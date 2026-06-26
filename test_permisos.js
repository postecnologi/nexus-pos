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

  // Usuarios
  await page.goto('http://localhost:5173/usuarios');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'C:/Users/Pc/AppData/Local/Temp/nexus_perm_1.png' });
  console.log('1. Usuarios page');

  // Click en botón de permisos (shield icon) del primer usuario
  try {
    const shieldBtn = page.locator('button:has(svg)').filter({ has: page.locator('[class*="lucide"]') });
    // El tercer botón en acciones debería ser el de permisos (shield)
    const actionBtns = page.locator('td:last-child button');
    const count = await actionBtns.count();
    console.log(`Found ${count} action buttons`);
    if (count >= 3) {
      await actionBtns.nth(2).click(); // Third button = permisos
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'C:/Users/Pc/AppData/Local/Temp/nexus_perm_2.png' });
      console.log('2. Permisos modal');
    }
  } catch(e) {
    console.log('2. Error:', e.message.slice(0,80));
    await page.screenshot({ path: 'C:/Users/Pc/AppData/Local/Temp/nexus_perm_2.png' });
  }

  await browser.close();
  console.log('Done!');
})();
