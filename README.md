# Cebar Mate

You're the *cebador* at a white plastic table in a conurbano backyard. The first mate is yours, then you
pour for a ronda that grows from 2 to 5 friends. Tilt the thermos gently and the water falls into the side
hole; tilt it hard and it lands on the dry mound and washes the yerba. Release when the mate is full. Score
is the number of good mates; the run ends when the yerba is washed out, or when you pour for someone who
already said *gracias*. Every couple of minutes the furniture truck passes with its loudspeaker, and you
can't hear a thing.

All player-facing text is in Argentine Spanish. Plain JavaScript, no build step, no runtime dependencies.

## Play

**https://sebasfavaron.github.io/mate-conurbano/** (GitHub Pages, from `main`). Or locally:

```bash
npm run serve        # http://127.0.0.1:5300/
```

Node ≥ 22. Any static file server works; the site deploys as plain static files (GitHub Pages from `main`, root, works as is).

| Input | How |
|---|---|
| Keyboard | Hold **Space** to tilt, release to straighten. Hold **Shift** for a slower, finer tilt (also mid-pour). |
| Mouse / touch | Press and drag down: 120 px is full tilt. |
| Gamepad | **L2 / R2**, analog. |
| Pause | **P**, Escape or the "pausa" button. |

## Develop

```bash
npm test             # node --test, the pure sim, input, audio curves and UI helpers
npm run smoke        # Playwright screenshots into screenshots/ (manual, see below)
npm run meta         # re-renders the link-preview image and icons in meta/ from the game
```

Both scripts need Playwright, which is not a dependency:

```bash
npm i --no-save playwright && npx playwright install chromium
```

- **Sound lab**: `http://127.0.0.1:5300/lab.html` — sliders for the pour synth, music/truck ducking and
  voices, with a "copiar valores" button that prints the values to paste into `src/tuning.js`.
- **Tuning**: every number lives in `src/tuning.js`.
- **Music**: one file per song in `audio/music/`, listed in `src/tracks.js`; they play shuffled, with a now-playing card.
- **Lines**: add teasing lines to `src/lines.js`; categories are picked at random, never twice in a row.
- **Playtest checklist**: `docs/playtest.md`.
- Design and plan: `docs/specs/2026-11-02-cebar-mate-design.md`, `docs/plans/2026-11-02-cebar-mate.md`.

| File | Role |
|---|---|
| `src/sim.js` | Pure, seeded rules: `createRun`, `step(state, dt, tilt)` → events |
| `src/input.js` | Gamepad / pointer / keyboard → one `tilt` |
| `src/scene.js` | Patio bake, friends, truck, dusk and the screen-space pour rig |
| `src/audio.js` | Web Audio: music + truck ducking, pour synth, one-shots, voices |
| `src/ui.js` | Bubbles, status line, rules, end screen |
| `src/main.js` | Boot and frame loop; `window.__mate` hook for the smoke script |

## Notes

- The engine draws at 10 px per world unit, so a to-scale gourd would be 2–3 px. The hands, thermos and
  gourd are drawn in screen space at the bottom of the canvas instead (decision D1 in the plan).
- `engine.js` is copied unmodified from Pixel Plays; the dusk grade runs on the pixel buffer afterwards.

## Credits

- Pixel renderer (`engine.js`) from [Pixel Plays](https://github.com/amirmushichge/pixel-plays) by Amir
  Mushich, MIT. Pixel Plays concept by abhi.
- Music and the truck recording: see `THIRD_PARTY.md`.

## Future maps

- *Ronda en la plaza*: a blanket in a Palermo park.
- *Playa*: beach chairs and a windbreak, with wind nudging the stream.

## License

Code: MIT (`LICENSE`). Third-party material: `THIRD_PARTY.md`.
