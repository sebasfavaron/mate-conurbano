// Pure game rules (spec §2–§3). No DOM, canvas or audio; all randomness comes from state.rng.
import { T } from './tuning.js';
import { makeRng, nextRandom, randomBetween } from './rng.js';

const EPS = 1e-9;
const WET_RISE = 4; // wetTop gained per unit of water landing on the top of the mound
const GUEST_SEAT = 6;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export function pourAt(tilt) {
  const land = clamp((tilt - T.TILT_FLOW_MIN) / (1 - T.TILT_FLOW_MIN), 0, 1);
  const flow = tilt > T.TILT_FLOW_MIN ? T.FLOW_MAX * land ** T.FLOW_EXP : 0;
  return { flow, land, topFrac: smoothstep(T.AIM_SAFE, T.AIM_FULL, land) };
}

const newTurn = (seat, trap, armed) => ({
  seat, trap, armed, fill: 0, overflow: 0, spilled: false, stillTime: 0, waited: 0, teases: 0, pourWash: 0, pouring: false,
});

export function createRun({ seed = 1, skipTutorial = false } = {}) {
  const rng = makeRng(seed);
  const seats = new Array(T.SEATS + 1).fill(null);
  seats[0] = { look: -1, saidGracias: false, guest: false };
  T.START_SEATS.forEach((seat, i) => { seats[seat] = { look: i, saidGracias: false, guest: false }; });
  const state = {
    phase: 'pour', phaseTime: 0, tutorial: true, time: 0, rondaTime: 0,
    tilt: 0, flow: 0, land: 0, topFrac: 0, yerba: 1, wetTop: 0, score: 0, served: 0,
    seats, turn: newTurn(0, false, true), lastSeat: 0,
    truck: { active: false, progress: 0, speed: 0, nextAt: 0, guestPass: false, stopped: false, signalled: false, slowTime: 0 },
    guest: { planned: false, done: false },
    lastLavadoAt: -Infinity, tipShown: false, arrivals: 0, over: null, rng,
  };
  state.guest.planned = nextRandom(rng) < T.P_GUEST;
  state.truck.nextAt = randomBetween(rng, T.TRUCK_FIRST_MIN, T.TRUCK_FIRST_MAX);
  if (skipTutorial) {
    state.tutorial = false;
    startTurn(state, nextSeat(state), []);
    state.turn.armed = false;
  }
  return state;
}

export function step(state, dt, tilt) {
  const events = [];
  if (state.phase === 'over') return { state, events };
  const n = Math.max(1, Math.ceil(dt / T.MAX_STEP - EPS));
  const h = dt / n;
  for (let i = 0; i < n && state.phase !== 'over'; i++) tick(state, h, tilt, events);
  return { state, events };
}

function tick(s, h, tilt, events) {
  s.time += h;
  s.phaseTime += h;
  s.tilt = tilt;
  if (!s.tutorial) {
    s.rondaTime += h;
    updateTruck(s, h, events);
  }
  const aim = pourAt(tilt);
  s.land = aim.land;
  s.topFrac = aim.topFrac;
  s.flow = 0;
  if (s.phase === 'pour') pourTick(s, h, tilt, aim, events);
  else passTick(s, events);
  if (!(s.flow > 0 && s.topFrac > 0)) s.wetTop = Math.max(0, s.wetTop - T.WET_DRY_RATE * h);
}

