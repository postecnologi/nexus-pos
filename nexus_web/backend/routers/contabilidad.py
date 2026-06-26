"""
Router Contabilidad — Modulo contable basico Ecuador (NEC/NIIF)
Plan de cuentas, asientos contables, balance general, estado de resultados,
libro diario, libro mayor, balance de comprobacion, generacion automatica
de asientos, cierre de periodo.
"""
from fastapi import APIRouter, Depends, HTTPException
from database import query, query_one, execute, insert
from auth import get_current_user
from typing import Optional
from pydantic import BaseModel
from datetime import date
import calendar

router = APIRouter(prefix="/api/contabilidad", tags=["Contabilidad"])


# ═══════════════════════════════════════════════════════════
# CONFIGURACIÓN DE CUENTAS POR DEFECTO (Ecuador NEC/NIIF)
# ═══════════════════════════════════════════════════════════

CUENTAS_DEFAULT = {
    "caja": "1.1.01",
    "bancos": "1.1.02",
    "cxc": "1.1.03",
    "inventarios": "1.1.05",
    "iva_pagado": "1.1.06",
    "cxp": "2.1.01",
    "iva_cobrado": "2.1.02",
    "ret_por_pagar": "2.1.03",
    "ventas": "4.1",
    "costo_ventas": "5.1",
    "otros_ingresos": "4.2",
}


# ═══════════════════════════════════════════════════════════
# HELPER — Generación automática de asientos
# ═══════════════════════════════════════════════════════════

def crear_asiento_automatico(fecha, descripcion, tipo, referencia_tipo, referencia_id, lineas, usuario_id=None):
    """
    Creates a journal entry automatically from a transaction.
    lineas: [(cuenta_codigo, descripcion, debe, haber), ...]
    Uses account codes to find cuenta_id from cont_plan_cuentas.
    """
    max_num = query_one("SELECT COALESCE(MAX(id),0)+1 as n FROM cont_asientos")
    numero = f"AST-{str(max_num['n']).zfill(8)}"

    asiento_id = insert("""
        INSERT INTO cont_asientos (numero, fecha, descripcion, tipo, referencia_tipo, referencia_id, estado, usuario_id)
        VALUES (%s,%s,%s,%s,%s,%s,'APROBADO',%s)
    """, (numero, fecha, descripcion, tipo, referencia_tipo, referencia_id, usuario_id))

    for cuenta_codigo, desc_linea, debe, haber in lineas:
        cuenta = query_one("SELECT id FROM cont_plan_cuentas WHERE codigo=%s", (cuenta_codigo,))
        if cuenta:
            insert("""
                INSERT INTO cont_asiento_detalles (asiento_id, cuenta_id, descripcion, debe, haber)
                VALUES (%s,%s,%s,%s,%s)
            """, (asiento_id, cuenta["id"], desc_linea, debe, haber))

    return asiento_id


# ── Modelos ─────────────────────────────────────────────────
class CuentaIn(BaseModel):
    codigo: str
    nombre: str
    tipo: str          # ACTIVO, PASIVO, PATRIMONIO, INGRESO, GASTO, COSTO
    naturaleza: str    # DEUDORA, ACREEDORA
    padre_id: Optional[int] = None
    nivel: int = 1
    es_movimiento: bool = False
    activa: bool = True

class CuentaUpdate(BaseModel):
    nombre: Optional[str] = None
    tipo: Optional[str] = None
    naturaleza: Optional[str] = None
    padre_id: Optional[int] = None
    nivel: Optional[int] = None
    es_movimiento: Optional[bool] = None
    activa: Optional[bool] = None

class AsientoDetalleIn(BaseModel):
    cuenta_id: int
    descripcion: Optional[str] = None
    debe: float = 0
    haber: float = 0

class AsientoIn(BaseModel):
    fecha: Optional[str] = None
    descripcion: str
    tipo: Optional[str] = None  # DIARIO, APERTURA, CIERRE, AJUSTE, AUTOMATICO
    referencia_tipo: Optional[str] = None
    referencia_id: Optional[int] = None
    detalles: list  # List of AsientoDetalleIn dicts


# ═══════════════════════════════════════════════════════════
# PLAN DE CUENTAS
# ═══════════════════════════════════════════════════════════

@router.get("/plan-cuentas")
def get_plan_cuentas(u=Depends(get_current_user)):
    """Lista todas las cuentas ordenadas por codigo para formar arbol."""
    cuentas = query("""
        SELECT c.*,
               p.codigo AS padre_codigo,
               p.nombre AS padre_nombre
        FROM cont_plan_cuentas c
        LEFT JOIN cont_plan_cuentas p ON p.id = c.padre_id
        ORDER BY c.codigo
    """)
    return cuentas


@router.post("/plan-cuentas")
def crear_cuenta(body: CuentaIn, u=Depends(get_current_user)):
    # Verificar codigo unico
    existing = query_one(
        "SELECT id FROM cont_plan_cuentas WHERE codigo=%s", (body.codigo,))
    if existing:
        raise HTTPException(400, f"Ya existe una cuenta con codigo {body.codigo}")

    if body.padre_id:
        padre = query_one("SELECT id FROM cont_plan_cuentas WHERE id=%s", (body.padre_id,))
        if not padre:
            raise HTTPException(404, "Cuenta padre no encontrada")

    cid = insert("""
        INSERT INTO cont_plan_cuentas
            (codigo, nombre, tipo, naturaleza, padre_id, nivel, es_movimiento, activa)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    """, (
        body.codigo, body.nombre, body.tipo.upper(), body.naturaleza.upper(),
        body.padre_id, body.nivel, body.es_movimiento, body.activa,
    ))
    return {"id": cid, "msg": "Cuenta creada correctamente"}


@router.put("/plan-cuentas/{cid}")
def actualizar_cuenta(cid: int, body: CuentaUpdate, u=Depends(get_current_user)):
    cuenta = query_one("SELECT * FROM cont_plan_cuentas WHERE id=%s", (cid,))
    if not cuenta:
        raise HTTPException(404, "Cuenta no encontrada")

    updates = []
    params = []
    if body.nombre is not None:
        updates.append("nombre=%s")
        params.append(body.nombre)
    if body.tipo is not None:
        updates.append("tipo=%s")
        params.append(body.tipo.upper())
    if body.naturaleza is not None:
        updates.append("naturaleza=%s")
        params.append(body.naturaleza.upper())
    if body.padre_id is not None:
        updates.append("padre_id=%s")
        params.append(body.padre_id)
    if body.nivel is not None:
        updates.append("nivel=%s")
        params.append(body.nivel)
    if body.es_movimiento is not None:
        updates.append("es_movimiento=%s")
        params.append(body.es_movimiento)
    if body.activa is not None:
        updates.append("activa=%s")
        params.append(body.activa)

    if not updates:
        return {"msg": "Sin cambios"}

    params.append(cid)
    execute(f"UPDATE cont_plan_cuentas SET {', '.join(updates)} WHERE id=%s", params)
    return {"msg": "Cuenta actualizada correctamente"}


