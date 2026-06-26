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

  await page.goto('http://localhost:5173/crm');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'C:/Users/Pc/AppData/Local/Temp/nexus_crm_1.png' });
  console.log('1. CRM Pipeline');

  // Click Actividades tab
  try {
    await page.click('button:has-text("Actividades")', { timeout: 3000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'C:/Users/Pc/AppData/Local/Temp/nexus_crm_2.png' });
    console.log('2. CRM Actividades');
  } catch(e) { console.log('2. Skip') }

  // Click Clientes 360
  try {
    await page.click('button:has-text("360")', { timeout: 3000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'C:/Users/Pc/AppData/Local/Temp/nexus_crm_3.png' });
    console.log('3. CRM Clientes 360');
  } catch(e) { console.log('3. Skip') }

  await browser.close();
  console.log('Done!');
})();
