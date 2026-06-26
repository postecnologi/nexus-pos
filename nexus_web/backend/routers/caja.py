from fastapi import APIRouter, Depends, HTTPException
from database import query, query_one, execute, insert
from auth import get_current_user
from typing import Optional
from pydantic import BaseModel

router = APIRouter(prefix="/api", tags=["Caja"])


@router.delete("/cajas/{caja_id}")
def eliminar_caja(caja_id: int, u=Depends(get_current_user)):
    tiene_sesiones = query_one(
        "SELECT id FROM caj_sesiones WHERE caja_id=%s LIMIT 1", (caja_id,))
    if tiene_sesiones:
        raise HTTPException(400, "No se puede eliminar una caja con historial de sesiones")
    execute("DELETE FROM caj_cajas WHERE id=%s", (caja_id,))
    return {"msg": "Caja eliminada"}


@router.get("/caja/verificar-abierta")
def verificar_caja_abierta(u=Depends(get_current_user)):
    """Verifica si el usuario tiene una caja abierta en su sucursal"""
    suc_id = u.get("sucursal_id")
    sesion = query_one("""
        SELECT cs.id, cs.caja_id, c.nombre as caja_nombre
        FROM caj_sesiones cs
        JOIN caj_cajas c ON c.id = cs.caja_id
        WHERE c.sucursal_id=%s AND cs.estado='ABIERTA'
        LIMIT 1
    """, (suc_id,))
    return {"abierta": bool(sesion), "sesion": sesion}

@router.get("/cajas")
def get_cajas(u=Depends(get_current_user)):
    suc_id = u.get("sucursal_id")
    return query("""
        SELECT c.*, s.nombre as sucursal_nombre,
               us.nombre as usuario_nombre,
               (SELECT id FROM caj_sesiones
                WHERE caja_id=c.id AND estado='ABIERTA'
                LIMIT 1) as sesion_activa_id
        FROM caj_cajas c
        JOIN sys_sucursales s  ON s.id = c.sucursal_id
        LEFT JOIN sys_usuarios us ON us.id = c.usuario_id
        WHERE c.activa=true AND c.sucursal_id=%s
        ORDER BY c.tipo, c.nombre
    """, (suc_id,))


class CajaIn(BaseModel):
    nombre:     str
    tipo:       str = "SUCURSAL"   # SUCURSAL, PERSONAL
    usuario_id: Optional[int] = None

@router.post("/cajas")
def crear_caja(c: CajaIn, u=Depends(get_current_user)):
    suc_id = u.get("sucursal_id")
    cid = insert("""
        INSERT INTO caj_cajas (nombre, sucursal_id, usuario_id, tipo)
        VALUES (%s,%s,%s,%s)
    """, (c.nombre, suc_id, c.usuario_id, c.tipo))
    return {"id": cid, "msg": "Caja creada"}


class AperturaIn(BaseModel):
    caja_id:        int
    monto_apertura: float = 0
    observaciones:  Optional[str] = None

@router.post("/caja/abrir")
def abrir_caja(a: AperturaIn, u=Depends(get_current_user)):
    # Verificar que no haya sesion abierta
    abierta = query_one("""
        SELECT id FROM caj_sesiones
        WHERE caja_id=%s AND estado='ABIERTA'
    """, (a.caja_id,))
    if abierta:
        raise HTTPException(400, "Esta caja ya tiene una sesion abierta")

    suc_id = u.get("sucursal_id")
    sid = insert("""
        INSERT INTO caj_sesiones
            (caja_id, usuario_id, sucursal_id, monto_apertura,
             fecha_apertura, estado)
        VALUES (%s,%s,%s,%s,NOW(),'ABIERTA')
    """, (a.caja_id, u["id"], suc_id, a.monto_apertura))

    return {"id": sid, "msg": "Caja abierta correctamente"}


