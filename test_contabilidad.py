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
        try: detail = str(r.json().get("detail",""))[:100]
        except: detail = r.text[:100]
        ERRORS.append(f"{name}: {r.status_code} - {detail}")
        print(f"  ERR {name} ({r.status_code}) {detail}")
        return None

print("=" * 60)
print("  PRUEBA COMPLETA: CONTABILIDAD")
print("=" * 60)

# ═══ PLAN DE CUENTAS ═══
print("\n--- 1. PLAN DE CUENTAS ---")
plan = S.get(f"{BASE}/contabilidad/plan-cuentas").json()
print(f"  Cuentas existentes: {len(plan)}")

if len(plan) < 10:
    print("  Inicializando plan de cuentas...")
    r = ok("Inicializar plan", S.post(f"{BASE}/contabilidad/plan-cuentas/inicializar"))
    if r: print(f"    {r}")
    plan = S.get(f"{BASE}/contabilidad/plan-cuentas").json()
    print(f"  Cuentas despues: {len(plan)}")

# Mostrar estructura
for c in plan[:15]:
    indent = "  " * c.get("nivel", 1)
    mov = " [MOV]" if c.get("es_movimiento") else ""
    print(f"    {indent}{c['codigo']} {c['nombre']}{mov}")
if len(plan) > 15:
    print(f"    ... y {len(plan)-15} mas")

# ═══ ASIENTOS CONTABLES ═══
print("\n--- 2. ASIENTOS CONTABLES ---")
# Find movimiento accounts
ctas_mov = [c for c in plan if c.get("es_movimiento")]
caja = next((c for c in ctas_mov if "CAJA" in c["nombre"].upper()), None)
banco = next((c for c in ctas_mov if "BANCO" in c["nombre"].upper()), None)
ventas = next((c for c in ctas_mov if "VENTA" in c["nombre"].upper() and c.get("tipo") in ("INGRESO","ingreso")), None)
cxc = next((c for c in ctas_mov if "COBRAR" in c["nombre"].upper()), None)
cxp = next((c for c in ctas_mov if "PAGAR" in c["nombre"].upper()), None)
costo = next((c for c in ctas_mov if "COSTO" in c["nombre"].upper()), None)
inv = next((c for c in ctas_mov if "INVENTAR" in c["nombre"].upper()), None)

print(f"  Cuentas movimiento: {len(ctas_mov)}")
if caja: print(f"    Caja: ID={caja['id']} ({caja['codigo']})")
if banco: print(f"    Banco: ID={banco['id']} ({banco['codigo']})")
if ventas: print(f"    Ventas: ID={ventas['id']} ({ventas['codigo']})")
if cxc: print(f"    CXC: ID={cxc['id']} ({cxc['codigo']})")
if cxp: print(f"    CXP: ID={cxp['id']} ({cxp['codigo']})")

if caja and ventas:
    print("\n  Creando asientos contables...")

    # Asiento 1: Venta al contado
    a1 = ok("Asiento: Venta contado", S.post(f"{BASE}/contabilidad/asientos", json={
        "numero": "AS-001", "fecha": "2026-06-29",
        "descripcion": "Registro venta al contado",
        "tipo": "DIARIO",
        "detalles": [
            {"cuenta_id": caja["id"], "descripcion": "Ingreso por venta", "debe": 626.75, "haber": 0},
            {"cuenta_id": ventas["id"], "descripcion": "Venta del dia", "debe": 0, "haber": 626.75},
        ]
    }))

    # Asiento 2: Venta a credito
    if cxc:
        a2 = ok("Asiento: Venta credito", S.post(f"{BASE}/contabilidad/asientos", json={
            "numero": "AS-002", "fecha": "2026-06-29",
            "descripcion": "Venta a credito cliente",
            "tipo": "DIARIO",
            "detalles": [
                {"cuenta_id": cxc["id"], "descripcion": "CXC cliente", "debe": 862.50, "haber": 0},
                {"cuenta_id": ventas["id"], "descripcion": "Venta credito", "debe": 0, "haber": 862.50},
            ]
        }))

    # Asiento 3: Pago a proveedor
    if banco and cxp:
        a3 = ok("Asiento: Pago proveedor", S.post(f"{BASE}/contabilidad/asientos", json={
            "numero": "AS-003", "fecha": "2026-06-29",
            "descripcion": "Pago a proveedor",
            "tipo": "DIARIO",
            "detalles": [
                {"cuenta_id": cxp["id"], "descripcion": "Pago deuda", "debe": 500, "haber": 0},
                {"cuenta_id": banco["id"], "descripcion": "Salida banco", "debe": 0, "haber": 500},
            ]
        }))

    # Asiento desbalanceado (debe fallar)
    print("\n  Asiento desbalanceado (debe fallar):")
    a_bad = ok("Asiento desbalanceado", S.post(f"{BASE}/contabilidad/asientos", json={
        "numero": "AS-BAD", "fecha": "2026-06-29",
        "descripcion": "Este debe fallar",
        "tipo": "DIARIO",
        "detalles": [
            {"cuenta_id": caja["id"], "descripcion": "Test", "debe": 100, "haber": 0},
            {"cuenta_id": ventas["id"], "descripcion": "Test", "debe": 0, "haber": 50},
        ]
    }))

