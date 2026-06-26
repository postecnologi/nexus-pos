const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();

  // Login
  await page.goto('http://localhost:5173/login');
  await page.waitForTimeout(1000);
  await page.fill('input[placeholder="Ingresa tu usuario"]', 'admin');
  await page.fill('input[placeholder="Ingresa tu contraseña"]', 'admin123');
  await page.click('button:has-text("Iniciar sesión")');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'C:/Users/Pc/AppData/Local/Temp/nexus_1_dashboard.png' });
  console.log('1. Dashboard');

  // Configuración - navegar por URL
  await page.goto('http://localhost:5173/configuracion');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'C:/Users/Pc/AppData/Local/Temp/nexus_2_config.png' });
  console.log('2. Configuración');

  // Click Facturación Electrónica tab
  try {
    await page.click('button:has-text("Electrónica")', { timeout: 5000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'C:/Users/Pc/AppData/Local/Temp/nexus_3_sri.png' });
    console.log('3. SRI tab');

    await page.evaluate(() => window.scrollTo(0, 999));
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'C:/Users/Pc/AppData/Local/Temp/nexus_4_email.png' });
    console.log('4. Email config');
  } catch(e) {
    console.log('3. SRI tab error:', e.message.slice(0,80));
    await page.screenshot({ path: 'C:/Users/Pc/AppData/Local/Temp/nexus_3_sri.png' });
  }

  // Facturas
  await page.goto('http://localhost:5173/facturas');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'C:/Users/Pc/AppData/Local/Temp/nexus_5_facturas.png' });
  console.log('5. Facturas');

  await browser.close();
  console.log('Done!');
})();
