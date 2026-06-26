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

  // Dashboard mejorado
  await page.screenshot({ path: 'C:/Users/Pc/AppData/Local/Temp/nexus_final_1_dash.png' });
  console.log('1. Dashboard top');
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'C:/Users/Pc/AppData/Local/Temp/nexus_final_2_dash.png' });
  console.log('2. Dashboard bottom');

  // Facturas con atajos
  await page.goto('http://localhost:5173/facturas');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'C:/Users/Pc/AppData/Local/Temp/nexus_final_3_fac.png' });
  console.log('3. Facturas con barra atajos');

  // Cotizaciones
  await page.goto('http://localhost:5173/cotizaciones');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'C:/Users/Pc/AppData/Local/Temp/nexus_final_4_cot.png' });
  console.log('4. Cotizaciones');

  // Kardex
  await page.goto('http://localhost:5173/kardex');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'C:/Users/Pc/AppData/Local/Temp/nexus_final_5_kardex.png' });
  console.log('5. Kardex');

  // Toma Física
  await page.goto('http://localhost:5173/toma-fisica');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'C:/Users/Pc/AppData/Local/Temp/nexus_final_6_toma.png' });
  console.log('6. Toma Física');

  // Sidebar completo
  // Click to expand all sidebar groups
  const groups = page.locator('nav button');
  for (let i = 0; i < await groups.count(); i++) {
    try { await groups.nth(i).click(); } catch {}
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'C:/Users/Pc/AppData/Local/Temp/nexus_final_7_sidebar.png',
    clip: { x: 0, y: 0, width: 220, height: 900 }});
  console.log('7. Sidebar');

  await browser.close();
  console.log('Done!');
})();
