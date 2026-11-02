// Renders the link-preview image and the icons in meta/ from the game itself.
// Manual tool, like smoke.mjs: npm i --no-save playwright && npx playwright install chromium
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

let chromium;
try { ({ chromium } = await import('playwright')); } catch {
  console.error('Playwright is missing. Run: npm i --no-save playwright && npx playwright install chromium');
  process.exit(1);
}

const PORT = 5318, URL = `http://127.0.0.1:${PORT}/`;
await mkdir('meta', { recursive: true });
const server = spawn(process.execPath, ['serve.mjs'], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
let browser;
try {
  await new Promise(r => setTimeout(r, 400));
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  await page.addInitScript(() => localStorage.setItem('cebar-mate:learned', JSON.stringify(Object.fromEntries(
    ['start', 'gauge', 'foam', 'ronda', 'points', 'tease', 'grab', 'wash', 'spill', 'gracias', 'truck', 'guest', 'side'].map(k => [k, true])))));
  await page.goto(URL);
  await page.waitForFunction(() => window.__mate && window.__mate.drawn > 2);

  // a full table, mid-pour in the sweet spot; then the same table at rest, for the icon
  const frame = setup => page.evaluate(async setup => {
    const m = window.__mate; m.reset(5, { skipTutorial: true }); m.state.truck.nextAt = 1e9;
    for (let i = 1; i <= 5; i++) m.state.seats[i] = { look: i - 1, saidGracias: false, guest: false };
    for (let i = 0; i < 2000 && m.state.phase !== 'pour'; i++) m.step(.02, 0);
    new Function('m', setup)(m);
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    return document.getElementById('c').toDataURL();
  }, setup);
  const pouring = await frame('m.step(.02, 0); for (let i = 0; i < 45; i++) m.step(.02, .48);');
  const resting = await frame('m.state.phase = "over";'); // gourd in hand, no tilt guide

  // compose both in a blank page, scaling the pixels by whole numbers so they stay crisp
  const out = await browser.newPage();
  const files = await out.evaluate(async ({ pouring, resting }) => {
    const load = src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = src; });
    const [scene, rest] = await Promise.all([load(pouring), load(resting)]);
    await document.fonts.ready;
    const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return [c, g]; };

    // 1200 × 630 preview: the scene ×3 on the right, the name on the left
    const [og, g] = canvas(1200, 630);
    g.fillStyle = '#fff'; g.fillRect(0, 0, 1200, 630);
    g.drawImage(scene, 62, 52, 240, 210, 470, 0, 720, 630);
    g.fillStyle = '#1c1b19'; g.font = '600 64px Menlo, monospace'; g.fillText('Cebar Mate', 56, 250);
    g.fillStyle = '#8b877f'; g.font = '26px Menlo, monospace';
    ['Cebale a la ronda en un', 'patio del conurbano.', 'Sin lavar la yerba.'].forEach((l, i) => g.fillText(l, 58, 312 + i * 38));
    g.font = '20px Menlo, monospace'; g.fillText('sebasfavaron.github.io/mate-conurbano', 58, 560);

    // icons: the gourd in hand, 52 × 52 source pixels, scaled by whole numbers and centred
    const icon = (size, opaque) => {
      const [c, g] = canvas(size, size);
      if (opaque) { g.fillStyle = '#fff'; g.fillRect(0, 0, size, size); }
      g.imageSmoothingEnabled = size < 52;
      const side = size < 52 ? size : 52 * Math.floor(size / 52), at = (size - side) / 2;
      g.drawImage(rest, 178, 212, 52, 52, at, at, side, side);
      if (!opaque) { // the paper turns transparent so the tab bar shows through
        const d = g.getImageData(0, 0, size, size);
        for (let i = 0; i < d.data.length; i += 4) if (d.data[i] > 250 && d.data[i + 1] > 250 && d.data[i + 2] > 250) d.data[i + 3] = 0;
        g.putImageData(d, 0, 0);
      }
      return c.toDataURL();
    };
    return { 'og.png': og.toDataURL(), 'icon-32.png': icon(32, false), 'icon-180.png': icon(180, true), 'icon-192.png': icon(192, true), 'icon-512.png': icon(512, true) };
  }, { pouring, resting });
  for (const [name, url] of Object.entries(files)) {
    await writeFile(`meta/${name}`, Buffer.from(url.split(',')[1], 'base64'));
    console.log(`meta/${name}`);
  }
} finally {
  await browser?.close();
  server.kill();
}
