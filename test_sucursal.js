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
  await page.screenshot({ path: 'C:/Users/Pc/AppData/Local/Temp/nexus_suc_selector.png' });
  console.log('1. Dashboard con selector sucursal');
  await browser.close();
  console.log('Done!');
})();
