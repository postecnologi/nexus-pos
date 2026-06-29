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
        except: d = {}
        print(f"  OK  {name}")
        return d
    else:
        FAIL += 1
        try: detail = str(r.json().get("detail",""))[:80]
        except: detail = r.text[:80]
        ERRORS.append(f"{name}: {r.status_code} - {detail}")
        print(f"  ERR {name} ({r.status_code}) {detail}")
        return None

print("=" * 56)
print("  PRUEBA: BANCOS + CONTABILIDAD + NOMINA")
print("=" * 56)

print("\n--- BANCOS: Abono CXC ---")
cxc = S.get(f"{BASE}/cxc").json()
if cxc:
    cxc_id = cxc[0]["id"]
    print(f"  CXC #{cxc_id}: Saldo ${cxc[0]['saldo']}")
    ok("Abono $200 transferencia", S.post(f"{BASE}/cxc/{cxc_id}/abonar", json={"monto":200,"forma_pago":"TRANSFERENCIA","referencia":"TRF-001","cuenta_bancaria_id":1}))
    cxc2 = S.get(f"{BASE}/cxc").json()
    if cxc2: print(f"  CXC despues: Saldo ${cxc2[0]['saldo']}")
else:
    print("  No hay CXC")

print("\n--- BANCOS: Pago CXP ---")
cxp = S.get(f"{BASE}/cxp").json()
if cxp:
    cxp_id = cxp[0]["id"]
    print(f"  CXP #{cxp_id}: Saldo ${cxp[0]['saldo']}")
    ok("Pago $500 transferencia", S.post(f"{BASE}/cxp/{cxp_id}/pagar", json={"monto":500,"forma_pago":"TRANSFERENCIA","referencia":"PAG-001","cuenta_bancaria_id":1}))
    cxp2 = S.get(f"{BASE}/cxp").json()
    if cxp2: print(f"  CXP despues: Saldo ${cxp2[0]['saldo']}")
else:
    print("  No hay CXP")

print("\n--- BANCOS: Verificar ---")
ctas = S.get(f"{BASE}/bancos/cuentas").json()
for c in ctas: print(f"  {c['nombre']}: Saldo ${c.get('saldo_actual',0)}")
res = S.get(f"{BASE}/bancos/resumen").json()
print(f"  Ingresos: ${res['total_ingresos']} | Egresos: ${res['total_egresos']}")
movs = S.get(f"{BASE}/bancos/movimientos").json()
print(f"  {len(movs)} movimientos:")
for m in movs: print(f"    {m.get('tipo','')} | {str(m.get('concepto',''))[:35]} | ${m.get('monto',0)}")

print("\n--- CONTABILIDAD ---")
plan = S.get(f"{BASE}/contabilidad/plan-cuentas").json()
print(f"  Plan de cuentas: {len(plan)} cuentas")
if len(plan) == 0:
    print("  Creando plan basico...")
    cuentas = [
        {"codigo":"1","nombre":"ACTIVOS","tipo":"ACTIVO","naturaleza":"DEUDORA","nivel":1},
        {"codigo":"1.1","nombre":"ACTIVO CORRIENTE","tipo":"ACTIVO","naturaleza":"DEUDORA","nivel":2},
        {"codigo":"1.1.01","nombre":"CAJA","tipo":"ACTIVO","naturaleza":"DEUDORA","nivel":3,"es_movimiento":True},
        {"codigo":"1.1.02","nombre":"BANCOS","tipo":"ACTIVO","naturaleza":"DEUDORA","nivel":3,"es_movimiento":True},
        {"codigo":"1.1.03","nombre":"CUENTAS POR COBRAR","tipo":"ACTIVO","naturaleza":"DEUDORA","nivel":3,"es_movimiento":True},
        {"codigo":"2","nombre":"PASIVOS","tipo":"PASIVO","naturaleza":"ACREEDORA","nivel":1},
        {"codigo":"2.1","nombre":"PASIVO CORRIENTE","tipo":"PASIVO","naturaleza":"ACREEDORA","nivel":2},
        {"codigo":"2.1.01","nombre":"CUENTAS POR PAGAR","tipo":"PASIVO","naturaleza":"ACREEDORA","nivel":3,"es_movimiento":True},
        {"codigo":"3","nombre":"PATRIMONIO","tipo":"PATRIMONIO","naturaleza":"ACREEDORA","nivel":1},
        {"codigo":"3.1","nombre":"CAPITAL","tipo":"PATRIMONIO","naturaleza":"ACREEDORA","nivel":2,"es_movimiento":True},
        {"codigo":"4","nombre":"INGRESOS","tipo":"INGRESO","naturaleza":"ACREEDORA","nivel":1},
        {"codigo":"4.1","nombre":"VENTAS","tipo":"INGRESO","naturaleza":"ACREEDORA","nivel":2,"es_movimiento":True},
        {"codigo":"5","nombre":"GASTOS","tipo":"GASTO","naturaleza":"DEUDORA","nivel":1},
        {"codigo":"5.1","nombre":"COSTO VENTAS","tipo":"GASTO","naturaleza":"DEUDORA","nivel":2,"es_movimiento":True},
    ]
    for c in cuentas:
        ok(f"Cuenta {c['codigo']}", S.post(f"{BASE}/contabilidad/plan-cuentas", json=c))

