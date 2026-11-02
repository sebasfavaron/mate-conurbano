# Cebar Mate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build *Cebar Mate*, a standalone pixel-diorama browser game where you pour mate for a growing ronda in a conurbano patio, without washing the yerba or pouring for whoever said *gracias*.

**Architecture:** A pure, seeded simulation (`src/sim.js`) advances the game from one analog `tilt` value and emits events; thin browser layers turn devices into `tilt` (`src/input.js`), events into sound (`src/audio.js`) and text (`src/ui.js`), and state into pixels (`src/scene.js`) through the copied Pixel Plays rasteriser (`engine.js`). `src/main.js` wires the loop.

**Tech Stack:** Plain JavaScript (ES modules + one classic script), Web Audio, Gamepad API, Canvas 2D. Node ≥ 22 for `node --test`. Playwright (already on the machine or via `npx`) for the optional smoke script only. No runtime dependencies, no build step.

**Spec:** `docs/specs/2026-11-02-cebar-mate-design.md`. Read it before starting any task; every number quoted below comes from it.

## Global Constraints

- No runtime dependencies, no build step, no image assets. `package.json` exists only for `"type": "module"` and the test script.
- `engine.js` is copied **unmodified** from `amirmushichge/pixel-plays` (`engine.js`, MIT, © 2026 Amir Mushich) with its header intact.
- Canvas 360×280, element `<canvas id="c">`, `window.PP_SCENE` set before `engine.js` loads.
- All player-facing text in Argentine Spanish (voseo), exactly as written in spec §5. `<html lang="es-AR">`.
- `src/sim.js`, `src/input.js` (pure part), `src/lines.js`, `src/audio-math.js`, `src/tuning.js`, `src/rng.js`, `src/store.js` must import in Node with no browser globals at module top level.
- All tunables live in `src/tuning.js` under the exact names in Task 1; no magic numbers elsewhere for anything the spec lists.
- Every `localStorage` access goes through `src/store.js` (try/catch; game works without storage).
- Respect `prefers-reduced-motion` via the engine's `STILL` (plants and dust stop; the truck still moves).
- Commits end with the session's attribution lines if your tooling adds them; messages are imperative, lowercase prefix (`feat:`, `test:`, `chore:`).

## Decision recorded during planning

- **D1 — Hero pour rig in screen space.** The engine's scale is fixed (`S = 10` px per world unit; a head is ~5 px), so a to-scale gourd would be 2–3 px and unreadable. The spec's "gourd in the foreground at ~16–18 px seen from above" is therefore drawn **in screen space** at the bottom centre of the canvas, overlapping the island's near edge: your hands, the thermos and the gourd interior, drawn pixel-by-pixel with the engine's ramps and Bayer dither (Task 12). The cebador is not drawn as a full figure. While a friend has the mate, a small to-scale gourd travels in the world (Task 11) and the rig shows the resting thermos. Spec §3.2 has been annotated accordingly.

## Review Focus

1. **Frame spikes** (tab hidden, slow device): a single `step` with a large `dt` must not skip a grab, a bomb or a skip. Sim sub-steps at `T.MAX_STEP`. Test in Task 4.
2. **Gamepad unplugged mid-pour / never plugged:** gamepad `tilt` source must fall to 0, not stay frozen at the last value. Test in Task 3.
3. **Focus lost while Space/Shift held** (alt-tab, dialog opened): keys must be treated as released so the thermos springs back. Test in Task 3.
4. **Input still held when the run ends:** the end screen must not restart from the held press; "otra ronda" needs a fresh press after `T.RESTART_GUARD`. Test in Task 14.
5. **Storage unavailable** (private mode, blocked site data): best score, mute and first-run flags fall back to defaults with no exception. Test in Task 1.

---

## File map

| File | Responsibility |
|---|---|
| `index.html` | Page, HUD markup, loads `engine.js` then `src/main.js` |
| `lab.html` | Sound lab (sliders) |
| `engine.js` | Copied rasteriser (globals) |
| `src/tuning.js` | `T`: every tunable number |
| `src/rng.js` | Seeded RNG (mulberry32) |
| `src/store.js` | Safe localStorage wrapper |
| `src/lines.js` | Line bank + `pickLine` |
| `src/input.js` | Pure tilt model + browser binding |
| `src/sim.js` | Pure rules: `createRun`, `step` |
| `src/audio-math.js` | Pure audio curves: resonance, truck mix, babble plan |
| `src/audio.js` | Web Audio graph (browser only) |
| `src/scene.js` | Bake + draw (browser only, reads engine globals) |
| `src/ui.js` | DOM text: bubbles, status, tutorial, rules, end screen |
| `src/main.js` | Boot, loop, wiring, `window.__mate` test hook |
| `scripts/smoke.mjs` | Playwright screenshots (manual) |
| `test/*.test.mjs` | Unit tests |

---

### Task 1: Scaffold, tuning, RNG, store

**Files:**
- Create: `package.json`, `serve.mjs`, `LICENSE`, `THIRD_PARTY.md`, `README.md` (short; expanded in Task 15), `.gitignore` (`screenshots/`, `node_modules/`)
- Create: `engine.js` (copy from `assets/engine.js` in the handoff zip, unmodified)
- Create: `audio/musica.mp3`, `audio/camion.mp3` (from the handoff zip `assets/`)
- Create: `src/tuning.js`, `src/rng.js`, `src/store.js`
- Test: `test/rng.test.mjs`, `test/store.test.mjs`

