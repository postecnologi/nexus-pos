"""
Módulo de Nómina — Ecuador (Código de Trabajo + IESS)
Gestión completa de empleados, roles de pago, décimos, vacaciones, liquidaciones y reportes.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from database import query, query_one, execute, insert
from auth import get_current_user
import io, json, math, calendar

router = APIRouter(prefix="/api/nomina", tags=["Nomina"])

# ── Modelos Pydantic ────────────────────────────────────────────

class ConfigIn(BaseModel):
    sbu: float = 470
    aporte_personal_pct: float = 9.45
    aporte_patronal_pct: float = 11.15
    fondos_reserva_pct: float = 8.33
    anio: int = 2026

class EmpleadoIn(BaseModel):
    codigo: Optional[str] = None
    cedula: str
    nombres: str
    apellidos: str
    fecha_nacimiento: Optional[str] = None
    genero: Optional[str] = None
    estado_civil: Optional[str] = None
    direccion: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    cargo: Optional[str] = None
    departamento: Optional[str] = None
    sucursal_id: Optional[int] = None
    fecha_ingreso: str
    fecha_salida: Optional[str] = None
    tipo_contrato: str = "INDEFINIDO"
    salario_base: float
    tiene_fondos_reserva: bool = False
    decimo_tercero_acumulado: bool = True
    decimo_cuarto_acumulado: bool = True
    region: str = "SIERRA"
    num_cargas_familiares: int = 0
    cuenta_bancaria: Optional[str] = None
    banco: Optional[str] = None
    tipo_cuenta: Optional[str] = None
    usuario_id: Optional[int] = None
    vendedor_id: Optional[int] = None
    tecnico_id: Optional[int] = None
    activo: bool = True

class CalcularRolIn(BaseModel):
    periodo: str  # YYYY-MM
    empleado_ids: Optional[List[int]] = None

class VacacionIn(BaseModel):
    empleado_id: int
    fecha_inicio: str
    fecha_fin: str
    dias_tomados: int
    observaciones: Optional[str] = None

class LiquidacionIn(BaseModel):
    motivo: str  # RENUNCIA, DESPIDO_INTEMPESTIVO, DESAHUCIO, MUTUO_ACUERDO
    fecha_salida: Optional[str] = None

class AprobarTodosIn(BaseModel):
    periodo: str

# ── Helpers ─────────────────────────────────────────────────────

def _get_config():
    """Obtener configuración de nómina, crear si no existe."""
    c = query_one("SELECT * FROM nom_config ORDER BY id DESC LIMIT 1")
    if not c:
        insert(
            "INSERT INTO nom_config (sbu, aporte_personal_pct, aporte_patronal_pct, fondos_reserva_pct, anio) "
            "VALUES (%s,%s,%s,%s,%s)",
            (470, 9.45, 11.15, 8.33, 2026)
        )
        c = query_one("SELECT * FROM nom_config ORDER BY id DESC LIMIT 1")
    return c

def _years_worked(fecha_ingreso, ref_date=None):
    """Calcular años trabajados desde la fecha de ingreso."""
    if not fecha_ingreso:
        return 0
    if isinstance(fecha_ingreso, str):
        fecha_ingreso = datetime.strptime(fecha_ingreso[:10], "%Y-%m-%d").date()
    ref = ref_date or date.today()
    if isinstance(ref, str):
        ref = datetime.strptime(ref[:10], "%Y-%m-%d").date()
    delta = ref - fecha_ingreso
    return delta.days / 365.25

def _vacation_days(years):
    """Días de vacación según años trabajados."""
    if years < 1:
        return 0
    base = 15
    if years > 5:
        extra = int(years - 5)
        base = min(15 + extra, 30)
    return base

def _decimal(val):
    """Convertir a Decimal redondeado a 2 decimales."""
    return Decimal(str(val or 0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

def _float(val):
    return float(val or 0)

# Tabla de impuesto a la renta 2026
TABLA_IR = [
    (0,        11902,   0,     0),
    (11902,    15159,   0,     5),
    (15159,    19682,   0,    10),
    (19682,    26031,   0,    12),
    (26031,    34255,   0,    15),
    (34255,    45407,   0,    20),
    (45407,    60450,   0,    25),
    (60450,    80605,   0,    30),
    (80605, 99999999,   0,    35),
]

def _calcular_ir_mensual(base_anual):
    """Calcular impuesto a la renta anual y retornar el valor mensual."""
    impuesto = 0
    for lower, upper, fijo, pct in TABLA_IR:
        if base_anual <= lower:
            break
        gravable = min(base_anual, upper) - lower
        impuesto += gravable * pct / 100
    return round(impuesto / 12, 2)


# ══════════════════════════════════════════════════════════════════
#  CONFIG
# ══════════════════════════════════════════════════════════════════

@router.get("/config")
def get_config(u=Depends(get_current_user)):
    return _get_config()

@router.put("/config")
def update_config(data: ConfigIn, u=Depends(get_current_user)):
    cfg = _get_config()
    execute("""
        UPDATE nom_config SET sbu=%s, aporte_personal_pct=%s, aporte_patronal_pct=%s,
        fondos_reserva_pct=%s, anio=%s, updated_at=NOW() WHERE id=%s
    """, (data.sbu, data.aporte_personal_pct, data.aporte_patronal_pct,
          data.fondos_reserva_pct, data.anio, cfg["id"]))
    return {"msg": "Configuración actualizada"}


# ══════════════════════════════════════════════════════════════════
#  EMPLEADOS
# ══════════════════════════════════════════════════════════════════

@router.get("/empleados")
def list_empleados(
    busqueda: str = "",
    activo: Optional[str] = "true",
    departamento: Optional[str] = None,
    u=Depends(get_current_user)
):
    conds = []
    params = []
    if activo == "true":
        conds.append("e.activo=true")
    elif activo == "false":
        conds.append("e.activo=false")
    if departamento:
        conds.append("e.departamento=%s")
        params.append(departamento)
    if busqueda:
        conds.append("(e.nombres ILIKE %s OR e.apellidos ILIKE %s OR e.cedula ILIKE %s OR e.codigo ILIKE %s)")
        params += [f"%{busqueda}%"] * 4
    where = "WHERE " + " AND ".join(conds) if conds else ""
    rows = query(f"""
        SELECT e.*, s.nombre as sucursal_nombre
        FROM nom_empleados e
        LEFT JOIN sys_sucursales s ON s.id = e.sucursal_id
        {where}
        ORDER BY e.apellidos, e.nombres
    """, params)
    return rows

@router.post("/empleados")
def crear_empleado(emp: EmpleadoIn, u=Depends(get_current_user)):
    existe = query_one("SELECT id FROM nom_empleados WHERE cedula=%s", (emp.cedula,))
    if existe:
        raise HTTPException(400, "Ya existe un empleado con esa cédula")
    # Auto-generar código si no viene
    if not emp.codigo:
        last = query_one("SELECT COUNT(*) as n FROM nom_empleados")
        emp.codigo = f"EMP-{(last['n'] or 0) + 1:04d}"
    eid = insert("""
        INSERT INTO nom_empleados
        (codigo, cedula, nombres, apellidos, fecha_nacimiento, genero, estado_civil,
         direccion, telefono, email, cargo, departamento, sucursal_id,
         fecha_ingreso, fecha_salida, tipo_contrato, salario_base,
         tiene_fondos_reserva, decimo_tercero_acumulado, decimo_cuarto_acumulado,
         region, num_cargas_familiares, cuenta_bancaria, banco, tipo_cuenta,
         usuario_id, vendedor_id, tecnico_id, activo)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
    """, (
        emp.codigo, emp.cedula, emp.nombres, emp.apellidos,
        emp.fecha_nacimiento or None, emp.genero, emp.estado_civil,
        emp.direccion, emp.telefono, emp.email, emp.cargo, emp.departamento,
        emp.sucursal_id, emp.fecha_ingreso, emp.fecha_salida or None,
        emp.tipo_contrato, emp.salario_base,
        emp.tiene_fondos_reserva, emp.decimo_tercero_acumulado,
        emp.decimo_cuarto_acumulado, emp.region, emp.num_cargas_familiares,
        emp.cuenta_bancaria, emp.banco, emp.tipo_cuenta,
        emp.usuario_id, emp.vendedor_id, emp.tecnico_id, emp.activo
    ))
    return {"id": eid, "msg": "Empleado creado"}

@router.get("/empleados/{eid}")
def get_empleado(eid: int, u=Depends(get_current_user)):
    emp = query_one("""
        SELECT e.*, s.nombre as sucursal_nombre
        FROM nom_empleados e
        LEFT JOIN sys_sucursales s ON s.id = e.sucursal_id
        WHERE e.id=%s
    """, (eid,))
    if not emp:
        raise HTTPException(404, "Empleado no encontrado")

    # Calcular tiempo de servicio y vacaciones
    years = _years_worked(emp["fecha_ingreso"])
    vac_days = _vacation_days(years)
    taken = query_one(
        "SELECT COALESCE(SUM(dias_tomados),0) as total FROM nom_vacaciones WHERE empleado_id=%s AND estado='APROBADA'",
        (eid,)
    )
    total_taken = _float(taken["total"]) if taken else 0
    total_derecho = vac_days * max(1, int(years)) if years >= 1 else 0
    available = max(0, total_derecho - total_taken)
    daily_value = round(_float(emp["salario_base"]) / 24, 2)

    emp["anos_servicio"] = round(years, 2)
    emp["dias_vacaciones_derecho"] = vac_days
    emp["dias_vacaciones_tomados"] = total_taken
    emp["dias_vacaciones_disponibles"] = available
    emp["valor_dia_vacacion"] = daily_value
    return emp

@router.put("/empleados/{eid}")
def update_empleado(eid: int, emp: EmpleadoIn, u=Depends(get_current_user)):
    existe = query_one("SELECT id FROM nom_empleados WHERE cedula=%s AND id!=%s", (emp.cedula, eid))
    if existe:
        raise HTTPException(400, "Ya existe otro empleado con esa cédula")
    execute("""
        UPDATE nom_empleados SET
            codigo=%s, cedula=%s, nombres=%s, apellidos=%s, fecha_nacimiento=%s,
            genero=%s, estado_civil=%s, direccion=%s, telefono=%s, email=%s,
            cargo=%s, departamento=%s, sucursal_id=%s,
            fecha_ingreso=%s, fecha_salida=%s, tipo_contrato=%s, salario_base=%s,
            tiene_fondos_reserva=%s, decimo_tercero_acumulado=%s,
            decimo_cuarto_acumulado=%s, region=%s, num_cargas_familiares=%s,
            cuenta_bancaria=%s, banco=%s, tipo_cuenta=%s,
            usuario_id=%s, vendedor_id=%s, tecnico_id=%s, activo=%s
        WHERE id=%s
    """, (
        emp.codigo, emp.cedula, emp.nombres, emp.apellidos,
        emp.fecha_nacimiento or None, emp.genero, emp.estado_civil,
        emp.direccion, emp.telefono, emp.email, emp.cargo, emp.departamento,
        emp.sucursal_id, emp.fecha_ingreso, emp.fecha_salida or None,
        emp.tipo_contrato, emp.salario_base,
        emp.tiene_fondos_reserva, emp.decimo_tercero_acumulado,
        emp.decimo_cuarto_acumulado, emp.region, emp.num_cargas_familiares,
        emp.cuenta_bancaria, emp.banco, emp.tipo_cuenta,
        emp.usuario_id, emp.vendedor_id, emp.tecnico_id, emp.activo, eid
    ))
    return {"msg": "Empleado actualizado"}

@router.patch("/empleados/{eid}/toggle")
def toggle_empleado(eid: int, u=Depends(get_current_user)):
    emp = query_one("SELECT activo FROM nom_empleados WHERE id=%s", (eid,))
    if not emp:
        raise HTTPException(404)
    execute("UPDATE nom_empleados SET activo=%s WHERE id=%s", (not emp["activo"], eid))
    return {"activo": not emp["activo"]}


# ══════════════════════════════════════════════════════════════════
#  ROL DE PAGOS
# ══════════════════════════════════════════════════════════════════

@router.get("/roles")
def list_roles(
    periodo: Optional[str] = None,
    empleado_id: Optional[int] = None,
    estado: Optional[str] = None,
    u=Depends(get_current_user)
):
    conds = []
    params = []
    if periodo:
        conds.append("r.periodo=%s")
        params.append(periodo)
    if empleado_id:
        conds.append("r.empleado_id=%s")
        params.append(empleado_id)
    if estado:
        conds.append("r.estado=%s")
        params.append(estado)
    where = "WHERE " + " AND ".join(conds) if conds else ""
    return query(f"""
        SELECT r.*, e.nombres, e.apellidos, e.cedula, e.cargo, e.departamento
        FROM nom_roles_pago r
        JOIN nom_empleados e ON e.id = r.empleado_id
        {where}
        ORDER BY e.apellidos, e.nombres
    """, params)

@router.post("/roles/calcular")
def calcular_roles(data: CalcularRolIn, u=Depends(get_current_user)):
    """Calcular nómina para un periodo. Crea roles en estado BORRADOR."""
    cfg = _get_config()
    periodo = data.periodo  # "YYYY-MM"
    anio, mes = int(periodo[:4]), int(periodo[5:7])

    # Obtener empleados activos
    if data.empleado_ids:
        placeholders = ",".join(["%s"] * len(data.empleado_ids))
        empleados = query(f"SELECT * FROM nom_empleados WHERE activo=true AND id IN ({placeholders})", data.empleado_ids)
    else:
        empleados = query("SELECT * FROM nom_empleados WHERE activo=true")

    if not empleados:
        raise HTTPException(400, "No hay empleados activos para calcular")

    pct_personal = _float(cfg["aporte_personal_pct"]) / 100
    pct_patronal = _float(cfg["aporte_patronal_pct"]) / 100
    pct_fondos = _float(cfg["fondos_reserva_pct"]) / 100
    sbu = _float(cfg["sbu"])

    created = []
    for emp in empleados:
        # Verificar si ya existe rol para este periodo y empleado
        existing = query_one(
            "SELECT id FROM nom_roles_pago WHERE empleado_id=%s AND periodo=%s",
            (emp["id"], periodo)
        )
        if existing:
            # Actualizar en vez de duplicar
            execute("DELETE FROM nom_roles_pago WHERE id=%s", (existing["id"],))

        salario = _float(emp["salario_base"])
        dias_trabajados = 30

        # Horas extras: buscar si hay registros previos (por ahora default 0)
        horas_50 = 0
        horas_100 = 0
        valor_hora = salario / 240  # Valor hora normal
        valor_horas_50 = round(valor_hora * 1.5 * horas_50, 2)
        valor_horas_100 = round(valor_hora * 2.0 * horas_100, 2)

        # Comisiones: buscar de ven_vendedores si el empleado está vinculado
        comisiones = 0
        if emp.get("vendedor_id"):
            try:
                vend = query_one("SELECT comision_pct FROM ven_vendedores WHERE id=%s", (emp["vendedor_id"],))
                if vend:
                    pct_com = _float(vend.get("comision_pct", 0))
                    if pct_com > 0:
                        fecha_inicio = f"{periodo}-01"
                        last_day = calendar.monthrange(anio, mes)[1]
                        fecha_fin = f"{periodo}-{last_day}"
                        ventas = query_one("""
                            SELECT COALESCE(SUM(subtotal_0 + subtotal_iva), 0) as total
                            FROM ven_facturas
                            WHERE vendedor_id=%s AND fecha_emision BETWEEN %s AND %s
                            AND estado='EMITIDA'
                        """, (emp["vendedor_id"], fecha_inicio, fecha_fin))
                        if ventas:
                            comisiones = round(_float(ventas["total"]) * pct_com / 100, 2)
            except:
                pass

        bonificaciones = 0
        total_ingresos = salario + valor_horas_50 + valor_horas_100 + comisiones + bonificaciones

        # IESS
        aporte_personal = round(total_ingresos * pct_personal, 2)
        aporte_patronal = round(total_ingresos * pct_patronal, 2)

        # Décimo tercero mensualizado
        decimo_tercero = 0
        if emp.get("decimo_tercero_acumulado"):
            decimo_tercero = round(total_ingresos / 12, 2)

        # Décimo cuarto mensualizado
        decimo_cuarto = 0
        if emp.get("decimo_cuarto_acumulado"):
            decimo_cuarto = round(sbu / 12, 2)

        # Fondos de reserva (después de 1 año)
        fondos_reserva = 0
        years = _years_worked(emp["fecha_ingreso"], date(anio, mes, 1))
        if years >= 1 or emp.get("tiene_fondos_reserva"):
            fondos_reserva = round(total_ingresos * pct_fondos, 2)

        # Provisión vacaciones
        vacaciones_provision = round(total_ingresos / 24, 2)

        # Descuentos
        prestamos_iess = 0
        anticipo = 0
        otros_descuentos = 0

        # Auto-deduct active loans
        prestamo_row = query_one("""
            SELECT COALESCE(SUM(monto_cuota), 0) as total FROM nom_prestamos
            WHERE empleado_id=%s AND estado='ACTIVO' AND saldo > 0
        """, (emp['id'],))
        prestamos_empresa = float(prestamo_row['total']) if prestamo_row and prestamo_row['total'] else 0

        total_descuentos = aporte_personal + prestamos_iess + prestamos_empresa + anticipo + otros_descuentos

        # Neto a pagar
        neto = total_ingresos - total_descuentos
        if emp.get("decimo_tercero_acumulado"):
            neto += decimo_tercero
        if emp.get("decimo_cuarto_acumulado"):
            neto += decimo_cuarto

        rid = insert("""
            INSERT INTO nom_roles_pago
            (empleado_id, periodo, fecha_pago, dias_trabajados, salario_base,
             horas_extras_50, horas_extras_100, valor_horas_extras_50, valor_horas_extras_100,
             comisiones, bonificaciones, total_ingresos,
             aporte_iess_personal, aporte_iess_patronal,
             prestamos_iess, prestamos_empresa, anticipo, otros_descuentos,
             total_descuentos, neto_a_pagar,
             decimo_tercero, decimo_cuarto, fondos_reserva, vacaciones_provision,
             estado)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (
            emp["id"], periodo, None, dias_trabajados, salario,
            horas_50, horas_100, valor_horas_50, valor_horas_100,
            comisiones, bonificaciones, total_ingresos,
            aporte_personal, aporte_patronal,
            prestamos_iess, prestamos_empresa, anticipo, otros_descuentos,
            total_descuentos, round(neto, 2),
            decimo_tercero, decimo_cuarto, fondos_reserva, vacaciones_provision,
            "BORRADOR"
        ))
        created.append(rid)

    return {"msg": f"Nómina calculada para {len(created)} empleados", "roles_ids": created}