function pourTick(s, h, tilt, aim, events) {
  const t = s.turn;
  if (!t.armed && tilt < T.TILT_FLOW_MIN) t.armed = true;
  const flow = t.armed ? aim.flow : 0;
  s.flow = flow;

  if (t.trap) {
    if (flow > 0) return gameOver(s, 'gracias', events, t.seat);
    t.stillTime += h;
    if (t.stillTime >= T.SKIP_DELAY - EPS) {
      events.push({ type: 'skip', seat: t.seat });
      startTurn(s, nextSeat(s), events);
    }
    return;
  }

  if (flow > 0) {
    if (!t.pouring) { t.pouring = true; events.push({ type: 'pourStart' }); }
    const vol = flow * h;
    const over = Math.max(0, t.fill + vol - 1);
    t.fill = Math.min(1, t.fill + vol);
    let wash = T.WASH_TOP * flow * aim.topFrac * h;
    if (over > 0) {
      t.overflow += over;
      if (!t.spilled) { t.spilled = true; wash += T.WASH_SPILL; events.push({ type: 'spill', seat: t.seat }); }
      wash += T.WASH_OVERFLOW * over;
    }
    s.wetTop = Math.min(1, s.wetTop + WET_RISE * flow * aim.topFrac * h);
    s.yerba -= wash;
    t.pourWash += wash;
    t.stillTime = 0;
    if (s.yerba <= 0) return gameOver(s, 'lavado', events);
  } else {
    if (t.pouring) endPour(s, events);
    t.stillTime += h;
  }

  if (!s.tutorial) {
    t.waited += h;
    const window = patienceWindow(s);
    while (t.teases < T.TEASE_AT.length && t.waited >= T.TEASE_AT[t.teases] * window - EPS) {
      t.teases += 1;
      events.push({ type: 'tease', seat: t.seat, level: t.teases });
    }
    if (t.waited >= window - EPS) return handOff(s, events, true);
  }
  if (flow === 0 && t.fill >= T.FILL_OK && t.stillTime >= T.HANDOFF_DELAY - EPS) handOff(s, events, false);
}

function endPour(s, events) {
  const t = s.turn;
  t.pouring = false;
  events.push({ type: 'pourEnd', wash: t.pourWash });
  if (t.pourWash > T.SHIFT_TIP_WASH) showTip(s, events);
  t.pourWash = 0;
}

function showTip(s, events) {
  if (s.tipShown) return;
  s.tipShown = true;
  events.push({ type: 'tip', name: 'shift' });
}

export function patienceWindow(s) {
  if (s.seats[s.turn.seat]?.guest) return T.GUEST_PATIENCE;
  return lerp(T.PATIENCE_START, T.PATIENCE_END, clamp(s.served / T.PATIENCE_RAMP_MATES, 0, 1));
}

function handOff(s, events, grabbed) {
  const t = s.turn;
  if (t.pouring) endPour(s, events);
  const good = t.fill >= T.FILL_OK;
  if (s.tutorial) {
    events.push({ type: 'handoff', seat: 0, good, value: 0, grabbed });
    return setPhase(s, 'drink');
  }
  const value = good ? (s.seats[t.seat].guest ? T.GUEST_VALUE : 1) : 0;
  s.served += 1;
  s.score += value;
  s.yerba -= T.WEAR_BASE;
  events.push({ type: 'handoff', seat: t.seat, good, value, grabbed });
  if (s.served % T.ARRIVE_EVERY === 0 && s.arrivals < T.ARRIVE_ORDER.length) {
    const seat = T.ARRIVE_ORDER[s.arrivals];
    s.seats[seat] = { look: 2 + s.arrivals, saidGracias: false, guest: false };
    s.arrivals += 1;
    events.push({ type: 'arrive', seat });
  }
  if (s.served === T.SHIFT_TIP_MATE) showTip(s, events);
  if (s.yerba <= 0) return gameOver(s, 'lavado', events);
  setPhase(s, 'out');
}

function passTick(s, events) {
  const seat = s.turn.seat;
  if (s.phase === 'out' && s.phaseTime >= T.PASS_TIME - EPS) setPhase(s, 'drink');
  else if (s.phase === 'drink' && s.phaseTime >= T.DRINK_TIME - EPS) {
    events.push({ type: 'drinkEnd', seat });
    if (s.tutorial) {
      s.tutorial = false;
      events.push({ type: 'tutorialDone' });
      startTurn(s, nextSeat(s), events);
    } else {
      setPhase(s, 'back');
      beginBack(s, events);
    }
  } else if (s.phase === 'back' && s.phaseTime >= T.PASS_TIME - EPS) startTurn(s, nextSeat(s), events);
}

function beginBack(s, events) {
  const seat = s.turn.seat;
  if (s.yerba <= T.LAVADO_AT && s.rondaTime - s.lastLavadoAt >= T.LAVADO_EVERY - EPS) {
    s.lastLavadoAt = s.rondaTime;
    events.push({ type: 'lavado', seat });
  }
  if (seat === GUEST_SEAT) {
    events.push({ type: 'gracias', seat, palmOnly: false });
    events.push({ type: 'guestLeave' });
    s.seats[GUEST_SEAT] = null;
    s.guest.done = true;
    s.truck.stopped = false;
    s.truck.speed = 1 / T.TRUCK_PASS;
    return;
  }
  const p = graciasChance(s);
  const active = activeFriends(s);
  if (p > 0 && active - 1 >= T.MIN_ACTIVE && nextRandom(s.rng) < p) {
    s.seats[seat].saidGracias = true;
    events.push({ type: 'gracias', seat, palmOnly: s.truck.active });
  }
}