**Interfaces:**
- Produces:
  - `src/tuning.js`: `export const T` — a frozen object with exactly these keys and starting values:
    - pour: `TILT_FLOW_MIN .12, FLOW_MAX .55, FLOW_EXP 1.3, AIM_SAFE .45, AIM_FULL .85, FILL_OK .85, HANDOFF_DELAY .4`
    - yerba: `WEAR_BASE .02, WASH_TOP .10, WASH_SPILL .05, WASH_OVERFLOW .20, WET_DRY_RATE .05, LAVADO_AT .30, LAVADO_EVERY 20`
    - ronda: `PATIENCE_START 6, PATIENCE_END 4, PATIENCE_RAMP_MATES 30, TEASE_AT [.5, .83], PASS_TIME .6, DRINK_TIME 3.0, SEATS 6, START_SEATS [2, 4], ARRIVE_ORDER [3, 1, 5], ARRIVE_EVERY 5`
    - gracias: `GRACIAS_FROM_MATE 5, P_GRACIAS_START .12, P_GRACIAS_END .20, P_GRACIAS_RAMP_MATES 30, TRUCK_GRACIAS_MULT 2, MIN_ACTIVE 2, SKIP_DELAY 1.2`
    - truck: `TRUCK_FIRST_MIN 60, TRUCK_FIRST_MAX 150, TRUCK_GAP_MIN 90, TRUCK_GAP_MAX 150, TRUCK_PASS 30.3, P_GUEST .25, GUEST_AFTER 180, GUEST_PATIENCE 8, GUEST_VALUE 2, GUEST_STOP_AT .5, GUEST_SLOW_TIME 3`
    - misc: `DUSK_TIME 720, SHIFT_TIP_WASH .08, SHIFT_TIP_MATE 8, MAX_STEP .05`
    - input: `KEY_UP 1.0, KEY_DOWN 2.5, FINE_UP .35, FINE_DOWN .6, PAD_DEADZONE .05, DRAG_PX 120`
    - audio: `MUSIC_GAIN .63, MUSIC_DUCK .30, DUCK_FADE_IN 1.0, DUCK_FADE_OUT 2.0, TRUCK_GAIN 1.0, RES_F_EMPTY 260, RES_MIN_AIR .04, BLIP_MIN .04, BLIP_MAX .06, VOICE_JITTER .08, WORD_PAUSE .05, FRIEND_VOICES [{hz:320,rate:1.15},{hz:260,rate:1},{hz:220,rate:.95},{hz:290,rate:1.1},{hz:180,rate:.9}], DRIVER_VOICE {hz:95, rate:.6, wordPause:.12}`
    - ui: `BUBBLE_TIME 2.2, RESTART_GUARD .8`
  - `src/rng.js`: `makeRng(seed: number) -> { s: number }`, `nextRandom(r) -> number in [0,1)` (mulberry32, mutates `r.s`), `randomBetween(r, a: number, b: number) -> number`.
  - `src/store.js`: `createStore(storage?: Storage-like) -> { get(key: string, fallback: any): any, set(key: string, value: any): void }`. Values JSON-encoded under the prefix `cebar-mate:`. Default `storage` is `globalThis.localStorage` resolved lazily inside a try. Keys used later: `best` (number), `muted` (boolean), `seenGracias` (boolean).

- [ ] **Step 1: Write the failing tests**

```js
// test/rng.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict';
import { makeRng, nextRandom, randomBetween } from '../src/rng.js';
test('same seed gives the same sequence', () => {
  const a = makeRng(42), b = makeRng(42);
  const sa = [1,2,3,4,5].map(() => nextRandom(a)), sb = [1,2,3,4,5].map(() => nextRandom(b));
  assert.deepEqual(sa, sb);
  assert.ok(sa.every(v => v >= 0 && v < 1));
});
test('randomBetween stays in range', () => {
  const r = makeRng(7);
  for (let i = 0; i < 1000; i++) { const v = randomBetween(r, 90, 150); assert.ok(v >= 90 && v < 150); }
});
// test/store.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict';
import { createStore } from '../src/store.js';
const memory = () => { const m = new Map(); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)) }; };
test('round-trips values under the prefix', () => {
  const s = memory(), store = createStore(s);
  store.set('best', 17);
  assert.equal(store.get('best', 0), 17);
  assert.equal(s.getItem('cebar-mate:best'), '17');
});
test('throwing storage falls back silently', () => {
  const bad = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  const store = createStore(bad);
  assert.doesNotThrow(() => store.set('muted', true));
  assert.equal(store.get('muted', false), false);
});
test('corrupt JSON falls back', () => {
  const s = memory(); s.setItem('cebar-mate:best', '{oops'); assert.equal(createStore(s).get('best', 0), 0);
});
```

- [ ] **Step 2: Run to verify failure** — `node --test "test/*.test.mjs"` → FAIL (modules not found).
- [ ] **Step 3: Implement** `package.json` (`{"name":"mate-conurbano","private":true,"type":"module","engines":{"node":">=22"},"scripts":{"test":"node --test \"test/*.test.mjs\"","serve":"node serve.mjs","smoke":"node scripts/smoke.mjs"}}`), `serve.mjs` (static server on `127.0.0.1:5300`, same behaviour as Pixel Plays' `serve.mjs`: path normalisation, 403 outside root, `no-store`, mp3/js/html types), `LICENSE` (MIT, © 2026 Sebastián Favaron), `THIRD_PARTY.md` (engine.js MIT notice reproduced in full; `audio/musica.mp3` "Lofi chill Argentina, Rock Nacional 60/70s vol. 5", source URL + licence for the owner to fill in; `audio/camion.mp3` the owner's own recording), `src/tuning.js`, `src/rng.js`, `src/store.js`.
- [ ] **Step 4: Run to verify pass** — `npm test` → all pass.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "chore: scaffold project, tuning, rng and store"`

---

### Task 2: Line bank

**Files:** Create `src/lines.js` · Test `test/lines.test.mjs`

**Interfaces:**
- Consumes: `nextRandom` (Task 1).
- Produces: `export const LINES` with keys `impatient, spill, lavado, arrive, gracias, bomb, guestAsk, guestThanks, tutorial` — arrays of strings copied **verbatim** from spec §5.2 (`guestAsk = ['Una mano, maestro, ¿me convidás uno?']`, `guestThanks = ['Gracias, jefe']`) and `tutorial = { start, pouring, first, gracias, shiftTip }` from spec §5.1 / §4.1. `export function pickLine(category: string, rng, last?: string) -> string` never returns `last` when the category has ≥ 2 lines.

- [ ] **Step 1: Failing tests** — `pickLine never repeats the previous line` (loop 200×, feed back `last`, assert `!==` for `impatient`); `single-line category returns that line` (`guestThanks`); `every category is non-empty strings`; `impatient contains the owner's four lines` (assert includes `'¿Es cuadrado ese mate que no gira?'`, `'Tengo la garganta un poco seca…'`, `'Che, no es cadena nacional'`, and `lavado` includes `'¿Armamos otro así gira más rápido?'`).
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3: Implement** `src/lines.js`.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** `git commit -am "feat: line bank"` (add the new files first).

---

### Task 3: Tilt input

**Files:** Create `src/input.js` · Test `test/input.test.mjs`

**Interfaces:**
- Consumes: `T` (Task 1).
- Produces (pure, Node-safe):
  - `gamepadValue(l2: number, r2: number) -> number` — `max`, then dead zone `T.PAD_DEADZONE` and rescale to 0–1.
  - `pointerValue(dragCssPx: number) -> number` — `clamp(dy / T.DRAG_PX, 0, 1)`.
  - `createTilt() -> { tilt: 0, source: 'keyboard' }`
  - `updateTilt(model, dt: number, raw: { space: boolean, shift: boolean, pointer: number|null, gamepad: number|null, source: 'keyboard'|'pointer'|'gamepad' }) -> number` — keyboard integrates (`KEY_UP/KEY_DOWN`, or `FINE_UP/FINE_DOWN` while `shift`), clamped 0–1; pointer/gamepad sources are direct (`null` → 0). Writes `model.tilt` and returns it.
