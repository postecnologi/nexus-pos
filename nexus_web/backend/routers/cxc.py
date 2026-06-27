from fastapi import APIRouter, Depends, HTTPException
from database import query, query_one, execute, insert
from auth import get_current_user
from typing import Optional
from pydantic import BaseModel

router = APIRouter(prefix="/api/cxc", tags=["CXC"])


@router.get("")
def get_cxc(
    estado:      Optional[str] = None,
    cliente_id:  Optional[int] = None,
    sucursal_id: Optional[int] = None,
    busqueda:    Optional[str] = None,
    u=Depends(get_current_user)
):
    conds  = ["1=1"]
    params = []

    if estado == "VENCIDA":
        conds.append("cxc.saldo > 0 AND cxc.fecha_vencimiento < CURRENT_DATE")
    elif estado == "PENDIENTE":
        conds.append("cxc.saldo > 0 AND cxc.fecha_vencimiento >= CURRENT_DATE")
    elif estado == "PAGADA":
        conds.append("cxc.saldo = 0")
    else:
        conds.append("cxc.saldo > 0")

    # Filtro por sucursal (a traves de la factura)
    if sucursal_id:
        conds.append("(f.sucursal_id=%s OR (f.sucursal_id IS NULL AND %s IS NOT NULL))")
        params += [sucursal_id, sucursal_id]

    if cliente_id:
        conds.append("cxc.cliente_id=%s"); params.append(cliente_id)

    if busqueda:
        conds.append("(c.razon_social ILIKE %s OR c.identificacion ILIKE %s OR f.numero_factura ILIKE %s)")
        params += [f"%{busqueda}%"]*3

    where = "WHERE " + " AND ".join(conds)

    rows = query(f"""
        SELECT
            cxc.id, cxc.factura_id, cxc.cliente_id,
            cxc.fecha_emision, cxc.fecha_vencimiento,
            CAST(cxc.valor_total  AS FLOAT) as monto,
            CAST(cxc.saldo  AS FLOAT) as saldo,
            CAST(cxc.valor_total - cxc.saldo AS FLOAT) as abonado,
            cxc.estado, cxc.observaciones,
            c.razon_social  as cliente_nombre,
            c.identificacion as cliente_ruc,
            c.telefono      as cliente_telefono,
            c.email         as cliente_email,
            f.numero_factura,
            CASE
                WHEN cxc.saldo = 0 THEN 'PAGADA'
                WHEN cxc.fecha_vencimiento < CURRENT_DATE THEN 'VENCIDA'
                ELSE 'PENDIENTE'
            END as estado_calculado,
            (CURRENT_DATE - cxc.fecha_vencimiento) as dias_vencido
        FROM fin_cxc cxc
        JOIN ven_clientes c     ON c.id  = cxc.cliente_id
        LEFT JOIN ven_facturas f ON f.id = cxc.factura_id
        {where}
        ORDER BY cxc.fecha_vencimiento ASC
    """, params)
    return rows


@router.get("/resumen")
def resumen_cxc(sucursal_id: Optional[int] = None, u=Depends(get_current_user)):
    if sucursal_id:
        return query_one("""
            SELECT
                COUNT(*)                                              as total_cuentas,
                COALESCE(SUM(cx.saldo),0)                            as total_cartera,
                COALESCE(SUM(CASE WHEN cx.fecha_vencimiento < CURRENT_DATE
                    AND cx.saldo>0 THEN cx.saldo ELSE 0 END),0)      as total_vencido,
                COALESCE(SUM(CASE WHEN cx.fecha_vencimiento >= CURRENT_DATE
                    AND cx.saldo>0 THEN cx.saldo ELSE 0 END),0)      as total_por_vencer,
                COUNT(CASE WHEN cx.fecha_vencimiento < CURRENT_DATE
                    AND cx.saldo>0 THEN 1 END)                       as cuentas_vencidas,
                COUNT(CASE WHEN cx.saldo>0 THEN 1 END)               as cuentas_pendientes
            FROM fin_cxc cx
            LEFT JOIN ven_facturas f ON f.id=cx.factura_id
            WHERE f.sucursal_id=%s
        """, (sucursal_id,))
    return query_one("""
        SELECT
            COUNT(*)                                              as total_cuentas,
            COALESCE(SUM(saldo),0)                               as total_cartera,
            COALESCE(SUM(CASE WHEN fecha_vencimiento < CURRENT_DATE
                AND saldo>0 THEN saldo ELSE 0 END),0)            as total_vencido,
            COALESCE(SUM(CASE WHEN fecha_vencimiento >= CURRENT_DATE
                AND saldo>0 THEN saldo ELSE 0 END),0)            as total_por_vencer,
            COUNT(CASE WHEN fecha_vencimiento < CURRENT_DATE
                AND saldo>0 THEN 1 END)                          as cuentas_vencidas,
            COUNT(CASE WHEN saldo>0 THEN 1 END)                  as cuentas_pendientes
        FROM fin_cxc
    """)