@router.post("/plan-cuentas/inicializar")
def inicializar_plan_cuentas(u=Depends(get_current_user)):
    """Inicializa el plan de cuentas con la estructura basica Ecuador NEC/NIIF."""
    existing = query_one("SELECT COUNT(*) AS n FROM cont_plan_cuentas")
    if existing and existing["n"] > 0:
        raise HTTPException(400, "El plan de cuentas ya tiene datos. Elimine las cuentas existentes primero.")

    # Estructura: (codigo, nombre, tipo, naturaleza, nivel, es_movimiento, padre_codigo)
    cuentas = [
        # 1. ACTIVO
        ("1",       "ACTIVO",                       "ACTIVO",      "DEUDORA",   1, False, None),
        ("1.1",     "ACTIVO CORRIENTE",             "ACTIVO",      "DEUDORA",   2, False, "1"),
        ("1.1.01",  "Caja",                         "ACTIVO",      "DEUDORA",   3, True,  "1.1"),
        ("1.1.02",  "Bancos",                       "ACTIVO",      "DEUDORA",   3, True,  "1.1"),
        ("1.1.03",  "Cuentas por Cobrar",           "ACTIVO",      "DEUDORA",   3, True,  "1.1"),
        ("1.1.05",  "Inventarios",                  "ACTIVO",      "DEUDORA",   3, True,  "1.1"),
        ("1.1.06",  "IVA Pagado",                   "ACTIVO",      "DEUDORA",   3, True,  "1.1"),
        ("1.2",     "ACTIVO NO CORRIENTE",          "ACTIVO",      "DEUDORA",   2, False, "1"),
        ("1.2.01",  "Propiedad Planta y Equipo",    "ACTIVO",      "DEUDORA",   3, True,  "1.2"),

        # 2. PASIVO
        ("2",       "PASIVO",                       "PASIVO",      "ACREEDORA", 1, False, None),
        ("2.1",     "PASIVO CORRIENTE",             "PASIVO",      "ACREEDORA", 2, False, "2"),
        ("2.1.01",  "Cuentas por Pagar",            "PASIVO",      "ACREEDORA", 3, True,  "2.1"),
        ("2.1.02",  "IVA Cobrado",                  "PASIVO",      "ACREEDORA", 3, True,  "2.1"),
        ("2.1.03",  "Retenciones por Pagar",        "PASIVO",      "ACREEDORA", 3, True,  "2.1"),
        ("2.1.04",  "IESS por Pagar",               "PASIVO",      "ACREEDORA", 3, True,  "2.1"),
        ("2.1.05",  "Sueldos por Pagar",            "PASIVO",      "ACREEDORA", 3, True,  "2.1"),

        # 3. PATRIMONIO
        ("3",       "PATRIMONIO",                   "PATRIMONIO",  "ACREEDORA", 1, False, None),
        ("3.1",     "Capital",                      "PATRIMONIO",  "ACREEDORA", 2, True,  "3"),
        ("3.2",     "Resultados Acumulados",        "PATRIMONIO",  "ACREEDORA", 2, True,  "3"),
        ("3.3",     "Resultado del Ejercicio",      "PATRIMONIO",  "ACREEDORA", 2, True,  "3"),

        # 4. INGRESOS
        ("4",       "INGRESOS",                     "INGRESO",     "ACREEDORA", 1, False, None),
        ("4.1",     "Ventas",                       "INGRESO",     "ACREEDORA", 2, True,  "4"),
        ("4.2",     "Otros Ingresos",               "INGRESO",     "ACREEDORA", 2, True,  "4"),

        # 5. COSTOS
        ("5",       "COSTOS",                       "COSTO",       "DEUDORA",   1, False, None),
        ("5.1",     "Costo de Ventas",              "COSTO",       "DEUDORA",   2, True,  "5"),

        # 6. GASTOS
        ("6",       "GASTOS",                       "GASTO",       "DEUDORA",   1, False, None),
        ("6.1",     "Gastos Administrativos",       "GASTO",       "DEUDORA",   2, True,  "6"),
        ("6.2",     "Gastos de Ventas",             "GASTO",       "DEUDORA",   2, True,  "6"),
        ("6.3",     "Gastos Financieros",           "GASTO",       "DEUDORA",   2, True,  "6"),
    ]

    # Insertar en orden, mapeando padre_codigo a padre_id
    codigo_to_id = {}
    for codigo, nombre, tipo, naturaleza, nivel, es_mov, padre_cod in cuentas:
        padre_id = codigo_to_id.get(padre_cod)
        cid = insert("""
            INSERT INTO cont_plan_cuentas
                (codigo, nombre, tipo, naturaleza, padre_id, nivel, es_movimiento, activa)
            VALUES (%s, %s, %s, %s, %s, %s, %s, true)
        """, (codigo, nombre, tipo, naturaleza, padre_id, nivel, es_mov))
        codigo_to_id[codigo] = cid

    return {"msg": f"Plan de cuentas inicializado con {len(cuentas)} cuentas", "total": len(cuentas)}


# ═══════════════════════════════════════════════════════════
# ASIENTOS CONTABLES
# ═══════════════════════════════════════════════════════════

@router.get("/asientos")
def get_asientos(
    fecha_ini: Optional[str] = None,
    fecha_fin: Optional[str] = None,
    tipo: Optional[str] = None,
    busqueda: Optional[str] = None,
    estado: Optional[str] = None,
    u=Depends(get_current_user),
):
    conds = ["1=1"]
    params = []

    if fecha_ini:
        conds.append("a.fecha >= %s")
        params.append(fecha_ini)
    if fecha_fin:
        conds.append("a.fecha <= %s")
        params.append(fecha_fin)
    if tipo:
        conds.append("a.tipo = %s")
        params.append(tipo)
    if estado:
        conds.append("a.estado = %s")
        params.append(estado)
    if busqueda:
        conds.append("(a.descripcion ILIKE %s OR a.numero ILIKE %s)")
        params += [f"%{busqueda}%"] * 2

    where = "WHERE " + " AND ".join(conds)

    return query(f"""
        SELECT a.*,
               COALESCE(SUM(d.debe), 0) AS total_debe,
               COALESCE(SUM(d.haber), 0) AS total_haber,
               u.nombre AS usuario_nombre
        FROM cont_asientos a
        LEFT JOIN cont_asiento_detalles d ON d.asiento_id = a.id
        LEFT JOIN sys_usuarios u ON u.id = a.usuario_id
        {where}
        GROUP BY a.id, u.nombre
        ORDER BY a.fecha DESC, a.id DESC
        LIMIT 200
    """, params)