@router.get("/caja/sesion-activa")
def sesion_activa(caja_id: int, u=Depends(get_current_user)):
    s = query_one("""
        SELECT cs.*, c.nombre as caja_nombre, c.tipo as caja_tipo
        FROM caj_sesiones cs
        JOIN caj_cajas c ON c.id = cs.caja_id
        WHERE cs.caja_id=%s AND cs.estado='ABIERTA'
        LIMIT 1
    """, (caja_id,))
    if not s:
        raise HTTPException(404, "No hay sesion abierta para esta caja")

    suc_id = s["sucursal_id"]
    fecha_ap = s["fecha_apertura"]

    # Ventas del periodo
    ventas = query_one("""
        SELECT
            COALESCE(SUM(CASE WHEN vp.forma_pago='EFECTIVO'      THEN vp.monto ELSE 0 END),0) as efectivo,
            COALESCE(SUM(CASE WHEN vp.forma_pago='TARJETA'       THEN vp.monto ELSE 0 END),0) as tarjeta,
            COALESCE(SUM(CASE WHEN vp.forma_pago='TRANSFERENCIA' THEN vp.monto ELSE 0 END),0) as transferencia,
            COALESCE(SUM(CASE WHEN vp.forma_pago='MEDIANET'      THEN vp.monto ELSE 0 END),0) as medianet,
            COALESCE(SUM(CASE WHEN vp.forma_pago='DEUNA'         THEN vp.monto ELSE 0 END),0) as deuna,
            COALESCE(SUM(CASE WHEN vp.forma_pago='CREDITO'       THEN vp.monto ELSE 0 END),0) as credito,
            COUNT(DISTINCT vf.id) as num_facturas,
            COALESCE(SUM(vf.total),0) as total_ventas
        FROM ven_facturas vf
        JOIN ven_pagos vp ON vp.factura_id = vf.id
        WHERE vf.sucursal_id=%s
          AND vf.fecha_emision >= DATE(%s)
          AND vf.estado='EMITIDA'
    """, (suc_id, fecha_ap))

    # Abonos CXC cobrados en el periodo
    cxc = query_one("""
        SELECT COALESCE(SUM(a.monto),0) as total_cobrado
        FROM fin_cxc_abonos a
        WHERE a.fecha >= DATE(%s)
          AND a.usuario_id = %s
    """, (fecha_ap, u["id"]))

    # Egresos manuales
    egresos = query_one("""
        SELECT COALESCE(SUM(monto),0) as total
        FROM caj_movimientos
        WHERE sesion_id=%s AND tipo='EGRESO'
    """, (s["id"],))

    # Movimientos detalle
    movimientos = query("""
        SELECT * FROM caj_movimientos
        WHERE sesion_id=%s ORDER BY fecha DESC
    """, (s["id"],))

    return {
        **dict(s),
        "ventas":            ventas,
        "cxc_cobrado":       float(cxc["total_cobrado"]),
        "egresos":           float(egresos["total"]),
        "movimientos":       movimientos,
    }


class MovimientoIn(BaseModel):
    sesion_id: int
    tipo:      str    # EGRESO, INGRESO
    concepto:  str
    monto:     float

@router.post("/caja/movimiento")
def registrar_movimiento(m: MovimientoIn, u=Depends(get_current_user)):
    insert("""
        INSERT INTO caj_movimientos (sesion_id, tipo, concepto, monto, usuario_id)
        VALUES (%s,%s,%s,%s,%s)
    """, (m.sesion_id, m.tipo, m.concepto, m.monto, u["id"]))
    return {"msg": "Movimiento registrado"}


class CierreIn(BaseModel):
    sesion_id:       int
    billetes_100:    int = 0
    billetes_50:     int = 0
    billetes_20:     int = 0
    billetes_10:     int = 0
    billetes_5:      int = 0
    billetes_1:      int = 0
    monedas_100:     int = 0
    monedas_50:      int = 0
    monedas_25:      int = 0
    monedas_10:      int = 0
    monedas_5:       int = 0
    monedas_1:       int = 0
    observaciones:   Optional[str] = None

