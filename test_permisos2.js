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

  await page.goto('http://localhost:5173/usuarios');
  await page.waitForTimeout(2500);

  // Click shield button (permisos) - third button in actions
  const actionBtns = page.locator('td:last-child button');
  const count = await actionBtns.count();
  if (count >= 3) {
    await actionBtns.nth(2).click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'C:/Users/Pc/AppData/Local/Temp/nexus_perm2_1.png' });
    console.log('1. Modal permisos granulares - top');

    // Scroll down in modal
    const modal = page.locator('div[style*="overflow"]').last();
    await modal.evaluate(el => el.scrollTop = 400);
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'C:/Users/Pc/AppData/Local/Temp/nexus_perm2_2.png' });
    console.log('2. Modal permisos - middle');

    await modal.evaluate(el => el.scrollTop = 900);
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'C:/Users/Pc/AppData/Local/Temp/nexus_perm2_3.png' });
    console.log('3. Modal permisos - bottom');
  }

  await browser.close();
  console.log('Done!');
})();