@router.post("/asientos")
def crear_asiento(body: AsientoIn, u=Depends(get_current_user)):
    if not body.detalles:
        raise HTTPException(400, "El asiento debe tener al menos un detalle")

    # Calcular y validar partida doble
    total_debe = 0.0
    total_haber = 0.0
    detalles_calc = []
    for d in body.detalles:
        det = AsientoDetalleIn(**(d if isinstance(d, dict) else d.dict()))
        total_debe += det.debe
        total_haber += det.haber
        if det.debe == 0 and det.haber == 0:
            raise HTTPException(400, "Cada linea debe tener un monto en debe o haber")
        # Validar que la cuenta existe
        cuenta = query_one("SELECT id, es_movimiento FROM cont_plan_cuentas WHERE id=%s", (det.cuenta_id,))
        if not cuenta:
            raise HTTPException(404, f"Cuenta con id {det.cuenta_id} no encontrada")
        detalles_calc.append(det)

    total_debe = round(total_debe, 2)
    total_haber = round(total_haber, 2)

    if abs(total_debe - total_haber) > 0.01:
        raise HTTPException(400,
            f"El asiento no cuadra: Debe ({total_debe:.2f}) != Haber ({total_haber:.2f})")

    # Generar numero
    count = query_one("SELECT COUNT(*) AS n FROM cont_asientos")
    num = int(count["n"] or 0) + 1
    numero = f"AST-{str(num).zfill(6)}"

    fecha = body.fecha or str(date.today())

    aid = insert("""
        INSERT INTO cont_asientos
            (numero, fecha, descripcion, tipo, referencia_tipo, referencia_id,
             estado, usuario_id)
        VALUES (%s, %s, %s, %s, %s, %s, 'BORRADOR', %s)
    """, (
        numero, fecha, body.descripcion, body.tipo or "DIARIO",
        body.referencia_tipo, body.referencia_id, u["id"],
    ))

    for det in detalles_calc:
        insert("""
            INSERT INTO cont_asiento_detalles
                (asiento_id, cuenta_id, descripcion, debe, haber)
            VALUES (%s, %s, %s, %s, %s)
        """, (aid, det.cuenta_id, det.descripcion, det.debe, det.haber))

    return {
        "id": aid,
        "numero": numero,
        "total_debe": total_debe,
        "total_haber": total_haber,
        "msg": "Asiento contable creado correctamente",
    }


@router.get("/asientos/{aid}")
def get_asiento(aid: int, u=Depends(get_current_user)):
    a = query_one("""
        SELECT a.*,
               u.nombre AS usuario_nombre
        FROM cont_asientos a
        LEFT JOIN sys_usuarios u ON u.id = a.usuario_id
        WHERE a.id = %s
    """, (aid,))
    if not a:
        raise HTTPException(404, "Asiento no encontrado")

    a["detalles"] = query("""
        SELECT d.*,
               c.codigo AS cuenta_codigo,
               c.nombre AS cuenta_nombre
        FROM cont_asiento_detalles d
        JOIN cont_plan_cuentas c ON c.id = d.cuenta_id
        WHERE d.asiento_id = %s
        ORDER BY d.id
    """, (aid,))

    return a


@router.patch("/asientos/{aid}/aprobar")
def aprobar_asiento(aid: int, u=Depends(get_current_user)):
    a = query_one("SELECT estado FROM cont_asientos WHERE id=%s", (aid,))
    if not a:
        raise HTTPException(404, "Asiento no encontrado")
    if a["estado"] != "BORRADOR":
        raise HTTPException(400, f"Solo se pueden aprobar asientos en BORRADOR (actual: {a['estado']})")
    execute("UPDATE cont_asientos SET estado='APROBADO' WHERE id=%s", (aid,))
    return {"msg": "Asiento aprobado correctamente"}


@router.delete("/asientos/{aid}")
def eliminar_asiento(aid: int, u=Depends(get_current_user)):
    a = query_one("SELECT estado FROM cont_asientos WHERE id=%s", (aid,))
    if not a:
        raise HTTPException(404, "Asiento no encontrado")
    if a["estado"] != "BORRADOR":
        raise HTTPException(400, "Solo se pueden eliminar asientos en BORRADOR")
    execute("DELETE FROM cont_asientos WHERE id=%s", (aid,))
    return {"msg": "Asiento eliminado correctamente"}


# ═══════════════════════════════════════════════════════════
# REPORTES CONTABLES
# ═══════════════════════════════════════════════════════════

@router.get("/balance-general")
def balance_general(
    fecha: Optional[str] = None,
    fecha_corte: Optional[str] = None,
    u=Depends(get_current_user),
):
    """Balance General a una fecha. Agrupa por ACTIVO, PASIVO, PATRIMONIO."""
    fecha_corte = fecha_corte or fecha or str(date.today())

    # Obtener saldos de todas las cuentas de movimiento
    rows = query("""
        SELECT c.id, c.codigo, c.nombre, c.tipo, c.naturaleza, c.nivel, c.padre_id,
               COALESCE(SUM(d.debe), 0) AS total_debe,
               COALESCE(SUM(d.haber), 0) AS total_haber
        FROM cont_plan_cuentas c
        LEFT JOIN cont_asiento_detalles d ON d.cuenta_id = c.id
        LEFT JOIN cont_asientos a ON a.id = d.asiento_id
            AND a.estado = 'APROBADO'
            AND a.fecha <= %s
        WHERE c.tipo IN ('ACTIVO', 'PASIVO', 'PATRIMONIO')
          AND c.es_movimiento = true
          AND c.activa = true
        GROUP BY c.id, c.codigo, c.nombre, c.tipo, c.naturaleza, c.nivel, c.padre_id
        ORDER BY c.codigo
    """, (fecha_corte,))

    # Calcular saldo segun naturaleza
    activos = []
    pasivos = []
    patrimonio = []
    total_activo = 0.0
    total_pasivo = 0.0
    total_patrimonio = 0.0

    for r in rows:
        debe = float(r["total_debe"])
        haber = float(r["total_haber"])
        if r["naturaleza"] == "DEUDORA":
            saldo = debe - haber
        else:
            saldo = haber - debe
        r["saldo"] = round(saldo, 2)

        if r["tipo"] == "ACTIVO":
            activos.append(r)
            total_activo += saldo
        elif r["tipo"] == "PASIVO":
            pasivos.append(r)
            total_pasivo += saldo
        else:
            patrimonio.append(r)
            total_patrimonio += saldo

    # Resultado del ejercicio (INGRESOS - COSTOS - GASTOS)
    resultado = query_one("""
        SELECT
            COALESCE(SUM(CASE WHEN c.tipo = 'INGRESO' THEN d.haber - d.debe ELSE 0 END), 0) AS ingresos,
            COALESCE(SUM(CASE WHEN c.tipo IN ('COSTO', 'GASTO') THEN d.debe - d.haber ELSE 0 END), 0) AS egresos
        FROM cont_asiento_detalles d
        JOIN cont_plan_cuentas c ON c.id = d.cuenta_id
        JOIN cont_asientos a ON a.id = d.asiento_id
        WHERE a.estado = 'APROBADO'
          AND a.fecha <= %s
    """, (fecha_corte,))

    utilidad = round(float(resultado["ingresos"]) - float(resultado["egresos"]), 2) if resultado else 0

    return {
        "fecha": fecha_corte,
        "activos": activos,
        "pasivos": pasivos,
        "patrimonio": patrimonio,
        "total_activo": round(total_activo, 2),
        "total_pasivo": round(total_pasivo, 2),
        "total_patrimonio": round(total_patrimonio, 2),
        "utilidad_ejercicio": utilidad,
        "total_pasivo_patrimonio": round(total_pasivo + total_patrimonio + utilidad, 2),
        "diferencia": round(total_activo - (total_pasivo + total_patrimonio + utilidad), 2),
    }