export function graciasChance(s) {
  if (s.served < T.GRACIAS_FROM_MATE) return 0;
  const p = lerp(T.P_GRACIAS_START, T.P_GRACIAS_END, clamp(s.served / T.P_GRACIAS_RAMP_MATES, 0, 1));
  return p * (s.truck.active ? T.TRUCK_GRACIAS_MULT : 1);
}

export function activeFriends(s) {
  let n = 0;
  for (let i = 1; i <= 5; i++) if (s.seats[i] && !s.seats[i].saidGracias) n++;
  return n;
}

function nextSeat(s) {
  const g = s.seats[GUEST_SEAT];
  if (g && !s.guest.done && s.turn.seat !== GUEST_SEAT) return GUEST_SEAT;
  for (let k = 1; k <= 5; k++) {
    const i = ((s.lastSeat - 1 + k) % 5 + 5) % 5 + 1;
    if (s.seats[i]) return i;
  }
  return 1;
}

function startTurn(s, seat, events) {
  if (seat !== GUEST_SEAT) s.lastSeat = seat;
  const trap = !!s.seats[seat]?.saidGracias;
  s.turn = newTurn(seat, trap, s.tilt < T.TILT_FLOW_MIN);
  setPhase(s, 'pour');
  events.push({ type: 'turn', seat, trap });
}

function setPhase(s, phase) {
  s.phase = phase;
  s.phaseTime = 0;
}

function gameOver(s, reason, events, seat) {
  const minutes = Math.floor(s.rondaTime / 60);
  s.over = { reason, score: s.score, minutes };
  s.phase = 'over';
  s.phaseTime = 0;
  const e = { type: 'gameOver', reason, score: s.score, minutes };
  if (seat != null) e.seat = seat;
  events.push(e);
}

function updateTruck(s, h, events) {
  const tr = s.truck;
  if (!tr.active) {
    if (s.rondaTime < tr.nextAt) return;
    tr.active = true;
    tr.progress = 0;
    tr.speed = 1 / T.TRUCK_PASS;
    tr.stopped = false;
    tr.signalled = false;
    tr.slowTime = 0;
    tr.guestPass = s.guest.planned && !s.guest.done && s.rondaTime >= T.GUEST_AFTER;
    tr.nextAt = s.rondaTime + randomBetween(s.rng, T.TRUCK_GAP_MIN, T.TRUCK_GAP_MAX);
    events.push({ type: 'truckEnter', guest: tr.guestPass });
    return;
  }
  if (tr.stopped) return;
  const v0 = 1 / T.TRUCK_PASS;
  const signalAt = T.GUEST_STOP_AT - .5 * T.GUEST_SLOW_TIME / T.TRUCK_PASS;
  if (tr.guestPass && !s.guest.done && tr.signalled) {
    tr.slowTime = Math.min(T.GUEST_SLOW_TIME, tr.slowTime + h);
    const u = tr.slowTime;
    tr.speed = v0 * (1 - u / T.GUEST_SLOW_TIME);
    tr.progress = signalAt + v0 * (u - u * u / (2 * T.GUEST_SLOW_TIME));
    if (u >= T.GUEST_SLOW_TIME - EPS) {
      tr.progress = T.GUEST_STOP_AT;
      tr.stopped = true;
      tr.speed = 0;
      s.seats[GUEST_SEAT] = { look: 5, guest: true, saidGracias: false };
      events.push({ type: 'truckStop' }, { type: 'guestArrive' });
    }
    return;
  }
  tr.progress += tr.speed * h;
  if (tr.guestPass && !s.guest.done && !tr.signalled && tr.progress >= signalAt) {
    tr.progress = signalAt;
    tr.signalled = true;
    events.push({ type: 'guestSignal' });
    return;
  }
  if (tr.progress >= 1) {
    tr.progress = 1;
    tr.active = false;
    tr.guestPass = false;
    events.push({ type: 'truckLeave' });
  }
}
