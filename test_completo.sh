#!/bin/bash
# NEXUS POS — Test completo módulo por módulo
# Registra OK o ERROR por cada endpoint

BASE="http://localhost:8000/api"
PASS=0
FAIL=0
ERRORS=""

# Login
TOKEN=$(curl -s -X POST $BASE/auth/login -d "username=admin&password=admin123" | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])" 2>/dev/null)
if [ -z "$TOKEN" ]; then echo "❌ LOGIN FAILED"; exit 1; fi
echo "✅ Login OK"
H="Authorization: Bearer $TOKEN"

test_get() {
  local name=$1 url=$2
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "$H" "$BASE$url")
  if [ "$STATUS" = "200" ]; then
    PASS=$((PASS+1))
    echo "  ✅ $name"
  else
    FAIL=$((FAIL+1))
    ERRORS="$ERRORS\n  ❌ $name → HTTP $STATUS"
    echo "  ❌ $name → HTTP $STATUS"
  fi
}

test_post() {
  local name=$1 url=$2 data=$3
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "$H" -H "Content-Type: application/json" -d "$data" "$BASE$url")
  if [ "$STATUS" = "200" ] || [ "$STATUS" = "201" ]; then
    PASS=$((PASS+1))
    echo "  ✅ $name"
  else
    FAIL=$((FAIL+1))
    ERRORS="$ERRORS\n  ❌ $name → HTTP $STATUS"
    echo "  ❌ $name → HTTP $STATUS"
  fi
}

echo ""
echo "════════ 1. AUTH ════════"
test_get "GET /auth/me" "/auth/me"

echo ""
echo "════════ 2. DASHBOARD ════════"
test_get "GET /dashboard" "/dashboard"

echo ""
echo "════════ 3. CONFIGURACIÓN ════════"
test_get "GET /config/empresa" "/config/empresa"
test_get "GET /config/sucursales" "/config/sucursales"
test_get "GET /config/bodegas" "/config/bodegas"

echo ""
echo "════════ 4. USUARIOS ════════"
test_get "GET /usuarios" "/usuarios"
test_get "GET /usuarios/roles" "/usuarios/roles"
test_get "GET /usuarios/modulos" "/usuarios/modulos"
test_get "GET /usuarios/mi-perfil" "/usuarios/mi-perfil"

echo ""
echo "════════ 5. PRODUCTOS ════════"
test_get "GET /productos" "/productos"
test_get "GET /tipos-precio" "/tipos-precio"
test_get "GET /marcas" "/marcas"
test_get "GET /categorias" "/categorias"

echo ""
echo "════════ 6. INVENTARIO ════════"
test_get "GET /stock" "/stock"
test_get "GET /bodegas" "/bodegas"
test_get "GET /inventario/resumen" "/inventario/resumen"
test_get "GET /inventario/stock-agrupado" "/inventario/stock-agrupado"
test_get "GET /inventario/sugerir-compra" "/inventario/sugerir-compra"
test_get "GET /inventario/alertas-stock" "/inventario/alertas-stock"
test_get "GET /inventario/abc?fecha_ini=2026-01-01&fecha_fin=2026-12-31" "/inventario/abc?fecha_ini=2026-01-01&fecha_fin=2026-12-31"
test_get "GET /inventario/rotacion?fecha_ini=2026-01-01&fecha_fin=2026-12-31" "/inventario/rotacion?fecha_ini=2026-01-01&fecha_fin=2026-12-31"

echo ""
echo "════════ 7. CLIENTES ════════"
test_get "GET /clientes" "/clientes"

echo ""
echo "════════ 8. PROVEEDORES ════════"
test_get "GET /proveedores" "/proveedores"

echo ""
echo "════════ 9. VENDEDORES ════════"
test_get "GET /vendedores" "/vendedores"
test_get "GET /sucursales" "/sucursales"

echo ""
echo "════════ 10. FACTURAS ════════"
test_get "GET /facturas" "/facturas"
test_get "GET /facturas-proximo-numero" "/facturas-proximo-numero"
test_get "GET /facturas/borradores" "/facturas/borradores"
test_get "GET /facturas/recurrentes" "/facturas/recurrentes"
test_get "GET /reimprimir/buscar" "/reimprimir/buscar"

echo ""
echo "════════ 11. COTIZACIONES ════════"
test_get "GET /cotizaciones" "/cotizaciones"
test_get "GET /cotizaciones/proximo-numero" "/cotizaciones/proximo-numero"

echo ""
echo "════════ 12. DEVOLUCIONES ════════"
test_get "GET /devoluciones" "/devoluciones"

echo ""
echo "════════ 13. NOTAS DÉBITO ════════"
test_get "GET /notas-debito" "/notas-debito/"
test_get "GET /notas-debito/proximo-numero" "/notas-debito/proximo-numero"

echo ""
echo "════════ 14. CXC ════════"
test_get "GET /cxc" "/cxc"
test_get "GET /cxc/resumen" "/cxc/resumen"

echo ""
echo "════════ 15. CXP ════════"
test_get "GET /cxp" "/cxp"
test_get "GET /cxp/resumen" "/cxp/resumen"