- Produces (browser): `bindInput(target: HTMLElement) -> { read(dt: number): number, raw }` — keydown/keyup for Space/Shift (preventDefault on Space), pointerdown/move/up/cancel with `setPointerCapture`, `navigator.getGamepads()` polled in `read` using standard buttons 6/7 `.value`; any activity sets `raw.source`; `window` `blur` and `visibilitychange` (hidden) set `space = shift = false` and `pointer = null`; `gamepaddisconnected` sets `gamepad = null`. Exposes `raw.pressedEdge` (true for one `read` after any fresh press from any source) for Task 14.

- [ ] **Step 1: Failing tests**

```js
// test/input.test.mjs — values from spec §4.1
import test from 'node:test'; import assert from 'node:assert/strict';
import { createTilt, updateTilt, gamepadValue, pointerValue } from '../src/input.js';
const kb = (o) => ({ space: false, shift: false, pointer: null, gamepad: null, source: 'keyboard', ...o });
const run = (m, secs, raw) => { for (let t = 0; t < secs - 1e-9; t += .01) updateTilt(m, .01, raw); return m.tilt; };
test('space reaches full tilt in ~1 s', () => { const m = createTilt(); assert.ok(Math.abs(run(m, .5, kb({ space: true })) - .5) < .02); assert.equal(run(m, 1, kb({ space: true })), 1); });
test('release springs back at 2.5/s', () => { const m = createTilt(); m.tilt = 1; assert.ok(Math.abs(run(m, .2, kb()) - .5) < .02); });
test('shift switches to fine rates mid-hold, both ways', () => {
  const m = createTilt(); run(m, .4, kb({ space: true }));                 // .4
  assert.ok(Math.abs(run(m, 1, kb({ space: true, shift: true })) - .75) < .02); // +.35
  assert.ok(Math.abs(run(m, .5, kb({ shift: true })) - .45) < .02);           // −.6/s * .5
});
test('gamepad dead zone and max of triggers', () => { assert.equal(gamepadValue(.04, 0), 0); assert.ok(Math.abs(gamepadValue(.2, .525) - .5) < 1e-9); });
test('pointer maps 120 px to full tilt', () => { assert.equal(pointerValue(60), .5); assert.equal(pointerValue(500), 1); assert.equal(pointerValue(-20), 0); });
test('unplugged gamepad falls to 0', () => { const m = createTilt(); updateTilt(m, .01, kb({ source: 'gamepad', gamepad: .9 })); assert.equal(updateTilt(m, .01, kb({ source: 'gamepad', gamepad: null })), 0); });
test('focus loss (all released) springs the thermos back', () => { const m = createTilt(); run(m, 1, kb({ space: true })); assert.ok(run(m, .5, kb()) < .01); });
```

- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3: Implement** `src/input.js`; keep the browser binding inside `bindInput` so the module has no top-level browser access.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** commit `feat: analog tilt input`.

---

### Task 4: Sim — the pour and the yerba

**Files:** Create `src/sim.js` · Test `test/sim-pour.test.mjs`

**Interfaces:**
- Consumes: `T`, `makeRng/nextRandom/randomBetween`.
- Produces (shape later tasks read — keep these names):
  - `createRun({ seed: number }) -> State`
  - `step(state, dt: number, tilt: number) -> { state, events: Event[] }` (mutates and returns the same `state`; internally sub-steps at `T.MAX_STEP`).
  - `pourAt(tilt) -> { flow, land, topFrac }` (exported pure helper, spec §2.2 formulas).
  - `State` fields: `phase: 'pour'|'out'|'drink'|'back'|'over'`, `phaseTime`, `tutorial: boolean`, `time`, `rondaTime`, `tilt`, `flow`, `land`, `topFrac`, `yerba`, `wetTop`, `score`, `served`, `seats: (Seat|null)[7]` (index 0 = you, 1–5 friend chairs anticlockwise, 6 = guest at the fence), `turn: { seat, trap, armed, fill, overflow, spilled, stillTime, waited, teases, pourWash, pouring }`, `truck: { active, progress, speed, nextAt, guestPass, stopped, signalled }`, `guest: { planned, done }`, `lastLavadoAt`, `tipShown`, `arrivals`, `over: null | { reason: 'lavado'|'gracias', score, minutes }`, `rng`.
  - `Seat = { look: number /* 0–4 friends, 5 = driver */, saidGracias: boolean, guest: boolean }`
  - `Event = { type: string, ...payload }`. Types emitted by this task: `pourStart`, `pourEnd {wash}`, `spill {seat}`, `handoff {seat, good, value, grabbed}`, `gameOver {reason, score, minutes}`.

This task implements only the pour inside a turn plus wear; ronda progression is Task 5. To make it testable now, `createRun` starts in `phase 'pour'`, `tutorial: true`, `turn.seat = 0`, `turn.armed = true` (the first gesture starts the game, so there is no held input to guard against), seats per `T.START_SEATS` with looks 0 and 1.

- [ ] **Step 1: Failing tests** (`test/sim-pour.test.mjs`; helper `pourFor(state, secs, tilt)` loops `step` at `.01`):
  - `no flow below TILT_FLOW_MIN` — `pourAt(.11).flow === 0`, `pourAt(.12).flow === 0`, `pourAt(.13).flow > 0`.
  - `full tilt flows FLOW_MAX and lands on the top` — `pourAt(1)` → `flow === .55`, `land === 1`, `topFrac === 1`.
  - `gentle tilt lands in the hole` — `pourAt(.4).topFrac === 0` (land ≈ .318 < .45).
  - `fill integrates flow` — `pourFor(s, 1, 1)` → `turn.fill ≈ .55` (±.01).
  - `hand-off after 0.4 s of stillness at ≥ .85` — pour to fill .9, then `pourFor(s, .39, 0)` → still `phase 'pour'`; `pourFor(s, .02, 0)` → event `handoff` with `seat 0` and `phase !== 'pour'`.
  - `re-tilting inside the delay cancels hand-off` — fill .9, still .3 s, pour .1 s at tilt .3, still .3 s → no `handoff` yet.
  - `under FILL_OK the mate stays` — fill .6, still 2 s → no `handoff`.
  - `top wash` — yerba drops by `WASH_TOP · flow · topFrac · dt`: pour 1 s at tilt 1 from yerba 1 → `yerba ≈ 1 − .10·.55` (±.005) (tutorial pour applies top wash, spec §2.3 / plan Task 5 note).
  - `overflow spills once and washes` — pour past fill 1 at tilt 1 for 1 s: exactly one `spill` event; `yerba` reduced by an extra `.05 + .20 · overflow` (±.005) on top of the top wash.
  - `wetTop rises with water on top and dries at .05/s`.
  - `yerba at 0 ends the run` — set `s.yerba = .001`, pour at tilt 1 → `gameOver` with `reason 'lavado'`, `phase 'over'`; further `step` calls emit nothing.
  - `big dt equals many small steps` (Review Focus 1) — two runs with the same seed; one `step(s, 1.0, 1)`, the other 20 × `step(s, .05, 1)`: `fill`, `yerba` and the event type sequence are equal.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3: Implement** `createRun`, `step` (sub-stepping), `pourAt`, the in-turn pour logic in `src/sim.js`. `pouring` flips true on the first frame with `flow > 0` after `armed` (emit `pourStart`), false when flow stops (emit `pourEnd {wash: turn.pourWash}`; reset `pourWash`). Water only falls when `phase === 'pour' && turn.armed`.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** commit `feat(sim): pour physics and yerba wear`.

