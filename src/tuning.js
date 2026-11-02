// Every tunable number in the game (spec §2–§5). Change values here, never inline.
export const T = Object.freeze({
  // pour
  TILT_FLOW_MIN: .12, FLOW_MAX: .55, FLOW_EXP: 1.3, AIM_SAFE: .45, AIM_FULL: .85, FILL_OK: .85, HANDOFF_DELAY: .4,
  // yerba
  WEAR_BASE: .02, WASH_TOP: .10, WASH_SPILL: .05, WASH_OVERFLOW: .20, WET_DRY_RATE: .05, LAVADO_AT: .30, LAVADO_EVERY: 20,
  // ronda
  PATIENCE_START: 6.2, PATIENCE_END: 5.0, PATIENCE_RAMP_MATES: 40, TEASE_AT: Object.freeze([.9]), TEASE_CHANCE: .5, PASS_TIME: .8, DRINK_TIME: 3.0,
  SEATS: 6, START_SEATS: Object.freeze([2, 4]), ARRIVE_ORDER: Object.freeze([3, 1, 5]), ARRIVE_EVERY: 5,
  LEAVE_AFTER_SKIPS: 2, SIDE_SPOTS: 3, FRIEND_LOOKS: Object.freeze([0, 1, 2, 3, 4, 6, 7, 8]),
  // gracias
  SECO_FILL: .4, SECO_LIMIT: 3,
  GRACIAS_FROM_MATE: 5, P_GRACIAS_START: .12, P_GRACIAS_END: .20, P_GRACIAS_RAMP_MATES: 30, TRUCK_GRACIAS_MULT: 2, MIN_ACTIVE: 2, SKIP_DELAY: 1.2,
  // truck
  TRUCK_FIRST_MIN: 60, TRUCK_FIRST_MAX: 150, TRUCK_GAP_MIN: 90, TRUCK_GAP_MAX: 150, TRUCK_PASS: 30.3,
  P_GUEST: .25, GUEST_AFTER: 180, GUEST_PATIENCE: 8.2, GUEST_VALUE: 2, GUEST_STOP_AT: .5, GUEST_SLOW_TIME: 3,
  // points per hand-off (pour quality)
  PTS_BASE: 100, PTS_BRIM: 50, PTS_BRIM_AT: .97, PTS_NEAR_BRIM: 25, PTS_NEAR_AT: .92, PTS_SPILL: -40,
  PTS_CLEAN: 50, PTS_CLEAN_WASH: .02, PTS_QUICK: 30, PTS_GRAB_MULT: .8, PTS_COMBO_STEP: .1, PTS_COMBO_MAX: 10,
  // misc
  DUSK_TIME: 360, NATURAL_WASH: .35, SHIFT_TIP_WASH: .08, SHIFT_TIP_MATE: 8, TIP_AIM_WASH: .025, TIP_WASHING_AT: .6, MAX_STEP: .05,
  // input
  KEY_UP: 1.0, KEY_DOWN: 1.25, FINE_UP: .35, FINE_DOWN: .6, PAD_DEADZONE: .05, DRAG_PX: 120,
  // audio
  MUSIC_GAIN: .63, MUSIC_DUCK: .30, DUCK_FADE_IN: 1.0, DUCK_FADE_OUT: 2.0, TRUCK_GAIN: 1.0, RES_F_EMPTY: 170, RES_MIN_AIR: .04,
  BLIP_MIN: .04, BLIP_MAX: .06, VOICE_JITTER: .08, WORD_PAUSE: .05,
  FRIEND_VOICES: Object.freeze([{ hz: 320, rate: 1.15 }, { hz: 260, rate: 1 }, { hz: 220, rate: .95 }, { hz: 290, rate: 1.1 }, { hz: 180, rate: .9 }].map(Object.freeze)),
  DRIVER_VOICE: Object.freeze({ hz: 95, rate: .6, wordPause: .12 }),
  // ui
  BUBBLE_TIME: 2.2, RESTART_GUARD: .8,
  LESSON_GRACE: 2, // seconds of patience given back when a lesson card interrupts a pour
  TILT_GUIDE: true, GUIDE_LAND_FROM: .3, GUIDE_WASH_TOP: .3, // the sweet-spot arc around the thermos
});
