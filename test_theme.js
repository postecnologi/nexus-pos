const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  await page.goto('http://localhost:5173/login');
  await page.waitForTimeout(1000);
  await page.fill('input[placeholder="Ingresa tu usuario"]', 'admin');
  await page.fill('input[placeholder="Ingresa tu contraseña"]', 'admin123');
  await page.click('button:has-text("Iniciar sesión")');
  await page.waitForTimeout(3000);

  // Dark mode (default)
  await page.screenshot({ path: 'C:/Users/Pc/AppData/Local/Temp/nexus_dark.png' });
  console.log('1. Dark mode');

  // Switch to light mode - click the Sun/Moon button
  try {
    const themeBtn = page.locator('button:has-text("Claro")');
    if (await themeBtn.count() > 0) {
      await themeBtn.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: 'C:/Users/Pc/AppData/Local/Temp/nexus_light.png' });
      console.log('2. Light mode');

      // Navigate to facturas in light mode
      await page.goto('http://localhost:5173/facturas');
      await page.waitForTimeout(2500);
      await page.screenshot({ path: 'C:/Users/Pc/AppData/Local/Temp/nexus_light_fac.png' });
      console.log('3. Light mode - Facturas');

      // Navigate to reportes
      await page.goto('http://localhost:5173/reportes');
      await page.waitForTimeout(2000);
      await page.click('button:has-text("Consultar")');
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'C:/Users/Pc/AppData/Local/Temp/nexus_light_rep.png' });
      console.log('4. Light mode - Reportes');
    } else {
      console.log('Theme button not found');
    }
  } catch(e) {
    console.log('Error:', e.message.slice(0,80));
  }

  await browser.close();
  console.log('Done!');
})();
