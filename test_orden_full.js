const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  page.on('response', res => {
    if(res.status()>=400 && res.url().includes('/api/'))
      res.text().then(t => console.log('HTTP', res.status(), res.request().method(), res.url(), t.slice(0,200)))
  });
  page.on('dialog', async d => { console.log('ALERT:', d.message()); await d.accept() });

  await page.goto('http://localhost:5173/login');
  await page.waitForTimeout(1000);
  await page.fill('input[placeholder="Ingresa tu usuario"]', 'admin');
  await page.fill('input[placeholder="Ingresa tu contraseña"]', 'admin123');
  await page.click('button:has-text("Iniciar sesión")');
  await page.waitForTimeout(3000);

  await page.goto('http://localhost:5173/servicio-tecnico');
  await page.waitForTimeout(2000);

  await page.click('button:has-text("Nueva Orden")', { timeout: 3000 });
  await page.waitForTimeout(1000);

  // Buscar y seleccionar cliente
  const cliInput = page.locator('input[placeholder*="cliente"]').first();
  await cliInput.fill('HER');
  await page.waitForTimeout(1500);
  // Click first search result
  const resultDiv = page.locator('div[style*="cursor: pointer"] b:has-text("HERNAN")').first();
  if (await resultDiv.count() > 0) {
    await resultDiv.click();
    await page.waitForTimeout(500);
    console.log('Cliente seleccionado');
  } else {
    console.log('No se encontro resultado de cliente');
  }

  // Llenar marca
  const marcaInput = page.locator('input[placeholder="Samsung, Apple..."]');
  if (await marcaInput.count() > 0) await marcaInput.fill('Samsung');

  // Llenar modelo
  const modeloInput = page.locator('input[placeholder="Galaxy S24..."]');
  if (await modeloInput.count() > 0) await modeloInput.fill('Galaxy A17');

  // Llenar problema reportado - buscar textarea con placeholder correcto
  const problemaTA = page.locator('textarea[placeholder*="problema"]');
  if (await problemaTA.count() > 0) {
    await problemaTA.fill('Pantalla rota, no responde al tacto');
    console.log('Problema llenado');
  } else {
    // Buscar el segundo textarea (primero es accesorios)
    const textareas = page.locator('textarea');
    const taCount = await textareas.count();
    console.log(`Textareas encontrados: ${taCount}`);
    if (taCount >= 2) {
      await textareas.nth(1).fill('Pantalla rota, no responde al tacto');
      console.log('Problema llenado (textarea #2)');
    }
  }

  await page.screenshot({ path: 'C:/Users/Pc/AppData/Local/Temp/nexus_ord_filled.png' });

  // Click crear
  await page.click('button:has-text("Crear Orden")');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'C:/Users/Pc/AppData/Local/Temp/nexus_ord_result.png' });
  console.log('Resultado final capturado');

  await browser.close();
  console.log('Done!');
})();