---

### Task 5: Sim — the ronda

**Files:** Modify `src/sim.js` · Test `test/sim-ronda.test.mjs`

**Interfaces:**
- Consumes: Task 4 `State`/`step`.
- Produces new events: `drinkEnd {seat}`, `turn {seat, trap}`, `tease {seat, level: 1|2}`, `lavado {seat}`, `arrive {seat}`, `tutorialDone`, `tip {name: 'shift'}`. Phases cycle `pour → out (PASS_TIME) → drink (DRINK_TIME) → back (PASS_TIME) → pour`.

Rules to implement (spec §2.1, §2.3–2.5, §2.7):
- Tutorial: seat 0's hand-off goes straight to `drink` (no `out`), no score, no `WEAR_BASE`; after `drink` emit `drinkEnd {seat:0}`, `tutorialDone`, set `tutorial = false`, start `rondaTime`, then start the first friend turn.
- Starting a turn: `turn = { seat, trap: seats[seat].saidGracias, armed: tilt < TILT_FLOW_MIN, fill: 0, … }`, emit `turn`. Next seat = the guest (index 6) if present and unserved, otherwise the next occupied index after the current one in 1–5 (wrapping, never 0).
- Hand-off of a friend turn: `served += 1`, `yerba −= WEAR_BASE`, `good = fill ≥ FILL_OK`, `value = good ? (guest ? GUEST_VALUE : 1) : 0`, `score += value`.
- Patience (non-trap turns, not tutorial): `waited += dt` while `phase 'pour'`; window = `GUEST_PATIENCE` for the guest, else `lerp(PATIENCE_START, PATIENCE_END, clamp(served / PATIENCE_RAMP_MATES, 0, 1))`; emit `tease` at `TEASE_AT[0]` and `TEASE_AT[1]` of the window; at the window end hand off with `grabbed: true`.
- Arrivals: after a hand-off, when `served % ARRIVE_EVERY === 0` and `arrivals < ARRIVE_ORDER.length`, seat `ARRIVE_ORDER[arrivals]` gets a new friend (`look = 2 + arrivals`), emit `arrive {seat}`.
- Lavado: at the start of `back`, if `yerba ≤ LAVADO_AT` and `rondaTime − lastLavadoAt ≥ LAVADO_EVERY`, emit `lavado {seat}`.
- Shift tip: once per run, emit `tip {name:'shift'}` on `pourEnd` with `wash > SHIFT_TIP_WASH`, or on the hand-off where `served === SHIFT_TIP_MATE`.
- `gameOver.minutes = Math.floor(rondaTime / 60)`.

- [ ] **Step 1: Failing tests** (helper `serve(s, fill = .9)` pours at tilt .4 until `turn.fill ≥ fill`, then steps with tilt 0 until the next `turn` event; returns collected events):
  - `tutorial mate is the cebador's` — first serve → events include `drinkEnd {seat:0}` then `tutorialDone` then `turn {seat:2}`; `score === 0`, `served === 0`.
  - `ronda goes anticlockwise through occupied seats` — after the tutorial with seats 2 and 4: turns 2, 4, 2.
  - `good mate scores 1 and wears WEAR_BASE`.
  - `phase timings` — after a hand-off: `out` for .6 s, `drink` 3.0 s, `back` .6 s (assert phase at t = .59, .61, 3.59, 3.61, 4.19, 4.21).
  - `teases at 50 % and 83 % then grab` — serve 0 mates in the ronda, hold tilt 0: `tease level 1` at 3.0 s, `level 2` at 4.98 s, `handoff {grabbed:true, good:false, value:0}` at 6.0 s.
  - `patience shrinks to 4 s by mate 30` — set `served = 30` before a turn: grab at 4.0 s.
  - `grab with a full mate still counts` — pour continuously at tilt .3 past 6 s with fill ≥ .85 → `handoff {grabbed:true, good:true, value:1}`.
  - `arrival every 5 mates, in ARRIVE_ORDER, max 3 arrivals` — 20 serves → `arrive` for seats 3, 1, 5 at served 5, 10, 15; nothing at 20.
  - `re-arm: holding through hand-off does not pour` — keep tilt .5 across `out/drink/back`: new turn has `armed === false`, `fill` stays 0 until tilt drops below .12 and rises again.
  - `lavado line throttled to every 20 s`.
  - `shift tip once` — a pour washing > .08 emits `tip`; a later one does not.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3: Implement** in `src/sim.js`.
- [ ] **Step 4:** `npm test` → PASS (Task 4 tests still green).
- [ ] **Step 5:** commit `feat(sim): ronda, patience, arrivals`.

---

### Task 6: Sim — gracias, skip and the bomb

**Files:** Modify `src/sim.js` · Test `test/sim-gracias.test.mjs`

**Interfaces:**
- Produces events: `gracias {seat, palmOnly: boolean}`, `skip {seat}`; `gameOver {reason:'gracias', score, minutes, seat}`.

Rules (spec §2.6, §3.4): roll at the start of `back` for friend seats only: `p = 0` while `served < GRACIAS_FROM_MATE`, else `lerp(P_GRACIAS_START, P_GRACIAS_END, clamp(served / P_GRACIAS_RAMP_MATES, 0, 1)) × (truck.active ? TRUCK_GRACIAS_MULT : 1)`; never when the number of seats 1–5 that are occupied and have not said gracias would drop below `MIN_ACTIVE`. `palmOnly = truck.active`. Trap turn: no patience, no tease; `stillTime ≥ SKIP_DELAY` → emit `skip` and start the next turn immediately (no `out/drink/back`); any frame with `flow > 0` (armed) → `gameOver 'gracias'`.