echo ""
echo "════════ 16. COMPRAS ════════"
test_get "GET /compras" "/compras"
test_get "GET /compras/proximo-numero" "/compras/proximo-numero"

echo ""
echo "════════ 17. TRANSFERENCIAS ════════"
test_get "GET /transferencias" "/transferencias"
test_get "GET /transferencias/proximo-numero" "/transferencias/proximo-numero"

echo ""
echo "════════ 18. AJUSTES ════════"
test_get "GET /ajustes" "/ajustes"

echo ""
echo "════════ 19. CAJA ════════"
test_get "GET /cajas" "/cajas"
test_get "GET /caja/verificar-abierta" "/caja/verificar-abierta"

echo ""
echo "════════ 20. BANCOS ════════"
test_get "GET /bancos/cuentas" "/bancos/cuentas"
test_get "GET /bancos/lista" "/bancos/lista"
test_get "GET /bancos/resumen" "/bancos/resumen"

echo ""
echo "════════ 21. CONCILIACIÓN ════════"
test_get "GET /conciliaciones" "/conciliaciones"

echo ""
echo "════════ 22. RETENCIONES ════════"
test_get "GET /retenciones/codigos" "/retenciones/codigos"
test_get "GET /retenciones/emitidas" "/retenciones/emitidas"
test_get "GET /retenciones/recibidas" "/retenciones/recibidas"
test_get "GET /retenciones/resumen" "/retenciones/resumen"
test_get "GET /retenciones/proximo-numero" "/retenciones/proximo-numero"

echo ""
echo "════════ 23. SRI ════════"
test_get "GET /sri/estado" "/sri/estado"
test_get "GET /sri/certificado" "/sri/certificado"
test_get "GET /sri/email/config" "/sri/email/config"

echo ""
echo "════════ 24. KARDEX ════════"
test_get "GET /kardex/resumen?fecha_ini=2026-01-01&fecha_fin=2026-12-31" "/kardex/resumen?fecha_ini=2026-01-01&fecha_fin=2026-12-31"

echo ""
echo "════════ 25. TOMA FÍSICA ════════"
test_get "GET /toma-fisica" "/toma-fisica"
test_get "GET /toma-fisica/proximo-numero" "/toma-fisica/proximo-numero"

echo ""
echo "════════ 26. SERVICIO TÉCNICO ════════"
test_get "GET /servicio-tecnico" "/servicio-tecnico"
test_get "GET /servicio-tecnico/stats" "/servicio-tecnico/stats"
test_get "GET /servicio-tecnico/proximo-numero" "/servicio-tecnico/proximo-numero"
test_get "GET /servicio-tecnico/tecnicos" "/servicio-tecnico/tecnicos"
test_get "GET /servicio-tecnico/dashboard-tecnicos" "/servicio-tecnico/dashboard-tecnicos"

echo ""
echo "════════ 27. CRM ════════"
test_get "GET /crm/etapas" "/crm/etapas"
test_get "GET /crm/pipeline" "/crm/pipeline"
test_get "GET /crm/oportunidades" "/crm/oportunidades"
test_get "GET /crm/actividades" "/crm/actividades"
test_get "GET /crm/dashboard" "/crm/dashboard"
test_get "GET /crm/forecast" "/crm/forecast"
test_get "GET /crm/reporte-embudo" "/crm/reporte-embudo"
test_get "GET /crm/plantillas" "/crm/plantillas"
test_get "GET /crm/automatizaciones" "/crm/automatizaciones"

echo ""
echo "════════ 28. CONTABILIDAD ════════"
test_get "GET /contabilidad/plan-cuentas" "/contabilidad/plan-cuentas"
test_get "GET /contabilidad/asientos" "/contabilidad/asientos"
test_get "GET /contabilidad/balance-general?fecha_corte=2026-12-31" "/contabilidad/balance-general?fecha_corte=2026-12-31"
test_get "GET /contabilidad/estado-resultados?fecha_ini=2026-01-01&fecha_fin=2026-12-31" "/contabilidad/estado-resultados?fecha_ini=2026-01-01&fecha_fin=2026-12-31"
test_get "GET /contabilidad/balance-comprobacion?fecha_ini=2026-01-01&fecha_fin=2026-12-31" "/contabilidad/balance-comprobacion?fecha_ini=2026-01-01&fecha_fin=2026-12-31"
test_get "GET /contabilidad/libro-diario?fecha_ini=2026-01-01&fecha_fin=2026-12-31" "/contabilidad/libro-diario?fecha_ini=2026-01-01&fecha_fin=2026-12-31"
test_get "GET /contabilidad/centros-costo" "/contabilidad/centros-costo"
test_get "GET /contabilidad/monedas" "/contabilidad/monedas"
test_get "GET /contabilidad/tipos-cambio" "/contabilidad/tipos-cambio"
test_get "GET /contabilidad/empresas-grupo" "/contabilidad/empresas-grupo"
test_get "GET /contabilidad/conciliacion-modulos?fecha_corte=2026-12-31" "/contabilidad/conciliacion-modulos?fecha_corte=2026-12-31"
test_get "GET /contabilidad/presupuesto?anio=2026" "/contabilidad/presupuesto?anio=2026"

