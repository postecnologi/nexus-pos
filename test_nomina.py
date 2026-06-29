import requests, json

BASE = "http://localhost:8000/api"
S = requests.Session()
r = S.post(f"{BASE}/auth/login", data={"username":"admin","password":"admin123"})
S.headers["Authorization"] = f"Bearer {r.json()['access_token']}"

PASS = 0; FAIL = 0; ERRORS = []
def ok(name, r):
    global PASS, FAIL
    if r.status_code in (200,201):
        PASS += 1
        try: d = r.json()
        except: d = {"raw": r.text[:100]}
        print(f"  OK  {name}")
        return d
    else:
        FAIL += 1
        try: detail = str(r.json().get("detail",""))[:100]
        except: detail = r.text[:100]
        ERRORS.append(f"{name}: {r.status_code} - {detail}")
        print(f"  ERR {name} ({r.status_code}) {detail}")
        return None

print("=" * 60)
print("  PRUEBA COMPLETA: NOMINA")
print("=" * 60)

print("\n--- 1. CONFIGURACION ---")
cfg = ok("Config nomina", S.get(f"{BASE}/nomina/config"))
if cfg:
    print(f"    SBU: ${cfg.get('sbu',0)}")
    print(f"    IESS Personal: {cfg.get('aporte_personal_pct',0)}%")
    print(f"    IESS Patronal: {cfg.get('aporte_patronal_pct',0)}%")
    print(f"    Fondos Reserva: {cfg.get('fondos_reserva_pct',0)}%")

print("\n--- 2. EMPLEADOS ---")
emps = S.get(f"{BASE}/nomina/empleados").json()
print(f"  {len(emps)} empleados")

if len(emps) == 0:
    print("  Creando empleados de prueba...")
    ok("Empleado 1", S.post(f"{BASE}/nomina/empleados", json={
        "cedula":"1759046343","nombres":"Hernan","apellidos":"Ferrer",
        "cargo":"Gerente General","departamento":"Administracion",
        "fecha_ingreso":"2025-01-01","salario_base":2000,
        "tipo_contrato":"INDEFINIDO","region":"SIERRA",
        "tiene_fondos_reserva":True,"decimo_tercero_acumulado":True,
        "decimo_cuarto_acumulado":True,
        "cuenta_bancaria":"2100183426","banco":"Banco Pichincha","tipo_cuenta":"AHORRO"
    }))
    ok("Empleado 2", S.post(f"{BASE}/nomina/empleados", json={
        "cedula":"1712345678","nombres":"Carlos","apellidos":"Lopez",
        "cargo":"Vendedor","departamento":"Ventas",
        "fecha_ingreso":"2026-03-01","salario_base":500,
        "tipo_contrato":"INDEFINIDO","region":"SIERRA",
        "tiene_fondos_reserva":False,"decimo_tercero_acumulado":False,
        "decimo_cuarto_acumulado":False
    }))
    emps = S.get(f"{BASE}/nomina/empleados").json()

for e in emps:
    print(f"    {e.get('nombres','')} {e.get('apellidos','')} | ${e.get('salario_base',0)} | {e.get('cargo','')}")
    print(f"      Ingreso: {e.get('fecha_ingreso','')} | D13 acum: {e.get('decimo_tercero_acumulado','')} | FR: {e.get('tiene_fondos_reserva','')}")

print("\n--- 3. CALCULAR ROLES DE PAGO ---")
for emp in emps:
    print(f"\n  Calculando para {emp['nombres']} {emp['apellidos']} (${emp['salario_base']})...")
    rol = ok(f"Rol {emp['nombres']}", S.post(f"{BASE}/nomina/roles/calcular", json={
        "empleado_id": emp["id"],
        "periodo": "2026-06",
        "dias_trabajados": 30,
    }))

print("\n--- 4. LISTAR ROLES ---")
roles = S.get(f"{BASE}/nomina/roles?periodo=2026-06").json()
print(f"  {len(roles)} roles periodo 2026-06")