plan = S.get(f"{BASE}/contabilidad/plan-cuentas").json()
print(f"  Plan actualizado: {len(plan)} cuentas")

# Buscar cuentas de movimiento para el asiento
ctas_mov = [c for c in plan if c.get("es_movimiento")]
if len(ctas_mov) >= 2:
    caja_id = next((c["id"] for c in ctas_mov if "CAJA" in c["nombre"]), ctas_mov[0]["id"])
    ventas_id = next((c["id"] for c in ctas_mov if "VENTA" in c["nombre"]), ctas_mov[1]["id"])

    print(f"\n  Asiento contable (Caja ID={caja_id}, Ventas ID={ventas_id}):")
    asiento = ok("Asiento ventas", S.post(f"{BASE}/contabilidad/asientos", json={
        "numero":"AS-001","fecha":"2026-06-29","descripcion":"Ventas del dia",
        "tipo":"DIARIO",
        "detalles":[
            {"cuenta_id":caja_id,"descripcion":"Ingreso caja","debe":2195,"haber":0},
            {"cuenta_id":ventas_id,"descripcion":"Ventas","debe":0,"haber":2195},
        ]
    }))
    if asiento: print(f"    Asiento #{asiento.get('id','?')}")

asientos = S.get(f"{BASE}/contabilidad/asientos").json()
print(f"  {len(asientos)} asientos registrados")

print("\n--- NOMINA ---")
config = S.get(f"{BASE}/nomina/config").json()
print(f"  SBU: ${config.get('sbu',0)}")
print(f"  IESS Personal: {config.get('aporte_personal_pct',0)}%")
print(f"  IESS Patronal: {config.get('aporte_patronal_pct',0)}%")
print(f"  Fondos Reserva: {config.get('fondos_reserva_pct',0)}%")

emps = S.get(f"{BASE}/nomina/empleados").json()
print(f"  {len(emps)} empleados")
for e in emps:
    print(f"    {e.get('nombres','')} {e.get('apellidos','')} | Salario: ${e.get('salario_base',0)} | {e.get('cargo','')}")

if emps:
    print("\n  Generando rol de pago...")
    rol = ok("Rol junio 2026", S.post(f"{BASE}/nomina/roles/calcular", json={
        "empleado_id": emps[0]["id"],
        "periodo": "2026-06",
        "dias_trabajados": 30,
    }))
    if rol:
        print(f"    Salario: ${rol.get('salario_base',0)}")
        print(f"    IESS personal (9.45%): ${rol.get('aporte_iess_personal',0)}")
        print(f"    IESS patronal (11.15%): ${rol.get('aporte_iess_patronal',0)}")
        print(f"    Ingresos: ${rol.get('total_ingresos',0)}")
        print(f"    Descuentos: ${rol.get('total_descuentos',0)}")
        print(f"    Neto a pagar: ${rol.get('neto_a_pagar',0)}")
        print(f"    Decimo tercero: ${rol.get('decimo_tercero',0)}")
        print(f"    Decimo cuarto: ${rol.get('decimo_cuarto',0)}")
        print(f"    Fondos reserva: ${rol.get('fondos_reserva',0)}")

        # Validate IESS calculation
        salario = float(rol.get('salario_base', 0))
        iess_p = round(salario * 0.0945, 2)
        iess_e = round(salario * 0.1115, 2)
        neto = salario - iess_p
        print(f"\n    Validacion IESS:")
        print(f"    Personal esperado: ${iess_p} | Calculado: ${rol.get('aporte_iess_personal',0)}")
        print(f"    Patronal esperado: ${iess_e} | Calculado: ${rol.get('aporte_iess_patronal',0)}")
        print(f"    Neto esperado: ${neto} | Calculado: ${rol.get('neto_a_pagar',0)}")

    roles = S.get(f"{BASE}/nomina/roles?periodo=2026-06").json()
    print(f"\n  {len(roles)} roles periodo 2026-06")

print(f"\n{'=' * 56}")
print(f"  RESULTADO: {PASS} OK | {FAIL} ERRORES")
print(f"{'=' * 56}")
if ERRORS:
    print("  Errores:")
    for e in ERRORS: print(f"    X {e}")
else:
    print("  TODO FUNCIONA CORRECTAMENTE")