- [ ] **Step 1: Failing tests** (force rolls by injecting a state: set `s.rng` seeds found by a small search helper in the test, or set `s.seats[n].saidGracias = true` directly for trap tests):
  - `no gracias before the 5th mate` — seed loop over 50 seeds × 4 serves: no `gracias`.
  - `never below 2 active friends` — 2 friends, 200 serves, many seeds: no `gracias` ever.
  - `probability doubles while the truck passes` — statistical: with 4 active friends, `served = 30`, 2000 forced `back` starts with `truck.active` false vs true → rates ≈ .20 and ≈ .40 (±.04).
  - `palm only during the truck` — `gracias.palmOnly === true` when `truck.active`.
  - `trap turn skips after 1.2 s of no water` — `skip` at 1.2 s, next `turn` immediately, `served` unchanged, no `tease`.
  - `holding the trigger into a trap turn is safe` — enter trap turn with tilt .8 held (`armed false`), hold 2 s → `skip`, no `gameOver`.
  - `any water on a trap turn is game over` — tilt .13 for one step after arming → `gameOver {reason:'gracias', seat}`; `phase 'over'`.
  - `trap check survives a big dt` (Review Focus 1) — one `step(s, 0.5, .9)` on an armed trap turn → `gameOver`.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** commit `feat(sim): gracias trap`.

---

### Task 7: Sim — truck and the guest

**Files:** Modify `src/sim.js` · Test `test/sim-truck.test.mjs`

**Interfaces:**
- Produces events: `truckEnter {guest: boolean}`, `guestSignal`, `truckStop`, `guestArrive`, `guestLeave`, `truckLeave`. `truck.progress ∈ [0,1]` (scene and audio read it).

Rules (spec §3.4–3.5):
- `createRun` rolls `guest.planned = nextRandom(rng) < P_GUEST` and `truck.nextAt = randomBetween(rng, TRUCK_FIRST_MIN, TRUCK_FIRST_MAX)` (ronda seconds). Each pass sets the next `nextAt = startTime + randomBetween(rng, TRUCK_GAP_MIN, TRUCK_GAP_MAX)`.
- A pass is a guest pass when `guest.planned && !guest.done && rondaTime ≥ GUEST_AFTER` at its start.
- Normal speed `1 / TRUCK_PASS` per second. Guest pass: emit `guestSignal` when `progress` reaches `GUEST_STOP_AT − 0.5 · GUEST_SLOW_TIME / TRUCK_PASS`, then decelerate linearly to 0 over `GUEST_SLOW_TIME` s, arriving exactly at `GUEST_STOP_AT` → `truckStop`, `guestArrive`, `seats[6] = { look: 5, guest: true, saidGracias: false }`. He takes the next turn. At the start of his `back`: emit `gracias {seat:6, palmOnly:false}` (no roll, not a trap), then `guestLeave`, `seats[6] = null`, `guest.done = true`, truck resumes at normal speed.
- `truckLeave` at `progress ≥ 1`; `truck.active = false`. The truck clock does not run during the tutorial.

- [ ] **Step 1: Failing tests:**
  - `first pass between 60 and 150 s of ronda, then every 90–150 s` (100 seeds, simulate 10 min with an auto-serving bot helper).
  - `a pass lasts 30.3 s` — `truckEnter` → `truckLeave` Δt ≈ 30.3 (±.05) on non-guest passes.
  - `guest at most once, never before 180 s` — over 200 seeds × 15 min: ≤ 1 `guestArrive` per run, at `rondaTime ≥ 180`; roughly 25 % of runs (±8 %).
  - `guest telegraph precedes the stop by 3 s and stops at .5` — `guestSignal` → `truckStop` Δt ≈ 3.0; `truck.progress === .5` while stopped.
  - `guest mate counts 2 and he leaves` — serve him full → `handoff {seat:6, value:2}`, later `gracias {seat:6}` then `guestLeave`; `seats[6] === null`; truck reaches `truckLeave`.
  - `guest patience is 8 s`.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** `npm test` → PASS (all sim suites).
- [ ] **Step 5:** commit `feat(sim): truck passes and the guest`.

---

### Task 8: Audio math

**Files:** Create `src/audio-math.js` · Test `test/audio-math.test.mjs`

**Interfaces:**
- Consumes: `T`, `nextRandom`.
- Produces:
  - `resonanceHz(fill: number) -> number` = `T.RES_F_EMPTY / Math.sqrt(Math.max(1 − fill, T.RES_MIN_AIR))`.
  - `truckMix(progress: number) -> { pan, gain, cutoff }` — `x = lerp(−1, 1, progress)`, `pan = x`, `gain = T.TRUCK_GAIN · (1 − 0.6 · x²)`, `cutoff = lerp(8000, 1200, |x|^1.5)` Hz.
  - `musicLevel(truckActive: boolean) -> { target: number, fade: number }` — active → `{ target: T.MUSIC_GAIN · T.MUSIC_DUCK, fade: T.DUCK_FADE_IN }`, else `{ target: T.MUSIC_GAIN, fade: T.DUCK_FADE_OUT }`.
  - `babblePlan(text: string, voice: { hz, rate, wordPause? }, rng) -> Array<{ t: number, hz: number, dur: number }>` — one blip per vowel group (`/[aeiouáéíóúü]+/gi`) of each word; `dur = randomBetween(BLIP_MIN, BLIP_MAX) / rate`; gap between blips `dur · 0.5 / rate`; extra `voice.wordPause ?? T.WORD_PAUSE` between words; `hz = voice.hz · (1 ± VOICE_JITTER)`.
  - `charTimes(text, plan) -> number[]` — reveal time for each character of `text`, so the bubble types in sync (a word's characters appear across that word's blips).

- [ ] **Step 1: Failing tests:** `resonance rises toward the brim` (`resonanceHz(0) === 260`, `resonanceHz(.75) === 520`, monotonic over 0..1, capped at `260/√.04 = 1300`); `truck is centred, loudest and brightest at .5` (`truckMix(.5)` → `pan 0, gain 1, cutoff 8000`; `truckMix(0).pan === −1`, `gain ≈ .4`, `cutoff 1200`); `music ducks to 30 %` (`musicLevel(true).target ≈ .189`); `babble: one blip per vowel group` (`'Gracias, jefe'` → 3 + 2 = 5 blips); `driver babble is slower` (same text: last `t` for `DRIVER_VOICE` > 1.5 × that for `FRIEND_VOICES[1]`); `jitter within ±8 %`; `charTimes is non-decreasing and ends before the last blip ends`.
- [ ] **Step 2:** FAIL → **Step 3:** implement → **Step 4:** `npm test` PASS.
- [ ] **Step 5:** commit `feat(audio): pure curves for resonance, truck mix and babble`.

