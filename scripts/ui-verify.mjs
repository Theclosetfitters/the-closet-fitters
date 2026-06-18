// Browser-driven verification of the configurator UI.
//
// Run (dev server must be running on BASE_URL):
//   npm run dev          # one terminal
//   npm run test:ui      # another
//
// Drives a real headless Chromium and asserts:
//   - /configure loads and shows a server-computed price
//   - the React Three Fiber 3D <canvas> actually mounts
//   - changing a component (adding a shelf) updates the live price upward
//   - switching closet type re-prices and the 3D viewer stays mounted
import { chromium } from 'playwright';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

let pass = 0;
let fail = 0;
const c = {
  g: (s) => `\x1b[32m${s}\x1b[0m`,
  r: (s) => `\x1b[31m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};
function ok(name, cond, detail = '') {
  if (cond) {
    pass++;
    console.log(`  ${c.g('PASS')} ${name}`);
  } else {
    fail++;
    console.log(`  ${c.r('FAIL')} ${name}${detail ? c.dim(' — ' + detail) : ''}`);
  }
}

const money = (s) => Number(String(s).replace(/[^0-9.]/g, ''));

async function main() {
  console.log(`\nUI verify against ${c.dim(BASE_URL)}\n`);

  // Confirm the server is up before launching a browser.
  try {
    const r = await fetch(`${BASE_URL}/configure`);
    if (!r.ok) throw new Error(`status ${r.status}`);
  } catch (err) {
    console.error(c.r(`Dev server not reachable at ${BASE_URL}. Run \`npm run dev\`.`));
    console.error(c.dim(String(err)));
    process.exit(1);
  }

  const browser = await chromium.launch({
    headless: true,
    // Software WebGL so the R3F canvas works without a GPU.
    args: [
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist',
    ],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));

  try {
    await page.goto(`${BASE_URL}/configure`, { waitUntil: 'domcontentloaded' });

    const total = page.getByTestId('price-total');

    // 1) Price renders (server-computed, not the "—" placeholder).
    await total.waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForFunction(
      () => {
        const el = document.querySelector('[data-testid="price-total"]');
        return el && el.textContent && el.textContent.trim() !== '—';
      },
      { timeout: 15000 }
    );
    const total1 = await total.textContent();
    ok('configure page shows a live price', money(total1) > 0, `total=${total1}`);

    // 2) The R3F canvas mounted inside the viewer.
    const canvas = page.locator('[data-testid="closet-viewer"] canvas');
    await canvas.waitFor({ state: 'attached', timeout: 20000 }).catch(() => {});
    ok('3D viewer <canvas> is mounted', (await canvas.count()) >= 1);

    const waitPriceChange = (prev) =>
      page.waitForFunction(
        (p) => {
          const el = document.querySelector('[data-testid="price-total"]');
          return el && el.textContent && el.textContent.trim() !== p;
        },
        prev,
        { timeout: 8000 }
      );

    // 3) Adding a section increases the price (+$500).
    await page.getByTestId('add-bay-A').click();
    await waitPriceChange(total1);
    const total2 = await total.textContent();
    ok(
      'adding a section raises the live price',
      money(total2) > money(total1),
      `${total1} -> ${total2}`
    );

    // 4) Switching a section to drawers re-prices upward ($500 -> $1,500).
    await page.getByTestId('section-interior-0').selectOption('drawers');
    await waitPriceChange(total2);
    const total3 = await total.textContent();
    ok(
      'changing a section to drawers re-prices upward',
      money(total3) > money(total2),
      `${total2} -> ${total3}`
    );
    ok('3D viewer still mounted after edits', (await page.locator('[data-testid="closet-viewer"] canvas').count()) >= 1);

    ok('no uncaught page errors', pageErrors.length === 0, pageErrors.join(' | '));
  } finally {
    await browser.close();
  }

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(c.r('\nUI run crashed:'), err);
  process.exit(1);
});