@router.get("/roles/{rid}")
def get_rol(rid: int, u=Depends(get_current_user)):
    rol = query_one("""
        SELECT r.*, e.nombres, e.apellidos, e.cedula, e.cargo, e.departamento,
               e.cuenta_bancaria, e.banco, e.tipo_cuenta, e.region
        FROM nom_roles_pago r
        JOIN nom_empleados e ON e.id = r.empleado_id
        WHERE r.id=%s
    """, (rid,))
    if not rol:
        raise HTTPException(404, "Rol de pagos no encontrado")
    return rol

@router.patch("/roles/{rid}/aprobar")
def aprobar_rol(rid: int, u=Depends(get_current_user)):
    rol = query_one("SELECT estado FROM nom_roles_pago WHERE id=%s", (rid,))
    if not rol:
        raise HTTPException(404)
    if rol["estado"] == "APROBADO":
        raise HTTPException(400, "Ya está aprobado")
    execute("UPDATE nom_roles_pago SET estado='APROBADO', fecha_pago=CURRENT_DATE WHERE id=%s", (rid,))
    return {"msg": "Rol aprobado"}

@router.post("/roles/aprobar-todos")
def aprobar_todos(data: AprobarTodosIn, u=Depends(get_current_user)):
    execute(
        "UPDATE nom_roles_pago SET estado='APROBADO', fecha_pago=CURRENT_DATE WHERE periodo=%s AND estado='BORRADOR'",
        (data.periodo,)
    )
    return {"msg": f"Todos los roles del periodo {data.periodo} aprobados"}