@router.get("/estado-resultados")
def estado_resultados(
    fecha_ini: Optional[str] = None,
    fecha_fin: Optional[str] = None,
    u=Depends(get_current_user),
):
    """Estado de Resultados para un periodo."""
    hoy = date.today()
    fi = fecha_ini or f"{hoy.year}-01-01"
    ff = fecha_fin or str(hoy)

    rows = query("""
        SELECT c.id, c.codigo, c.nombre, c.tipo, c.naturaleza,
               COALESCE(SUM(d.debe), 0) AS total_debe,
               COALESCE(SUM(d.haber), 0) AS total_haber
        FROM cont_plan_cuentas c
        LEFT JOIN cont_asiento_detalles d ON d.cuenta_id = c.id
        LEFT JOIN cont_asientos a ON a.id = d.asiento_id
            AND a.estado = 'APROBADO'
            AND a.fecha >= %s AND a.fecha <= %s
        WHERE c.tipo IN ('INGRESO', 'COSTO', 'GASTO')
          AND c.es_movimiento = true
          AND c.activa = true
        GROUP BY c.id, c.codigo, c.nombre, c.tipo, c.naturaleza
        ORDER BY c.codigo
    """, (fi, ff))

    ingresos = []
    costos = []
    gastos = []
    total_ingresos = 0.0
    total_costos = 0.0
    total_gastos = 0.0

    for r in rows:
        debe = float(r["total_debe"])
        haber = float(r["total_haber"])
        if r["naturaleza"] == "ACREEDORA":
            saldo = haber - debe
        else:
            saldo = debe - haber
        r["saldo"] = round(saldo, 2)

        if r["tipo"] == "INGRESO":
            ingresos.append(r)
            total_ingresos += saldo
        elif r["tipo"] == "COSTO":
            costos.append(r)
            total_costos += saldo
        else:
            gastos.append(r)
            total_gastos += saldo

    utilidad_bruta = round(total_ingresos - total_costos, 2)
    utilidad_neta = round(utilidad_bruta - total_gastos, 2)

    return {
        "periodo": {"desde": fi, "hasta": ff},
        "ingresos": ingresos,
        "costos": costos,
        "gastos": gastos,
        "total_ingresos": round(total_ingresos, 2),
        "total_costos": round(total_costos, 2),
        "total_gastos": round(total_gastos, 2),
        "utilidad_bruta": utilidad_bruta,
        "utilidad_neta": utilidad_neta,
    }


@router.get("/libro-diario")
def libro_diario(
    fecha_ini: Optional[str] = None,
    fecha_fin: Optional[str] = None,
    u=Depends(get_current_user),
):
    """Libro Diario: asientos con sus detalles en un periodo."""
    hoy = date.today()
    fi = fecha_ini or f"{hoy.year}-01-01"
    ff = fecha_fin or str(hoy)

    asientos = query("""
        SELECT a.id, a.numero, a.fecha, a.descripcion, a.tipo, a.estado
        FROM cont_asientos a
        WHERE a.fecha >= %s AND a.fecha <= %s
          AND a.estado = 'APROBADO'
        ORDER BY a.fecha, a.numero
    """, (fi, ff))

    for a in asientos:
        a["detalles"] = query("""
            SELECT d.*, c.codigo AS cuenta_codigo, c.nombre AS cuenta_nombre
            FROM cont_asiento_detalles d
            JOIN cont_plan_cuentas c ON c.id = d.cuenta_id
            WHERE d.asiento_id = %s
            ORDER BY d.id
        """, (a["id"],))

    return {"periodo": {"desde": fi, "hasta": ff}, "asientos": asientos}


@router.get("/libro-mayor")
def libro_mayor(
    cuenta_id: int = None,
    fecha_ini: Optional[str] = None,
    fecha_fin: Optional[str] = None,
    u=Depends(get_current_user),
):
    """Libro Mayor: movimientos de una cuenta con saldo acumulado."""
    if not cuenta_id:
        raise HTTPException(400, "Debe especificar cuenta_id")

    cuenta = query_one("""
        SELECT * FROM cont_plan_cuentas WHERE id=%s
    """, (cuenta_id,))
    if not cuenta:
        raise HTTPException(404, "Cuenta no encontrada")

    hoy = date.today()
    fi = fecha_ini or f"{hoy.year}-01-01"
    ff = fecha_fin or str(hoy)

    # Saldo inicial (antes del periodo)
    saldo_ini_row = query_one("""
        SELECT COALESCE(SUM(d.debe), 0) AS debe,
               COALESCE(SUM(d.haber), 0) AS haber
        FROM cont_asiento_detalles d
        JOIN cont_asientos a ON a.id = d.asiento_id
        WHERE d.cuenta_id = %s
          AND a.estado = 'APROBADO'
          AND a.fecha < %s
    """, (cuenta_id, fi))

    debe_ini = float(saldo_ini_row["debe"]) if saldo_ini_row else 0
    haber_ini = float(saldo_ini_row["haber"]) if saldo_ini_row else 0
    if cuenta["naturaleza"] == "DEUDORA":
        saldo_inicial = debe_ini - haber_ini
    else:
        saldo_inicial = haber_ini - debe_ini

    # Movimientos del periodo
    movimientos = query("""
        SELECT d.id, d.debe, d.haber, d.descripcion,
               a.numero AS asiento_numero, a.fecha, a.descripcion AS asiento_descripcion
        FROM cont_asiento_detalles d
        JOIN cont_asientos a ON a.id = d.asiento_id
        WHERE d.cuenta_id = %s
          AND a.estado = 'APROBADO'
          AND a.fecha >= %s AND a.fecha <= %s
        ORDER BY a.fecha, a.id
    """, (cuenta_id, fi, ff))

    # Calcular saldo acumulado
    saldo_acum = round(saldo_inicial, 2)
    for m in movimientos:
        d = float(m["debe"])
        h = float(m["haber"])
        if cuenta["naturaleza"] == "DEUDORA":
            saldo_acum += d - h
        else:
            saldo_acum += h - d
        m["saldo"] = round(saldo_acum, 2)

    return {
        "cuenta": cuenta,
        "periodo": {"desde": fi, "hasta": ff},
        "saldo_inicial": round(saldo_inicial, 2),
        "movimientos": movimientos,
        "saldo_final": round(saldo_acum, 2),
    }


# ═══════════════════════════════════════════════════════════
# GENERACIÓN AUTOMÁTICA DE ASIENTOS
# ═══════════════════════════════════════════════════════════

