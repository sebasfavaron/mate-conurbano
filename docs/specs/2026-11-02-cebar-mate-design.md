# Cebar Mate — design spec

Date: 2026-11-02 · Status: approved in conversation, pending written review

A standalone browser game in the visual style of [Pixel Plays](https://github.com/amirmushichge/pixel-plays):
you are the *cebador* at a white plastic table in a conurbano backyard, pouring mate for a circle of
friends that grows over the run. Keep the yerba alive as long as you can, and never pour for someone
who already said *gracias*.

All player-facing text is in Argentine Spanish (conurbano register, voseo). This document is in English;
quoted game text is final copy unless marked otherwise.

---

## 1. Goals and constraints

**Goals**
- One readable physical action — tilting the thermos — controlled as a continuous analog input.
- A short-session score chase ("14 mates · la yerba aguantó 9 min") with a reason to replay.
- A memory test woven into the loop: *gracias* is said on one lap and tested on the next.
- A strong, affectionate local flavour: conurbano patio, the furniture-buying truck, *boludeo* lines.

**Constraints (inherited from Pixel Plays)**
- Plain JavaScript, no build step, no runtime dependencies, no image assets: everything drawn by the
  copied software rasteriser (`engine.js`).
- 360×280 canvas, nearest-neighbour upscale, fixed 30° orthographic camera, long hard shadows falling
  screen-right, one small place floating on white with a ragged dithered edge, no UI chrome beyond a
  score corner and a mute button.
- Ambient motion only in plants (and the truck/dust when it passes); respect `prefers-reduced-motion`.

**Standalone**
- Not part of the Pixel Plays menu. Own repo (`sebasfavaron/mate-conurbano`), own Spanish shell
  (rules dialog, mute). Structured so it could later move into Pixel Plays as a `mate/` folder.

**Out of scope (for this version)**
- Other maps — kept as future ideas: *ronda en la plaza* (park blanket, Palermo) and *playa*
  (beach chairs, windbreak, wind nudging the stream).
- Joining the Pixel Plays menu, English translation, online leaderboards, water-temperature mechanic,
  sweet/bitter mate variants.

---

## 2. Core loop

### 2.1 The ronda
- Seats: one round white plastic table with **6 chairs**: you (near side, facing the camera's
  forward direction) + up to **5 friends**. A run starts with **2 friends**.
- The mate goes around **anticlockwise** (seen from above), skipping empty chairs.
- **Turn** = the gourd is in your hands → you pour → hand-off → the friend drinks (**3.0 s**, ending
  with the *bombilla* slurp) → they hand it back → next turn for the next seated friend.
- **First mate is the cebador's**: the very first pour of a run is the tutorial pour. You drink it
  yourself (no patience timer, no score), then the ronda starts.

### 2.2 The pour
All values live in `src/tuning.js`; numbers below are starting points.

- Input produces `tilt ∈ [0, 1]` (see §4).
- **Flow threshold**: no water falls below `TILT_FLOW_MIN = 0.12`. This is also the safety margin that
  keeps trigger drift and a resting finger from ever "pouring".
- **Flow rate** (gourd volumes per second): `flow = FLOW_MAX · ((tilt − TILT_FLOW_MIN) / (1 − TILT_FLOW_MIN))^1.3`,
  `FLOW_MAX = 0.55`.
- **Aim**: `land = (tilt − TILT_FLOW_MIN) / (1 − TILT_FLOW_MIN)` (0 = the side hole by the near wall of
  the gourd, 1 = the dry top of the mound). Fraction of the stream hitting the dry top:
  `topFrac = smoothstep(AIM_SAFE = 0.45, AIM_FULL = 0.85, land)`.
- **Fill**: `fill += flow · dt`. `fill ∈ [0, 1]`; anything poured above 1 is **overflow**.
- **Re-arm rule**: when a turn starts, pouring is ignored until `tilt` has dropped below
  `TILT_FLOW_MIN` at least once. Holding the trigger through a hand-off never pours by accident.
  While the gourd is not in your hands the thermos visibly tilts but no water falls.
- **Hand-off**: when the stream stops (tilt < `TILT_FLOW_MIN`) and `fill ≥ FILL_OK = 0.85`, the mate is
  handed over after `HANDOFF_DELAY = 0.4 s`. Re-tilting within that window cancels the hand-off (you can
  top up). Below `FILL_OK` the mate stays with you.

### 2.3 Yerba wear
- `yerba` starts at **1.0** (100 %). The run ends when it reaches **0** — *se lavó*.
- Per served mate (any hand-off, good or not): `−WEAR_BASE = 0.02`.
- Per unit volume landing on the dry top: `−WASH_TOP = 0.10 · flow · topFrac · dt`.
- Spill: `−WASH_SPILL = 0.05` once per spill event plus `−0.20 · overflowVolume`.
- `wetTop ∈ [0, 1]` tracks how soaked the top of the mound is (drives visuals and the "dry yerba vs
  water" pouring sound); it rises with water on top and slowly dries (`−0.05/s`).
- At `yerba ≤ 0.30` friends start the *lavado* lines (§5.2), at most one every 20 s.

### 2.4 Patience
- The clock starts when the gourd comes back into your hands.
- `patience = lerp(PATIENCE_START = 6.0 s, PATIENCE_END = 4.0 s, clamp(matesServed / 30, 0, 1))`.
- One tease line per turn, at **90 %** of the patience window (the waiting friend speaks). *(Playtest
  2026-11-02: at 50 % the tease was unavoidable, since a clean pour takes ~4.4 s; two lines per turn felt like nagging.)*
- The friend the mate is for leans in with a hand out, further as patience runs out (trap turns look the same).
- A grab of an empty mate gets its own line (`grabEmpty`); a half-full grab gets a `grab` line if nobody teased that turn.
- A full mate (`fill ≥ FILL_OK`) shows foam on the water. A skipped friend raises a palm and says a `skip` line.
- At **100 %** the friend grabs the mate as it is and drinks. If `fill < FILL_OK` the mate is **not
  counted**.
- Spills still count as good mates if `fill ≥ FILL_OK` (the cost is the wash + the tease).

- **Mates secos**: a grab with `fill < SECO_FILL = 0.4` is a dry mate. `SECO_LIMIT = 3` in a row ends the run
  (*se cansaron de los mates secos*); a good mate resets the streak. *(Playtest 2026-11-02: never pouring made
  the yerba last longer than pouring well.)*

### 2.5 Score
- **Score = good mates**: hand-offs with `fill ≥ FILL_OK`. The truck guest's mate counts **2**.
- Run time = seconds from the first ronda pour to game over, shown in whole minutes.
- Best score persists in `localStorage` (`cebar-mate:best`), wrapped in try/catch; game works without it.

### 2.6 Gracias (the bomb)
- When a friend **hands the mate back**, they may say *gracias* (bubble + raised palm + voice blips).
- Probability per return: 0 for the first 4 ronda mates, then `P_GRACIAS = 0.12`, rising linearly to
  `0.20` by mate 30. Doubled while the truck is passing (§3.4).
- **Never** below 2 active friends: if a *gracias* would leave fewer than 2 active, it does not happen.
- After *gracias* the friend stays seated **with no visible marker** for the rest of the run. Testing
  your memory is the point.
- On that friend's next turn: if no water falls for `SKIP_DELAY = 1.2 s` the gourd passes to the next
  active friend automatically (no patience timer and no tease on that turn). **If any water falls** (`flow > 0` for any frame after re-arm) it is
  **game over**: offended face + a bomb line (§5.2).

### 2.7 The circle grows
- Every `ARRIVE_EVERY = 5` served mates a new friend pulls up a chair (walks in from the fence gate,
  arrival line), until all 5 friend chairs are taken.
- A new friend joins the ronda at their seat's position in the anticlockwise order.
- Friends who said *gracias* never leave, so chairs never free up; late game is up to 5 seated friends
  with some of them out.

### 2.8 Game over
- **Se lavó**: `yerba ≤ 0`.
- **Le cebaste al que dijo gracias**: water fell for a friend who said *gracias*.
- The scene stays (with dusk light); the end block appears (§5.3).

---

## 3. Scene and visuals

### 3.1 Composition
A small corner lot floating on white:
- **Ground**: packed dirt with darker patches, grass tufts at the ragged edges (wind-sway, 8 fps whole
  pixels, stops under reduced motion).
- **Back edge**: a dirt **road** running diagonally along the far side, with a puddle. In front of it a
  **wire fence** with a gate gap, and a stretch of **unplastered hollow-brick wall** (*ladrillo hueco*).
- **Side**: a ***paraíso*** tree (`growTree`) throwing a long shadow over part of the patio.
- **Centre**: the white plastic table, 6 white plastic chairs (empty ones visible), and on the table:
  the thermos (in your hand while pouring), the *yerbera*, a bag of *bizcochitos*.

### 3.2 The gourd (readability — the riskiest part)
> **Planning note (D1):** the engine's scale is fixed at 10 px per world unit (a head is ~5 px), so a
> to-scale gourd would be 2–3 px. The pour rig below (your hands, the thermos, the gourd interior) is
> therefore drawn **in screen space** at the bottom centre, overlapping the island's near edge, and is
> not to world scale. The cebador is not drawn as a full figure. While a friend has the mate, a small
> to-scale gourd travels in the world. See the plan's decision D1.
- Camera framed so the table spans roughly the middle third of the canvas. You sit at the near side;
  the gourd (screen-space rig, see D1) is in the foreground at **~16–18 px** wide, seen from above at 30° so its mouth is visible.
- Inside it, drawn every frame:
  - The **yerba mound** as a green slope against the far wall.
  - The **side hole** by the near wall; water there reads as a darker, glossy pool.
  - The **stream** as light-blue pixels from the thermos spout to the landing point, which moves with
    `land`. Thicker with more flow.
  - The **fill level** as the water surface rising in the hole; at overflow, pixels spill over the rim.
- **Yerba state is diegetic** (no health bar):
  - Fresh: tall bright mound. Wet top (`wetTop`): darker green on the crest.
  - Washing (`yerba` falling): mound lowers and pales; at ≤ 0.30 a few pale stalks (*palitos*) float.

### 3.3 People
- Built with the engine's `figure()`. Each friend has a fixed look: striped shirt, cap, moustache,
  hoodie up, and a fifth (e.g. sunglasses on the forehead). Generic colours; no real club crests.
- Gestures: drinking pose, raised palm (*gracias*), leaning/arm-out (impatient), offended (game over).
- **Speech bubbles** are DOM text in the page's monospace font, positioned above each head from the
  engine's `project()` and the canvas scale; one bubble per speaker, ~2.2 s, text typed out in sync with
  the voice blips (§4.3).

### 3.4 The truck
- Reference: green pickup with rust spots, slatted wooden side boards on the bed, a mattress in the
  back, a loudspeaker horn on the cab roof, driver visible. Built with engine `box()` primitives.
- **Pass**: every 90–150 s (uniform random), first not before 60 s into the ronda. It crosses the road
  over **30.3 s**, the length of the loudspeaker clip, kicking up a dithered dust trail.
- **Distraction**: while the truck is passing, *gracias* shows **only the raised palm**: no bubble, no
  voice. Other lines still show their bubble, but every voice blip is muted while the truck passes.

### 3.5 The truck guest (rare, rewarding)
- Rolled once per run: `P_GUEST = 0.25`. If chosen, it happens on the first truck pass that starts
  after 3 min of ronda.
- **Telegraph** (unmistakable): the truck slows over ~3 s, a synthesized double honk distinct from
  anything else in the game, the driver waves out of the window, then stops at the fence gate at the
  midpoint of the road.
- The driver (heavyset figure) leans over the fence: "Una mano, maestro, ¿me convidás uno?". He is
  inserted as the **next** turn after the current one completes. Patience for him is 8 s.
- A good mate for him counts **2**. He drinks, says "Gracias, jefe" (always), walks back and the truck
  drives off. He never comes back in that run, so there is no trap.
- The loudspeaker clip keeps playing while he stops (it's a loudspeaker); the music stays ducked until
  the truck has left.

### 3.6 Dusk
- Light drifts from afternoon (`dusk = 0`) to sunset (`dusk = 1`) over **12 minutes** of ronda.
- Implemented as a post-process colour grade on the pixel buffer after the engine draws (shadows towards
  deeper violet, lights towards orange), so the engine's colour constants stay untouched. Shadow length
  does not change.

---

## 4. Input and audio

### 4.1 Input → one `tilt`
| Source | Mapping |
|---|---|
| **Gamepad** | `max(L2, R2)` analog value (standard mapping buttons 6/7 `.value`), dead zone 0.05 then rescaled to 0–1. Polled every frame. |
| **Pointer / touch** | Press anywhere and drag downward: 0 → 120 CSS px maps to 0 → 1. Release → 0. |
| **Keyboard** | Space held: `tilt += 1.0/s`. Space released: `tilt −= 1.25/s` *(was 2.5/s; too hard to hold a tilt without Shift)*. With **Shift** held, both rates switch to the **fine mode**: up `0.35/s`, down `0.6/s`. Shift can be pressed or released at any moment, even mid-pour (fast start, slow finish). Shift alone (Space up) makes the thermos return slowly. |

- The most recently active source wins.
- The thermos' drawn angle follows `tilt` with light smoothing (no lag a player would feel).
- **Shift tip** appears once per run in the status line, "Tip: con Shift apretado inclinás más despacio",
  the first time a single pour washes away more than 8 % yerba, or at mate 8, whichever comes first. It
  is **not** in the tutorial or rules dialog.

### 4.2 Audio graph (Web Audio)
- **Music**: `audio/musica.mp3` loops through a gain node at a base level `MUSIC_GAIN` (≈ −4 dB relative to
  the truck clip, which is about 4 LU louder: −16.2 vs −20.3 LUFS integrated).
- **Truck**: `audio/camion.mp3` (30.3 s, mono, 48 kHz) through gain → stereo panner → low-pass filter.
  Panner follows the truck's screen x (−1 to 1). Gain and filter cutoff follow distance from screen
  centre (quieter and more muffled at the ends).
- **Ducking**: when the truck enters, music ramps to `MUSIC_DUCK = 0.30` over `DUCK_FADE_IN = 1.0 s`;
  after it leaves, back to 1.0 over `DUCK_FADE_OUT = 2.0 s`. `TRUCK_GAIN` sets the clip level. All four
  are exposed for tuning by ear.
- Audio starts on the first user gesture (browser autoplay policy). That gesture is also the start of
  the tutorial pour.
- **Mute** button: "sonido: sí" / "sonido: no", master gain, persisted in `localStorage`.

### 4.3 Synthesized sounds (no files)
- **Pouring — top priority, must sound like real mate being poured.** Three layers, all continuous:
  1. *Stream*: band-passed noise; gain and brightness follow `flow`.
  2. *Gourd resonance*: a resonant filter (Helmholtz-like) whose centre frequency **rises as the air
     space shrinks**: low and hollow at `fill = 0`, rising steeply near the brim. You can pour by ear.
  3. *Surface*: dull/muffled while the stream hits dry yerba (`topFrac`), plus short random bubble
     chirps when it hits water. Chirp density scales with `flow`.
- **Bombilla slurp** at the end of each drink (filtered noise burst with a falling gurgle).
- **Spill** splash.
- **Guest honk**: double tone, used only to telegraph the guest.
- **Voices (Celeste-style babble)**: one short blip (40–60 ms, oscillator + filter, ±8 % pitch jitter)
  per syllable, synced with the typed-out bubble text. Each friend has a fixed pitch (180–320 Hz) and
  speed. The **driver** is ~95 Hz, slower (×0.6), with longer pauses between words (~120 ms), to fit his
  heavyset build. Muted while the truck passes.

### 4.4 Sound lab
`lab.html` loads the audio module with sliders for `flow`, `fill`, `topFrac`, voice pitch/speed,
duck levels and fades, a "play truck" button and a "play line" box, for tuning without playing.

---

## 5. Text, tutorial and end screen

### 5.1 Tutorial (inside the first mate)
1. On load / first gesture: "Mantené espacio, tocá y arrastrá hacia abajo, o apretá el gatillo para
   cebar". Thermos and gourd glow faintly.
2. While pouring: "Despacio cae al costado. Si inclinás mucho, mojás la montañita".
3. After the tutorial mate is filled: "El primero es del cebador". You drink it; the ronda starts.
4. On the first *gracias* of the run (only in a player's first run, tracked in `localStorage`):
   "Dijo gracias: ya no le cebes más. Dejá pasar el mate".

**Rules dialog** (`?` top-right), four items:
1. Mantené para inclinar el termo y soltá cuando el mate esté lleno.
2. Despacio cae al costado; si mojás la montañita, la yerba se lava. Si se lava toda, se termina.
3. Si alguien dice gracias, no le cebes más: dejá pasar el mate. Si le cebás, perdiste.
4. Cuando pasa el camión no se escucha nada: mirá las manos.

### 5.2 Line bank (`src/lines.js`, editable)
Chosen at random per category, never the same line twice in a row.
- **impatient**: "¿Es cuadrado ese mate que no gira?", "Tengo la garganta un poco seca…", "Che, no es
  cadena nacional", "¿Lo estás cebando o lo estás bendiciendo?", "Mientras tanto me tomo un tereré".
- **spill**: "¡Ey, me mojaste el pantalón!", "Tranqui que no es el Niágara".
- **lavado** (yerba ≤ 0.30): "¿Armamos otro así gira más rápido?", "Este ya está para regar las plantas",
  "Tiene gusto a agua de florero".
- **arrive**: "¿Hay lugar para uno más?", "Traje bizcochitos, eh".
- **gracias**: "Gracias", "Gracias, estoy bien", "Ya estoy, gracias".
- **bomb** (game over): "Te dije gracias, ¿eh?", "¿No escuchás o qué?".
- **guest**: "Una mano, maestro, ¿me convidás uno?", then "Gracias, jefe".

### 5.3 End screen
Centred block over the frozen scene:
```
14 mates
la yerba aguantó 9 min
se lavó                      (or: le cebaste al que dijo gracias)
récord: 17
otra ronda
```
"otra ronda" is activated by Space, tap/click or a trigger press (after a 0.8 s guard so the last pour
input doesn't skip it).

### 5.4 Accessibility
- Canvas `aria-label` in Spanish describing the controls; status line is `aria-live="polite"`; bubbles
  are mirrored into the status line as text.
- Reduced motion: plants and dust stop; the truck still moves (it carries the mechanic).

---

## 6. Architecture

```
mate-conurbano/
├─ index.html          page, HUD (score corner, status, mute, rules), loads scripts
├─ lab.html            sound lab
├─ engine.js           copied from Pixel Plays, MIT header kept, unmodified
├─ src/
│  ├─ tuning.js        every tunable number above
│  ├─ sim.js           pure rules: createRun(seed), step(state, dt, tilt) → { state, events }
│  ├─ input.js         gamepad / pointer / keyboard → tilt, Shift fine mode
│  ├─ scene.js         bake + draw: patio, table, figures, gourd interior, truck, dust, dusk grade
│  ├─ audio.js         Web Audio graph, music + truck ducking/pan, pour synth, voices
│  ├─ ui.js            bubbles, tutorial, rules dialog, end screen, best score, status line
│  └─ lines.js         line bank
├─ audio/musica.mp3, audio/camion.mp3
├─ test/*.test.mjs     node --test
├─ serve.mjs           minimal static server (node serve.mjs → http://127.0.0.1:5300/)
├─ LICENSE             MIT for this project's code
├─ THIRD_PARTY.md      engine.js (MIT, © 2026 Amir Mushich), music source + licence, truck recording
└─ docs/specs, docs/plans
```

- **Data flow per frame**: `input.read()` → `tilt` → `sim.step(state, dt, tilt)` → `events`
  (`pourStart`, `handoff`, `spill`, `gracias`, `skip`, `arrive`, `truckEnter`, `truckLeave`,
  `guestArrive`, `tease`, `gameOver`, …) → `audio.handle(events, state)` and `ui.handle(events, state)` →
  `scene.draw(state)`.
- `sim.js` never touches DOM, canvas or audio, and takes all randomness from a seeded RNG in the state,
  so runs are reproducible in tests.
- `engine.js` is a classic script defining globals; `src/*.js` are ES modules. `scene.js` reads the
  engine's globals (top-level declarations of classic scripts are visible to modules).
- `sim.js` and `input.js` (its pure rate logic) must import in Node with no browser globals.

## 7. Testing

- **Unit** (`node --test test/`), no dependencies:
  - pour: flow below/above threshold, landing/topFrac, fill, overflow + spill wash, hand-off at
    ≥ 0.85 after 0.4 s, cancel on re-tilt, re-arm rule.
  - patience: tease events at 50/83 %, grab at 100 %, uncounted under 0.85, window shrinking with mates.
  - yerba: base wear, top wash, end at 0.
  - gracias: never below 2 active, skip after 1.2 s, game over on any flow, probability doubled during
    the truck, palm-only flag during the truck.
  - circle: arrival every 5, max 5 friends, anticlockwise order with inserted seats.
  - truck & guest: schedule bounds with a fixed seed; guest at most once, only after 3 min, counts 2.
  - input: keyboard rates, Shift switching mid-hold in both directions, gamepad dead zone, latest
    source wins.
- **Visual smoke**: a Playwright script (Chromium) loads the page, simulates a pour via keyboard, and
  saves screenshots at start, mid-pour, hand-off and end screen. Run manually, not a dependency.
- **Manual playtest checklist** (owner):
  - Is the stream and fill level readable at 360×280 at 2× and 3×?
  - Does the pouring sound read as mate being poured; is the brim audible?
  - Truck mix: duck depth, truck level, fades.
  - Does the guest feel like a reward, and is the telegraph unmistakable?
  - Does *gracias* during the truck feel fair?

## 8. Owner actions
- Create `sebasfavaron/mate-conurbano` and push this repo.
- Fill in the music source URL and licence name in `THIRD_PARTY.md` (owner states it is free to use).
- Final say on tuning numbers after playtests.