@router.get("/roles/{rid}/pdf")
def rol_pdf(rid: int, u=Depends(get_current_user)):
    """Generar PDF del rol de pagos individual."""
    rol = query_one("""
        SELECT r.*, e.nombres, e.apellidos, e.cedula, e.cargo, e.departamento,
               e.cuenta_bancaria, e.banco, e.region
        FROM nom_roles_pago r
        JOIN nom_empleados e ON e.id = r.empleado_id
        WHERE r.id=%s
    """, (rid,))
    if not rol:
        raise HTTPException(404)

    # Generar HTML simple como PDF simulado
    nombre = f"{rol['apellidos']} {rol['nombres']}"
    html = f"""
    <html><head><meta charset="utf-8">
    <style>
        body {{ font-family: Arial, sans-serif; font-size: 12px; margin: 30px; }}
        h2 {{ text-align: center; color: #333; }}
        table {{ width: 100%; border-collapse: collapse; margin-top: 10px; }}
        th, td {{ border: 1px solid #ccc; padding: 6px 10px; text-align: left; }}
        th {{ background: #f0f0f0; font-weight: bold; }}
        .section {{ margin-top: 20px; font-weight: bold; font-size: 13px; color: #2563EB; }}
        .total {{ font-weight: bold; background: #f9f9f9; }}
        .right {{ text-align: right; }}
    </style></head><body>
    <h2>ROL DE PAGOS</h2>
    <p><strong>Periodo:</strong> {rol['periodo']} | <strong>Empleado:</strong> {nombre} |
       <strong>Cédula:</strong> {rol['cedula']} | <strong>Cargo:</strong> {rol.get('cargo','')}</p>

    <div class="section">INGRESOS</div>
    <table>
        <tr><td>Salario Base</td><td class="right">${_float(rol['salario_base']):.2f}</td></tr>
        <tr><td>Horas Extras 50%</td><td class="right">${_float(rol['valor_horas_extras_50']):.2f}</td></tr>
        <tr><td>Horas Extras 100%</td><td class="right">${_float(rol['valor_horas_extras_100']):.2f}</td></tr>
        <tr><td>Comisiones</td><td class="right">${_float(rol['comisiones']):.2f}</td></tr>
        <tr><td>Bonificaciones</td><td class="right">${_float(rol['bonificaciones']):.2f}</td></tr>
        <tr class="total"><td>TOTAL INGRESOS</td><td class="right">${_float(rol['total_ingresos']):.2f}</td></tr>
    </table>

    <div class="section">DESCUENTOS</div>
    <table>
        <tr><td>Aporte IESS Personal (9.45%)</td><td class="right">${_float(rol['aporte_iess_personal']):.2f}</td></tr>
        <tr><td>Préstamos IESS</td><td class="right">${_float(rol['prestamos_iess']):.2f}</td></tr>
        <tr><td>Préstamos Empresa</td><td class="right">${_float(rol['prestamos_empresa']):.2f}</td></tr>
        <tr><td>Anticipos</td><td class="right">${_float(rol['anticipo']):.2f}</td></tr>
        <tr><td>Otros Descuentos</td><td class="right">${_float(rol['otros_descuentos']):.2f}</td></tr>
        <tr class="total"><td>TOTAL DESCUENTOS</td><td class="right">${_float(rol['total_descuentos']):.2f}</td></tr>
    </table>

    <div class="section">PROVISIONES</div>
    <table>
        <tr><td>Décimo Tercero</td><td class="right">${_float(rol['decimo_tercero']):.2f}</td></tr>
        <tr><td>Décimo Cuarto</td><td class="right">${_float(rol['decimo_cuarto']):.2f}</td></tr>
        <tr><td>Fondos de Reserva</td><td class="right">${_float(rol['fondos_reserva']):.2f}</td></tr>
        <tr><td>Vacaciones (Provisión)</td><td class="right">${_float(rol['vacaciones_provision']):.2f}</td></tr>
    </table>

    <div class="section">APORTE PATRONAL</div>
    <table>
        <tr><td>Aporte Patronal IESS (11.15%)</td><td class="right">${_float(rol['aporte_iess_patronal']):.2f}</td></tr>
    </table>

    <br/>
    <table>
        <tr class="total" style="font-size:14px;">
            <td>NETO A PAGAR</td><td class="right">${_float(rol['neto_a_pagar']):.2f}</td>
        </tr>
    </table>

    <br/><br/>
    <table style="border:none;">
        <tr style="border:none;">
            <td style="border:none; width:50%; text-align:center; padding-top:40px; border-top:1px solid #333;">
                EMPLEADOR
            </td>
            <td style="border:none; width:50%; text-align:center; padding-top:40px; border-top:1px solid #333;">
                EMPLEADO
            </td>
        </tr>
    </table>
    </body></html>
    """

    buf = io.BytesIO(html.encode("utf-8"))
    return StreamingResponse(
        buf,
        media_type="text/html",
        headers={"Content-Disposition": f'inline; filename="rol_{rol["periodo"]}_{rol["cedula"]}.html"'}
    )


