from fastapi import APIRouter, Depends, HTTPException
from database import query, query_one, execute, insert
from auth import get_current_user
from typing import Optional
from pydantic import BaseModel

router = APIRouter(prefix="/api/bancos", tags=["Bancos"])


# -- Cuentas bancarias --------------------------------------------------------

@router.get("/cuentas")
def get_cuentas(u=Depends(get_current_user)):
    return query("""
        SELECT cb.*, sb.nombre as banco, sb.codigo as banco_codigo
        FROM fin_cuentas_bancarias cb
        LEFT JOIN sys_bancos sb ON sb.id = cb.banco_id
        WHERE cb.activa=true
        ORDER BY sb.nombre, cb.nombre
    """)

@router.get("/lista")
def get_bancos_lista(u=Depends(get_current_user)):
    return query("SELECT * FROM sys_bancos WHERE activo=true ORDER BY nombre")


class CuentaIn(BaseModel):
    banco_id:       int
    nombre:         str
    numero:         Optional[str] = None
    tipo:           str   = "CORRIENTE"
    saldo_inicial:  float = 0

@router.post("/cuentas")
def crear_cuenta(c: CuentaIn, u=Depends(get_current_user)):
    cid = insert("""
        INSERT INTO fin_cuentas_bancarias
            (banco_id, nombre, numero, tipo, saldo_inicial, saldo_actual)
        VALUES (%s,%s,%s,%s,%s,%s)
    """, (c.banco_id, c.nombre, c.numero, c.tipo, c.saldo_inicial, c.saldo_inicial))
    return {"id": cid, "msg": "Cuenta creada"}

@router.put("/cuentas/{cid}")
def editar_cuenta(cid: int, c: CuentaIn, u=Depends(get_current_user)):
    execute("""
        UPDATE fin_cuentas_bancarias
        SET banco_id=%s, nombre=%s, numero=%s, tipo=%s, saldo_inicial=%s
        WHERE id=%s
    """, (c.banco_id, c.nombre, c.numero, c.tipo, c.saldo_inicial, cid))
    return {"msg": "Cuenta actualizada"}

@router.delete("/cuentas/{cid}")
def eliminar_cuenta(cid: int, u=Depends(get_current_user)):
    tiene = query_one("SELECT id FROM fin_movimientos_bancarios WHERE cuenta_id=%s LIMIT 1",(cid,))
    if tiene: raise HTTPException(400,"Cuenta con movimientos no se puede eliminar")
    execute("UPDATE fin_cuentas_bancarias SET activa=false WHERE id=%s",(cid,))
    return {"msg":"Cuenta eliminada"}


# -- Movimientos bancarios ----------------------------------------------------

@router.get("/movimientos")
def get_movimientos(
    cuenta_id:  Optional[int] = None,
    fecha_ini:  Optional[str] = None,
    fecha_fin:  Optional[str] = None,
    tipo:       Optional[str] = None,
    estado:     Optional[str] = None,
    u=Depends(get_current_user)
):
    suc_id = u.get("sucursal_id")
    conds  = ["1=1"]
    params = []
    if cuenta_id: conds.append("m.cuenta_id=%s");  params.append(cuenta_id)
    if fecha_ini: conds.append("m.fecha>=%s");      params.append(fecha_ini)
    if fecha_fin: conds.append("m.fecha<=%s");      params.append(fecha_fin)
    if tipo:      conds.append("m.tipo=%s");        params.append(tipo)
    if estado:    conds.append("m.estado=%s");      params.append(estado)
    where = "WHERE " + " AND ".join(conds)
    return query(f"""
        SELECT m.*,
               sb.nombre as banco, cb.numero as numero_cuenta, cb.nombre as cuenta_nombre,
               u.nombre as usuario_nombre,
               (SELECT COUNT(*) FROM fin_lote_transacciones WHERE movimiento_id=m.id) as num_transacciones,
               (SELECT COUNT(*) FROM fin_lote_transacciones
                WHERE movimiento_id=m.id AND conciliada=true) as num_conciliadas
        FROM fin_movimientos_bancarios m
        JOIN fin_cuentas_bancarias cb ON cb.id = m.cuenta_id
        LEFT JOIN sys_bancos sb        ON sb.id = cb.banco_id
        LEFT JOIN sys_usuarios u       ON u.id  = m.usuario_id
        {where}
        ORDER BY m.fecha DESC, m.id DESC
        LIMIT 200
    """, params)


class LoteTransIn(BaseModel):
    voucher:     Optional[str] = None
    tarjeta_tipo:Optional[str] = None
    monto:       float
    observaciones:Optional[str] = None

