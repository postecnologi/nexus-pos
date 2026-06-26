const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  page.on('dialog', async d => { console.log('ALERT:', d.message()); await d.accept() });
  page.on('response', res => {
    if(res.url().includes('/clientes'))
      console.log('API:', res.status(), res.url().split('?')[1]||'')
  });

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

  // Use keyboard typing instead of fill
  const input = page.locator('input[placeholder*="cliente"]').first();
  await input.click();
  await page.keyboard.type('HER', { delay: 100 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'C:/Users/Pc/AppData/Local/Temp/nexus_type.png' });
  console.log('Screenshot after typing HER');

  // Try clicking result
  const result = page.locator('div[style*="cursor: pointer"]').first();
  const cnt = await result.count();
  console.log('Clickable results found:', cnt);

  if (cnt > 0) {
    await result.click();
    await page.waitForTimeout(500);
    console.log('Clicked result');

    // Fill problema
    const problema = page.locator('textarea[placeholder*="problema"]');
    if (await problema.count() > 0) await problema.fill('Pantalla rota');

    // Click crear
    await page.click('button:has-text("Crear Orden")');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'C:/Users/Pc/AppData/Local/Temp/nexus_created.png' });
  }

  await browser.close();
  console.log('Done!');
})();