# ══════════════════════════════════════════════════════════════════
#  DÉCIMOS
# ══════════════════════════════════════════════════════════════════

@router.get("/decimo-tercero")
def calcular_decimo_tercero(anio: int = 2026, u=Depends(get_current_user)):
    """
    Décimo Tercer Sueldo: 1/12 de todo lo ganado entre Dic 1 del año anterior y Nov 30 del año actual.
    Se paga hasta el 24 de diciembre.
    """
    fecha_ini = f"{anio - 1}-12-01"
    fecha_fin = f"{anio}-11-30"

    empleados = query("SELECT * FROM nom_empleados WHERE activo=true ORDER BY apellidos, nombres")
    resultado = []
    for emp in empleados:
        # Sumar todos los ingresos del periodo de roles
        total_ganado = query_one("""
            SELECT COALESCE(SUM(total_ingresos), 0) as total
            FROM nom_roles_pago
            WHERE empleado_id=%s AND periodo >= %s AND periodo <= %s
        """, (emp["id"], f"{anio-1}-12", f"{anio}-11"))

        total = _float(total_ganado["total"]) if total_ganado else 0

        # Si no hay roles, estimar con salario base * meses trabajados
        if total == 0:
            fi = emp["fecha_ingreso"]
            if isinstance(fi, str):
                fi = datetime.strptime(fi[:10], "%Y-%m-%d").date()
            inicio_periodo = date(anio - 1, 12, 1)
            fin_periodo = date(anio, 11, 30)
            if fi > fin_periodo:
                continue
            start = max(fi, inicio_periodo)
            meses = max(1, (fin_periodo.year - start.year) * 12 + fin_periodo.month - start.month)
            total = _float(emp["salario_base"]) * min(meses, 12)

        decimo = round(total / 12, 2)
        resultado.append({
            "empleado_id": emp["id"],
            "nombres": emp["nombres"],
            "apellidos": emp["apellidos"],
            "cedula": emp["cedula"],
            "cargo": emp.get("cargo", ""),
            "total_ganado": total,
            "decimo_tercero": decimo,
            "mensualizado": emp.get("decimo_tercero_acumulado", True),
        })

    return resultado

@router.get("/decimo-cuarto")
def calcular_decimo_cuarto(anio: int = 2026, u=Depends(get_current_user)):
    """
    Décimo Cuarto Sueldo: 1 SBU por año.
    Sierra/Oriente: pago hasta Ago 15 (periodo: Ago año anterior a Jul año actual)
    Costa/Insular: pago hasta Mar 15 (periodo: Mar año anterior a Feb año actual)
    """
    cfg = _get_config()
    sbu = _float(cfg["sbu"])

    empleados = query("SELECT * FROM nom_empleados WHERE activo=true ORDER BY apellidos, nombres")
    resultado = []
    for emp in empleados:
        region = (emp.get("region") or "SIERRA").upper()
        if region in ("SIERRA", "ORIENTE"):
            fecha_pago = f"{anio}-08-15"
            periodo_ini = date(anio - 1, 8, 1)
            periodo_fin = date(anio, 7, 31)
        else:
            fecha_pago = f"{anio}-03-15"
            periodo_ini = date(anio - 1, 3, 1)
            periodo_fin = date(anio, 2, 28)

        fi = emp["fecha_ingreso"]
        if isinstance(fi, str):
            fi = datetime.strptime(fi[:10], "%Y-%m-%d").date()

        if fi > periodo_fin:
            continue

        start = max(fi, periodo_ini)
        dias_trabajados = (periodo_fin - start).days + 1
        dias_periodo = (periodo_fin - periodo_ini).days + 1
        proporcional = round(sbu * dias_trabajados / dias_periodo, 2)

        resultado.append({
            "empleado_id": emp["id"],
            "nombres": emp["nombres"],
            "apellidos": emp["apellidos"],
            "cedula": emp["cedula"],
            "cargo": emp.get("cargo", ""),
            "region": region,
            "fecha_pago": fecha_pago,
            "sbu": sbu,
            "dias_trabajados": dias_trabajados,
            "dias_periodo": dias_periodo,
            "decimo_cuarto": proporcional,
            "mensualizado": emp.get("decimo_cuarto_acumulado", True),
        })

    return resultado


# ══════════════════════════════════════════════════════════════════
#  VACACIONES
# ══════════════════════════════════════════════════════════════════

@router.get("/vacaciones")
def list_vacaciones(empleado_id: Optional[int] = None, u=Depends(get_current_user)):
    conds = []
    params = []
    if empleado_id:
        conds.append("v.empleado_id=%s")
        params.append(empleado_id)
    where = "WHERE " + " AND ".join(conds) if conds else ""
    return query(f"""
        SELECT v.*, e.nombres, e.apellidos, e.cedula
        FROM nom_vacaciones v
        JOIN nom_empleados e ON e.id = v.empleado_id
        {where}
        ORDER BY v.fecha_inicio DESC
    """, params)

@router.post("/vacaciones")
def crear_vacacion(vac: VacacionIn, u=Depends(get_current_user)):
    emp = query_one("SELECT * FROM nom_empleados WHERE id=%s", (vac.empleado_id,))
    if not emp:
        raise HTTPException(404, "Empleado no encontrado")

    years = _years_worked(emp["fecha_ingreso"])
    vac_days = _vacation_days(years)
    taken = query_one(
        "SELECT COALESCE(SUM(dias_tomados),0) as total FROM nom_vacaciones WHERE empleado_id=%s AND estado='APROBADA'",
        (vac.empleado_id,)
    )
    total_taken = _float(taken["total"]) if taken else 0
    total_derecho = vac_days * max(1, int(years)) if years >= 1 else 0
    available = max(0, total_derecho - total_taken)

    if vac.dias_tomados > available:
        raise HTTPException(400, f"Solo tiene {available} días disponibles")

    daily_value = round(_float(emp["salario_base"]) / 24, 2)
    valor = round(daily_value * vac.dias_tomados, 2)

    vid = insert("""
        INSERT INTO nom_vacaciones (empleado_id, fecha_inicio, fecha_fin, dias_tomados, dias_derecho, valor, estado, observaciones)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
    """, (vac.empleado_id, vac.fecha_inicio, vac.fecha_fin, vac.dias_tomados, vac_days, valor, "APROBADA", vac.observaciones))

    return {"id": vid, "msg": "Vacaciones registradas", "valor": valor}

@router.get("/empleados/{eid}/vacaciones-disponibles")
def vacaciones_disponibles(eid: int, u=Depends(get_current_user)):
    emp = query_one("SELECT * FROM nom_empleados WHERE id=%s", (eid,))
    if not emp:
        raise HTTPException(404)

    years = _years_worked(emp["fecha_ingreso"])
    vac_days = _vacation_days(years)
    taken = query_one(
        "SELECT COALESCE(SUM(dias_tomados),0) as total FROM nom_vacaciones WHERE empleado_id=%s AND estado='APROBADA'",
        (eid,)
    )
    total_taken = _float(taken["total"]) if taken else 0
    total_derecho = vac_days * max(1, int(years)) if years >= 1 else 0
    available = max(0, total_derecho - total_taken)

    # Subtract days deducted by personal permissions
    permisos_descontados = query_one("SELECT COALESCE(dias_descontados,0) as d FROM nom_horas_acumuladas WHERE empleado_id=%s", (eid,))
    dias_por_permisos = int(permisos_descontados['d']) if permisos_descontados else 0
    available = max(0, available - dias_por_permisos)

    daily_value = round(_float(emp["salario_base"]) / 24, 2)

    return {
        "empleado_id": eid,
        "anos_servicio": round(years, 2),
        "dias_por_ano": vac_days,
        "total_derecho": total_derecho,
        "dias_tomados": total_taken,
        "dias_por_permisos": dias_por_permisos,
        "dias_disponibles": available,
        "valor_diario": daily_value,
    }


# ══════════════════════════════════════════════════════════════════
#  LIQUIDACIÓN
# ══════════════════════════════════════════════════════════════════