@router.post("/generar-asientos")
def generar_asientos_periodo(mes: str, u=Depends(get_current_user)):
    """Generates automatic journal entries for all transactions in a month."""
    year, month = mes.split('-')
    last_day = calendar.monthrange(int(year), int(month))[1]
    fi, ff = f"{mes}-01", f"{mes}-{last_day}"

    generados = 0

    # 1. VENTAS -> Debit CXC/Caja, Credit Ventas + IVA Cobrado
    facturas = query("""
        SELECT f.id, f.numero_factura, f.fecha_emision, f.subtotal_0, f.subtotal_iva,
               f.iva, f.total, c.razon_social
        FROM ven_facturas f
        JOIN ven_clientes c ON c.id=f.cliente_id
        WHERE f.estado='EMITIDA' AND f.fecha_emision BETWEEN %s AND %s
          AND NOT EXISTS (SELECT 1 FROM cont_asientos WHERE referencia_tipo='FACTURA' AND referencia_id=f.id)
    """, (fi, ff))

    for fac in facturas:
        lineas = []
        total = float(fac['total'])
        sub0 = float(fac['subtotal_0'])
        sub_iva = float(fac['subtotal_iva'])
        iva = float(fac['iva'])

        # Debit: CXC by total
        lineas.append(("1.1.03", f"Factura {fac['numero_factura']} - {fac['razon_social']}", total, 0))
        # Credit: Ventas by subtotals
        if sub0 + sub_iva > 0:
            lineas.append(("4.1", f"Venta {fac['numero_factura']}", 0, sub0 + sub_iva))
        # Credit: IVA Cobrado
        if iva > 0:
            lineas.append(("2.1.02", f"IVA {fac['numero_factura']}", 0, iva))

        try:
            crear_asiento_automatico(
                str(fac['fecha_emision']), f"Venta: {fac['numero_factura']} - {fac['razon_social']}",
                'VENTA', 'FACTURA', fac['id'], lineas, u['id'])
            generados += 1
        except Exception:
            pass

    # 2. COMPRAS -> Debit Inventario + IVA Pagado, Credit CXP
    compras = query("""
        SELECT c.id, c.num_documento, DATE(c.fecha) as fecha, c.subtotal_0, c.subtotal_iva,
               c.iva, c.total, p.razon_social
        FROM com_compras c
        JOIN com_proveedores p ON p.id=c.proveedor_id
        WHERE c.estado='CONFIRMADA' AND DATE(c.fecha) BETWEEN %s AND %s
          AND NOT EXISTS (SELECT 1 FROM cont_asientos WHERE referencia_tipo='COMPRA' AND referencia_id=c.id)
    """, (fi, ff))

    for comp in compras:
        lineas = []
        total = float(comp['total'])
        sub0 = float(comp['subtotal_0'])
        sub_iva = float(comp['subtotal_iva'])
        iva = float(comp['iva'])

        # Debit: Inventario
        if sub0 + sub_iva > 0:
            lineas.append(("1.1.05", f"Compra {comp['num_documento']}", sub0 + sub_iva, 0))
        # Debit: IVA Pagado
        if iva > 0:
            lineas.append(("1.1.06", f"IVA Compra {comp['num_documento']}", iva, 0))
        # Credit: CXP
        lineas.append(("2.1.01", f"Compra {comp['num_documento']} - {comp['razon_social']}", 0, total))

        try:
            crear_asiento_automatico(
                str(comp['fecha']), f"Compra: {comp['num_documento']} - {comp['razon_social']}",
                'COMPRA', 'COMPRA', comp['id'], lineas, u['id'])
            generados += 1
        except Exception:
            pass

    # 3. COBROS CXC -> Debit Caja/Bancos, Credit CXC
    cobros = query("""
        SELECT a.id, a.monto, a.fecha, a.forma_pago, cx.cliente_id,
               c.razon_social, f.numero_factura
        FROM fin_cxc_abonos a
        JOIN fin_cxc cx ON cx.id=a.cxc_id
        JOIN ven_clientes c ON c.id=cx.cliente_id
        LEFT JOIN ven_facturas f ON f.id=cx.factura_id
        WHERE a.fecha BETWEEN %s AND %s
          AND NOT EXISTS (SELECT 1 FROM cont_asientos WHERE referencia_tipo='COBRO_CXC' AND referencia_id=a.id)
    """, (fi, ff))

    for cobro in cobros:
        monto = float(cobro['monto'])
        cuenta_debe = "1.1.02" if cobro['forma_pago'] in ('TRANSFERENCIA', 'TARJETA') else "1.1.01"
        lineas = [
            (cuenta_debe, f"Cobro {cobro['razon_social']}", monto, 0),
            ("1.1.03", f"Cobro CXC {cobro.get('numero_factura', '')}", 0, monto),
        ]
        try:
            crear_asiento_automatico(
                str(cobro['fecha']), f"Cobro: {cobro['razon_social']} - {cobro.get('numero_factura', '')}",
                'COBRO', 'COBRO_CXC', cobro['id'], lineas, u['id'])
            generados += 1
        except Exception:
            pass

    # 4. PAGOS CXP -> Debit CXP, Credit Caja/Bancos
    pagos = query("""
        SELECT p.id, p.monto, p.fecha, p.forma_pago, cx.proveedor_id,
               pr.razon_social, c.num_documento
        FROM fin_cxp_pagos p
        JOIN fin_cxp cx ON cx.id=p.cxp_id
        JOIN com_proveedores pr ON pr.id=cx.proveedor_id
        LEFT JOIN com_compras c ON c.id=cx.compra_id
        WHERE p.fecha BETWEEN %s AND %s
          AND NOT EXISTS (SELECT 1 FROM cont_asientos WHERE referencia_tipo='PAGO_CXP' AND referencia_id=p.id)
    """, (fi, ff))

    for pago in pagos:
        monto = float(pago['monto'])
        cuenta_haber = "1.1.02" if pago['forma_pago'] in ('TRANSFERENCIA',) else "1.1.01"
        lineas = [
            ("2.1.01", f"Pago {pago['razon_social']}", monto, 0),
            (cuenta_haber, f"Pago CXP {pago.get('num_documento', '')}", 0, monto),
        ]
        try:
            crear_asiento_automatico(
                str(pago['fecha']), f"Pago: {pago['razon_social']}",
                'PAGO', 'PAGO_CXP', pago['id'], lineas, u['id'])
            generados += 1
        except Exception:
            pass

    return {"generados": generados, "msg": f"{generados} asientos generados para {mes}"}


# ═══════════════════════════════════════════════════════════
# BALANCE DE COMPROBACIÓN
# ═══════════════════════════════════════════════════════════

@router.get("/balance-comprobacion")
def balance_comprobacion(fecha_ini: str, fecha_fin: str, u=Depends(get_current_user)):
    """Trial balance: all accounts with debit/credit totals and balances."""
    cuentas = query("""
        SELECT c.id, c.codigo, c.nombre, c.tipo, c.naturaleza, c.nivel,
               COALESCE(SUM(d.debe),0) as total_debe,
               COALESCE(SUM(d.haber),0) as total_haber,
               COALESCE(SUM(d.debe),0) - COALESCE(SUM(d.haber),0) as saldo
        FROM cont_plan_cuentas c
        LEFT JOIN cont_asiento_detalles d ON d.cuenta_id=c.id
        LEFT JOIN cont_asientos a ON a.id=d.asiento_id
            AND a.estado='APROBADO' AND a.fecha BETWEEN %s AND %s
        WHERE c.activa=true AND c.es_movimiento=true
        GROUP BY c.id, c.codigo, c.nombre, c.tipo, c.naturaleza, c.nivel
        HAVING COALESCE(SUM(d.debe),0) != 0 OR COALESCE(SUM(d.haber),0) != 0
        ORDER BY c.codigo
    """, (fecha_ini, fecha_fin))

    total_debe = sum(float(c['total_debe']) for c in cuentas)
    total_haber = sum(float(c['total_haber']) for c in cuentas)

    return {
        "titulo": "Balance de Comprobacion",
        "fecha_ini": fecha_ini, "fecha_fin": fecha_fin,
        "cuentas": cuentas,
        "total_debe": round(total_debe, 2),
        "total_haber": round(total_haber, 2),
        "diferencia": round(total_debe - total_haber, 2),
        "cuadrado": abs(total_debe - total_haber) < 0.01,
    }


# ═══════════════════════════════════════════════════════════
# CIERRE DE PERÍODO
# ═══════════════════════════════════════════════════════════

