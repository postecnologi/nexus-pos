const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  page.on('dialog', async d => { await d.accept() });

  const screens = [];
  async function screenshot(name) {
    const path = `C:/Users/Pc/AppData/Local/Temp/nexus_test_${name}.png`;
    await page.screenshot({ path });
    screens.push(name);
    console.log(`  ${name}`);
  }

  // Login
  await page.goto('http://localhost:5173/login');
  await page.waitForTimeout(1000);
  await page.fill('input[placeholder="Ingresa tu usuario"]', 'admin');
  await page.fill('input[placeholder="Ingresa tu contrasena"]', 'admin123');
  await page.click('button:has-text("Iniciar sesion")', { force: true });
  await page.waitForTimeout(3000);

  // Navigate to each page and screenshot
  const pages = [
    ['dashboard', '/'],
    ['facturas', '/facturas'],
    ['clientes', '/clientes'],
    ['cotizaciones', '/cotizaciones'],
    ['devoluciones', '/devoluciones'],
    ['notas_debito', '/notas-debito'],
    ['stock', '/stock'],
    ['gestion_precios', '/gestion-precios'],
    ['transferencias', '/transferencias'],
    ['ajustes', '/ajustes'],
    ['kardex', '/kardex'],
    ['toma_fisica', '/toma-fisica'],
    ['compras', '/compras'],
    ['proveedores', '/proveedores'],
    ['retenciones', '/retenciones'],
    ['cxc', '/cxc'],
    ['cxp', '/cxp-pagar'],
    ['caja', '/caja'],
    ['bancos', '/bancos'],
    ['conciliacion', '/conciliacion'],
    ['contabilidad', '/contabilidad'],
    ['crm', '/crm'],
    ['servicio_tecnico', '/servicio-tecnico'],
    ['nomina', '/nomina'],
    ['reportes', '/reportes'],
    ['usuarios', '/usuarios'],
    ['configuracion', '/configuracion'],
    ['etiquetas', '/etiquetas'],
  ];

  console.log('Navegando páginas...');
  let errors = [];
  for (const [name, path] of pages) {
    try {
      await page.goto(`http://localhost:5173${path}`, { timeout: 10000 });
      await page.waitForTimeout(1500);

      // Check for error messages in the page
      const errorText = await page.locator('text=Error').first().isVisible().catch(() => false);
      const status = errorText ? '⚠️' : '✅';

      await screenshot(name);
    } catch(e) {
      errors.push(`${name}: ${e.message.slice(0,80)}`);
      console.log(`  ❌ ${name}: ${e.message.slice(0,80)}`);
    }
  }

  // Test theme toggle
  try {
    const themeBtn = page.locator('button:has-text("Claro"), button:has-text("Oscuro")').first();
    if (await themeBtn.count() > 0) {
      await themeBtn.click();
      await page.waitForTimeout(1000);
      await screenshot('tema_toggle');
    }
  } catch {}

  // Test sidebar collapse
  try {
    await page.goto('http://localhost:5173/');
    await page.waitForTimeout(1000);
    // Expand all sidebar groups
    const groups = page.locator('nav button[title]');
    for (let i = 0; i < Math.min(await groups.count(), 10); i++) {
      try { await groups.nth(i).click(); await page.waitForTimeout(200); } catch {}
    }
    await screenshot('sidebar_expanded');
  } catch {}

  console.log(`\nResultado: ${screens.length} páginas capturadas`);
  if (errors.length > 0) {
    console.log(`Errores: ${errors.length}`);
    errors.forEach(e => console.log(`  ❌ ${e}`));
  } else {
    console.log('✅ Todas las páginas cargaron correctamente');
  }

  await browser.close();
  console.log('Done!');
})();
