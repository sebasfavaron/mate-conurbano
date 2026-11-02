# Playtest checklist

Run `npm run serve` and play a few full runs with each input you have. Tick what holds; write what doesn't.

## Readability

- [ ] At 2× and at 3×, you can tell at a glance whether the stream lands in the side hole or on the mound.
- [ ] The fill level reads: you know when the mate is close to full without watching the score.
- [ ] A washed mound (pale, low, floating palitos) is obvious.
- [ ] An overflow is obvious.
- [ ] The raised palm of a *gracias* reads without its bubble (it is the only cue while the truck passes).
- [ ] Friends read as seated people with distinct looks.

## Sound (`lab.html` first, then in game)

- [ ] The pour sounds like mate being poured, not like noise.
- [ ] You can pour by ear: the pitch rises steeply near the brim.
- [ ] Pouring on dry yerba sounds duller than pouring into water.
- [ ] Truck mix: duck depth (`MUSIC_DUCK`), truck level (`TRUCK_GAIN`), fades (`DUCK_FADE_IN`, `DUCK_FADE_OUT`).
- [ ] The driver's voice is clearly lower and slower than the friends'.

## Feel

- [ ] Patience (6 s → 4 s) feels fair; the teasing lands as *boludeo*, not as nagging.
- [ ] A *gracias* during the truck feels fair.
- [ ] The guest feels like a reward, and the telegraph (slow down, double honk, wave, stop at the gate) is unmistakable.
- [ ] Shift fine mode helps once the tip appears.
- [ ] Holding Space through a game over does not restart; a fresh press after a moment does.
- [ ] The tips (aim, foam, washing, Shift) arrive when they help and never feel like nagging.
- [ ] The end-screen hint names what actually went wrong in the run.

## Ambience

- [ ] The dog's bark sounds like a dog, not a beep; it is not too frequent (every 30–75 s at rest).
- [ ] The dog running to the fence and barking at the truck reads at 2×.
- [ ] The benteveo call is pleasant and quiet; the steam and the yerba flecks don't distract from the pour.

## Tuning log

| Key | Old | New | Why |
|---|---|---|---|
| `TEASE_AT` | `[.5, .83]` | `[.83]` | 50 % could not be beaten; one tease per turn |
| `KEY_DOWN` | 2.5 | 1.75 | the spring-back was too fast to hold a tilt without Shift |
| `RES_F_EMPTY` | 260 | 170 | pour sounded too thin; mate is denser (stream band and slurp lowered in `audio.js` too) |
