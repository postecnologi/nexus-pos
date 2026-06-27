from fastapi import APIRouter, Depends, HTTPException
from database import query, query_one, execute, insert
from auth import get_current_user
from typing import Optional
from pydantic import BaseModel

router = APIRouter(prefix="/api/cxp", tags=["CXP"])


@router.get("")
def get_cxp(
    busqueda:   Optional[str] = None,
    estado:     Optional[str] = None,
    u=Depends(get_current_user)
):
    conds  = ["cx.saldo > 0"]
    params = []
    if estado == "VENCIDA":
        conds.append("cx.fecha_vencimiento < CURRENT_DATE")
    elif estado == "PENDIENTE":
        conds.append("cx.fecha_vencimiento >= CURRENT_DATE")
    if busqueda:
        conds.append("(p.razon_social ILIKE %s OR p.identificacion ILIKE %s)")
        params += [f"%{busqueda}%"]*2
    where = "WHERE " + " AND ".join(conds)
    return query(f"""
        SELECT cx.*,
               p.razon_social as proveedor_nombre,
               p.identificacion as proveedor_ruc,
               comp.num_documento as numero_compra,
               comp.numero_factura_prov,
               cx.valor_total  as monto,
               cx.valor_pagado as pagado,
               CASE
                   WHEN cx.saldo=0 THEN 'PAGADA'
                   WHEN cx.fecha_vencimiento < CURRENT_DATE THEN 'VENCIDA'
                   ELSE 'PENDIENTE'
               END as estado_calculado,
               (CURRENT_DATE - cx.fecha_vencimiento) as dias_vencido
        FROM fin_cxp cx
        JOIN com_proveedores p  ON p.id = cx.proveedor_id
        LEFT JOIN com_compras comp ON comp.id = cx.compra_id
        {where}
        ORDER BY cx.fecha_vencimiento ASC
    """, params)


class PagoProvIn(BaseModel):
    monto:         float
    forma_pago:    str = "TRANSFERENCIA"
    referencia:    Optional[str] = None
    banco_origen:  Optional[str] = None
    banco_destino: Optional[str] = None
    observaciones: Optional[str] = None
    cuenta_bancaria_id: Optional[int] = None

@router.post("/{cxp_id}/pagar")
def pagar_cxp(cxp_id: int, p: PagoProvIn, u=Depends(get_current_user)):
    cxp = query_one("SELECT * FROM fin_cxp WHERE id=%s", (cxp_id,))
    if not cxp: raise HTTPException(404)
    if float(cxp["saldo"]) <= 0: raise HTTPException(400, "Ya esta pagada")
    if p.monto > float(cxp["saldo"]) + 0.01:
        raise HTTPException(400, f"Monto excede el saldo ({cxp['saldo']})")
    nuevo_saldo   = round(max(0, float(cxp["saldo"]) - p.monto), 2)
    nuevo_pagado  = round(float(cxp["valor_pagado"]) + p.monto, 2)
    nuevo_estado  = "PAGADA" if nuevo_saldo == 0 else "PARCIAL"
    insert("""
        INSERT INTO fin_cxp_pagos
            (cxp_id, monto, forma_pago, referencia, banco_origen,
             banco_destino, observaciones, fecha, usuario_id, cuenta_bancaria_id)
        VALUES (%s,%s,%s,%s,%s,%s,%s,CURRENT_DATE,%s,%s)
    """, (cxp_id, p.monto, p.forma_pago, p.referencia,
          p.banco_origen, p.banco_destino, p.observaciones,
          u["id"], p.cuenta_bancaria_id))

    # Generar movimiento bancario automatico (salida de dinero)
    if p.cuenta_bancaria_id:
        try:
            insert("""
                INSERT INTO fin_movimientos_bancarios
                    (cuenta_id, tipo, concepto, monto, fecha, referencia,
                     banco_origen, estado, usuario_id)
                VALUES (%s,'PAGO_PROVEEDOR',%s,%s,CURRENT_DATE,%s,%s,'CONFIRMADO',%s)
            """, (p.cuenta_bancaria_id,
                  f"Pago CXP - {p.forma_pago}",
                  p.monto, p.referencia, p.banco_origen, u["id"]))
            execute("UPDATE fin_cuentas_bancarias SET saldo_actual=saldo_actual-%s WHERE id=%s",
                    (p.monto, p.cuenta_bancaria_id))
        except: pass
    execute("""
        UPDATE fin_cxp SET saldo=%s, valor_pagado=%s, estado=%s WHERE id=%s
    """, (nuevo_saldo, nuevo_pagado, nuevo_estado, cxp_id))
    return {"msg": "Pago registrado", "saldo_nuevo": nuevo_saldo, "pagado": nuevo_pagado}


@router.get("/resumen")
def resumen_cxp(u=Depends(get_current_user)):
    return query_one("""
        SELECT
            COUNT(CASE WHEN saldo>0 THEN 1 END)                           as cuentas_pendientes,
            COALESCE(SUM(CASE WHEN saldo>0 THEN saldo ELSE 0 END),0)      as total_cartera,
            COALESCE(SUM(CASE WHEN fecha_vencimiento < CURRENT_DATE
                AND saldo>0 THEN saldo ELSE 0 END),0)                     as total_vencido,
            COALESCE(SUM(CASE WHEN fecha_vencimiento >= CURRENT_DATE
                AND saldo>0 THEN saldo ELSE 0 END),0)                     as total_por_vencer,
            COUNT(CASE WHEN fecha_vencimiento < CURRENT_DATE
                AND saldo>0 THEN 1 END)                                   as cuentas_vencidas,
            COALESCE(SUM(valor_total),0)                                  as total_monto
        FROM fin_cxp
    """)


@router.get("/{cxp_id}/pagos")
def historial_pagos_cxp(cxp_id: int, u=Depends(get_current_user)):
    return query("""
        SELECT p.*, u.nombre as usuario_nombre
        FROM fin_cxp_pagos p
        LEFT JOIN sys_usuarios u ON u.id = p.usuario_id
        WHERE p.cxp_id = %s
        ORDER BY p.fecha DESC, p.id DESC
    """, (cxp_id,))  # fin_cxp_pagos ya existe en la BD