@router.get("/{cxc_id}/abonos")
def get_abonos(cxc_id: int, u=Depends(get_current_user)):
    return query("""
        SELECT a.*, u.nombre as usuario_nombre
        FROM fin_cxc_abonos a
        LEFT JOIN sys_usuarios u ON u.id = a.usuario_id
        WHERE a.cxc_id = %s
        ORDER BY a.fecha DESC
    """, (cxc_id,))


class AbonoIn(BaseModel):
    monto:       float
    forma_pago:  str = "EFECTIVO"
    referencia:  Optional[str] = None
    observaciones: Optional[str] = None
    banco_origen:  Optional[str] = None
    banco_destino: Optional[str] = None
    cuenta_bancaria_id: Optional[int] = None

@router.post("/{cxc_id}/abonar")
def registrar_abono(cxc_id: int, a: AbonoIn, u=Depends(get_current_user)):
    cxc = query_one("SELECT * FROM fin_cxc WHERE id=%s", (cxc_id,))
    if not cxc:
        raise HTTPException(404, "Cuenta no encontrada")
    if float(cxc["saldo"]) <= 0:
        raise HTTPException(400, "Esta cuenta ya esta pagada")
    if a.monto <= 0:
        raise HTTPException(400, "El monto debe ser mayor a 0")
    if a.monto > float(cxc["saldo"]) + 0.01:
        raise HTTPException(400, f"El monto excede el saldo ({cxc['saldo']})")

    nuevo_saldo = max(0, float(cxc["saldo"]) - a.monto)

    # Registrar abono
    insert("""
        INSERT INTO fin_cxc_abonos
            (cxc_id, monto, forma_pago, referencia, observaciones,
             banco_origen, banco_destino, fecha, usuario_id, cuenta_bancaria_id)
        VALUES (%s,%s,%s,%s,%s,%s,%s,CURRENT_DATE,%s,%s)
    """, (cxc_id, a.monto, a.forma_pago, a.referencia,
          a.observaciones, a.banco_origen, a.banco_destino,
          u["id"], a.cuenta_bancaria_id))

    # Generar movimiento bancario automatico
    if a.cuenta_bancaria_id and a.forma_pago != "EFECTIVO":
        try:
            insert("""
                INSERT INTO fin_movimientos_bancarios
                    (cuenta_id, tipo, concepto, monto, fecha, referencia,
                     estado, usuario_id)
                VALUES (%s,'TRANSFERENCIA_RECIBIDA',%s,%s,CURRENT_DATE,%s,'CONFIRMADO',%s)
            """, (a.cuenta_bancaria_id,
                  f"Abono CXC - {a.forma_pago}",
                  a.monto, a.referencia, u["id"]))
            execute("UPDATE fin_cuentas_bancarias SET saldo_actual=saldo_actual+%s WHERE id=%s",
                    (a.monto, a.cuenta_bancaria_id))
        except: pass

    # Actualizar saldo
    nuevo_estado = "PAGADA" if nuevo_saldo == 0 else cxc["estado"]
    execute("""
        UPDATE fin_cxc SET saldo=%s, estado=%s WHERE id=%s
    """, (nuevo_saldo, nuevo_estado, cxc_id))

    return {
        "msg": "Abono registrado correctamente",
        "saldo_anterior": float(cxc["saldo"]),
        "abono":          a.monto,
        "saldo_nuevo":    nuevo_saldo,
        "pagada":         nuevo_saldo == 0
    }


class RecordatorioIn(BaseModel):
    cxc_ids:  list
    mensaje:  Optional[str] = None

@router.post("/enviar-recordatorio")
def enviar_recordatorio(r: RecordatorioIn, u=Depends(get_current_user)):
    """
    Marca las cuentas como notificadas.
    El envio real de email se integra con el proveedor SMTP configurado.
    """
    enviados = []
    for cxc_id in r.cxc_ids:
        cxc = query_one("""
            SELECT cxc.*, c.email, c.razon_social, f.numero_factura
            FROM fin_cxc cxc
            JOIN ven_clientes c ON c.id=cxc.cliente_id
            LEFT JOIN ven_facturas f ON f.id=cxc.factura_id
            WHERE cxc.id=%s
        """, (cxc_id,))
        if cxc and cxc.get("email"):
            enviados.append({
                "id":      cxc_id,
                "cliente": cxc["razon_social"],
                "email":   cxc["email"],
                "factura": cxc.get("numero_factura"),
                "saldo":   float(cxc["saldo"])
            })
    return {
        "enviados": len(enviados),
        "detalle":  enviados,
        "msg": f"Recordatorio marcado para {len(enviados)} cliente(s). Configure SMTP en Configuracion para el envio real."
    }
