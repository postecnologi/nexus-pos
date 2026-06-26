const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  // Capture console and network errors
  page.on('console', msg => { if(msg.type()==='error') console.log('CONSOLE ERROR:', msg.text()) });
  page.on('requestfailed', req => console.log('REQUEST FAILED:', req.method(), req.url(), req.failure()?.errorText));
  page.on('response', res => { if(res.status()>=400) console.log('HTTP ERROR:', res.status(), res.request().method(), res.url()) });

  await page.goto('http://localhost:5173/login');
  await page.waitForTimeout(1000);
  await page.fill('input[placeholder="Ingresa tu usuario"]', 'admin');
  await page.fill('input[placeholder="Ingresa tu contraseña"]', 'admin123');
  await page.click('button:has-text("Iniciar sesión")');
  await page.waitForTimeout(3000);

  await page.goto('http://localhost:5173/servicio-tecnico');
  await page.waitForTimeout(2000);

  // Click Tecnicos tab
  try {
    await page.click('button:has-text("Tecnicos")', { timeout: 3000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'C:/Users/Pc/AppData/Local/Temp/nexus_tec_1.png' });
    console.log('1. Tab Tecnicos');

    // Click + Nuevo Tecnico
    await page.click('button:has-text("Nuevo")', { timeout: 3000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'C:/Users/Pc/AppData/Local/Temp/nexus_tec_2.png' });
    console.log('2. Modal nuevo tecnico');

    // Fill form
    await page.fill('input[placeholder=""]', 'Carlos');
    await page.waitForTimeout(200);
    // Fill nombre field - find by label
    const nombreInput = page.locator('label:has-text("NOMBRE") + input, label:has-text("NOMBRE") ~ input').first();
    if (await nombreInput.count() > 0) {
      await nombreInput.fill('Carlos');
    }
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'C:/Users/Pc/AppData/Local/Temp/nexus_tec_3.png' });
    console.log('3. Form filled');

    // Click crear
    const crearBtn = page.locator('button:has-text("Crear tecnico")');
    if (await crearBtn.count() > 0) {
      await crearBtn.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'C:/Users/Pc/AppData/Local/Temp/nexus_tec_4.png' });
      console.log('4. After crear');
    }
  } catch(e) {
    console.log('Error:', e.message.slice(0,120));
    await page.screenshot({ path: 'C:/Users/Pc/AppData/Local/Temp/nexus_tec_error.png' });
  }

  await browser.close();
  console.log('Done!');
})();