@router.post("/caja/cerrar")
def cerrar_caja(c: CierreIn, u=Depends(get_current_user)):
    s = query_one("SELECT * FROM caj_sesiones WHERE id=%s AND estado='ABIERTA'",
                  (c.sesion_id,))
    if not s:
        raise HTTPException(404, "Sesion no encontrada o ya cerrada")

    suc_id = s["sucursal_id"]
    fecha_ap = s["fecha_apertura"]

    # Calcular total contado
    total_contado = (
        c.billetes_100 * 100 + c.billetes_50 * 50 +
        c.billetes_20  * 20  + c.billetes_10 * 10 +
        c.billetes_5   * 5   + c.billetes_1  * 1  +
        c.monedas_100  * 1.0 + c.monedas_50  * 0.50 +
        c.monedas_25   * 0.25 + c.monedas_10 * 0.10 +
        c.monedas_5    * 0.05 + c.monedas_1  * 0.01
    )

    # Totales del sistema
    ventas = query_one("""
        SELECT
            COALESCE(SUM(CASE WHEN vp.forma_pago='EFECTIVO'      THEN vp.monto ELSE 0 END),0) as efectivo,
            COALESCE(SUM(CASE WHEN vp.forma_pago='TARJETA'       THEN vp.monto ELSE 0 END),0) as tarjeta,
            COALESCE(SUM(CASE WHEN vp.forma_pago='TRANSFERENCIA' THEN vp.monto ELSE 0 END),0) as transferencia,
            COALESCE(SUM(CASE WHEN vp.forma_pago='MEDIANET'      THEN vp.monto ELSE 0 END),0) as medianet,
            COALESCE(SUM(CASE WHEN vp.forma_pago='DEUNA'         THEN vp.monto ELSE 0 END),0) as deuna,
            COALESCE(SUM(CASE WHEN vp.forma_pago='CREDITO'       THEN vp.monto ELSE 0 END),0) as credito
        FROM ven_facturas vf
        JOIN ven_pagos vp ON vp.factura_id = vf.id
        WHERE vf.sucursal_id=%s
          AND vf.fecha_emision >= DATE(%s)
          AND vf.estado='EMITIDA'
    """, (suc_id, fecha_ap))

    cxc = query_one("""
        SELECT COALESCE(SUM(a.monto),0) as total
        FROM fin_cxc_abonos a WHERE a.fecha >= DATE(%s) AND a.usuario_id=%s
    """, (fecha_ap, u["id"]))

    egresos = query_one("""
        SELECT COALESCE(SUM(monto),0) as total
        FROM caj_movimientos WHERE sesion_id=%s AND tipo='EGRESO'
    """, (s["id"],))

    ef_sis = float(ventas["efectivo"]) + float(cxc["total"]) - float(egresos["total"])
    diferencia = round(total_contado - ef_sis, 2)

    execute("""
        UPDATE caj_sesiones SET
            fecha_cierre=NOW(), estado='CERRADA',
            billetes_100=%s, billetes_50=%s, billetes_20=%s,
            billetes_10=%s,  billetes_5=%s,  billetes_1=%s,
            monedas_100=%s,  monedas_50=%s,  monedas_25=%s,
            monedas_10=%s,   monedas_5=%s,   monedas_1=%s,
            total_efectivo_sistema=%s, total_tarjeta_sistema=%s,
            total_transferencia_sistema=%s, total_medianet_sistema=%s,
            total_deuna_sistema=%s, total_credito_sistema=%s,
            total_cxc_cobrado=%s, total_egresos=%s,
            total_contado=%s, diferencia=%s, observaciones=%s
        WHERE id=%s
    """, (
        c.billetes_100, c.billetes_50, c.billetes_20,
        c.billetes_10,  c.billetes_5,  c.billetes_1,
        c.monedas_100,  c.monedas_50,  c.monedas_25,
        c.monedas_10,   c.monedas_5,   c.monedas_1,
        ventas["efectivo"], ventas["tarjeta"],
        ventas["transferencia"], ventas["medianet"],
        ventas["deuna"], ventas["credito"],
        cxc["total"], egresos["total"],
        round(total_contado, 2), diferencia, c.observaciones,
        c.sesion_id
    ))

    return {
        "msg":           "Caja cerrada correctamente",
        "total_contado": round(total_contado, 2),
        "efectivo_sis":  round(ef_sis, 2),
        "diferencia":    diferencia,
        "estado":        "SOBRANTE" if diferencia > 0 else "FALTANTE" if diferencia < 0 else "CUADRADO",
    }


@router.get("/caja/historial")
def historial_sesiones(caja_id: int, u=Depends(get_current_user)):
    return query("""
        SELECT cs.*, u.nombre as usuario_nombre
        FROM caj_sesiones cs
        LEFT JOIN sys_usuarios u ON u.id = cs.usuario_id
        WHERE cs.caja_id=%s
        ORDER BY cs.fecha_apertura DESC
        LIMIT 30
    """, (caja_id,))
