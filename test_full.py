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
        try: detail = r.json().get("detail","")
        except: detail = r.text[:100]
        ERRORS.append(f"{name}: {r.status_code} - {detail}")
        print(f"  ERR {name} ({r.status_code}) {detail}")
        return None

print("=" * 56)
print("  PRUEBA COMPLETA MODULO POR MODULO")
print("=" * 56)

print("\n--- 1. CONFIGURACION ---")
ok("Vendedor", S.post(f"{BASE}/vendedores", json={"codigo":"V001","nombre":"Carlos Lopez","cedula":"1712345678","telefono":"0991111111","activo":True}))

print("\n--- 2. CLIENTES ---")
ok("Cliente persona", S.post(f"{BASE}/clientes", json={"identificacion":"1759046343","razon_social":"HERNAN FERRER","tipo_identificacion":"CEDULA","telefono":"0999038296","direccion":"Quito","plazo_pago":30}))
ok("Cliente empresa", S.post(f"{BASE}/clientes", json={"identificacion":"1790001001001","razon_social":"EMPRESA ABC S.A.","tipo_identificacion":"RUC","telefono":"022345678","direccion":"Guayaquil","plazo_pago":60}))

print("\n--- 3. PROVEEDORES ---")
ok("Proveedor", S.post(f"{BASE}/proveedores", json={"identificacion":"1791234567001","razon_social":"DISTRIBUIDORA TECH","tipo_identificacion":"RUC","telefono":"042345678","direccion":"Guayaquil","plazo_pago":45}))

print("\n--- 4. INVENTARIO ---")
ok("Categoria Celulares", S.post(f"{BASE}/categorias", json={"nombre":"CELULARES"}))
ok("Categoria Accesorios", S.post(f"{BASE}/categorias", json={"nombre":"ACCESORIOS"}))
ok("Marca Samsung", S.post(f"{BASE}/marcas", json={"nombre":"SAMSUNG"}))
ok("Marca Apple", S.post(f"{BASE}/marcas", json={"nombre":"APPLE"}))
ok("Producto Galaxy A15", S.post(f"{BASE}/productos", json={"codigo":"CEL001","descripcion":"SAMSUNG GALAXY A15","categoria_id":1,"marca_id":1,"iva_porcentaje":15,"precio_venta":250}))
ok("Producto iPhone 15", S.post(f"{BASE}/productos", json={"codigo":"CEL002","descripcion":"IPHONE 15","categoria_id":1,"marca_id":2,"iva_porcentaje":15,"precio_venta":900}))
ok("Producto Funda", S.post(f"{BASE}/productos", json={"codigo":"ACC001","descripcion":"FUNDA SAMSUNG","categoria_id":2,"marca_id":1,"iva_porcentaje":15,"precio_venta":15}))
ok("Ajuste stock entrada", S.post(f"{BASE}/ajustes", json={"tipo":"ENTRADA","bodega_id":1,"motivo":"Stock inicial","detalles":[{"producto_id":1,"cantidad":20},{"producto_id":2,"cantidad":10},{"producto_id":3,"cantidad":50}]}))

stock = S.get(f"{BASE}/inventario/stock").json()
for p in stock: print(f"    {p['descripcion']}: {p['cantidad']} uds")

print("\n--- 5. FACTURACION ---")
f1 = ok("Factura efectivo $626.75", S.post(f"{BASE}/facturas", json={"cliente_id":2,"vendedor_id":1,"detalles":[{"producto_id":1,"cantidad":2,"precio_unitario":250,"iva_porcentaje":15},{"producto_id":3,"cantidad":3,"precio_unitario":15,"iva_porcentaje":15}],"pagos":[{"forma_pago":"EFECTIVO","monto":626.75}],"descuento_global_pct":0}))
if f1: print(f"    {f1.get('numero_factura')} = ${f1.get('total')}")

f2 = ok("Factura tarjeta $1035", S.post(f"{BASE}/facturas", json={"cliente_id":3,"detalles":[{"producto_id":2,"cantidad":1,"precio_unitario":900,"iva_porcentaje":15}],"pagos":[{"forma_pago":"TARJETA","monto":1035,"referencia":"VOC-12345"}],"descuento_global_pct":0}))
if f2: print(f"    {f2.get('numero_factura')} = ${f2.get('total')}")

f3 = ok("Factura credito $862.50", S.post(f"{BASE}/facturas", json={"cliente_id":2,"detalles":[{"producto_id":1,"cantidad":3,"precio_unitario":250,"iva_porcentaje":15}],"pagos":[{"forma_pago":"CREDITO","monto":862.5}],"descuento_global_pct":0}))
if f3: print(f"    {f3.get('numero_factura')} = ${f3.get('total')}")

print("\n--- 6. NOTA DE VENTA ---")
nv = ok("Nota venta $86.25", S.post(f"{BASE}/notas-venta", json={"cliente_id":1,"detalles":[{"producto_id":3,"cantidad":5,"precio_unitario":15,"iva_porcentaje":15}],"pagos":[{"forma_pago":"EFECTIVO","monto":86.25}],"descuento_global_pct":0}))
if nv: print(f"    {nv.get('numero')} = ${nv.get('total')}")