@router.post("/cierre-periodo")
def cierre_periodo(mes: str, u=Depends(get_current_user)):
    """Closes a period: generates summary entry transferring P&L to equity."""
    year, month = mes.split('-')
    last_day = calendar.monthrange(int(year), int(month))[1]
    fi, ff = f"{mes}-01", f"{mes}-{last_day}"

    # Check for existing closing entry
    existing = query_one("""
        SELECT id FROM cont_asientos
        WHERE referencia_tipo='CIERRE' AND tipo='CIERRE'
          AND fecha BETWEEN %s AND %s
    """, (fi, ff))
    if existing:
        raise HTTPException(400, f"Ya existe un asiento de cierre para {mes}")

    # Sum all income accounts (tipo=INGRESO)
    ingresos = query_one("""
        SELECT COALESCE(SUM(d.haber) - SUM(d.debe), 0) as total
        FROM cont_asiento_detalles d
        JOIN cont_asientos a ON a.id=d.asiento_id
        JOIN cont_plan_cuentas c ON c.id=d.cuenta_id
        WHERE a.estado='APROBADO' AND a.fecha BETWEEN %s AND %s AND c.tipo='INGRESO'
    """, (fi, ff))

    # Sum all expense accounts (tipo=GASTO or COSTO)
    gastos = query_one("""
        SELECT COALESCE(SUM(d.debe) - SUM(d.haber), 0) as total
        FROM cont_asiento_detalles d
        JOIN cont_asientos a ON a.id=d.asiento_id
        JOIN cont_plan_cuentas c ON c.id=d.cuenta_id
        WHERE a.estado='APROBADO' AND a.fecha BETWEEN %s AND %s AND c.tipo IN ('GASTO','COSTO')
    """, (fi, ff))

    utilidad = float(ingresos['total']) - float(gastos['total'])

    # Create closing entry
    lineas = []
    if float(ingresos['total']) > 0:
        lineas.append(("4.1", "Cierre ingresos del periodo", float(ingresos['total']), 0))
    if float(gastos['total']) > 0:
        lineas.append(("5.1", "Cierre costos/gastos del periodo", 0, float(gastos['total'])))

    if utilidad >= 0:
        lineas.append(("3.3", f"Utilidad del periodo {mes}", 0, utilidad))
    else:
        lineas.append(("3.3", f"Perdida del periodo {mes}", abs(utilidad), 0))

    asiento_id = crear_asiento_automatico(
        ff, f"Cierre contable {mes}", 'CIERRE', 'CIERRE', None, lineas, u['id'])

    return {
        "msg": f"Periodo {mes} cerrado",
        "ingresos": float(ingresos['total']),
        "gastos": float(gastos['total']),
        "utilidad": round(utilidad, 2),
        "asiento_id": asiento_id,
    }


# ═══════════════════════════════════════════════════════════
# CENTROS DE COSTO
# ═══════════════════════════════════════════════════════════

@router.get("/centros-costo")
def get_centros_costo(u=Depends(get_current_user)):
    return query("SELECT * FROM cont_centros_costo WHERE activo=true ORDER BY codigo")

@router.post("/centros-costo")
def crear_centro_costo(codigo: str, nombre: str, u=Depends(get_current_user)):
    cid = insert("INSERT INTO cont_centros_costo (codigo, nombre) VALUES (%s,%s)", (codigo, nombre))
    return {"id": cid, "msg": "Centro de costo creado"}

@router.get("/reporte-centro-costo")
def reporte_centro_costo(fecha_ini: str, fecha_fin: str, centro_id: Optional[int] = None, u=Depends(get_current_user)):
    """Report of movements by cost center."""
    conds = ["a.estado='APROBADO'", "a.fecha BETWEEN %s AND %s"]
    params = [fecha_ini, fecha_fin]
    if centro_id:
        conds.append("d.centro_costo_id=%s")
        params.append(centro_id)
    else:
        conds.append("d.centro_costo_id IS NOT NULL")
    where = "WHERE " + " AND ".join(conds)

    detalle = query(f"""
        SELECT cc.codigo as centro_codigo, cc.nombre as centro_nombre,
               c.codigo as cuenta_codigo, c.nombre as cuenta_nombre,
               SUM(d.debe) as total_debe, SUM(d.haber) as total_haber
        FROM cont_asiento_detalles d
        JOIN cont_asientos a ON a.id=d.asiento_id
        JOIN cont_plan_cuentas c ON c.id=d.cuenta_id
        LEFT JOIN cont_centros_costo cc ON cc.id=d.centro_costo_id
        {where}
        GROUP BY cc.codigo, cc.nombre, c.codigo, c.nombre
        ORDER BY cc.codigo, c.codigo
    """, params)

    # Group by centro
    centros = {}
    for r in detalle:
        key = r['centro_nombre'] or 'Sin Centro'
        if key not in centros:
            centros[key] = {"nombre": key, "codigo": r.get('centro_codigo',''), "cuentas": [], "total_debe": 0, "total_haber": 0}
        centros[key]["cuentas"].append(r)
        centros[key]["total_debe"] += float(r['total_debe'])
        centros[key]["total_haber"] += float(r['total_haber'])

    return {"centros": list(centros.values()), "fecha_ini": fecha_ini, "fecha_fin": fecha_fin}


# ═══════════════════════════════════════════════════════════
# MAYORES AUXILIARES
# ═══════════════════════════════════════════════════════════

@router.get("/auxiliar-cxc")
def auxiliar_cxc(fecha_corte: str, u=Depends(get_current_user)):
    """CXC auxiliary ledger: balance per client vs accounting account."""
    clientes = query("""
        SELECT c.id, c.razon_social, c.identificacion,
               COALESCE(SUM(CASE WHEN cx.saldo > 0 THEN cx.saldo ELSE 0 END), 0) as saldo_operativo
        FROM ven_clientes c
        LEFT JOIN fin_cxc cx ON cx.cliente_id=c.id AND cx.saldo > 0
        GROUP BY c.id, c.razon_social, c.identificacion
        HAVING COALESCE(SUM(CASE WHEN cx.saldo > 0 THEN cx.saldo ELSE 0 END), 0) > 0
        ORDER BY c.razon_social
    """)

    # Get accounting CXC balance
    saldo_contable = query_one("""
        SELECT COALESCE(SUM(d.debe) - SUM(d.haber), 0) as saldo
        FROM cont_asiento_detalles d
        JOIN cont_asientos a ON a.id=d.asiento_id
        JOIN cont_plan_cuentas c ON c.id=d.cuenta_id
        WHERE c.codigo LIKE '1.1.03%%' AND a.estado='APROBADO' AND a.fecha <= %s
    """, (fecha_corte,))

    total_operativo = sum(float(c['saldo_operativo']) for c in clientes)
    total_contable = float(saldo_contable['saldo']) if saldo_contable else 0

    return {
        "clientes": clientes,
        "total_operativo": round(total_operativo, 2),
        "total_contable": round(total_contable, 2),
        "diferencia": round(total_operativo - total_contable, 2),
        "conciliado": abs(total_operativo - total_contable) < 0.01,
    }

