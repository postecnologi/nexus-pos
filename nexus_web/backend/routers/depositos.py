"""
Depositos Bancarios — Liquidacion de cobros
Gestiona la transicion de pagos (efectivo, voucher, transferencia) hacia el banco.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from database import query, query_one, execute, insert
from auth import get_current_user
from datetime import date

router = APIRouter(prefix="/api/depositos", tags=["Depositos"])


@router.get("/pendientes")
def cobros_pendientes(metodo: Optional[str] = None, u=Depends(get_current_user)):
    """Get all payments pending deposit, grouped by payment method."""
    conds = ["p.pendiente_deposito = true"]
    params = []
    if metodo:
        conds.append("p.forma_pago = %s")
        params.append(metodo)

    where = " AND ".join(conds)
    pagos = query(f"""
        SELECT p.id, p.factura_id, p.forma_pago, p.monto, p.referencia,
               p.fecha, p.banco_tarjeta, p.banco_origen,
               f.numero_factura, c.razon_social as cliente
        FROM ven_pagos p
        JOIN ven_facturas f ON f.id = p.factura_id
        LEFT JOIN ven_clientes c ON c.id = f.cliente_id
        WHERE {where}
        ORDER BY p.forma_pago, p.fecha
    """, params)

    resumen = {}
    for p in pagos:
        fp = p["forma_pago"]
        if fp not in resumen:
            resumen[fp] = {"metodo": fp, "cantidad": 0, "total": 0, "pagos": []}
        resumen[fp]["cantidad"] += 1
        resumen[fp]["total"] += float(p["monto"])
        resumen[fp]["pagos"].append(p)

    return {
        "total_pendiente": sum(r["total"] for r in resumen.values()),
        "total_transacciones": sum(r["cantidad"] for r in resumen.values()),
        "por_metodo": list(resumen.values()),
        "pagos": pagos,
    }


class CrearDeposito(BaseModel):
    cuenta_bancaria_id: int
    pago_ids: List[int]
    referencia: str = ""
    observaciones: str = ""
    fecha_deposito: Optional[str] = None

@router.post("")
def crear_deposito(data: CrearDeposito, u=Depends(get_current_user)):
    """Create a deposit batch from selected payments."""
    if not data.pago_ids:
        raise HTTPException(400, "Debe seleccionar al menos un pago")

    placeholders = ",".join(["%s"] * len(data.pago_ids))
    pagos = query(f"""
        SELECT id, monto, forma_pago FROM ven_pagos
        WHERE id IN ({placeholders}) AND pendiente_deposito = true
    """, data.pago_ids)

    if not pagos:
        raise HTTPException(400, "No se encontraron pagos pendientes")

    total = sum(float(p["monto"]) for p in pagos)
    metodos = list(set(p["forma_pago"] for p in pagos))
    from fecha_validator import validar_fecha
    fecha_dep = validar_fecha(data.fecha_deposito, "fecha de deposito")

    dep_id = insert("""
        INSERT INTO fin_depositos
            (cuenta_bancaria_id, fecha, total, cantidad_pagos, metodos_pago,
             referencia, observaciones, estado, usuario_id)
        VALUES (%s, %s, %s, %s, %s, %s, %s, 'PENDIENTE', %s)
    """, (data.cuenta_bancaria_id, fecha_dep, round(total, 2), len(pagos),
          ",".join(metodos), data.referencia, data.observaciones, u["id"]))

    for p in pagos:
        execute("""
            UPDATE ven_pagos SET pendiente_deposito = false, liquidacion_id = %s
            WHERE id = %s
        """, (dep_id, p["id"]))

    execute("""
        INSERT INTO fin_deposito_pagos (deposito_id, pago_id, monto)
        SELECT %s, id, monto FROM ven_pagos WHERE id IN ({})
    """.format(placeholders), [dep_id] + data.pago_ids)

    return {"id": dep_id, "total": round(total, 2), "cantidad": len(pagos), "msg": "Deposito creado"}


@router.get("")
def listar_depositos(estado: Optional[str] = None, u=Depends(get_current_user)):
    conds = ["1=1"]
    params = []
    if estado:
        conds.append("d.estado = %s")
        params.append(estado)
    where = " AND ".join(conds)
    return query(f"""
        SELECT d.*, cb.nombre as cuenta_nombre, cb.numero as numero_cuenta,
               b.nombre as banco_nombre, u.nombre as usuario_nombre
        FROM fin_depositos d
        LEFT JOIN fin_cuentas_bancarias cb ON cb.id = d.cuenta_bancaria_id
        LEFT JOIN sys_bancos b ON b.id = cb.banco_id
        LEFT JOIN sys_usuarios u ON u.id = d.usuario_id
        WHERE {where}
        ORDER BY d.fecha DESC, d.id DESC
    """, params)


@router.get("/{did}")
def detalle_deposito(did: int, u=Depends(get_current_user)):
    dep = query_one("""
        SELECT d.*, cb.nombre as cuenta_nombre, cb.numero as numero_cuenta,
               b.nombre as banco_nombre
        FROM fin_depositos d
        LEFT JOIN fin_cuentas_bancarias cb ON cb.id = d.cuenta_bancaria_id
        LEFT JOIN sys_bancos b ON b.id = cb.banco_id
        WHERE d.id = %s
    """, (did,))
    if not dep:
        raise HTTPException(404, "Deposito no encontrado")

    dep["pagos"] = query("""
        SELECT dp.*, p.forma_pago, p.referencia as pago_referencia, p.fecha as pago_fecha,
               f.numero_factura, c.razon_social as cliente
        FROM fin_deposito_pagos dp
        JOIN ven_pagos p ON p.id = dp.pago_id
        JOIN ven_facturas f ON f.id = p.factura_id
        LEFT JOIN ven_clientes c ON c.id = f.cliente_id
        WHERE dp.deposito_id = %s
        ORDER BY p.fecha
    """, (did,))

    return dep


@router.post("/{did}/confirmar")
def confirmar_deposito(did: int, referencia_banco: str = "", u=Depends(get_current_user)):
    """Confirm deposit was made at the bank. Creates bank movement."""
    dep = query_one("SELECT * FROM fin_depositos WHERE id=%s", (did,))
    if not dep:
        raise HTTPException(404, "Deposito no encontrado")
    if dep["estado"] == "CONFIRMADO":
        raise HTTPException(400, "Este deposito ya fue confirmado")

    execute("""
        UPDATE fin_depositos SET estado='CONFIRMADO', referencia=%s, fecha_confirmacion=NOW()
        WHERE id=%s
    """, (referencia_banco or dep.get("referencia", ""), did))

    ref = referencia_banco or dep.get("referencia", "")
    try:
        insert("""
            INSERT INTO fin_movimientos_bancarios
                (cuenta_id, tipo, concepto, monto, fecha, referencia, estado, usuario_id)
            VALUES (%s, 'DEPOSITO', %s, %s, %s, %s, 'CONFIRMADO', %s)
        """, (dep["cuenta_bancaria_id"],
              f"Deposito #{did} - {dep.get('metodos_pago','')}",
              dep["total"], dep["fecha"], ref, u["id"]))
    except Exception:
        pass

    # Update bank account balance
    try:
        execute("""
            UPDATE fin_cuentas_bancarias SET saldo_actual = saldo_actual + %s
            WHERE id = %s
        """, (dep["total"], dep["cuenta_bancaria_id"]))
    except Exception:
        pass

    return {"msg": "Deposito confirmado y registrado en banco"}


@router.post("/{did}/anular")
def anular_deposito(did: int, u=Depends(get_current_user)):
    """Cancel a deposit and return payments to pending status."""
    dep = query_one("SELECT * FROM fin_depositos WHERE id=%s", (did,))
    if not dep:
        raise HTTPException(404)
    if dep["estado"] == "CONFIRMADO":
        raise HTTPException(400, "No se puede anular un deposito confirmado")

    pagos = query("SELECT pago_id FROM fin_deposito_pagos WHERE deposito_id=%s", (did,))
    for p in pagos:
        execute("UPDATE ven_pagos SET pendiente_deposito=true, liquidacion_id=NULL WHERE id=%s", (p["pago_id"],))

    execute("DELETE FROM fin_deposito_pagos WHERE deposito_id=%s", (did,))
    execute("DELETE FROM fin_depositos WHERE id=%s", (did,))

    return {"msg": "Deposito anulado, pagos devueltos a pendientes"}


@router.get("/resumen/general")
def resumen_depositos(u=Depends(get_current_user)):
    pendientes = query_one("""
        SELECT COUNT(*) as cantidad, COALESCE(SUM(monto),0) as total
        FROM ven_pagos WHERE pendiente_deposito = true
    """)
    depositos_pend = query_one("""
        SELECT COUNT(*) as cantidad, COALESCE(SUM(total),0) as total
        FROM fin_depositos WHERE estado = 'PENDIENTE'
    """)
    depositos_conf = query_one("""
        SELECT COUNT(*) as cantidad, COALESCE(SUM(total),0) as total
        FROM fin_depositos WHERE estado = 'CONFIRMADO'
        AND fecha >= date_trunc('month', CURRENT_DATE)
    """)
    return {
        "pagos_sin_depositar": pendientes,
        "depositos_pendientes": depositos_pend,
        "depositos_mes": depositos_conf,
    }
