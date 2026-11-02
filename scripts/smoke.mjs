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
  // the screenshots drive the game directly, so skip the first-time lesson cards
  await page.addInitScript(() => localStorage.setItem('cebar-mate:learned', JSON.stringify(Object.fromEntries(
    ['start', 'gauge', 'foam', 'ronda', 'points', 'tease', 'grab', 'wash', 'spill', 'gracias', 'truck', 'guest'].map(k => [k, true])))));
  await page.goto(URL);
  await page.waitForFunction(() => window.__mate && window.__mate.drawn > 2, null, { timeout: 8000 }).catch(e => { console.error(errors.join('\n')); throw e; });
  const canvas = page.locator('#c');
  const shot = async (name, setup) => {
    if (only && !name.startsWith(only)) return;
    if (setup) await page.evaluate(setup);
    const path = `screenshots/${name}.png`;
    await canvas.screenshot({ path });
    shots.push(path);
  };

  await shot('01-start');

  // finish the tutorial mate, then catch the first friend mid-drink
  await page.evaluate(() => {
    const m = window.__mate;
    for (let i = 0; i < 2000 && m.state.turn.fill < .9; i++) m.step(.02, .4);
    for (let i = 0; i < 2000 && !(m.state.tutorial === false && m.state.phase === 'pour'); i++) m.step(.02, 0);
    for (let i = 0; i < 2000 && m.state.turn.fill < .9; i++) m.step(.02, .45);
    for (let i = 0; i < 2000 && m.state.phase !== 'drink'; i++) m.step(.02, 0);
    m.step(1.2, 0);
  });
  await shot('02-drink');
  await shot('03-palm', () => {
    const m = window.__mate;
    m.state.seats[4].saidGracias = true;
    m.feed([{ type: 'gracias', seat: 4, palmOnly: true }]);
    m.step(.02, 0);
  });

  const rig = async (name, setup) => {
    if (only && !name.startsWith(only)) return;
    await page.evaluate(setup);
    const path = `screenshots/${name}.png`;
    await canvas.screenshot({ path });
    // a 2x crop of the rig too, the part that has to read at a glance
    const box = await canvas.boundingBox();
    await page.screenshot({ path: path.replace('.png', '-zoom.png'), clip: { x: box.x + box.width * .3, y: box.y + box.height * .7, width: box.width * .4, height: box.height * .3 } });
    shots.push(path);
  };
  const fresh = `const m = window.__mate; m.reset(1); `;
  await rig('04-rig-gentle', fresh + `for (let i = 0; i < 50; i++) m.step(.02, .35);`);
  await rig('04b-rig-sweet', fresh + `for (let i = 0; i < 50; i++) m.step(.02, .48);`);
  await rig('05-rig-hard', fresh + `for (let i = 0; i < 30; i++) m.step(.02, 1);`);
  await rig('06-rig-washed', fresh + `m.state.yerba = .2; for (let i = 0; i < 160; i++) m.step(.02, .45); m.step(.02, 0);`);
  await rig('07-rig-overflow', fresh + `m.state.turn.fill = .97; for (let i = 0; i < 25; i++) m.step(.02, .6);`);
  await page.evaluate(() => window.__mate.reset(1));

  // truck pass, the guest at the fence, and dusk
  await shot('08-truck', () => {
    const m = window.__mate; m.reset(2, { skipTutorial: true });
    Object.assign(m.state.truck, { active: true, progress: .5, speed: 1 / 30.3, nextAt: 1e9 });
    m.state.rondaTime = 100; m.step(.02, 0);
  });
  await shot('09-guest', () => {
    const m = window.__mate; m.reset(2, { skipTutorial: true });
    Object.assign(m.state.truck, { active: true, progress: .5, speed: 0, stopped: true, guestPass: true, signalled: true, nextAt: 1e9 });
    m.state.seats[6] = { look: 5, guest: true, saidGracias: false };
    m.feed([{ type: 'truckStop' }, { type: 'guestArrive' }]);
    for (let i = 0; i < 100; i++) m.step(.02, 0);
  });
  await shot('08b-dog-barks', () => {
    const m = window.__mate; m.reset(2, { skipTutorial: true });
    Object.assign(m.state.truck, { active: true, progress: .3, speed: 1 / 30.3, nextAt: 1e9 });
    m.state.rondaTime = 100;
    m.ambience.update(m.state, .02, [{ type: 'truckEnter' }]);
    for (let i = 0; i < 140; i++) m.step(.02, 0);
    m.ambience.dog.barkAt = m.state.time; m.step(.02, 0);
  });
  await shot('10-dusk', () => {
    const m = window.__mate; m.reset(3, { skipTutorial: true });
    m.state.rondaTime = 720; m.state.truck.nextAt = 1e9;
    for (let i = 0; i < 40; i++) m.step(.02, .4);
  });


  await shot('11-end', () => {
    const m = window.__mate; m.reset(4, { skipTutorial: true });
    m.state.score = 14; m.state.rondaTime = 9 * 60 + 5; m.state.yerba = .001; m.state.truck.nextAt = 1e9;
    m.step(.05, 0); for (let i = 0; i < 20; i++) m.step(.02, 1);
  });
  if (!only || '11-end'.startsWith(only)) {
    await page.screenshot({ path: 'screenshots/11-end-page.png' });
    shots.push('screenshots/11-end-page.png');
  }
} finally {
  await browser?.close();
  server.kill();
}
for (const s of shots) console.log(s);
if (errors.length) { console.error('page errors:\n' + errors.join('\n')); process.exit(1); }