@router.get("/auxiliar-cxp")
def auxiliar_cxp(fecha_corte: str, u=Depends(get_current_user)):
    """CXP auxiliary ledger: balance per supplier vs accounting."""
    proveedores = query("""
        SELECT p.id, p.razon_social, p.identificacion,
               COALESCE(SUM(CASE WHEN cx.saldo > 0 THEN cx.saldo ELSE 0 END), 0) as saldo_operativo
        FROM com_proveedores p
        LEFT JOIN fin_cxp cx ON cx.proveedor_id=p.id AND cx.saldo > 0
        GROUP BY p.id, p.razon_social, p.identificacion
        HAVING COALESCE(SUM(CASE WHEN cx.saldo > 0 THEN cx.saldo ELSE 0 END), 0) > 0
        ORDER BY p.razon_social
    """)

    saldo_contable = query_one("""
        SELECT COALESCE(SUM(d.haber) - SUM(d.debe), 0) as saldo
        FROM cont_asiento_detalles d
        JOIN cont_asientos a ON a.id=d.asiento_id
        JOIN cont_plan_cuentas c ON c.id=d.cuenta_id
        WHERE c.codigo LIKE '2.1.01%%' AND a.estado='APROBADO' AND a.fecha <= %s
    """, (fecha_corte,))

    total_operativo = sum(float(p['saldo_operativo']) for p in proveedores)
    total_contable = float(saldo_contable['saldo']) if saldo_contable else 0

    return {
        "proveedores": proveedores,
        "total_operativo": round(total_operativo, 2),
        "total_contable": round(total_contable, 2),
        "diferencia": round(total_operativo - total_contable, 2),
        "conciliado": abs(total_operativo - total_contable) < 0.01,
    }

@router.get("/auxiliar-bancos")
def auxiliar_bancos(fecha_corte: str, u=Depends(get_current_user)):
    """Bank auxiliary: balance per bank account vs accounting."""
    cuentas_banco = query("""
        SELECT cb.id, cb.nombre, cb.numero, sb.nombre as banco,
               COALESCE(cb.saldo_inicial, 0) +
               COALESCE((SELECT SUM(CASE WHEN m.tipo IN ('DEPOSITO_EFECTIVO','LOTE_TARJETA','TRANSFERENCIA_RECIBIDA')
                   THEN m.monto ELSE -m.monto END)
                   FROM fin_movimientos_bancarios m
                   WHERE m.cuenta_id=cb.id AND m.estado='CONCILIADO'), 0) as saldo_operativo
        FROM fin_cuentas_bancarias cb
        LEFT JOIN sys_bancos sb ON sb.id=cb.banco_id
        WHERE cb.activa=true
    """)

    saldo_contable = query_one("""
        SELECT COALESCE(SUM(d.debe) - SUM(d.haber), 0) as saldo
        FROM cont_asiento_detalles d
        JOIN cont_asientos a ON a.id=d.asiento_id
        JOIN cont_plan_cuentas c ON c.id=d.cuenta_id
        WHERE c.codigo LIKE '1.1.02%%' AND a.estado='APROBADO' AND a.fecha <= %s
    """, (fecha_corte,))

    total_operativo = sum(float(c['saldo_operativo']) for c in cuentas_banco)
    total_contable = float(saldo_contable['saldo']) if saldo_contable else 0

    return {
        "cuentas": cuentas_banco,
        "total_operativo": round(total_operativo, 2),
        "total_contable": round(total_contable, 2),
        "diferencia": round(total_operativo - total_contable, 2),
        "conciliado": abs(total_operativo - total_contable) < 0.01,
    }


# ═══════════════════════════════════════════════════════════
# PRESUPUESTO CONTABLE
# ═══════════════════════════════════════════════════════════

@router.get("/presupuesto")
def get_presupuesto(anio: int, u=Depends(get_current_user)):
    """Returns budget vs actual for a year."""
    presupuestos = query("""
        SELECT p.*, c.codigo as cuenta_codigo, c.nombre as cuenta_nombre, c.tipo as cuenta_tipo
        FROM cont_presupuestos p
        JOIN cont_plan_cuentas c ON c.id=p.cuenta_id
        WHERE p.anio=%s
        ORDER BY c.codigo
    """, (anio,))

    # Get actual values per month for each account
    for pres in presupuestos:
        for mes in range(1, 13):
            fi = f"{anio}-{str(mes).zfill(2)}-01"
            ld = calendar.monthrange(anio, mes)[1]
            ff = f"{anio}-{str(mes).zfill(2)}-{ld}"
            actual = query_one("""
                SELECT COALESCE(SUM(d.debe)-SUM(d.haber),0) as saldo
                FROM cont_asiento_detalles d
                JOIN cont_asientos a ON a.id=d.asiento_id
                WHERE d.cuenta_id=%s AND a.estado='APROBADO' AND a.fecha BETWEEN %s AND %s
            """, (pres['cuenta_id'], fi, ff))
            pres[f'real_{str(mes).zfill(2)}'] = float(actual['saldo']) if actual else 0

    return {"anio": anio, "presupuestos": presupuestos}

@router.post("/presupuesto")
def guardar_presupuesto(anio: int, cuenta_id: int, montos: dict, u=Depends(get_current_user)):
    """Save or update budget for an account/year. montos: {mes_01: 1000, mes_02: 1500, ...}"""
    existing = query_one(
        "SELECT id FROM cont_presupuestos WHERE anio=%s AND cuenta_id=%s AND centro_costo_id IS NULL",
        (anio, cuenta_id))

    cols = ', '.join([f"mes_{str(i).zfill(2)}=%s" for i in range(1,13)])
    vals = [float(montos.get(f"mes_{str(i).zfill(2)}", 0)) for i in range(1,13)]

    if existing:
        execute(f"UPDATE cont_presupuestos SET {cols} WHERE id=%s", vals + [existing['id']])
    else:
        insert_cols = ', '.join([f"mes_{str(i).zfill(2)}" for i in range(1,13)])
        placeholders = ', '.join(['%s']*12)
        insert(f"INSERT INTO cont_presupuestos (anio, cuenta_id, {insert_cols}) VALUES (%s,%s,{placeholders})",
               [anio, cuenta_id] + vals)

    return {"msg": "Presupuesto guardado"}


# ═══════════════════════════════════════════════════════════
# CONCILIACIÓN AUTOMÁTICA DE MÓDULOS
# ═══════════════════════════════════════════════════════════

