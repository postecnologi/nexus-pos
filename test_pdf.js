const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text().slice(0,200)));
  page.on('response', res => {
    if(res.url().includes('exportar'))
      console.log('EXPORT RESPONSE:', res.status(), res.headers()['content-type'])
  });

  await page.goto('http://localhost:5173/login');
  await page.waitForTimeout(1000);
  await page.fill('input[placeholder="Ingresa tu usuario"]', 'admin');
  await page.fill('input[placeholder="Ingresa tu contraseña"]', 'admin123');
  await page.click('button:has-text("Iniciar sesión")');
  await page.waitForTimeout(3000);

  await page.goto('http://localhost:5173/reportes');
  await page.waitForTimeout(2000);

  // Click consultar primero
  await page.click('button:has-text("Consultar")');
  await page.waitForTimeout(2000);

  // Ahora click PDF
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 10000 }).catch(() => null),
    page.click('button:has-text("PDF")'),
  ]);

  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'C:/Users/Pc/AppData/Local/Temp/nexus_pdf_test.png' });

  if (download) {
    console.log('DOWNLOAD:', download.suggestedFilename());
    await download.saveAs('C:/Users/Pc/AppData/Local/Temp/nexus_reporte.pdf');
    console.log('PDF saved!');
  } else {
    console.log('No download event');
  }

  await browser.close();
  console.log('Done!');
})();
