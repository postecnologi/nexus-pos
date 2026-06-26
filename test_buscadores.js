const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  page.on('dialog', async d => { await d.accept() });

  await page.goto('http://localhost:5173/login');
  await page.waitForTimeout(1000);
  await page.fill('input[placeholder="Ingresa tu usuario"]', 'admin');
  await page.fill('input[placeholder="Ingresa tu contrasena"]', 'admin123');
  await page.click('button:has-text("Iniciar sesion")', { force: true });
  await page.waitForTimeout(3000);

  await page.goto('http://localhost:5173/facturas');
  await page.waitForTimeout(2000);

  // Try clicking on client search
  const clientInput = page.locator('input[placeholder*="nombre, RUC"]').first();
  console.log('Client input count:', await clientInput.count());
  try {
    await clientInput.click({ timeout: 3000 });
    await page.keyboard.type('HER');
    await page.waitForTimeout(1500);
    console.log('Client search: OK');
  } catch(e) {
    console.log('Client search ERROR:', e.message.slice(0, 100));
  }

  await page.screenshot({ path: 'C:/Users/Pc/AppData/Local/Temp/nexus_fac_buscar.png' });

  // Try product search
  const prodInput = page.locator('input[placeholder*="producto"]').first();
  console.log('Product input count:', await prodInput.count());
  try {
    await prodInput.click({ timeout: 3000 });
    await page.keyboard.type('CEL');
    await page.waitForTimeout(1500);
    console.log('Product search: OK');
  } catch(e) {
    console.log('Product search ERROR:', e.message.slice(0, 100));
  }

  await page.screenshot({ path: 'C:/Users/Pc/AppData/Local/Temp/nexus_fac_buscar2.png' });

  // Try vendor search
  const vendorInput = page.locator('input[placeholder*="vendedor"]').first();
  console.log('Vendor input count:', await vendorInput.count());
  try {
    await vendorInput.click({ timeout: 3000 });
    await page.keyboard.type('HER');
    await page.waitForTimeout(1500);
    console.log('Vendor search: OK');
  } catch(e) {
    console.log('Vendor search ERROR:', e.message.slice(0, 100));
  }

  await page.screenshot({ path: 'C:/Users/Pc/AppData/Local/Temp/nexus_fac_buscar3.png' });

  await browser.close();
  console.log('Done!');
})();