def calcular_liquidacion_interna(eid, motivo, fecha_salida_str=None):
    """Internal helper that computes settlement values without side effects."""
    emp = query_one("SELECT * FROM nom_empleados WHERE id=%s", (eid,))
    if not emp:
        return {}
    cfg = _get_config()
    sbu = _float(cfg["sbu"])
    pct_fondos = _float(cfg["fondos_reserva_pct"]) / 100

    fecha_salida = fecha_salida_str or (str(emp.get('fecha_salida', '')) if emp.get('fecha_salida') else date.today().isoformat())
    if not fecha_salida:
        fecha_salida = date.today().isoformat()
    fs = datetime.strptime(str(fecha_salida)[:10], "%Y-%m-%d").date()
    fi = emp["fecha_ingreso"]
    if isinstance(fi, str):
        fi = datetime.strptime(fi[:10], "%Y-%m-%d").date()

    years = _years_worked(fi, fs)
    salario = _float(emp["salario_base"])

    anio = fs.year
    inicio_13 = date(anio - 1, 12, 1) if fs.month < 12 else date(anio, 12, 1)
    dias_13 = (fs - inicio_13).days + 1
    dt13_proporcional = round(salario * dias_13 / 365, 2)

    region = (emp.get("region") or "SIERRA").upper()
    if region in ("SIERRA", "ORIENTE"):
        inicio_14 = date(anio - 1, 8, 1) if fs.month < 8 else date(anio, 8, 1)
    else:
        inicio_14 = date(anio - 1, 3, 1) if fs.month < 3 else date(anio, 3, 1)
    dias_14 = (fs - inicio_14).days + 1
    dt14_proporcional = round(sbu * dias_14 / 365, 2)

    vac_days = _vacation_days(years)
    taken = query_one(
        "SELECT COALESCE(SUM(dias_tomados),0) as total FROM nom_vacaciones WHERE empleado_id=%s AND estado='APROBADA'",
        (eid,)
    )
    total_taken = _float(taken["total"]) if taken else 0
    total_derecho = vac_days * max(1, int(years)) if years >= 1 else 0
    dias_pendientes = max(0, total_derecho - total_taken)
    valor_vacaciones = round(salario / 24 * dias_pendientes, 2)

    fondos_reserva = 0
    if years >= 1:
        meses_ultimo_anio = min(12, int((years % 1) * 12)) or 12
        fondos_reserva = round(salario * pct_fondos * meses_ultimo_anio / 12, 2)

    desahucio = 0
    if motivo == "DESAHUCIO":
        desahucio = round(salario * 0.25 * max(1, math.ceil(years)), 2)

    despido_intempestivo = 0
    if motivo == "DESPIDO_INTEMPESTIVO":
        if years <= 3:
            despido_intempestivo = round(salario * 3, 2)
        else:
            meses = min(int(math.ceil(years)), 25)
            despido_intempestivo = round(salario * meses, 2)

    total = (dt13_proporcional + dt14_proporcional + valor_vacaciones +
             fondos_reserva + desahucio + despido_intempestivo)

    return {
        "decimo_tercero_prop": dt13_proporcional,
        "decimo_cuarto_prop": dt14_proporcional,
        "vacaciones_no_gozadas": valor_vacaciones,
        "vacaciones_no_gozadas_dias": dias_pendientes,
        "fondos_reserva_prop": fondos_reserva,
        "desahucio": desahucio,
        "despido_intempestivo": despido_intempestivo,
        "total": round(total, 2),
    }


@router.post("/empleados/{eid}/liquidacion")
def calcular_liquidacion(eid: int, data: LiquidacionIn, u=Depends(get_current_user)):
    """
    Calcular liquidación (settlement) al salir un empleado.
    Motivos: RENUNCIA, DESPIDO_INTEMPESTIVO, DESAHUCIO, MUTUO_ACUERDO
    """
    emp = query_one("SELECT * FROM nom_empleados WHERE id=%s", (eid,))
    if not emp:
        raise HTTPException(404)

    cfg = _get_config()
    sbu = _float(cfg["sbu"])
    pct_fondos = _float(cfg["fondos_reserva_pct"]) / 100

    fecha_salida = data.fecha_salida or date.today().isoformat()
    fs = datetime.strptime(fecha_salida[:10], "%Y-%m-%d").date()
    fi = emp["fecha_ingreso"]
    if isinstance(fi, str):
        fi = datetime.strptime(fi[:10], "%Y-%m-%d").date()

    years = _years_worked(fi, fs)
    salario = _float(emp["salario_base"])

    # ── Décimo Tercero proporcional ──
    # Periodo: Dic 1 a fecha de salida
    anio = fs.year
    inicio_13 = date(anio - 1, 12, 1) if fs.month < 12 else date(anio, 12, 1)
    dias_13 = (fs - inicio_13).days + 1
    dt13_proporcional = round(salario * dias_13 / 365, 2)

    # ── Décimo Cuarto proporcional ──
    region = (emp.get("region") or "SIERRA").upper()
    if region in ("SIERRA", "ORIENTE"):
        inicio_14 = date(anio - 1, 8, 1) if fs.month < 8 else date(anio, 8, 1)
    else:
        inicio_14 = date(anio - 1, 3, 1) if fs.month < 3 else date(anio, 3, 1)
    dias_14 = (fs - inicio_14).days + 1
    dt14_proporcional = round(sbu * dias_14 / 365, 2)

    # ── Vacaciones no gozadas ──
    vac_days = _vacation_days(years)
    taken = query_one(
        "SELECT COALESCE(SUM(dias_tomados),0) as total FROM nom_vacaciones WHERE empleado_id=%s AND estado='APROBADA'",
        (eid,)
    )
    total_taken = _float(taken["total"]) if taken else 0
    total_derecho = vac_days * max(1, int(years)) if years >= 1 else 0
    dias_pendientes = max(0, total_derecho - total_taken)
    valor_vacaciones = round(salario / 24 * dias_pendientes, 2)

    # ── Fondos de Reserva proporcional ──
    fondos_reserva = 0
    if years >= 1:
        # Proporcional del último periodo
        meses_ultimo_anio = min(12, int((years % 1) * 12)) or 12
        fondos_reserva = round(salario * pct_fondos * meses_ultimo_anio / 12, 2)

    # ── Desahucio: 25% del último salario por cada año ──
    desahucio = 0
    if data.motivo == "DESAHUCIO":
        desahucio = round(salario * 0.25 * max(1, math.ceil(years)), 2)

    # ── Despido Intempestivo ──
    despido_intempestivo = 0
    if data.motivo == "DESPIDO_INTEMPESTIVO":
        if years <= 3:
            despido_intempestivo = round(salario * 3, 2)  # 3 meses
        else:
            meses = min(int(math.ceil(years)), 25)  # 1 mes por año, max 25
            despido_intempestivo = round(salario * meses, 2)

    # ── Total Liquidación ──
    total = (dt13_proporcional + dt14_proporcional + valor_vacaciones +
             fondos_reserva + desahucio + despido_intempestivo)

    result = {
        "empleado_id": eid,
        "nombres": emp["nombres"],
        "apellidos": emp["apellidos"],
        "cedula": emp["cedula"],
        "cargo": emp.get("cargo", ""),
        "fecha_ingreso": str(fi),
        "fecha_salida": fecha_salida,
        "anos_servicio": round(years, 2),
        "salario_base": salario,
        "motivo": data.motivo,
        "desglose": {
            "decimo_tercero_proporcional": dt13_proporcional,
            "decimo_cuarto_proporcional": dt14_proporcional,
            "vacaciones_no_gozadas_dias": dias_pendientes,
            "vacaciones_no_gozadas_valor": valor_vacaciones,
            "fondos_reserva": fondos_reserva,
            "desahucio": desahucio,
            "despido_intempestivo": despido_intempestivo,
        },
        "total_liquidacion": round(total, 2),
    }

    # Marcar empleado como inactivo
    execute("UPDATE nom_empleados SET activo=false, fecha_salida=%s WHERE id=%s", (fecha_salida, eid))

    return result


# ══════════════════════════════════════════════════════════════════
#  REPORTES
# ══════════════════════════════════════════════════════════════════

@router.get("/reporte-planilla")
def reporte_planilla(periodo: str, u=Depends(get_current_user)):
    """Reporte de planilla general del periodo."""
    roles = query("""
        SELECT r.*, e.nombres, e.apellidos, e.cedula, e.cargo, e.departamento
        FROM nom_roles_pago r
        JOIN nom_empleados e ON e.id = r.empleado_id
        WHERE r.periodo=%s
        ORDER BY e.apellidos, e.nombres
    """, (periodo,))

    totales = {
        "salario_base": 0, "total_ingresos": 0,
        "aporte_iess_personal": 0, "aporte_iess_patronal": 0,
        "total_descuentos": 0, "neto_a_pagar": 0,
        "decimo_tercero": 0, "decimo_cuarto": 0,
        "fondos_reserva": 0, "vacaciones_provision": 0,
        "empleados": len(roles),
    }
    for r in roles:
        for k in totales:
            if k != "empleados" and k in r:
                totales[k] += _float(r[k])

    # Round totales
    for k in totales:
        if k != "empleados":
            totales[k] = round(totales[k], 2)

    return {"roles": roles, "totales": totales, "periodo": periodo}

