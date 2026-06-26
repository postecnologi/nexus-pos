const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  page.on('dialog', async d => { await d.accept() });

  await page.goto('http://localhost:5173/login');
  await page.waitForTimeout(1000);
  await page.fill('input[placeholder="Ingresa tu usuario"]', 'admin');
  await page.fill('input[placeholder="Ingresa tu contraseña"]', 'admin123');
  await page.click('button:has-text("Iniciar sesión")');
  await page.waitForTimeout(3000);

  await page.goto('http://localhost:5173/servicio-tecnico');
  await page.waitForTimeout(2000);
  await page.click('button:has-text("Nueva Orden")');
  await page.waitForTimeout(1000);

  // Type in client search
  const input = page.locator('input[placeholder*="cliente"]').first();
  await input.fill('HER');
  await page.waitForTimeout(2000);

  // Screenshot to see if dropdown appears
  await page.screenshot({ path: 'C:/Users/Pc/AppData/Local/Temp/nexus_dropdown.png' });
  console.log('Screenshot taken - check dropdown visibility');

  await browser.close();
})();