for r in roles:
    salario = float(r.get('salario_base',0))
    iess_p = float(r.get('aporte_iess_personal',0))
    iess_e = float(r.get('aporte_iess_patronal',0))
    d13 = float(r.get('decimo_tercero',0))
    d14 = float(r.get('decimo_cuarto',0))
    fr = float(r.get('fondos_reserva',0))
    neto = float(r.get('neto_a_pagar',0))
    ingresos = float(r.get('total_ingresos',0))
    descuentos = float(r.get('total_descuentos',0))

    print(f"\n  === {r.get('empleado_nombre', 'ID '+str(r.get('empleado_id','?')))} ===")
    print(f"    Salario base:        ${salario:.2f}")
    print(f"    Total ingresos:      ${ingresos:.2f}")
    print(f"    IESS personal 9.45%: ${iess_p:.2f} (esperado: ${salario*0.0945:.2f})")
    print(f"    IESS patronal 11.15%:${iess_e:.2f} (esperado: ${salario*0.1115:.2f})")
    print(f"    Total descuentos:    ${descuentos:.2f}")
    print(f"    Decimo tercero:      ${d13:.2f} (esperado: ${salario/12:.2f})")
    print(f"    Decimo cuarto:       ${d14:.2f} (esperado: ${470/12:.2f})")
    print(f"    Fondos reserva:      ${fr:.2f} (esperado: ${salario*0.0833:.2f})")
    print(f"    NETO A PAGAR:        ${neto:.2f}")

    # Validaciones
    errors_local = []
    if abs(iess_p - salario*0.0945) > 0.02: errors_local.append(f"IESS personal incorrecto")
    if abs(iess_e - salario*0.1115) > 0.02: errors_local.append(f"IESS patronal incorrecto")
    if abs(d13 - salario/12) > 0.02 and d13 > 0: errors_local.append(f"D13 incorrecto")
    if abs(d14 - 470/12) > 0.02 and d14 > 0: errors_local.append(f"D14 incorrecto")
    if errors_local:
        print(f"    ERRORES: {', '.join(errors_local)}")
    else:
        print(f"    CALCULOS CORRECTOS")

print("\n--- 5. DETALLE ROL ---")
if roles:
    rid = roles[0]["id"]
    det = ok(f"Detalle rol #{rid}", S.get(f"{BASE}/nomina/roles/{rid}"))
    if det:
        print(f"    Estado: {det.get('estado','?')}")

print("\n--- 6. PDF ROL ---")
if roles:
    rid = roles[0]["id"]
    r = S.get(f"{BASE}/nomina/roles/{rid}/pdf")
    if r.status_code == 200 and len(r.content) > 100:
        PASS += 1
        print(f"  OK  PDF rol #{rid} ({len(r.content)} bytes)")
    else:
        FAIL += 1
        try: detail = r.json().get("detail","")
        except: detail = r.text[:100]
        ERRORS.append(f"PDF rol: {r.status_code} - {detail}")
        print(f"  ERR PDF rol ({r.status_code}) {detail}")

print("\n--- 7. PRESTAMOS ---")
if emps:
    ok("Crear prestamo", S.post(f"{BASE}/nomina/prestamos", json={
        "empleado_id": emps[0]["id"],
        "tipo": "ANTICIPO",
        "monto_total": 300,
        "cuotas": 3,
        "observaciones": "Anticipo salario"
    }))
    prestamos = S.get(f"{BASE}/nomina/prestamos?empleado_id={emps[0]['id']}").json()
    print(f"  {len(prestamos)} prestamos")
    for p in prestamos:
        print(f"    ${p.get('monto_total',0)} en {p.get('cuotas',0)} cuotas | Cuota: ${p.get('monto_cuota',0)} | Saldo: ${p.get('saldo',0)}")

print("\n--- 8. VACACIONES ---")
if emps:
    vac = ok("Registrar vacaciones", S.post(f"{BASE}/nomina/vacaciones", json={
        "empleado_id": emps[0]["id"],
        "fecha_inicio": "2026-07-01",
        "fecha_fin": "2026-07-15",
        "dias_tomados": 15,
        "dias_derecho": 15
    }))
    vacaciones = S.get(f"{BASE}/nomina/vacaciones?empleado_id={emps[0]['id']}").json()
    print(f"  {len(vacaciones)} registros vacaciones")

print("\n--- 9. PERMISOS ---")
if emps:
    ok("Permiso horas", S.post(f"{BASE}/nomina/permisos", json={
        "empleado_id": emps[0]["id"],
        "tipo": "PERSONAL",
        "modalidad": "HORAS",
        "fecha": "2026-06-29",
        "horas": 4,
        "motivo": "Cita medica"
    }))
    permisos = S.get(f"{BASE}/nomina/permisos?empleado_id={emps[0]['id']}").json()
    print(f"  {len(permisos)} permisos")

print(f"\n{'=' * 60}")
print(f"  RESULTADO: {PASS} OK | {FAIL} ERRORES")
print(f"{'=' * 60}")
if ERRORS:
    print("  Errores:")
    for e in ERRORS: print(f"    X {e}")
else:
    print("  NOMINA FUNCIONA CORRECTAMENTE")