@router.get("/reporte-iess")
def reporte_iess(periodo: str, u=Depends(get_current_user)):
    """Reporte para declaración al IESS."""
    roles = query("""
        SELECT r.empleado_id, e.cedula, e.apellidos, e.nombres, e.cargo,
               r.salario_base, r.total_ingresos,
               r.aporte_iess_personal, r.aporte_iess_patronal,
               r.fondos_reserva,
               (r.aporte_iess_personal + r.aporte_iess_patronal) as total_aporte
        FROM nom_roles_pago r
        JOIN nom_empleados e ON e.id = r.empleado_id
        WHERE r.periodo=%s
        ORDER BY e.apellidos, e.nombres
    """, (periodo,))

    total_personal = sum(_float(r["aporte_iess_personal"]) for r in roles)
    total_patronal = sum(_float(r["aporte_iess_patronal"]) for r in roles)
    total_fondos = sum(_float(r["fondos_reserva"]) for r in roles)

    return {
        "roles": roles,
        "periodo": periodo,
        "total_aporte_personal": round(total_personal, 2),
        "total_aporte_patronal": round(total_patronal, 2),
        "total_fondos_reserva": round(total_fondos, 2),
        "total_general": round(total_personal + total_patronal, 2),
    }

@router.get("/reporte-provisiones")
def reporte_provisiones(periodo: str, u=Depends(get_current_user)):
    """Reporte de provisiones: décimos, vacaciones, fondos de reserva."""
    roles = query("""
        SELECT r.empleado_id, e.cedula, e.apellidos, e.nombres,
               r.total_ingresos, r.decimo_tercero, r.decimo_cuarto,
               r.fondos_reserva, r.vacaciones_provision,
               (r.decimo_tercero + r.decimo_cuarto + r.fondos_reserva + r.vacaciones_provision) as total_provisiones
        FROM nom_roles_pago r
        JOIN nom_empleados e ON e.id = r.empleado_id
        WHERE r.periodo=%s
        ORDER BY e.apellidos, e.nombres
    """, (periodo,))

    totales = {
        "decimo_tercero": round(sum(_float(r["decimo_tercero"]) for r in roles), 2),
        "decimo_cuarto": round(sum(_float(r["decimo_cuarto"]) for r in roles), 2),
        "fondos_reserva": round(sum(_float(r["fondos_reserva"]) for r in roles), 2),
        "vacaciones": round(sum(_float(r["vacaciones_provision"]) for r in roles), 2),
    }
    totales["total"] = round(sum(totales.values()), 2)

    return {"roles": roles, "totales": totales, "periodo": periodo}


# ══════════════════════════════════════════════════════════════════
#  ARCHIVO BANCARIO
# ══════════════════════════════════════════════════════════════════