echo ""
echo "════════ 29. NÓMINA ════════"
test_get "GET /nomina/config" "/nomina/config"
test_get "GET /nomina/empleados" "/nomina/empleados"
test_get "GET /nomina/roles?periodo=2026-06" "/nomina/roles?periodo=2026-06"
test_get "GET /nomina/vacaciones" "/nomina/vacaciones"
test_get "GET /nomina/prestamos" "/nomina/prestamos"
test_get "GET /nomina/permisos" "/nomina/permisos"
test_get "GET /nomina/permisos/tipos" "/nomina/permisos/tipos"
test_get "GET /nomina/decimo-tercero" "/nomina/decimo-tercero"
test_get "GET /nomina/decimo-cuarto" "/nomina/decimo-cuarto"

echo ""
echo "════════ 30. REPORTES ════════"
test_get "GET /reportes/ventas?fecha_ini=2026-01-01&fecha_fin=2026-12-31" "/reportes/ventas?fecha_ini=2026-01-01&fecha_fin=2026-12-31"
test_get "GET /reportes/productos-facturados?fecha_ini=2026-01-01&fecha_fin=2026-12-31" "/reportes/productos-facturados?fecha_ini=2026-01-01&fecha_fin=2026-12-31"
test_get "GET /reportes/inventario" "/reportes/inventario"
test_get "GET /reportes/cxc-aging" "/reportes/cxc-aging"
test_get "GET /reportes/cxp-aging" "/reportes/cxp-aging"
test_get "GET /reportes/compras?fecha_ini=2026-01-01&fecha_fin=2026-12-31" "/reportes/compras?fecha_ini=2026-01-01&fecha_fin=2026-12-31"
test_get "GET /reportes/comisiones?mes=2026-06" "/reportes/comisiones?mes=2026-06"
test_get "GET /reportes/caja?fecha_ini=2026-01-01&fecha_fin=2026-12-31" "/reportes/caja?fecha_ini=2026-01-01&fecha_fin=2026-12-31"
test_get "GET /reportes/rentabilidad?fecha_ini=2026-01-01&fecha_fin=2026-12-31" "/reportes/rentabilidad?fecha_ini=2026-01-01&fecha_fin=2026-12-31"
test_get "GET /reportes/clientes-rentables?fecha_ini=2026-01-01&fecha_fin=2026-12-31" "/reportes/clientes-rentables?fecha_ini=2026-01-01&fecha_fin=2026-12-31"
test_get "GET /reportes/stock-muerto?dias=90" "/reportes/stock-muerto?dias=90"
test_get "GET /reportes/comparativo-ventas?periodo1_ini=2026-05-01&periodo1_fin=2026-05-31&periodo2_ini=2026-06-01&periodo2_fin=2026-06-30" "/reportes/comparativo-ventas?periodo1_ini=2026-05-01&periodo1_fin=2026-05-31&periodo2_ini=2026-06-01&periodo2_fin=2026-06-30"
test_get "GET /reportes/servicio-tecnico?fecha_ini=2026-01-01&fecha_fin=2026-12-31" "/reportes/servicio-tecnico?fecha_ini=2026-01-01&fecha_fin=2026-12-31"
test_get "GET /reportes/nomina?periodo=2026-06" "/reportes/nomina?periodo=2026-06"
test_get "GET /reportes/devoluciones?fecha_ini=2026-01-01&fecha_fin=2026-12-31" "/reportes/devoluciones?fecha_ini=2026-01-01&fecha_fin=2026-12-31"
test_get "GET /reportes/dashboard-ejecutivo?fecha_ini=2026-01-01&fecha_fin=2026-12-31" "/reportes/dashboard-ejecutivo?fecha_ini=2026-01-01&fecha_fin=2026-12-31"
test_get "GET /reportes/formulario-104?mes=2026-06" "/reportes/formulario-104?mes=2026-06"
test_get "GET /reportes/formulario-103?mes=2026-06" "/reportes/formulario-103?mes=2026-06"
test_get "GET /reportes/ats?mes=2026-06" "/reportes/ats?mes=2026-06"
test_get "GET /reportes/flujo-caja" "/reportes/flujo-caja"
test_get "GET /reportes/dashboard-financiero" "/reportes/dashboard-financiero"

echo ""
echo "════════ 31. GUÍAS REMISIÓN ════════"
test_get "GET /guias-remision" "/guias-remision"
test_get "GET /guias-remision/proximo-numero" "/guias-remision/proximo-numero"

echo ""
echo "════════ 32. LIQUIDACIONES ════════"
test_get "GET /liquidaciones" "/liquidaciones"
test_get "GET /liquidaciones/proximo-numero" "/liquidaciones/proximo-numero"

echo ""
echo "════════════════════════════════════════════"
echo "RESULTADO: $PASS OK / $FAIL ERRORES"
echo "════════════════════════════════════════════"
if [ $FAIL -gt 0 ]; then
  echo ""
  echo "ERRORES ENCONTRADOS:"
  echo -e "$ERRORS"
fi