---

### Task 9: Audio engine and sound lab

**Files:** Create `src/audio.js`, `lab.html`

**Interfaces:**
- Consumes: `T`, Task 8 functions, `createStore` (muted flag).
- Produces: `createAudio({ musicUrl: 'audio/musica.mp3', truckUrl: 'audio/camion.mp3', store }) -> { start(): Promise<void> /* call from a user gesture */, update(state, dt): void /* pour layers + truck pan follow state every frame */, handle(events: Event[], state): void, say(text: string, voice): number[] /* plays babble, returns charTimes */, setMuted(b: boolean): void, muted: boolean, params /* live-editable copy of the audio keys of T for the lab */ }`.

Graph (spec §4.2–4.3): `master → destination`; music `<audio loop>` element via `MediaElementSource → musicGain → master` (streams the 12.6 MB file instead of decoding it); truck clip decoded once into an `AudioBuffer`, played per `truckEnter` through `gain → StereoPanner → BiquadFilter(lowpass) → master`, parameters set from `truckMix(state.truck.progress)` each `update`; ducking with `setTargetAtTime`/linear ramps from `musicLevel`. Pour synth: looping white-noise buffer → bandpass (stream, gain ∝ `flow`) → peaking/bandpass at `resonanceHz(turn.fill)` (Q ≈ 8) → lowpass whose cutoff drops with `topFrac` (dull on dry yerba) → master; bubble chirps: short sine sweeps (+300 Hz over 30 ms) scheduled at a rate ∝ `flow · (1 − topFrac)`. One-shots on events: `drinkEnd` slurp (noise burst through a falling bandpass 1800→400 Hz, 0.5 s), `spill` splash, `guestSignal` double honk (two square tones ~370/310 Hz, 0.18 s each, 0.1 s apart). `say` schedules `babblePlan` blips as triangle oscillators through a bandpass at 2·hz; skipped while `state.truck.active` (handled by the caller: Task 14 passes `palmOnly`/truck state).

- [ ] **Step 1: Build `lab.html`**: loads `src/audio.js`; sliders `flow` (0–0.55), `fill` (0–1.05), `topFrac` (0–1) driving a fake `state`; sliders for `MUSIC_DUCK`, `TRUCK_GAIN`, `DUCK_FADE_IN`, `DUCK_FADE_OUT`, voice `hz` and `rate`; buttons "play truck pass" (animates progress 0→1 over 30.3 s), "slurp", "splash", "honk", text box + "decir" for babble; "copy values" button that prints the current `params` as a `T` snippet to paste into `src/tuning.js`.
- [ ] **Step 2: Verify by ear** — `npm run serve`, open `http://127.0.0.1:5300/lab.html`. Pass when: sweeping `fill` 0→1 at constant flow audibly rises in pitch with the steepest change near the top; `topFrac` 1 sounds duller than 0; the truck pass pans left→right and the music dips then recovers; the driver's babble is clearly lower and slower than a friend's. Note any tuning changes in `src/tuning.js`.
- [ ] **Step 3:** `npm test` still PASS (Node must not import `audio.js`).
- [ ] **Step 4:** commit `feat(audio): web audio graph and sound lab`.

---

### Task 10: Scene — the patio bake and the page

**Files:** Create `index.html`, `src/scene.js`, `src/main.js`, `scripts/smoke.mjs`

**Interfaces:**
- Consumes: engine globals (`W, H, pix, zb, ground, groundZ, kinds, bakedPix, bakedZ, staticShadow, shadowMask, pendingShadows, rgb, rampOf, bayerAt, noise, hash, clamp, lerp, project, unproject, box, capsule, sphere, castShadow, applyShadows, shadeEdges, growGrass, growTree, drawTufts, drawLeaves, bakeOcclusion, flushShadows, figure, dynamicAdd, ctx, image, fit, STILL, WIND_FPS, KIND_GRASS, COS, R2`), `createRun`, `step`.
- Produces: `scene.js` exports `bakeScene(): void`, `drawScene(state, t: number): void` (later tasks add helpers it calls), `seatPosition(index: number) -> { x, y, yaw }` (world coords of each chair, 0–5, and the fence spot for 6), `headScreen(index, state) -> { sx, sy }` (canvas px above the head, for bubbles). `main.js` exposes `window.__mate = { state, step(dt, tilt), drawn: number /* frame counter */ }`.

Layout decisions (world units, table at origin): island roughly a rounded rectangle `|x| ≤ 13, |y| ≤ 8` with the ragged edge built like Balote's `groundColor` (super-ellipse + noise, Bayer dissolve). Road: a band along the far side (`y` from −8 to −5.6), slightly darker, with tyre ruts and a puddle (`gloss` sphere-flattened or a flat tinted patch). Fence: posts every 1.5 along `y = −5.4` with dotted wire (`plot` points), gate gap at `x ∈ [−1.2, 1.2]`. Hollow-brick wall: `box` segments with alternating terracotta tones and dark mortar holes, `x ∈ [5, 11]` along the fence line, height 1.8. Paraíso tree at `(−9, −3)` via `growTree`. Table: white plastic top radius 1.6 at z .74 (`capsule` disk or stacked `sphere`s flattened — keep tones close), single pedestal; 6 chairs at radius 2.3, angles anticlockwise from seat 0 at the near side (screen-bottom). Props on the table: thermos (when not in the rig), yerbera (small box), bizcochitos bag. `PP_SCENE = { originY: 10, shadowX: 1.1, shadowY: -.2 }` as a starting point; adjust so the whole island plus 60 px at the bottom (for the hero rig) fit.