class MovBancarioIn(BaseModel):
    cuenta_id:      int
    tipo:           str   # DEPOSITO_EFECTIVO, LOTE_TARJETA, TRANSFERENCIA_RECIBIDA, PAGO_PROVEEDOR, OTRO
    concepto:       str
    monto:          float
    fecha:          str
    referencia:     Optional[str] = None
    banco_origen:   Optional[str] = None
    observaciones:  Optional[str] = None
    sesion_caja_id: Optional[int] = None
    transacciones:  list = []  # solo para LOTE_TARJETA

@router.post("/movimientos")
def crear_movimiento(m: MovBancarioIn, u=Depends(get_current_user)):
    suc_id = u.get("sucursal_id")
    mid = insert("""
        INSERT INTO fin_movimientos_bancarios
            (cuenta_id, tipo, concepto, monto, fecha, referencia,
             banco_origen, estado, sesion_caja_id, usuario_id,
             observaciones)
        VALUES (%s,%s,%s,%s,%s,%s,%s,'PENDIENTE',%s,%s,%s)
    """, (m.cuenta_id, m.tipo, m.concepto, m.monto, m.fecha,
          m.referencia, m.banco_origen, m.sesion_caja_id,
          u["id"], m.observaciones))

    # Insertar transacciones de lote
    for t in m.transacciones:
        insert("""
            INSERT INTO fin_lote_transacciones
                (movimiento_id, voucher, tarjeta_tipo, monto, observaciones)
            VALUES (%s,%s,%s,%s,%s)
        """, (mid, t.get("voucher"), t.get("tarjeta_tipo"),
              float(t["monto"]), t.get("observaciones")))

    return {"id": mid, "msg": "Movimiento registrado"}


@router.patch("/movimientos/{mid}/conciliar")
def conciliar_movimiento(mid: int, u=Depends(get_current_user)):
    execute("UPDATE fin_movimientos_bancarios SET estado='CONCILIADO' WHERE id=%s",(mid,))
    return {"msg": "Movimiento conciliado"}


@router.get("/movimientos/{mid}/transacciones")
def get_transacciones_lote(mid: int, u=Depends(get_current_user)):
    return query("""
        SELECT * FROM fin_lote_transacciones
        WHERE movimiento_id=%s ORDER BY id
    """, (mid,))


@router.patch("/lote/{tid}/conciliar")
def conciliar_transaccion(tid: int, u=Depends(get_current_user)):
    execute("UPDATE fin_lote_transacciones SET conciliada=true WHERE id=%s",(tid,))
    # Si todas las transacciones del movimiento estan conciliadas, conciliar el movimiento
    t = query_one("SELECT movimiento_id FROM fin_lote_transacciones WHERE id=%s",(tid,))
    if t:
        pendientes = query_one("""
            SELECT COUNT(*) as n FROM fin_lote_transacciones
            WHERE movimiento_id=%s AND conciliada=false
        """, (t["movimiento_id"],))
        if int(pendientes["n"]) == 0:
            execute("UPDATE fin_movimientos_bancarios SET estado='CONCILIADO' WHERE id=%s",
                    (t["movimiento_id"],))
    return {"msg": "Transaccion conciliada"}


@router.patch("/lote/{tid}/desconciliar")
def desconciliar_transaccion(tid: int, u=Depends(get_current_user)):
    execute("UPDATE fin_lote_transacciones SET conciliada=false WHERE id=%s",(tid,))
    t = query_one("SELECT movimiento_id FROM fin_lote_transacciones WHERE id=%s",(tid,))
    if t:
        execute("UPDATE fin_movimientos_bancarios SET estado='PENDIENTE' WHERE id=%s",
                (t["movimiento_id"],))
    return {"msg": "Desconciliada"}


@router.get("/resumen")
def resumen_bancario(u=Depends(get_current_user)):
    suc_id = u.get("sucursal_id")
    return query_one("""
        SELECT
            (SELECT COUNT(*) FROM fin_cuentas_bancarias WHERE activa=true) as cuentas,
            COALESCE(SUM(CASE WHEN m.tipo IN ('DEPOSITO','DEPOSITO_EFECTIVO','LOTE_TARJETA',
                'TRANSFERENCIA_RECIBIDA')
                THEN m.monto ELSE 0 END),0) as total_ingresos,
            COALESCE(SUM(CASE WHEN m.tipo IN ('PAGO_PROVEEDOR','OTRO')
                THEN m.monto ELSE 0 END),0) as total_egresos,
            COUNT(CASE WHEN m.estado='PENDIENTE' THEN 1 END) as pendientes
        FROM fin_movimientos_bancarios m
    """)
