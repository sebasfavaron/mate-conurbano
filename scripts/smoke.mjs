// Visual smoke test: loads the game in Chromium, drives it through window.__mate and saves screenshots.
// Manual tool, not a dependency: npm i --no-save playwright && npx playwright install chromium
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';

let chromium;
try { ({ chromium } = await import('playwright')); } catch {
  console.error('Playwright is missing. Run: npm i --no-save playwright && npx playwright install chromium');
  process.exit(1);
}

const PORT = 5317, URL = `http://127.0.0.1:${PORT}/`;
const only = process.argv[2];
await mkdir('screenshots', { recursive: true });
const server = spawn(process.execPath, ['serve.mjs'], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
const errors = [], shots = [];
let browser;
try {
  await new Promise(r => setTimeout(r, 400));
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 3 });
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(URL);
  await page.waitForFunction(() => window.__mate && window.__mate.drawn > 2);
  const canvas = page.locator('#c');
  const shot = async (name, setup) => {
    if (only && !name.startsWith(only)) return;
    if (setup) await page.evaluate(setup);
    const path = `screenshots/${name}.png`;
    await canvas.screenshot({ path });
    shots.push(path);
  };

  await shot('01-start');
} finally {
  await browser?.close();
  server.kill();
}
for (const s of shots) console.log(s);
if (errors.length) { console.error('page errors:\n' + errors.join('\n')); process.exit(1); }
