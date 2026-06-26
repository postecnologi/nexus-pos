const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  page.on('dialog', async d => { console.log('DIALOG:', d.message()); await d.accept() });

  await page.goto('http://localhost:5173/login');
  await page.waitForTimeout(1000);
  await page.fill('input[placeholder="Ingresa tu usuario"]', 'admin');
  await page.fill('input[placeholder="Ingresa tu contraseña"]', 'admin123');
  await page.click('button:has-text("Iniciar sesión")');
  await page.waitForTimeout(3000);

  await page.goto('http://localhost:5173/servicio-tecnico');
  await page.waitForTimeout(2000);

  // Click "Ver" on first order
  const verBtn = page.locator('button:has-text("Ver")').first();
  if (await verBtn.count() > 0) {
    await verBtn.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'C:/Users/Pc/AppData/Local/Temp/nexus_estado_1.png' });
    console.log('1. Detail view with estado buttons');
  }

  await browser.close();
  console.log('Done!');
})();