- [ ] **Step 1: `index.html`** — HUD as in Pixel Plays (`#scores` with `<b id="total">0</b>`, `#bottom` with `#status` `aria-live="polite"` and `#mute` "sonido: sí", `#rules-open` "?" and a `<dialog id="rules">`, `#bubbles` layer, `#end` block hidden), canvas `#c` with the Spanish `aria-label` (spec §5.4), `<script>window.PP_SCENE = …</script>`, `<script src="engine.js"></script>`, `<script type="module" src="src/main.js"></script>`. Styles copied from Pixel Plays' page conventions (paper `#fff`, ink `#1c1b19`, muted `#8b877f`, monospace 13px).
- [ ] **Step 2: `bakeScene`** — ground, road, fence, wall, tree, table, chairs, props, static shadows, occlusion, then `bakedPix/bakedZ` saved (follow Balote's `bake()` order exactly: ground → `growGrass` → `groundZ.set` → objects → shadows → `flushShadows` → `bakeOcclusion` → `staticShadow.set` → `applyShadows(groundZ)` → save).
- [ ] **Step 3: `drawScene`** (for now) — restore baked buffers, `drawLeaves/drawTufts` at `Math.floor(t·WIND_FPS)/WIND_FPS` (0 when `STILL`), `flushShadows`, `applyShadows(bakedZ)`, `shadeEdges`, `ctx.putImageData`.
- [ ] **Step 4: `main.js`** — `fit()` on resize, `bakeScene()`, `requestAnimationFrame` loop with `dt = min(.05, …)`, `step(state, dt, input.read(dt))` (input from Task 3), `drawScene`. Game time starts at the first `pressedEdge` (audio `start()` will hook here in Task 14).
- [ ] **Step 5: `scripts/smoke.mjs`** — Playwright (`import { chromium } from 'playwright'`; if missing, print `npx -y playwright@1.49.1 install chromium` hint and exit 1), starts `serve.mjs` as a child process, opens the page at 3× device scale, waits for `__mate.drawn > 2`, saves `screenshots/01-start.png`; later tasks append shots by driving `window.__mate.step` (no wall-clock waiting).
- [ ] **Step 6: Verify** — `npm run smoke`, open `screenshots/01-start.png`: island floats on white with ragged edge, road + fence + brick wall at the back, tree with long shadow to the screen-right, table with 6 white chairs, no console errors (smoke fails on `pageerror`).
- [ ] **Step 7:** commit `feat(scene): conurbano patio bake and page shell`.

---

### Task 11: Scene — the ronda in the world

**Files:** Modify `src/scene.js`, `scripts/smoke.mjs`

**Interfaces:**
- Produces: `seatedFigure(px, py, yaw, pose: { lean?, armR?, armL?, palm?: boolean, offended?: boolean, drinking?: boolean }, palette, addBone) -> handR` in `scene.js` (seated variant of the engine's `figure()`: hips at chair height ~.55, thighs horizontal forward .5, shins down; same shirt banding and solid mode). `LOOKS[0..5]` palettes `{ shirt, stripe, legs, hair, skin }` plus a `detail` tag: 0 striped shirt, 1 cap, 2 moustache, 3 hoodie up, 4 sunglasses on forehead, 5 driver (heavy: `scale 1.15`, wide torso radius, cap).
- Draw in `drawScene` from `state`: each occupied seat 1–5 as a seated figure facing the table; the small to-scale gourd (`sphere` .12 gloss, brown-green) + `bombilla` (2-pixel silver `plot` line) in the right hand of whoever holds it: during `out` it lerps from seat 0's position to the friend, `drink` at the friend's mouth (`drinking` pose), `back` lerps back; `palm: true` raised for 1.2 s after a `gracias` event (scene keeps a small per-seat gesture timer fed by events from `main.js`: export `sceneEvents(events)`); impatient lean after `tease`; `offended` on `gameOver 'gracias'` for the guilty seat; newcomers walk from the gate to their chair over 2 s after `arrive`.

- [ ] **Step 1:** Implement `seatedFigure`, `LOOKS`, `sceneEvents`, figure drawing and gourd travel.
- [ ] **Step 2:** Extend smoke: complete the tutorial via `__mate.step` (tilt .4 until fill ≥ .9, then 0) and screenshot `02-drink.png` mid-`drink` of seat 2; force `gracias` on seat 4 (`__mate.state.seats[4].saidGracias = true` + feed a synthetic `gracias` event through `sceneEvents`) → `03-palm.png`.
- [ ] **Step 3: Verify** — figures read as seated people with distinct looks at 3×; the gourd is visibly in the drinker's hand; the raised palm is readable without a bubble.
- [ ] **Step 4:** commit `feat(scene): seated friends, gestures, passing the mate`.

---

### Task 12: Scene — the hero pour rig

**Files:** Modify `src/scene.js`, `scripts/smoke.mjs`

**Interfaces:**
- Produces: `drawRig(state, t)` called at the end of `drawScene` (after `shadeEdges`, before `putImageData`), drawing in **screen space** over the bottom centre (D1): rig area ≈ 120×70 px centred at `(W/2, H − 38)`.

Contents (spec §3.2): left, your hand holding the thermos — a tall cylinder (~14×30 px) rotated by `angle = lerp(0, 105°, smoothed tilt)` around its base hinge, steel ramp + red cap, spout at the top; right, your other hand under the gourd (~18 px wide ellipse mouth seen from 30° above, ~22 px tall body, calabaza brown/green ramp, silver bombilla rising from the near-right). Inside the mouth: mound as a sloped green polygon against the far wall whose height = `lerp(.35, 1, yerba)` of max and colour paled by `(1 − yerba)`, wet crest darkened by `wetTop`; hole by the near wall; water surface height from `turn.fill` (glossy light blue with 1-px highlight); stream = 1–3 px wide light-blue polyline from spout to the landing point `lerp(holePoint, moundTopPoint, land)`, width by `flow`; overflow: blue pixels running down the outside of the gourd while `overflow > 0`; palitos (3–4 pale 1×3 px stalks) when `yerba ≤ LAVADO_AT`. All fills use `rampOf()` colours with `bayerAt` dither for curved shading; figures-style dark 1-px outline. When the mate is away (`out/drink/back`) the right hand is empty and the thermos rests upright. During the tutorial both thermos and gourd pulse a 1-px `SIGNAL` halo every 0.5 s (none under `STILL`, steady instead).

- [ ] **Step 1:** Implement `drawRig`.
- [ ] **Step 2:** Smoke screenshots `04-rig-gentle.png` (tilt .35 for 1 s: stream in the hole), `05-rig-hard.png` (tilt 1 for .6 s: stream on the mound, wet crest), `06-rig-washed.png` (`state.yerba = .2`), `07-rig-overflow.png`.
- [ ] **Step 3: Verify** at 2× and 3×: you can tell hole vs. mound landing, the fill level, a washed mound and an overflow at a glance (owner checklist item 1).
- [ ] **Step 4:** commit `feat(scene): hero pour rig`.

---

### Task 13: Scene — the truck, the guest and dusk

**Files:** Modify `src/scene.js`, `scripts/smoke.mjs`

**Interfaces:**
- Produces: `drawTruck(state, t)`, `gradeDusk(dusk: number)` (called last before `putImageData`), with `dusk = clamp(state.rondaTime / T.DUSK_TIME, 0, 1)`.

Truck (spec §3.4, reference `docs/reference/truck.png`): built from `box()` in world space on the road, oriented along the road's axis, position `lerp(roadStart, roadEnd, truck.progress)` (start/end just past the island's left and right ends so it enters from and leaves into white); faded green cab with rust-spot pixels, windscreen dark, white grille, wooden slatted bed (alternating plank tones, dark gaps), white mattress in the back, grey loudspeaker cone on the cab roof (sphere + capsule), driver as a `figure` (`LOOKS[5]`) visible through the side window; wheels as dark spheres with a 2-frame rotation stipple; dust: 20–40 tan dithered pixels trailing behind, rising and fading over 1.5 s (none under `STILL`). Guest: from `truckStop` the driver walks from the cab to the fence gate (seat 6 position) over 1.5 s, leans on the fence (`lean .3`), waves on `guestSignal` (arm up out of the window), walks back on `guestLeave`.
Dusk grade per pixel after everything: luminance-preserving mix towards orange in lights and violet in shadows, strength `0.35 · dusk` (shadows via `ground` + darker luminance). Do not mutate engine constants.

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** Smoke shots `08-truck.png` (`truck.active = true, progress .5`), `09-guest.png` (stopped, driver at the fence), `10-dusk.png` (`rondaTime = 720`).
- [ ] **Step 3: Verify** against the reference photo: green cab, slatted bed, mattress and horn are recognisable; dusk is warm but the stream and fill stay readable.
- [ ] **Step 4:** commit `feat(scene): truck, guest and dusk`.

---

### Task 14: UI, audio wiring and the full loop

**Files:** Create `src/ui.js` · Modify `src/main.js`, `index.html` · Test `test/ui.test.mjs`

**Interfaces:**
- Consumes: everything above; `pickLine`, `LINES`, `createStore`, `createAudio`, `headScreen`, `sceneEvents`.
- Produces (pure, tested): `bubblePosition(sx, sy, canvasRect: {left, top, width, height}) -> { left, top }` (CSS px; `left = rect.left + sx · rect.width / W`, `top = rect.top + sy · rect.height / H`; `W = 360, H = 280` passed in or constant); `formatEnd(over: {reason, score, minutes}, best: number) -> string[]` returning exactly the spec §5.3 lines (`'14 mates'`, `'1 mate'` singular, `'la yerba aguantó 9 min'`, `'se lavó'` | `'le cebaste al que dijo gracias'`, `'récord: 17'`, `'otra ronda'`); `canRestart(sinceOver: number, pressedEdge: boolean) -> boolean` (`sinceOver ≥ T.RESTART_GUARD && pressedEdge`).
- Produces (DOM): `createUi({ store, audio }) -> { handle(events, state), frame(state, dt) }`.

Wiring (spec §4.1, §5): first `pressedEdge` → `audio.start()` and the run begins (tutorial line `start`); during the tutorial's first `pourStart` show `pouring`; on `tutorialDone` show `first`; first `gracias` ever (`store.get('seenGracias')` false) show the gracias tutorial line and set the flag. Bubbles: `tease` → `impatient` line for that seat, `spill` → `spill`, `lavado`, `arrive`, `gracias` (bubble only if `!palmOnly`), `guestArrive` → `guestAsk`, guest `gracias` → `guestThanks`, `gameOver 'gracias'` → `bomb` from the guilty seat; each bubble typed with `audio.say(text, voice)`'s char times (voice = `FRIEND_VOICES[look]` or `DRIVER_VOICE`; no `say` while `truck.active` except the guest), positioned every frame via `headScreen` + `bubblePosition`, removed after `BUBBLE_TIME`, mirrored into `#status`. `tip 'shift'` → status line `LINES.tutorial.shiftTip`. Score corner updates `#total`. Rules dialog with the four spec §5.1 lines; opening it blurs input (Review Focus 3 already handled by Task 3's blur). Mute starts from `store.get('muted', false)`; the button toggles `audio.setMuted` + `store.set('muted')`, label "sonido: sí"/"sonido: no". `gameOver` → update best (`store`), show `#end` with `formatEnd`; restart only when `canRestart` (new `createRun({ seed: Date.now() })`, scene/ui reset, tutorial skipped on restarts: `createRun` gains option `{ skipTutorial: true }` → starts at the first friend turn, `tutorial false`, armed false).

- [ ] **Step 1: Failing tests** — `bubblePosition maps canvas px to CSS px at 3×`; `formatEnd for lavado and gracias, singular mate`; `canRestart needs both the guard and a fresh press` (Review Focus 4: `canRestart(.5, true) === false`, `canRestart(1, false) === false`, `canRestart(1, true) === true`); add to `test/sim-ronda.test.mjs`: `skipTutorial starts at the first friend turn unarmed`.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3: Implement** `src/ui.js`, the `skipTutorial` option in `sim.js`, wiring in `main.js` (`events` from `step` go to `sceneEvents`, `ui.handle`, `audio.handle`; `audio.update(state, dt)` and `ui.frame(state, dt)` every frame).
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5: Verify in the browser** — `npm run serve`, play a full run with keyboard, then with mouse drag, then (if available) a controller: tutorial lines appear in order; bubbles follow heads and type with babble; truck dips the music and pans; a gracias during the truck shows only a palm; skipping works; pouring for a gracias friend ends the run with the bomb line; end screen shows correct lines; holding Space through game over does not restart; a fresh press after 0.8 s does.
- [ ] **Step 6:** commit `feat: ui, audio wiring and full game loop`.

---

### Task 15: Smoke run, README and playtest checklist

**Files:** Modify `scripts/smoke.mjs`, `README.md` · Create `docs/playtest.md`

- [ ] **Step 1:** Smoke script final pass: run the full sequence of shots 01–10 plus `11-end.png` (force `gameOver`), fail on any `pageerror` or console `error`; print the screenshot paths.
- [ ] **Step 2:** `README.md` (Spanish title, English body is fine): what the game is, `npm run serve` → `http://127.0.0.1:5300/`, controls (Space / Shift, drag, L2/R2), `npm test`, `npm run smoke`, `lab.html`, where to tune (`src/tuning.js`), where to add lines (`src/lines.js`), credits (Pixel Plays engine by Amir Mushich, concept by abhi; music credit per `THIRD_PARTY.md`), future maps (plaza, playa).
- [ ] **Step 3:** `docs/playtest.md` — the owner checklist from spec §7 as checkboxes, plus a table to record tuning changes (key, old, new, why).
- [ ] **Step 4: Verify** — `npm test` all pass; `npm run smoke` exits 0 and produces 11 screenshots.
- [ ] **Step 5:** commit `docs: readme and playtest checklist`.