@router.get("/roles/archivo-bancario")
def generar_archivo_bancario(periodo: str, banco: str = 'PICHINCHA', u=Depends(get_current_user)):
    """Generate bank file for mass payment. Format depends on bank."""
    roles = query("""
        SELECT r.*, e.cedula, e.nombres, e.apellidos, e.cuenta_bancaria, e.banco, e.tipo_cuenta
        FROM nom_roles_pago r
        JOIN nom_empleados e ON e.id=r.empleado_id
        WHERE r.periodo=%s AND r.estado='APROBADO'
        ORDER BY e.apellidos
    """, (periodo,))

    if not roles:
        raise HTTPException(400, "No hay roles aprobados para este periodo")

    lines = []
    total = 0

    if banco.upper() in ('PICHINCHA', 'GENERAL'):
        # Banco Pichincha format: PA|tipo_cuenta|num_cuenta|cedula|apellidos nombres|monto|referencia
        for r in roles:
            tipo = 'AHO' if (r.get('tipo_cuenta', '') or '').upper() == 'AHORROS' else 'CTE'
            monto = f"{float(r['neto_a_pagar']):.2f}"
            total += float(r['neto_a_pagar'])
            lines.append(f"PA|{tipo}|{r.get('cuenta_bancaria', '')}|{r['cedula']}|{r['apellidos']} {r['nombres']}|{monto}|ROL {periodo}")
    else:
        # Generic CSV format
        lines.append("CEDULA,NOMBRE,CUENTA,TIPO,MONTO,REFERENCIA")
        for r in roles:
            monto = f"{float(r['neto_a_pagar']):.2f}"
            total += float(r['neto_a_pagar'])
            lines.append(f"{r['cedula']},{r['apellidos']} {r['nombres']},{r.get('cuenta_bancaria', '')},{r.get('tipo_cuenta', '')},{monto},ROL {periodo}")

    content = '\n'.join(lines)
    filename = f"pago_nomina_{periodo}_{banco.lower()}.txt"

    from fastapi.responses import Response
    return Response(content=content, media_type="text/plain",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'})


# ══════════════════════════════════════════════════════════════════
#  ARCHIVO IESS
# ══════════════════════════════════════════════════════════════════

@router.get("/roles/archivo-iess")
def generar_archivo_iess(periodo: str, u=Depends(get_current_user)):
    """Generate IESS declaration file."""
    config = _get_config()
    roles = query("""
        SELECT r.*, e.cedula, e.nombres, e.apellidos, e.fecha_ingreso, e.fecha_salida
        FROM nom_roles_pago r
        JOIN nom_empleados e ON e.id=r.empleado_id
        WHERE r.periodo=%s AND r.estado='APROBADO'
    """, (periodo,))

    if not roles:
        raise HTTPException(400, "No hay roles aprobados para este periodo")

    lines = []
    # IESS format: cedula|apellidos|nombres|dias|sueldo|horas_extras|comisiones|otros|observacion
    for r in roles:
        sueldo = f"{float(r['salario_base']):.2f}"
        extras = f"{float(r.get('valor_horas_extras_50', 0)) + float(r.get('valor_horas_extras_100', 0)):.2f}"
        comisiones = f"{float(r.get('comisiones', 0)):.2f}"
        dias = r.get('dias_trabajados', 30)
        aviso = ''
        if r.get('fecha_salida'):
            aviso = 'S'  # Salida
        lines.append(f"{r['cedula']}|{r['apellidos']}|{r['nombres']}|{dias}|{sueldo}|{extras}|{comisiones}|0.00|{aviso}")

    content = '\n'.join(lines)
    from fastapi.responses import Response
    return Response(content=content, media_type="text/plain",
        headers={"Content-Disposition": f'attachment; filename="iess_{periodo}.txt"'})


# ══════════════════════════════════════════════════════════════════
#  PRESTAMOS Y ANTICIPOS
# ══════════════════════════════════════════════════════════════════

@router.get("/prestamos")
def get_prestamos(empleado_id: Optional[int] = None, estado: Optional[str] = None, u=Depends(get_current_user)):
    conds = []
    params = []
    if empleado_id:
        conds.append("p.empleado_id=%s")
        params.append(empleado_id)
    if estado:
        conds.append("p.estado=%s")
        params.append(estado)
    else:
        conds.append("p.saldo > 0")
    where = "WHERE " + " AND ".join(conds) if conds else ""
    return query(f"""
        SELECT p.*, e.nombres, e.apellidos, e.cedula
        FROM nom_prestamos p JOIN nom_empleados e ON e.id=p.empleado_id
        {where} ORDER BY p.fecha DESC
    """, params)

@router.post("/prestamos")
def crear_prestamo(empleado_id: int, tipo: str, monto_total: float, cuotas: int = 1, observaciones: str = '', u=Depends(get_current_user)):
    emp = query_one("SELECT id FROM nom_empleados WHERE id=%s", (empleado_id,))
    if not emp:
        raise HTTPException(404, "Empleado no encontrado")
    monto_cuota = round(monto_total / cuotas, 2)
    pid = insert("""
        INSERT INTO nom_prestamos (empleado_id, tipo, monto_total, cuotas, monto_cuota, saldo, observaciones)
        VALUES (%s,%s,%s,%s,%s,%s,%s)
    """, (empleado_id, tipo, monto_total, cuotas, monto_cuota, monto_total, observaciones))
    return {"id": pid, "msg": f"{'Anticipo' if tipo == 'ANTICIPO' else 'Prestamo'} registrado", "cuota_mensual": monto_cuota}

@router.patch("/prestamos/{pid}/abonar")
def abonar_prestamo(pid: int, monto: float, u=Depends(get_current_user)):
    p = query_one("SELECT * FROM nom_prestamos WHERE id=%s", (pid,))
    if not p:
        raise HTTPException(404)
    nuevo_saldo = max(0, float(p['saldo']) - monto)
    nuevas_cuotas = int(p['cuotas_pagadas']) + 1
    estado = 'PAGADO' if nuevo_saldo == 0 else 'ACTIVO'
    execute("UPDATE nom_prestamos SET saldo=%s, cuotas_pagadas=%s, estado=%s WHERE id=%s",
            (nuevo_saldo, nuevas_cuotas, estado, pid))
    return {"msg": "Abono registrado", "saldo": nuevo_saldo}


# ══════════════════════════════════════════════════════════════════
#  ACTA DE FINIQUITO PDF
# ══════════════════════════════════════════════════════════════════

@router.get("/empleados/{eid}/acta-finiquito")
def acta_finiquito_pdf(eid: int, motivo: str = 'RENUNCIA', u=Depends(get_current_user)):
    """Generate Acta de Finiquito PDF in MRL format."""
    emp = query_one("SELECT * FROM nom_empleados WHERE id=%s", (eid,))
    if not emp:
        raise HTTPException(404, "Empleado no encontrado")
    empresa = query_one("SELECT * FROM sys_empresas WHERE activa=true LIMIT 1")

    liquidacion_data = calcular_liquidacion_interna(eid, motivo)

    nombre = f"{emp['apellidos']} {emp['nombres']}"
    rubros_rows = ""
    for key, label in [
        ('decimo_tercero_prop', 'Decimo Tercero Proporcional'),
        ('decimo_cuarto_prop', 'Decimo Cuarto Proporcional'),
        ('vacaciones_no_gozadas', 'Vacaciones No Gozadas'),
        ('fondos_reserva_prop', 'Fondos de Reserva Proporcional'),
        ('desahucio', 'Desahucio (Art. 185 CT)'),
        ('despido_intempestivo', 'Indemnizacion Despido Intempestivo'),
    ]:
        val = float(liquidacion_data.get(key, 0))
        if val > 0:
            rubros_rows += f'<tr><td style="padding:6px 10px;border:1px solid #ccc;">{label}</td><td style="padding:6px 10px;border:1px solid #ccc;text-align:right;">${val:.2f}</td></tr>'

    total = float(liquidacion_data.get('total', 0))
    rubros_rows += f'<tr style="background:#e2e8f0;font-weight:bold;"><td style="padding:6px 10px;border:1px solid #ccc;">TOTAL A PAGAR</td><td style="padding:6px 10px;border:1px solid #ccc;text-align:right;">${total:.2f}</td></tr>'

    razon_social = empresa.get('razon_social', '') if empresa else ''
    ruc = empresa.get('ruc', '') if empresa else ''

    html = f"""
    <html><head><meta charset="utf-8">
    <style>
        body {{ font-family: Arial, sans-serif; font-size: 12px; margin: 30px; }}
        h2 {{ text-align: center; color: #333; }}
        .subtitle {{ text-align: center; color: #666; font-size: 11px; margin-bottom: 20px; }}
        table {{ width: 100%; border-collapse: collapse; margin-top: 10px; }}
        .info td {{ border: none; padding: 4px 10px; font-size: 11px; }}
        .info .lbl {{ font-weight: bold; width: 130px; }}
    </style></head><body>
    <h2>ACTA DE FINIQUITO</h2>
    <div class="subtitle">(Art. 185 Codigo del Trabajo)</div>

    <table class="info">
        <tr><td class="lbl">EMPLEADOR:</td><td>{razon_social}</td></tr>
        <tr><td class="lbl">RUC:</td><td>{ruc}</td></tr>
        <tr><td class="lbl">TRABAJADOR:</td><td>{nombre}</td></tr>
        <tr><td class="lbl">CEDULA:</td><td>{emp['cedula']}</td></tr>
        <tr><td class="lbl">CARGO:</td><td>{emp.get('cargo', '')}</td></tr>
        <tr><td class="lbl">FECHA INGRESO:</td><td>{str(emp['fecha_ingreso'])[:10]}</td></tr>
        <tr><td class="lbl">FECHA SALIDA:</td><td>{str(emp.get('fecha_salida', ''))[:10]}</td></tr>
        <tr><td class="lbl">MOTIVO:</td><td>{motivo.replace('_', ' ')}</td></tr>
        <tr><td class="lbl">ULTIMO SUELDO:</td><td>${float(emp['salario_base']):.2f}</td></tr>
    </table>

    <h3 style="color:#2563EB;margin-top:20px;">LIQUIDACION DE HABERES</h3>
    <table>{rubros_rows}</table>

    <p style="margin-top:30px;">Las partes declaran su conformidad con los valores liquidados.</p>

    <table style="margin-top:50px;border:none;">
        <tr style="border:none;">
            <td style="border:none;width:50%;text-align:center;padding-top:40px;border-top:1px solid #333;">EMPLEADOR</td>
            <td style="border:none;width:50%;text-align:center;padding-top:40px;border-top:1px solid #333;">TRABAJADOR</td>
        </tr>
    </table>
    </body></html>
    """

    buf = io.BytesIO(html.encode("utf-8"))
    return StreamingResponse(
        buf,
        media_type="text/html",
        headers={"Content-Disposition": f'inline; filename="Finiquito_{emp["cedula"]}.html"'}
    )


# ══════════════════════════════════════════════════════════════════
#  CERTIFICADO DE TRABAJO PDF
# ══════════════════════════════════════════════════════════════════

@router.get("/empleados/{eid}/certificado-trabajo")
def certificado_trabajo_pdf(eid: int, u=Depends(get_current_user)):
    """Generate employment certificate PDF."""
    emp = query_one("SELECT * FROM nom_empleados WHERE id=%s", (eid,))
    if not emp:
        raise HTTPException(404, "Empleado no encontrado")
    empresa = query_one("SELECT * FROM sys_empresas WHERE activa=true LIMIT 1")

    razon_social = empresa.get('razon_social', 'LA EMPRESA') if empresa else 'LA EMPRESA'
    ruc = empresa.get('ruc', '') if empresa else ''
    nombre = f"{emp['nombres']} {emp['apellidos']}"
    fecha_ingreso = str(emp['fecha_ingreso'])[:10]
    cargo = emp.get('cargo', 'sus funciones')
    salario = f"{float(emp['salario_base']):.2f}"
    fecha_hoy = date.today().strftime("%d de %B de %Y")

    estado_txt = "labora" if emp.get('activo') else "laboro"

    html = f"""
    <html><head><meta charset="utf-8">
    <style>
        body {{ font-family: Arial, sans-serif; font-size: 13px; margin: 60px 50px; line-height: 1.8; }}
        h2 {{ text-align: center; color: #333; margin-bottom: 40px; }}
        .body-text {{ text-align: justify; margin: 20px 0; }}
        .signature {{ margin-top: 80px; text-align: center; }}
    </style></head><body>

    <h2>CERTIFICADO DE TRABAJO</h2>

    <p class="body-text">
        <strong>{razon_social}</strong>{f', con RUC {ruc},' if ruc else ','} por medio del presente documento certifica que:
    </p>

    <p class="body-text">
        El/La Sr(a). <strong>{nombre}</strong>, portador(a) de la cedula de identidad No. <strong>{emp['cedula']}</strong>,
        {estado_txt} en esta empresa desde el <strong>{fecha_ingreso}</strong>,
        desempenando el cargo de <strong>{cargo}</strong>,
        con una remuneracion mensual de <strong>${salario}</strong>.
    </p>

    <p class="body-text">
        Durante su permanencia en la empresa, ha demostrado responsabilidad y dedicacion en el cumplimiento de sus funciones.
    </p>

    <p class="body-text">
        Se expide el presente certificado a solicitud del interesado, para los fines legales que estime pertinentes.
    </p>

    <p class="body-text" style="margin-top: 10px;">
        Dado en la ciudad, a {fecha_hoy}.
    </p>

    <div class="signature">
        <div style="margin-top:60px;border-top:1px solid #333;display:inline-block;padding-top:10px;min-width:250px;">
            <strong>{razon_social}</strong><br/>
            REPRESENTANTE LEGAL
        </div>
    </div>

    </body></html>
    """

    buf = io.BytesIO(html.encode("utf-8"))
    return StreamingResponse(
        buf,
        media_type="text/html",
        headers={"Content-Disposition": f'inline; filename="Certificado_{emp["cedula"]}.html"'}
    )


# ══════════════════════════════════════════════════════════════
#  PERMISOS LABORALES
# ══════════════════════════════════════════════════════════════

TIPOS_PERMISO = [
    {"id": "PERSONAL", "nombre": "Personal", "descuenta_vacacion": True, "pagado": True},
    {"id": "MEDICO", "nombre": "Médico", "descuenta_vacacion": False, "pagado": True},
    {"id": "CALAMIDAD", "nombre": "Calamidad Doméstica", "descuenta_vacacion": False, "pagado": True, "max_dias": 3},
    {"id": "MATERNIDAD", "nombre": "Maternidad", "descuenta_vacacion": False, "pagado": True, "max_dias": 84},
    {"id": "PATERNIDAD", "nombre": "Paternidad", "descuenta_vacacion": False, "pagado": True, "max_dias": 10},
    {"id": "ESTUDIOS", "nombre": "Estudios", "descuenta_vacacion": False, "pagado": True},
    {"id": "SIN_SUELDO", "nombre": "Sin Sueldo", "descuenta_vacacion": False, "pagado": False},
]

@router.get("/permisos/tipos")
def get_tipos_permiso(u=Depends(get_current_user)):
    return TIPOS_PERMISO

@router.get("/permisos")
def get_permisos(empleado_id: Optional[int] = None, estado: Optional[str] = None,
                  fecha_ini: Optional[str] = None, fecha_fin: Optional[str] = None,
                  u=Depends(get_current_user)):
    conds = ["1=1"]; params = []
    if empleado_id: conds.append("p.empleado_id=%s"); params.append(empleado_id)
    if estado: conds.append("p.estado=%s"); params.append(estado)
    if fecha_ini: conds.append("p.fecha>=%s"); params.append(fecha_ini)
    if fecha_fin: conds.append("p.fecha<=%s"); params.append(fecha_fin)
    where = "WHERE " + " AND ".join(conds)
    return query(f"""
        SELECT p.*, e.nombres, e.apellidos, e.cedula,
               u.nombre as aprobado_por_nombre
        FROM nom_permisos p
        JOIN nom_empleados e ON e.id=p.empleado_id
        LEFT JOIN sys_usuarios u ON u.id=p.aprobado_por
        {where} ORDER BY p.fecha DESC, p.created_at DESC
    """, params)

@router.post("/permisos")
def solicitar_permiso(empleado_id: int, tipo: str, modalidad: str, fecha: str,
                       motivo: str, horas: float = 0, dias: float = 0,
                       hora_salida: str = None, hora_regreso: str = None,
                       u=Depends(get_current_user)):
    # Validate tipo
    tipo_info = next((t for t in TIPOS_PERMISO if t['id'] == tipo), None)
    if not tipo_info: raise HTTPException(400, "Tipo de permiso inválido")

    # Calculate hours/days
    if modalidad == 'HORAS':
        if horas <= 0: raise HTTPException(400, "Debe indicar las horas")
        dias = 0
    else:  # DIA_COMPLETO
        if dias <= 0: dias = 1
        horas = dias * 8

    descuenta = tipo_info['descuenta_vacacion']

    pid = insert("""
        INSERT INTO nom_permisos (empleado_id, tipo, modalidad, fecha, hora_salida, hora_regreso,
                                   horas, dias, motivo, estado, descuenta_vacacion)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,'SOLICITADO',%s)
    """, (empleado_id, tipo, modalidad, fecha, hora_salida, hora_regreso,
          horas, dias, motivo, descuenta))

    return {"id": pid, "msg": "Permiso solicitado", "descuenta_vacacion": descuenta}

@router.patch("/permisos/{pid}/aprobar")
def aprobar_permiso(pid: int, u=Depends(get_current_user)):
    perm = query_one("SELECT * FROM nom_permisos WHERE id=%s", (pid,))
    if not perm: raise HTTPException(404)
    if perm['estado'] != 'SOLICITADO': raise HTTPException(400, "Solo se pueden aprobar permisos solicitados")

    execute("""
        UPDATE nom_permisos SET estado='APROBADO', aprobado_por=%s, fecha_aprobacion=NOW()
        WHERE id=%s
    """, (u['id'], pid))

    # If it deducts from vacation
    if perm.get('descuenta_vacacion'):
        if perm['modalidad'] == 'DIA_COMPLETO':
            # Deduct full days directly from vacation balance
            dias_val = float(perm.get('dias', 1))
            execute("""
                UPDATE nom_permisos SET vacacion_descontada=true WHERE id=%s
            """, (pid,))
            # Record in nom_horas_acumuladas
            existing = query_one("SELECT * FROM nom_horas_acumuladas WHERE empleado_id=%s", (perm['empleado_id'],))
            if existing:
                execute("UPDATE nom_horas_acumuladas SET dias_descontados=dias_descontados+%s, updated_at=NOW() WHERE empleado_id=%s",
                        (int(dias_val), perm['empleado_id']))
            else:
                insert("INSERT INTO nom_horas_acumuladas (empleado_id, dias_descontados) VALUES (%s,%s)",
                       (perm['empleado_id'], int(dias_val)))

            return {"msg": f"Aprobado. Se descuentan {int(dias_val)} día(s) de vacaciones", "dias_descontados": int(dias_val)}

        else:  # HORAS
            horas_permiso = float(perm.get('horas', 0))

            existing = query_one("SELECT * FROM nom_horas_acumuladas WHERE empleado_id=%s", (perm['empleado_id'],))
            if existing:
                nuevas_horas = float(existing['horas_acumuladas']) + horas_permiso
                dias_a_descontar = int(nuevas_horas // 8)
                horas_restantes = round(nuevas_horas % 8, 2)

                execute("""
                    UPDATE nom_horas_acumuladas SET horas_acumuladas=%s,
                    dias_descontados=dias_descontados+%s, updated_at=NOW()
                    WHERE empleado_id=%s
                """, (horas_restantes, dias_a_descontar, perm['empleado_id']))
            else:
                nuevas_horas = horas_permiso
                dias_a_descontar = int(nuevas_horas // 8)
                horas_restantes = round(nuevas_horas % 8, 2)

                insert("INSERT INTO nom_horas_acumuladas (empleado_id, horas_acumuladas, dias_descontados) VALUES (%s,%s,%s)",
                       (perm['empleado_id'], horas_restantes, dias_a_descontar))

            if dias_a_descontar > 0:
                execute("UPDATE nom_permisos SET vacacion_descontada=true WHERE id=%s", (pid,))
                return {"msg": f"Aprobado. {horas_permiso}h acumuladas → {dias_a_descontar} día(s) descontado(s). Horas pendientes: {horas_restantes}h",
                        "horas_acumuladas": horas_restantes, "dias_descontados": dias_a_descontar}
            else:
                return {"msg": f"Aprobado. {horas_permiso}h acumuladas. Total acumulado: {horas_restantes}h (faltan {round(8-horas_restantes,2)}h para descontar 1 día)",
                        "horas_acumuladas": horas_restantes, "dias_descontados": 0}

    return {"msg": "Permiso aprobado (no descuenta vacaciones)"}

@router.patch("/permisos/{pid}/rechazar")
def rechazar_permiso(pid: int, observaciones: str = '', u=Depends(get_current_user)):
    execute("UPDATE nom_permisos SET estado='RECHAZADO', observaciones=%s, aprobado_por=%s, fecha_aprobacion=NOW() WHERE id=%s",
            (observaciones, u['id'], pid))
    return {"msg": "Permiso rechazado"}

@router.get("/permisos/horas-acumuladas/{eid}")
def get_horas_acumuladas(eid: int, u=Depends(get_current_user)):
    """Get accumulated permission hours for an employee."""
    acum = query_one("SELECT * FROM nom_horas_acumuladas WHERE empleado_id=%s", (eid,))
    if not acum:
        return {"empleado_id": eid, "horas_acumuladas": 0, "dias_descontados": 0, "horas_para_proximo_dia": 8}
    horas = float(acum['horas_acumuladas'])
    return {
        "empleado_id": eid,
        "horas_acumuladas": horas,
        "dias_descontados": acum['dias_descontados'],
        "horas_para_proximo_dia": round(8 - horas, 2) if horas < 8 else 0,
    }