# Aprobar asiento
asientos = S.get(f"{BASE}/contabilidad/asientos").json()
print(f"\n  {len(asientos)} asientos creados")
if asientos:
    ok("Aprobar asiento 1", S.patch(f"{BASE}/contabilidad/asientos/{asientos[0]['id']}/aprobar"))

# ═══ REPORTES CONTABLES ═══
print("\n--- 3. BALANCE GENERAL ---")
bg = ok("Balance general", S.get(f"{BASE}/contabilidad/balance-general"))
if bg:
    print(f"    Activos: ${bg.get('total_activos',0)}")
    print(f"    Pasivos: ${bg.get('total_pasivos',0)}")
    print(f"    Patrimonio: ${bg.get('total_patrimonio',0)}")

print("\n--- 4. ESTADO DE RESULTADOS ---")
er = ok("Estado resultados", S.get(f"{BASE}/contabilidad/estado-resultados"))
if er:
    print(f"    Ingresos: ${er.get('total_ingresos',0)}")
    print(f"    Gastos: ${er.get('total_gastos',0)}")
    print(f"    Resultado: ${er.get('resultado',0)}")

print("\n--- 5. LIBRO DIARIO ---")
ld = ok("Libro diario", S.get(f"{BASE}/contabilidad/libro-diario"))
if ld:
    if isinstance(ld, list): print(f"    {len(ld)} registros")
    elif isinstance(ld, dict): print(f"    {len(ld.get('asientos',ld))} registros")

print("\n--- 6. LIBRO MAYOR ---")
if caja:
    lm = ok("Libro mayor (Caja)", S.get(f"{BASE}/contabilidad/libro-mayor?cuenta_id={caja['id']}"))
    if lm:
        if isinstance(lm, list): print(f"    {len(lm)} movimientos")
        elif isinstance(lm, dict):
            print(f"    Saldo: ${lm.get('saldo',0)}")
            movs = lm.get('movimientos', [])
            print(f"    {len(movs)} movimientos")

print("\n--- 7. BALANCE COMPROBACION ---")
bc = ok("Balance comprobacion", S.get(f"{BASE}/contabilidad/balance-comprobacion?fecha_ini=2026-01-01&fecha_fin=2026-12-31"))
if bc:
    if isinstance(bc, list):
        total_debe = sum(float(c.get('debe',0)) for c in bc)
        total_haber = sum(float(c.get('haber',0)) for c in bc)
        print(f"    {len(bc)} cuentas")
        print(f"    Total Debe: ${total_debe} | Haber: ${total_haber}")
        print(f"    Diferencia: ${abs(total_debe - total_haber)}")

print("\n--- 8. AUXILIARES ---")
ok("Auxiliar CXC", S.get(f"{BASE}/contabilidad/auxiliar-cxc?fecha_corte=2026-12-31"))
ok("Auxiliar CXP", S.get(f"{BASE}/contabilidad/auxiliar-cxp?fecha_corte=2026-12-31"))
ok("Auxiliar Bancos", S.get(f"{BASE}/contabilidad/auxiliar-bancos?fecha_corte=2026-12-31"))

print("\n--- 9. CENTROS DE COSTO ---")
ok("Listar centros", S.get(f"{BASE}/contabilidad/centros-costo"))
ok("Crear centro ADM", S.post(f"{BASE}/contabilidad/centros-costo?codigo=ADM&nombre=Administracion"))
ok("Crear centro VEN", S.post(f"{BASE}/contabilidad/centros-costo?codigo=VEN&nombre=Ventas"))

print("\n--- 10. PRESUPUESTO ---")
ok("Listar presupuesto", S.get(f"{BASE}/contabilidad/presupuesto?anio=2026"))

print("\n--- 11. MULTI-MONEDA ---")
monedas = ok("Monedas", S.get(f"{BASE}/contabilidad/monedas"))
if monedas:
    for m in monedas: print(f"    {m.get('codigo','')} - {m.get('nombre','')}")
tc = ok("Tipos cambio", S.get(f"{BASE}/contabilidad/tipos-cambio"))

print("\n--- 12. CONCILIACION MODULOS ---")
cm = ok("Conciliacion modulos", S.get(f"{BASE}/contabilidad/conciliacion-modulos?fecha_corte=2026-12-31"))
if cm:
    for k,v in cm.items():
        if isinstance(v, (int,float)): print(f"    {k}: ${v}")

print(f"\n{'=' * 60}")
print(f"  RESULTADO: {PASS} OK | {FAIL} ERRORES")
print(f"{'=' * 60}")
if ERRORS:
    print("  Errores:")
    for e in ERRORS: print(f"    X {e}")
else:
    print("  CONTABILIDAD FUNCIONA CORRECTAMENTE")
