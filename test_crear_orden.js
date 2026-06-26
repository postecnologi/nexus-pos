const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  // Capturar errores de red
  page.on('response', res => {
    if(res.status()>=400 && res.url().includes('/api/'))
      console.log('HTTP ERROR:', res.status(), res.request().method(), res.url())
  });
  page.on('console', msg => {
    if(msg.type()==='error') console.log('CONSOLE:', msg.text().slice(0,200))
  });

  await page.goto('http://localhost:5173/login');
  await page.waitForTimeout(1000);
  await page.fill('input[placeholder="Ingresa tu usuario"]', 'admin');
  await page.fill('input[placeholder="Ingresa tu contraseña"]', 'admin123');
  await page.click('button:has-text("Iniciar sesión")');
  await page.waitForTimeout(3000);

  await page.goto('http://localhost:5173/servicio-tecnico');
  await page.waitForTimeout(2000);

  // Click + Nueva Orden
  try {
    await page.click('button:has-text("Nueva Orden")', { timeout: 3000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'C:/Users/Pc/AppData/Local/Temp/nexus_ord_1.png' });
    console.log('1. Modal nueva orden abierto');

    // Buscar cliente
    const cliInput = page.locator('input[placeholder*="cliente"]').first();
    await cliInput.fill('HER');
    await page.waitForTimeout(1500);

    // Click en resultado
    const resultado = page.locator('div:has-text("HERNAN")').last();
    if (await resultado.count() > 0) {
      await resultado.click();
      await page.waitForTimeout(500);
    }
    console.log('2. Cliente seleccionado');

    // Llenar equipo
    const inputs = page.locator('input');
    const count = await inputs.count();
    console.log(`Total inputs: ${count}`);

    // Llenar problema reportado (textarea)
    const textarea = page.locator('textarea').first();
    if (await textarea.count() > 0) {
      await textarea.fill('Pantalla rota, no responde al tacto');
      console.log('3. Problema llenado');
    }

    await page.screenshot({ path: 'C:/Users/Pc/AppData/Local/Temp/nexus_ord_2.png' });

    // Click crear
    const crearBtn = page.locator('button:has-text("Crear")').last();
    if (await crearBtn.count() > 0) {
      console.log('4. Clicking crear...');
      await crearBtn.click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: 'C:/Users/Pc/AppData/Local/Temp/nexus_ord_3.png' });
      console.log('5. Despues de crear');
    }
  } catch(e) {
    console.log('ERROR:', e.message.slice(0,150));
    await page.screenshot({ path: 'C:/Users/Pc/AppData/Local/Temp/nexus_ord_error.png' });
  }

  await browser.close();
  console.log('Done!');
})();
