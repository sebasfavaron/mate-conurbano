# Handoff — Cebar Mate

You are picking this up locally after a design session in a Claude Code cloud session (2026-11-02).
Nothing has been implemented yet: this repo holds the approved design, the implementation plan and the
reference material. The game code starts at Task 1 of the plan.

## What's in the zip

```
cebar-mate-handoff/
├─ mate-conurbano/                 ← this git repo (2 commits, branch main)
│  ├─ HANDOFF.md                   ← this file
│  ├─ docs/specs/2026-11-02-cebar-mate-design.md   approved design (source of truth)
│  ├─ docs/plans/2026-11-02-cebar-mate.md          15-task TDD implementation plan
│  └─ docs/reference/truck.png     the truck reference photo
└─ assets/                         ← copied into the repo by plan Task 1
   ├─ engine.js                    Pixel Plays rasteriser, unmodified (MIT)
   ├─ engine-LICENSE               its MIT licence (© 2026 Amir Mushich)
   ├─ musica.mp3                   lo-fi background track (13:51, 12.6 MB)
   ├─ camion.mp3                   your truck loudspeaker recording (30.3 s, mono)
   └─ pixel-plays-reference/       balote/index.html + serve.mjs + README, for engine usage patterns
```

## Get going locally

1. Unzip, then create the empty GitHub repo `sebasfavaron/mate-conurbano` (no README/licence so the
   push is clean) and push:
   ```bash
   cd cebar-mate-handoff/mate-conurbano
   git remote add origin git@github.com:sebasfavaron/mate-conurbano.git
   git push -u origin main
   ```
2. Requirements: Node ≥ 22. Playwright only for the optional smoke script (`npx -y playwright@1.49.1 install chromium`).
3. Open Claude Code in `mate-conurbano/` and start with something like:
   > Read HANDOFF.md, the spec and the plan in docs/. Execute docs/plans/2026-11-02-cebar-mate.md
   > task by task. The assets for Task 1 are in ../assets.

   Pick an execution mode when asked (see "Execution" below).

## The game in one paragraph

You're the *cebador* at a white plastic table in a conurbano backyard (dirt road, wire fence,
unplastered brick wall, a paraíso tree). The first mate is yours; then you pour for a ronda that grows
from 2 to 5 friends. Tilt the thermos with an analog input: gentle tilt pours into the side hole, hard
tilt fills fast but lands on the dry mound and washes the yerba. Release at ≥ 85 % full to hand it over;
too slow and the friend teases you (*"¿Es cuadrado ese mate que no gira?"*) and grabs it half-full
(doesn't count). Score = good mates; the run ends when the yerba is washed out. Anyone can say *gracias*
when returning the mate; a lap later you must **not** pour for them (no visible marker, it's a memory
test). Pour for them and it's game over. Every 1.5–2.5 min the furniture-buying truck passes with its
loudspeaker (your recording): music ducks, and a *gracias* said then shows only as a raised palm. Rarely
(~1 in 4 runs) the truck stops, the driver leans over the fence and asks for a mate worth double.

## Decisions log (all approved by you during the session)

| # | Topic | Decision |
|---|---|---|
| 1 | Concept | *Cebar mate*, chosen over La Sortija, Sapo, Asado, Jineteada |
| 2 | Distribution | Standalone for now, not in the Pixel Plays menu; reuses `engine.js` (MIT) |
| 3 | Core challenge | Make the yerba last (option B), score = mates served |
| 4 | Gracias | Memory test: said on return, tested next lap; skip by not pouring for 1.2 s |
| 5 | Bomb penalty | Instant game over |
| 6 | Pour model | Tilt controls flow **and** aim (stream creeps onto the mound) |
| 7 | Analog input | L2/R2 via Gamepad API; mouse/touch drag; keyboard Space spring + **Shift fine mode** |
| 8 | Shift | Toggleable mid-pour both directions; Shift alone slows the spring-back; taught only as an in-game tip, never in the tutorial |
| 9 | Setting | Conurbano patio: dirt road, white plastic table and chairs; plaza/playa kept as future maps |
| 10 | Truck | Your photo + recording; acts as a distraction (palm-only gracias) |
| 11 | Truck guest | Very rare, clearly telegraphed, double value, always says gracias |
| 12 | Music | Your lo-fi track, ducked live under the truck clip (you'll judge the mix) |
| 13 | Score | Only good mates count (option A) |
| 14 | Teasing | Affectionate *boludeo* lines; your four lines included verbatim |
| 15 | Voices | Celeste-style synthesized babble per character; driver low, slow (heavyset) |
| 16 | Language | All in Argentine Spanish, conurbano register |
| 17 | Visual extras | Dusk over the run (12 min to sunset) |
| 18 | Pour sound | Top priority: dense, continuous synth that rises in pitch as it fills; sound lab for tuning |
| 19 | Tech | Copy engine + own code, no deps, no build; pure seeded sim tested with `node --test` |
| 20 | Planning (D1) | Pour rig drawn in screen space (engine scale makes a to-scale gourd 2–3 px) |

## Things only you can do

- Create the GitHub repo and push (step 1 above).
- Fill in the lo-fi track's source URL and licence in `THIRD_PARTY.md` (created in Task 1). You said it
  is free to use; the file should say where it came from.
- Judge by ear and eye: the pour sound (`lab.html`), the truck/music mix (`MUSIC_DUCK`, `TRUCK_GAIN`,
  `DUCK_FADE_IN`, `DUCK_FADE_OUT` in `src/tuning.js`), readability of the pour rig, the guest's
  telegraph. `docs/playtest.md` (Task 15) is the checklist.
- Add more lines to `src/lines.js` whenever you think of them.

## Execution

The plan has 15 tasks. Tasks 4–7 build one module (`src/sim.js`) in sequence and the scene/UI tasks
depend on its exact `State` field names and event types, so:

- **Subagent-driven** (recommended): a fresh implementer per task with a reviewer before the next one.
  Best here because the later tasks consume earlier interfaces and a reviewer catches name drift.
- **Native**: one session does every task, then one review at the end. Faster and cheaper.

The visual tasks (10–13) and audio (9) end with a manual "look/listen" step; expect to iterate on them
with screenshots from `npm run smoke` and the sound lab.

## Risks to watch

- **Pour readability (Task 12)** is the make-or-break. If the screen-space rig doesn't read, enlarge it
  before tuning anything else.
- **Seated figures (Task 11)**: the engine's `figure()` only stands. `seatedFigure` is new code modelled
  on it. Budget time.
- **Pour sound (Task 9)**: synthesized water is hard. If it can't get dense enough, a fallback is to
  layer a short recorded pour loop (your own recording) under the resonant filter, keeping the pitch
  rise synthesized. That would be a spec change: decide it explicitly.
- **Music file size**: 12.6 MB streams fine through a `<audio>` element; re-encode to ~96 kbps only if
  hosting complains.
