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

  // Escribir en el buscador de cliente
  const input = page.locator('input[placeholder="Buscar por nombre, RUC o cédula..."]');
  await input.fill('HER');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'C:/Users/Pc/AppData/Local/Temp/nexus_buscar_1.png' });
  console.log('1. Buscador abierto con resultados');

  // Seleccionar el primer resultado
  await page.click('div:has-text("HERNAN JAVIER") >> nth=0');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'C:/Users/Pc/AppData/Local/Temp/nexus_buscar_2.png' });
  console.log('2. Cliente seleccionado');

  // Consultar con cliente filtrado
  await page.click('button:has-text("Consultar")');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'C:/Users/Pc/AppData/Local/Temp/nexus_buscar_3.png' });
  console.log('3. Reporte filtrado por cliente');

  await browser.close();
  console.log('Done!');
})();