@router.get("/conciliacion-modulos")
def conciliacion_modulos(fecha_corte: str, u=Depends(get_current_user)):
    """Shows if accounting matches operational modules."""
    resultado = []

    # CXC
    cxc_op = query_one("SELECT COALESCE(SUM(saldo),0) as total FROM fin_cxc WHERE saldo>0")
    cxc_ct = query_one("""
        SELECT COALESCE(SUM(d.debe)-SUM(d.haber),0) as total
        FROM cont_asiento_detalles d JOIN cont_asientos a ON a.id=d.asiento_id
        JOIN cont_plan_cuentas c ON c.id=d.cuenta_id
        WHERE c.codigo LIKE '1.1.03%%' AND a.estado='APROBADO' AND a.fecha<=%s
    """, (fecha_corte,))
    resultado.append({
        "modulo": "Cuentas por Cobrar", "cuenta": "1.1.03",
        "saldo_operativo": float(cxc_op['total']),
        "saldo_contable": float(cxc_ct['total']),
        "diferencia": round(float(cxc_op['total']) - float(cxc_ct['total']), 2),
        "conciliado": abs(float(cxc_op['total']) - float(cxc_ct['total'])) < 0.01,
    })

    # CXP
    cxp_op = query_one("SELECT COALESCE(SUM(saldo),0) as total FROM fin_cxp WHERE saldo>0")
    cxp_ct = query_one("""
        SELECT COALESCE(SUM(d.haber)-SUM(d.debe),0) as total
        FROM cont_asiento_detalles d JOIN cont_asientos a ON a.id=d.asiento_id
        JOIN cont_plan_cuentas c ON c.id=d.cuenta_id
        WHERE c.codigo LIKE '2.1.01%%' AND a.estado='APROBADO' AND a.fecha<=%s
    """, (fecha_corte,))
    resultado.append({
        "modulo": "Cuentas por Pagar", "cuenta": "2.1.01",
        "saldo_operativo": float(cxp_op['total']),
        "saldo_contable": float(cxp_ct['total']),
        "diferencia": round(float(cxp_op['total']) - float(cxp_ct['total']), 2),
        "conciliado": abs(float(cxp_op['total']) - float(cxp_ct['total'])) < 0.01,
    })

    # Inventario
    inv_op = query_one("""
        SELECT COALESCE(SUM(s.cantidad * COALESCE(c.costo,0)),0) as total
        FROM inv_stock s LEFT JOIN inv_costos c ON c.producto_id=s.producto_id
    """)
    inv_ct = query_one("""
        SELECT COALESCE(SUM(d.debe)-SUM(d.haber),0) as total
        FROM cont_asiento_detalles d JOIN cont_asientos a ON a.id=d.asiento_id
        JOIN cont_plan_cuentas c ON c.id=d.cuenta_id
        WHERE c.codigo LIKE '1.1.05%%' AND a.estado='APROBADO' AND a.fecha<=%s
    """, (fecha_corte,))
    resultado.append({
        "modulo": "Inventarios", "cuenta": "1.1.05",
        "saldo_operativo": float(inv_op['total']),
        "saldo_contable": float(inv_ct['total']),
        "diferencia": round(float(inv_op['total']) - float(inv_ct['total']), 2),
        "conciliado": abs(float(inv_op['total']) - float(inv_ct['total'])) < 0.01,
    })

    return {"modulos": resultado, "fecha_corte": fecha_corte}


# ═══════════════════════════════════════════════════════════
# MULTI-MONEDA (Multi-Currency)
# ═══════════════════════════════════════════════════════════

@router.get("/monedas")
def get_monedas(u=Depends(get_current_user)):
    return query("SELECT * FROM cont_monedas WHERE activa=true ORDER BY es_base DESC, nombre")

@router.post("/monedas")
def crear_moneda(codigo: str, nombre: str, simbolo: str = '$', u=Depends(get_current_user)):
    mid = insert("INSERT INTO cont_monedas (codigo, nombre, simbolo) VALUES (%s,%s,%s)", (codigo.upper(), nombre, simbolo))
    return {"id": mid, "msg": "Moneda creada"}

@router.get("/tipos-cambio")
def get_tipos_cambio(moneda_id: Optional[int] = None, u=Depends(get_current_user)):
    if moneda_id:
        return query("SELECT tc.*, m.codigo, m.nombre as moneda FROM cont_tipos_cambio tc JOIN cont_monedas m ON m.id=tc.moneda_id WHERE tc.moneda_id=%s ORDER BY tc.fecha DESC LIMIT 30", (moneda_id,))
    return query("SELECT tc.*, m.codigo, m.nombre as moneda FROM cont_tipos_cambio tc JOIN cont_monedas m ON m.id=tc.moneda_id ORDER BY tc.fecha DESC LIMIT 50")

@router.post("/tipos-cambio")
def registrar_tipo_cambio(moneda_id: int, fecha: str, tasa: float, u=Depends(get_current_user)):
    """Register exchange rate. tasa = how many USD for 1 unit of foreign currency."""
    existing = query_one("SELECT id FROM cont_tipos_cambio WHERE moneda_id=%s AND fecha=%s", (moneda_id, fecha))
    if existing:
        execute("UPDATE cont_tipos_cambio SET tasa=%s WHERE id=%s", (tasa, existing['id']))
    else:
        insert("INSERT INTO cont_tipos_cambio (moneda_id, fecha, tasa) VALUES (%s,%s,%s)", (moneda_id, fecha, tasa))
    return {"msg": "Tipo de cambio registrado"}

@router.get("/diferencia-cambio")
def reporte_diferencia_cambio(fecha_ini: str, fecha_fin: str, u=Depends(get_current_user)):
    """Report of exchange rate differences for multi-currency entries."""
    movimientos = query("""
        SELECT d.id, a.fecha, a.descripcion, c.codigo as cuenta_codigo, c.nombre as cuenta_nombre,
               m.codigo as moneda, d.monto_moneda, d.tasa_cambio,
               d.debe, d.haber
        FROM cont_asiento_detalles d
        JOIN cont_asientos a ON a.id=d.asiento_id
        JOIN cont_plan_cuentas c ON c.id=d.cuenta_id
        JOIN cont_monedas m ON m.id=d.moneda_id
        WHERE a.estado='APROBADO' AND a.fecha BETWEEN %s AND %s
          AND d.moneda_id IS NOT NULL
        ORDER BY a.fecha, a.id
    """, (fecha_ini, fecha_fin))

    # Calculate current value vs registered value
    for mov in movimientos:
        tasa_actual = query_one("""
            SELECT tasa FROM cont_tipos_cambio
            WHERE moneda_id=(SELECT id FROM cont_monedas WHERE codigo=%s)
            ORDER BY fecha DESC LIMIT 1
        """, (mov['moneda'],))
        if tasa_actual and mov.get('monto_moneda'):
            valor_actual = float(mov['monto_moneda']) * float(tasa_actual['tasa'])
            valor_original = float(mov.get('debe', 0)) or float(mov.get('haber', 0))
            mov['valor_actual'] = round(valor_actual, 2)
            mov['diferencia'] = round(valor_actual - valor_original, 2)
        else:
            mov['valor_actual'] = 0
            mov['diferencia'] = 0

    total_diferencia = sum(float(m.get('diferencia', 0)) for m in movimientos)
    return {"movimientos": movimientos, "total_diferencia": round(total_diferencia, 2)}


# ═══════════════════════════════════════════════════════════
# MULTI-EMPRESA / CONSOLIDACION
# ═══════════════════════════════════════════════════════════

@router.get("/empresas-grupo")
def get_empresas_grupo(u=Depends(get_current_user)):
    return query("SELECT * FROM cont_empresas_grupo WHERE activa=true ORDER BY es_matriz DESC, nombre")

@router.post("/empresas-grupo")
def crear_empresa_grupo(nombre: str, ruc: str = '', es_matriz: bool = False, u=Depends(get_current_user)):
    eid = insert("INSERT INTO cont_empresas_grupo (nombre, ruc, es_matriz) VALUES (%s,%s,%s)", (nombre, ruc, es_matriz))
    return {"id": eid, "msg": "Empresa agregada al grupo"}

@router.get("/consolidado")
def balance_consolidado(fecha_corte: str, u=Depends(get_current_user)):
    """
    Consolidated balance sheet. For now, returns the current company's balance
    plus info about group companies. Full consolidation requires each company
    to have its own database, which is an enterprise deployment feature.
    """
    # Get current company balance
    balance = balance_general(fecha_corte=fecha_corte, u=u)

    # Get group companies
    empresas = query("SELECT * FROM cont_empresas_grupo WHERE activa=true")

    return {
        "titulo": "Balance General Consolidado",
        "fecha_corte": fecha_corte,
        "empresa_actual": balance,
        "empresas_grupo": empresas,
        "nota": "Para consolidacion completa multi-base, contacte soporte para configuracion enterprise."
    }
