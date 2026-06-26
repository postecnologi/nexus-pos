const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  // Login
  await page.goto('http://localhost:5173/login');
  await page.waitForTimeout(1000);
  await page.fill('input[placeholder="Ingresa tu usuario"]', 'admin');
  await page.fill('input[placeholder="Ingresa tu contraseña"]', 'admin123');
  await page.click('button:has-text("Iniciar sesión")');
  await page.waitForTimeout(3000);

  // Reportes
  await page.goto('http://localhost:5173/reportes');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'C:/Users/Pc/AppData/Local/Temp/nexus_rep_1.png' });
  console.log('1. Reportes - Ventas tab');

  // Click consultar si hay botón
  try {
    await page.click('button:has-text("Consultar")', { timeout: 3000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'C:/Users/Pc/AppData/Local/Temp/nexus_rep_2.png' });
    console.log('2. Reportes - con datos');
  } catch(e) { console.log('2. Skip consultar') }

  // Tab Productos
  try {
    await page.click('button:has-text("Productos")', { timeout: 3000 });
    await page.waitForTimeout(1000);
    await page.click('button:has-text("Consultar")', { timeout: 3000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'C:/Users/Pc/AppData/Local/Temp/nexus_rep_3.png' });
    console.log('3. Reportes - Productos');
  } catch(e) { console.log('3. Skip productos') }

  // Tab Inventario
  try {
    await page.click('button:has-text("Inventario")', { timeout: 3000 });
    await page.waitForTimeout(1000);
    await page.click('button:has-text("Consultar")', { timeout: 3000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'C:/Users/Pc/AppData/Local/Temp/nexus_rep_4.png' });
    console.log('4. Reportes - Inventario');
  } catch(e) { console.log('4. Skip inventario') }

  // Tab CXC
  try {
    await page.click('button:has-text("CXC")', { timeout: 3000 });
    await page.waitForTimeout(1000);
    await page.click('button:has-text("Consultar")', { timeout: 3000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'C:/Users/Pc/AppData/Local/Temp/nexus_rep_5.png' });
    console.log('5. Reportes - CXC Aging');
  } catch(e) { console.log('5. Skip CXC') }

  // Tab Comisiones
  try {
    await page.click('button:has-text("Comisiones")', { timeout: 3000 });
    await page.waitForTimeout(1000);
    await page.click('button:has-text("Consultar")', { timeout: 3000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'C:/Users/Pc/AppData/Local/Temp/nexus_rep_6.png' });
    console.log('6. Reportes - Comisiones');
  } catch(e) { console.log('6. Skip comisiones') }

  await browser.close();
  console.log('Done!');
})();