print("\n--- 7. STOCK DESPUES DE VENTAS ---")
stock = S.get(f"{BASE}/inventario/stock").json()
for p in stock: print(f"    {p['descripcion']}: {p['cantidad']}")

print("\n--- 8. CXC ---")
cxc = S.get(f"{BASE}/cxc").json()
print(f"    {len(cxc)} cuentas por cobrar")
for c in cxc: print(f"    {c.get('cliente_nombre','?')}: ${c.get('saldo',0)} ({c.get('estado','?')})")

print("\n--- 9. DEPOSITOS ---")
pend = S.get(f"{BASE}/depositos/pendientes").json()
print(f"    Pendiente: ${pend['total_pendiente']} ({pend['total_transacciones']} pagos)")
pids = [p["id"] for p in pend["pagos"]]
if pids:
    ok("Crear deposito", S.post(f"{BASE}/depositos", json={"cuenta_bancaria_id":2,"pago_ids":pids,"referencia":"DEP-001"}))
    ok("Confirmar deposito", S.post(f"{BASE}/depositos/1/confirmar?referencia_banco=PAP-999"))

print("\n--- 10. BANCOS ---")
res = S.get(f"{BASE}/bancos/resumen").json()
print(f"    Ingresos: ${res['total_ingresos']} | Egresos: ${res['total_egresos']}")
ctas = S.get(f"{BASE}/bancos/cuentas").json()
for c in ctas: print(f"    {c['nombre']}: Saldo ${c.get('saldo_actual',0)}")

print("\n--- 11. COMPRAS ---")
comp = ok("Compra $2070", S.post(f"{BASE}/compras", json={"proveedor_id":1,"bodega_id":1,"numero_factura_prov":"FAC-001","fecha_emision":"2026-06-29","plazo_dias":45,"detalles":[{"producto_id":1,"cantidad":10,"precio_unitario":180,"iva_porcentaje":15}]}))
if comp: print(f"    {comp.get('numero_compra')} = ${comp.get('total')}")

print("\n--- 12. CXP ---")
cxp = S.get(f"{BASE}/cxp").json()
print(f"    {len(cxp)} cuentas por pagar")
for c in cxp: print(f"    {c.get('proveedor_nombre','?')}: ${c.get('saldo',0)}")

print("\n--- 13. ORDEN DE COMPRA ---")
oc = ok("Orden compra", S.post(f"{BASE}/ordenes-compra", json={"proveedor_id":1,"bodega_id":1,"detalles":[{"producto_id":2,"cantidad":5,"precio_unitario":700,"iva_porcentaje":15}]}))
if oc: print(f"    {oc.get('numero_compra')} = ${oc.get('total')}")

print("\n--- 14. COTIZACION ---")
ok("Cotizacion", S.post(f"{BASE}/cotizaciones", json={"cliente_id":2,"detalles":[{"producto_id":2,"cantidad":2,"precio_unitario":900,"iva_porcentaje":15}],"descuento_global_pct":5}))

print("\n--- 15. SERVICIO TECNICO ---")
ok("Tecnico", S.post(f"{BASE}/servicio-tecnico/tecnicos", json={"nombre":"Pedro Garcia","cedula":"1798765432","telefono":"0992222222","especialidad":"Celulares"}))
ok("Orden servicio", S.post(f"{BASE}/servicio-tecnico", json={"cliente_id":2,"tecnico_id":1,"equipo_tipo":"Celular","equipo_marca":"Samsung","equipo_modelo":"A15","problema_reportado":"No enciende","prioridad":"ALTA"}))

print("\n--- 16. CRM ---")
ok("Oportunidad", S.post(f"{BASE}/crm/oportunidades", json={"titulo":"Venta 50 celulares","cliente_id":3,"valor_estimado":45000,"etapa_id":1}))

print("\n--- 17. NOMINA ---")
ok("Empleado", S.post(f"{BASE}/nomina/empleados", json={"cedula":"1759046343","nombres":"Hernan","apellidos":"Ferrer","cargo":"Gerente","departamento":"Administracion","fecha_ingreso":"2026-01-01","salario_base":1500,"tipo_contrato":"INDEFINIDO","region":"SIERRA"}))

print("\n--- 18. DASHBOARD ---")
dash = S.get(f"{BASE}/dashboard").json()
print(f"    Clientes: {dash['clientes']}")
print(f"    Productos: {dash['productos']}")
print(f"    Ventas hoy: ${dash['ventas_hoy']['total']}")
print(f"    Ventas mes: ${dash['ventas_mes']['total']}")

print(f"\n{'=' * 56}")
print(f"  RESULTADO: {PASS} OK | {FAIL} ERRORES")
print(f"{'=' * 56}")
if ERRORS:
    print("  Errores:")
    for e in ERRORS: print(f"    X {e}")
else:
    print("  TODOS LOS MODULOS FUNCIONAN CORRECTAMENTE")
