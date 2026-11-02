// Bake and draw the patio through the engine's globals (engine.js is a classic script loaded first).
import { T } from './tuning.js';
import { patienceWindow } from './sim.js';

/* ---------- layout (world units, table at the origin) ---------- */
const ISLAND_X = 10, ISLAND_Y = 6.8, ISLAND_FAR = 9.4;
const ROAD_Y0 = -8, ROAD_Y1 = -5.2, FENCE_Y = -5, GATE = 1.2;
const WALL_X0 = 3.6, WALL_X1 = 8.6, WALL_H = 1.8;
const TREE = [-8.4, 3.4];
const PUDDLE_AT = [-2.6, -6.3];
const TABLE_R = 1.6, TABLE_Z = .74, CHAIR_R = 2.3;
const SEAT0_ANGLE = Math.PI / 4; // the near side, towards the bottom of the screen
const GUEST_SPOT = [0, -4.6];

const DIRT = [150, 116, 84], DIRT_TONES = [[136, 104, 76], [146, 112, 82], [154, 120, 88], [162, 128, 94]];
const ROAD = [120, 108, 98], ROAD_TONES = [[104, 94, 88], [112, 101, 93], [120, 108, 98], [128, 115, 104]];
const PUDDLE = [96, 112, 124];
const PLASTIC = [236, 234, 226], PLASTIC_LIFT = .9;
const POST = [112, 100, 88], WIRE = [92, 92, 96];
const BRICK = [[178, 92, 62], [166, 84, 58], [188, 104, 70]], MORTAR = [120, 110, 100];
const KIND_DIRT = 1, KIND_ROAD = 2;

/* ---------- small helpers on top of the engine ---------- */
const VIEW = [COS / R2, COS / R2, .5];
// Level for a face normal, matching the engine's box(): top 3.4, +y 2.3, +x 1.2.
const faceLevel = (nx, ny, nz) => 1.75 + 1.65 * nz + .55 * ny - .55 * nx;

function paintPoint(x, y, z, ramp, level, grain = .5) {
  const p = project(x, y, z), ix = p.sx | 0, iy = p.sy | 0;
  if (ix < 0 || iy < 0 || ix >= W || iy >= H) return;
  const i = iy * W + ix;
  if (p.d <= zb[i]) return;
  zb[i] = p.d;
  pix[i] = ramp[clamp(Math.floor(level + (grain - .5) * .9 + (bayerAt(ix, iy) - .5) * .5), 0, 4)];
}

// A box rotated by yaw around z, centred at (cx, cy) with its base at z0.
export function obox(cx, cy, z0, hx, hy, hz, yaw, color, seed = 0, lift = 0) {
  const ramp = rampOf(color), c = Math.cos(yaw), s = Math.sin(yaw), st = .045;
  const at = (a, b) => [cx + c * a - s * b, cy + s * a + c * b];
  const faces = [
    [0, 0, 1], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0],
  ];
  for (const [fa, fb, fz] of faces) {
    const nx = c * fa - s * fb, ny = s * fa + c * fb;
    if (nx * VIEW[0] + ny * VIEW[1] + fz * VIEW[2] <= 0) continue;
    const level = faceLevel(nx, ny, fz) + lift;
    if (fz) {
      for (let a = -hx; a <= hx; a += st) for (let b = -hy; b <= hy; b += st) {
        const [x, y] = at(a, b);
        paintPoint(x, y, z0 + 2 * hz, ramp, level, noise(a * 3 + seed, b * 3));
      }
    } else if (fa) {
      for (let b = -hy; b <= hy; b += st) for (let z = 0; z <= 2 * hz; z += st) {
        const [x, y] = at(fa * hx, b);
        paintPoint(x, y, z0 + z, ramp, level, noise(b * 3 + seed, z * 3));
      }
    } else {
      for (let a = -hx; a <= hx; a += st) for (let z = 0; z <= 2 * hz; z += st) {
        const [x, y] = at(a, fb * hy);
        paintPoint(x, y, z0 + z, ramp, level, noise(a * 3 + seed, z * 3));
      }
    }
  }
}

// An upright cylinder: lit top disk plus the side facing the camera.
export function cylinder(cx, cy, z0, z1, r, color, topLevel = 3.4) {
  const ramp = rampOf(color), st = .04;
  for (let a = 0; a < Math.PI * 2; a += st / Math.max(r, .05)) {
    const nx = Math.cos(a), ny = Math.sin(a);
    if (nx * VIEW[0] + ny * VIEW[1] <= -.05) continue;
    const level = faceLevel(nx, ny, 0) + .3;
    for (let z = z0; z <= z1; z += st) paintPoint(cx + nx * r, cy + ny * r, z, ramp, level, .5);
  }
  for (let x = -r; x <= r; x += st) for (let y = -r; y <= r; y += st) {
    if (x * x + y * y > r * r) continue;
    paintPoint(cx + x, cy + y, z1, ramp, topLevel, .5 + (noise(x * 2, y * 2) - .5) * .3);
  }
}

/* ---------- seats ---------- */
export function seatPosition(index) {
  if (index === 6) return { x: GUEST_SPOT[0], y: GUEST_SPOT[1], yaw: Math.PI / 2 };
  const a = SEAT0_ANGLE - index * Math.PI * 2 / T.SEATS; // anticlockwise as seen on screen
  return { x: Math.cos(a) * CHAIR_R, y: Math.sin(a) * CHAIR_R, yaw: a + Math.PI };
}

function chair(index) {
  const { x, y, yaw } = seatPosition(index), fx = Math.cos(yaw), fy = Math.sin(yaw);
  obox(x, y, .42, .26, .26, .025, yaw, PLASTIC, index * 7, PLASTIC_LIFT);
  obox(x - fx * .26, y - fy * .26, .46, .03, .27, .26, yaw, PLASTIC, index * 7 + 3, PLASTIC_LIFT);
  for (const [a, b] of [[.22, .22], [.22, -.22], [-.22, .22], [-.22, -.22]]) {
    obox(x + fx * a - fy * b, y + fy * a + fx * b, 0, .03, .03, .21, yaw, PLASTIC, 0, PLASTIC_LIFT);
  }
  for (let k = -.2; k <= .2; k += .1) castShadow(x + fx * k, y + fy * k, .44, .32);
  castShadow(x - fx * .26, y - fy * .26, .8, .28);
}

/* ---------- ground ---------- */
function pickTone(tones, v, ix, iy) {
  return rgb(...tones[clamp(Math.floor(v * 4 + (bayerAt(ix, iy) - .5) * .6), 0, 3)]);
}

function groundColor(x, y, ix, iy, i) {
  const ey = y < 0 ? ISLAND_FAR : ISLAND_Y;
  const edge = Math.pow(Math.pow(Math.abs(x) / (ISLAND_X + .6), 4) + Math.pow(Math.abs(y) / ey, 4), .25);
  const rough = edge + (noise(x * 1.3, y * 1.3) - .5) * .13;
  if (rough > 1.04) return 0;
  if (rough > .93 && hash(ix, iy) < (rough - .93) / .11) return 0;
  const fine = hash(ix, iy), pebble = fine > .975, pebbleShade = hash(ix - 1, iy - 1) > .975;
  if (y < ROAD_Y1 + (noise(x * .7, 3) - .5) * .3) {
    kinds[i] = KIND_ROAD;
    const ramp = rampOf(ROAD);
    const pd = Math.hypot((x - PUDDLE_AT[0]) / 1.4, (y - PUDDLE_AT[1]) / .55) + (noise(x * 2, y * 2) - .5) * .3;
    if (pd < 1) return pd < .35 && fine > .6 ? rgb(176, 192, 200) : rampOf(PUDDLE)[pd < .7 ? 2 : 1];
    if (pebble) return ramp[4];
    if (pebbleShade) return ramp[0];
    const rut = Math.min(Math.abs(y + 7.2), Math.abs(y + 6.1)) < .12 + noise(x, y) * .08 ? -.35 : 0;
    return pickTone(ROAD_TONES, .5 + (noise(x * .8, y * 2) - .5) * .7 + rut, ix, iy);
  }
  if (y > ROAD_Y1 + .4 && edge > .84 + noise(x * .9, y * .9) * .1) {
    kinds[i] = KIND_GRASS;
    const t = noise(x * .9, y * .9) * 1.15 + (fine - .5) * .55 - .08;
    return rgb(...GRASS[clamp(Math.floor(t * 4.2), 0, 3)]);
  }
  kinds[i] = KIND_DIRT;
  const ramp = rampOf(DIRT);
  if (pebble) return ramp[4];
  if (pebbleShade) return ramp[1];
  const patch = noise(x * .35 + 10, y * .35) < .35 ? -.25 : 0;
  const worn = Math.max(0, 1 - Math.hypot(x, y) / 3.4) * .18; // trodden ring around the table
  return pickTone(DIRT_TONES, .5 + (noise(x * .9, y * .9) - .5) * .6 + patch - worn, ix, iy);
}

/* ---------- props ---------- */
function fence() {
  for (let x = -ISLAND_X + .6; x <= WALL_X0; x += 1.5) {
    if (Math.abs(x) < GATE) continue;
    obox(x, FENCE_Y, 0, .07, .07, .8, 0, POST, x * 3);
    castShadow(x, FENCE_Y, 1.1, .1);
    castShadow(x, FENCE_Y, .5, .1);
  }
  const wire = rgb(...WIRE);
  for (const z of [.45, .85, 1.25]) {
    for (let x = -ISLAND_X + .6; x <= WALL_X0; x += .08) {
      if (Math.abs(x) < GATE) continue;
      if (hash(x * 10, z * 10) > .25) plot(x, FENCE_Y, z + Math.sin(x * 1.3) * .03, wire);
    }
  }
}

function wall() {
  const bw = .6, bh = .3;
  obox((WALL_X0 + WALL_X1) / 2, FENCE_Y - .15, 0, (WALL_X1 - WALL_X0) / 2, .14, WALL_H / 2, 0, MORTAR, 2);
  for (let row = 0; row * bh < WALL_H - .01; row++) {
    const off = row % 2 ? bw / 2 : 0;
    for (let x = WALL_X0 - off; x < WALL_X1 - .01; x += bw) {
      const x0 = Math.max(WALL_X0, x + .02), x1 = Math.min(WALL_X1, x + bw - .02);
      if (x1 - x0 < .1) continue;
      const tone = BRICK[Math.floor(hash(x * 3, row) * BRICK.length)];
      box(x0, FENCE_Y - .28, row * bh + .02, x1, FENCE_Y - .01, row * bh + bh - .02, tone, row * 13 + (x * 7 | 0));
      if (row === Math.round(WALL_H / bh) - 1) {
        for (const hx of [.25, .5, .75]) plot(lerp(x0, x1, hx), FENCE_Y - .14, row * bh + bh - .015, rgb(58, 40, 34));
      }
    }
  }
  for (let x = WALL_X0; x <= WALL_X1; x += .3) for (let z = .3; z <= WALL_H; z += .3) castShadow(x, FENCE_Y - .14, z, .22);
}

function table() {
  cylinder(0, 0, 0, .7, .1, PLASTIC, 3);
  cylinder(0, 0, 0, .04, .55, PLASTIC, 2.6);
  cylinder(0, 0, TABLE_Z - .05, TABLE_Z, TABLE_R, PLASTIC, 3.5);
  for (let a = 0; a < 6.28; a += .5) for (let r = .4; r <= TABLE_R; r += .5) castShadow(Math.cos(a) * r, Math.sin(a) * r, TABLE_Z, .35);
  castShadow(0, 0, .35, .15);
  // yerbera and a bag of bizcochitos on the table
  obox(-.55, -.55, TABLE_Z, .14, .1, .12, .4, [196, 176, 120], 5);
  obox(-.15, -.95, TABLE_Z, .2, .14, .05, -.3, [210, 196, 160], 6);
  obox(-.15, -.95, TABLE_Z + .1, .1, .08, .01, -.3, [180, 60, 52], 9);
}

/* ---------- bake ---------- */
export function bakeScene() {
  zb.fill(-1e9);
  pix.fill(rgb(255, 255, 255));
  for (let iy = 0; iy < H; iy++) for (let ix = 0; ix < W; ix++) {
    const g = unproject(ix + .5, iy + .5), i = iy * W + ix, c = groundColor(g.x, g.y, ix, iy, i);
    if (!c) continue;
    pix[i] = c; ground[i] = 1;
    zb[i] = (g.x + g.y) / R2 * COS;
  }
  growGrass();
  groundZ.set(zb);

  fence();
  wall();
  growTree(TREE[0], TREE[1]);
  table();
  for (let i = 1; i <= 5; i++) chair(i);
  pendingShadows.length = 0;
  flushShadows();
  bakeOcclusion();
  staticShadow.set(shadowMask);
  applyShadows(groundZ);

  bakedPix.set(pix);
  bakedZ.set(zb);
}

/* ---------- people ---------- */
// Five friends and the truck driver. Generic colours, no club crests.
export const LOOKS = [
  { shirt: [40, 96, 160], stripe: [236, 234, 226], legs: [48, 50, 62], hair: [40, 30, 24], skin: [222, 172, 134], detail: 'stripes' },
  { shirt: [196, 70, 52], stripe: [196, 70, 52], legs: [70, 74, 92], hair: [34, 28, 26], skin: [200, 150, 112], detail: 'cap', cap: [30, 34, 44] },
  { shirt: [86, 120, 74], stripe: [86, 120, 74], legs: [96, 84, 66], hair: [72, 52, 38], skin: [214, 162, 124], detail: 'moustache' },
  { shirt: [70, 70, 78], stripe: [70, 70, 78], legs: [40, 42, 50], hair: [26, 22, 22], skin: [180, 130, 96], detail: 'hoodie' },
  { shirt: [236, 196, 70], stripe: [236, 196, 70], legs: [62, 78, 110], hair: [110, 74, 44], skin: [230, 184, 148], detail: 'sunglasses' },
  { shirt: [210, 206, 196], stripe: [210, 206, 196], legs: [58, 64, 80], hair: [90, 84, 80], skin: [196, 140, 104], detail: 'cap', cap: [44, 88, 60], scale: 1.15, heavy: true },
];
const SHOE_C = [226, 222, 212], DARK = [30, 28, 30];

// Seated variant of the engine's figure(): hips on the chair, thighs forward, shins down.
export function seatedFigure(px, py, yaw, pose, look, addBone) {
  const fx = Math.cos(yaw), fy = Math.sin(yaw), sx = -fy, sy = fx, k = look.scale || 1, base = pose.z || 0;
  const P = (a, b, c) => [px + (fx * a + sx * b) * k, py + (fy * a + sy * b) * k, c * k + base];
  const add = (a, b, r0, r1, f) => addBone(a, b, r0 * k, r1 * k, f);
  const ball = (c, r, color) => add(c, c, r, r, () => color);
  const shirt = z => (look.detail === 'stripes' && Math.floor(z * 3.2) % 2 ? look.stripe : look.shirt);
  const legs = () => look.legs, skin = () => look.skin;
  const lean = pose.lean || 0, hipZ = .56 / k + (pose.standing ? .7 : 0);
  const torsoR = look.heavy ? .4 : .3;
  const shA = Math.sin(lean) * .9, shZ = hipZ + Math.cos(lean) * .9;
  const neck = P(shA, 0, shZ + .08), head = P(shA + Math.sin(lean) * .3, 0, shZ + .36);
  for (const side of [.15, -.15]) {
    const hip = P(0, side, hipZ), knee = P(.46, side * 1.1, hipZ + .02), foot = P(.52, side * 1.15, .1);
    add(hip, knee, .17, .14, legs); add(knee, foot, .13, .1, legs);
    add(foot, P(.68, side * 1.15, .08), .1, .09, () => SHOE_C);
  }
  add(P(0, 0, hipZ), neck, torsoR, torsoR + .02, shirt);
  add(neck, head, .11, .12, skin);
  ball(head, .24, look.skin);
  const hb = [head[0] - fx * .06 * k, head[1] - fy * .06 * k, head[2] + .08 * k];
  if (look.detail === 'hoodie') ball([head[0] - fx * .08 * k, head[1] - fy * .08 * k, head[2] + .05 * k], .27, look.shirt);
  else ball(hb, .205, look.hair);
  if (look.detail === 'cap') {
    ball([hb[0], hb[1], hb[2] + .04 * k], .21, look.cap);
    add([head[0] + fx * .12 * k, head[1] + fy * .12 * k, head[2] + .17 * k], [head[0] + fx * .32 * k, head[1] + fy * .32 * k, head[2] + .14 * k], .07, .06, () => look.cap);
  }
  if (look.detail === 'moustache') add(P(shA + .23, -.07, shZ + .3), P(shA + .23, .07, shZ + .3), .045, .045, () => look.hair);
  if (look.detail === 'sunglasses') add(P(shA + .14, -.1, shZ + .55), P(shA + .14, .1, shZ + .55), .06, .06, () => DARK);

  const shR = P(shA, .36 + (look.heavy ? .06 : 0), shZ - .03), shL = P(shA, -.36 - (look.heavy ? .06 : 0), shZ - .03);
  let elbowR, handR, elbowL, handL;
  if (pose.drinking) {
    elbowR = P(shA + .3, .34, shZ - .3); handR = P(shA + .38, .12, shZ + .22);
  } else if (pose.palm) {
    elbowR = P(shA + .1, .62, shZ + .3); handR = P(shA + .16, .66, shZ + .86);
  } else if (pose.offended) {
    elbowR = P(shA + .22, .3, shZ - .42); handR = P(shA + .3, -.08, shZ - .2);
    elbowL = P(shA + .22, -.3, shZ - .42); handL = P(shA + .3, .08, shZ - .14);
  } else {
    const reach = pose.reach || 0; // 0 = hand on the thigh, 1 = arm out towards the cebador
    elbowR = P(shA + lerp(.22, .42, reach), .4, shZ - lerp(.42, .2, reach));
    handR = P(shA + lerp(.48, .9, reach), .34, shZ - lerp(.62, .16, reach));
  }
  if (!elbowL) { elbowL = P(shA + .22, -.42, shZ - .42); handL = P(shA + .48, -.36, shZ - .62); }
  add(shR, elbowR, .12, .1, shirt); add(elbowR, handR, .09, .08, skin);
  add(shL, elbowL, .12, .1, shirt); add(elbowL, handL, .09, .08, skin);
  if (pose.palm) ball(handR, .14, [Math.min(255, look.skin[0] + 20), Math.min(255, look.skin[1] + 20), Math.min(255, look.skin[2] + 20)]);
  return { handR, head };
}

/* ---------- gestures fed by sim events ---------- */
const WALK_SPEED = 2.2, WALK_RING = 3.4, PALM_TIME = 1.2;
const fx = { palm: [], arrive: [], offended: -1 };
export function resetScene() {
  fx.palm = []; fx.arrive = []; fx.offended = -1;
  truckFx.signalAt = truckFx.stopAt = truckFx.leaveAt = -99;
  dust.length = 0;
}
export function sceneEvents(events, state) {
  truckEvents(events, state);
  for (const e of events) {
    if (e.type === 'gracias') fx.palm[e.seat] = state.time;
    else if (e.type === 'skip') fx.palm[e.seat] = state.time;
    else if (e.type === 'arrive') fx.arrive[e.seat] = state.time;
    else if (e.type === 'gameOver' && e.reason === 'gracias') fx.offended = e.seat;
  }
}

const TABLE_EDGE_0 = [1.05, 1.05, TABLE_Z + .2]; // where the gourd leaves your hands, on the near side
const GOURD = [118, 104, 56], BOMBILLA = rgb(214, 214, 220);

function drawGourd(p) {
  sphere(p[0], p[1], p[2], .12, GOURD, 'gloss');
  pendingShadows.push(p, .12, p, .12);
  plot(p[0] + .04, p[1] - .02, p[2] + .14, BOMBILLA);
  plot(p[0] + .06, p[1] - .03, p[2] + .22, BOMBILLA);
}

// A newcomer's route from the gate: out to a ring clear of the chairs, round it the short way, then in to the seat.
const paths = [];
function arrivalPath(index) {
  if (paths[index]) return paths[index];
  const seat = seatPosition(index), from = [GUEST_SPOT[0], GUEST_SPOT[1] + .3];
  const a0 = Math.atan2(from[1], from[0]), a1 = Math.atan2(seat.y, seat.x);
  let da = a1 - a0;
  while (da > Math.PI) da -= Math.PI * 2;
  while (da < -Math.PI) da += Math.PI * 2;
  const pts = [from];
  const n = Math.max(2, Math.ceil(Math.abs(da) / .25));
  for (let k = 0; k <= n; k++) { const a = a0 + da * k / n; pts.push([Math.cos(a) * WALK_RING, Math.sin(a) * WALK_RING]); }
  pts.push([seat.x, seat.y]);
  const lengths = [0];
  for (let k = 1; k < pts.length; k++) lengths.push(lengths[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
  return (paths[index] = { pts, lengths, total: lengths.at(-1) });
}

function personAt(index, state) {
  const seat = seatPosition(index);
  const since = fx.arrive[index] == null ? Infinity : state.time - fx.arrive[index];
  const path = since < Infinity ? arrivalPath(index) : null;
  if (path && since * WALK_SPEED < path.total) {
    const d = since * WALK_SPEED;
    let k = 1;
    while (k < path.pts.length - 1 && path.lengths[k] < d) k++;
    const a = path.pts[k - 1], b = path.pts[k], u = (d - path.lengths[k - 1]) / Math.max(1e-6, path.lengths[k] - path.lengths[k - 1]);
    return { walking: true, x: lerp(a[0], b[0], u), y: lerp(a[1], b[1], u), yaw: Math.atan2(b[1] - a[1], b[0] - a[0]) };
  }
  return { walking: false, ...seat };
}

function drawPeople(state, t) {
  const holder = state.phase === 'over' ? -1 : state.turn.seat;
  for (let i = 1; i <= 6; i++) {
    const occupant = state.seats[i];
    if (!occupant) continue;
    const look = LOOKS[occupant.look] || LOOKS[0], at = i === 6 ? guestPlace(state) : personAt(i, state);
    if (i === 6 && at.walking) { drawWalkingDriver(at, t); continue; }
    if (at.walking) {
      const stride = STILL ? 0 : Math.sin(t * 9) * .35;
      figure(at.x, at.y, at.yaw, { stance: .15 + stride * .2, armR: stride, armL: -stride, scale: look.scale }, look, dynamicAdd);
      continue;
    }
    const isHolder = i === holder && state.phase !== 'pour', p = state.phaseTime;
    const pose = {};
    if (fx.offended === i) Object.assign(pose, { offended: true, lean: -.2 });
    else if (state.time - (fx.palm[i] ?? -99) < PALM_TIME) pose.palm = true;
    else if (isHolder && state.phase === 'drink') pose.drinking = true;
    else if (isHolder && state.phase === 'out') pose.reach = 1 - ease(clamp(p / T.PASS_TIME, 0, 1)) * .4;
    else if (isHolder && state.phase === 'back') pose.reach = .6 + ease(clamp(p / T.PASS_TIME, 0, 1)) * .4;
    else if (i === holder && state.phase === 'pour' && !state.tutorial) {
      // the friend the mate is for leans in, hand out, further as their patience runs out.
      // Trap turns look the same, so nothing gives away who said gracias.
      const waited = state.turn.trap ? state.phaseTime : state.turn.waited;
      const p = clamp(waited / patienceWindow(state), 0, 1);
      Object.assign(pose, { lean: .1 + .28 * p, reach: .3 + .7 * p });
    }
    else pose.lean = STILL ? 0 : Math.sin(t * 1.6 + i) * .015;
    let handR;
    if (i === 6) {
      const armR = pose.drinking ? 2.1 : pose.palm ? 2.9 : pose.reach ? .4 + pose.reach : .1;
      handR = figure(at.x, at.y, at.yaw, { lean: .3, stance: .1, armR, armL: .1, scale: look.scale }, look, dynamicAdd);
    } else handR = seatedFigure(at.x, at.y, at.yaw, pose, look, dynamicAdd).handR;
    if (!isHolder) continue;
    const u = ease(clamp(p / T.PASS_TIME, 0, 1));
    if (state.phase === 'out') drawGourd(lerp3(TABLE_EDGE_0, handR, u));
    else if (state.phase === 'back') drawGourd(lerp3(handR, TABLE_EDGE_0, u));
    else drawGourd(handR);
  }
  if (!state.seats[6]) { const back = guestPlace(state); if (back) drawWalkingDriver(back, t); }
}
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/* ---------- the hero pour rig (screen space, decision D1) ---------- */
// Your hands, the thermos and the gourd, drawn pixel by pixel over the bottom centre and not to world scale.
const RIG = {
  mouth: { x: 204, y: 230, rx: 15, ry: 8 },     // gourd opening seen from 30° above
  body: { x: 204, y: 246, rx: 17, ry: 17 },     // calabaza belly below the mouth
  pivot: { x: 168, y: 214 },                    // your left fist, where the thermos turns
  thermo: { back: 16, front: 17, half: 6 },     // thermos length behind / ahead of the fist, half width
  hole: { u: .35, v: .45 },                     // centre of the side hole inside the mouth (unit ellipse)
  moundTop: { u: -.45, v: -.45 },               // dry crest against the far wall
};
const C = {
  ink: rgb(36, 30, 30), steel: rampOf([170, 176, 184]), cap: rampOf([196, 52, 44]), gourd: rampOf([124, 98, 54]),
  rim: rampOf([200, 196, 184]), skin: rampOf([226, 176, 138]), sleeve: rampOf([62, 74, 96]), cuff: rampOf([84, 96, 118]),
  thermos: rampOf([66, 112, 78]), cup: rampOf([58, 58, 62]),
  yerba: [98, 142, 58], yerbaWet: [52, 86, 40], yerbaPale: [176, 178, 128], hole: rgb(40, 36, 28),
  water: rgb(132, 186, 222), waterDeep: rgb(92, 150, 196), shine: rgb(236, 248, 255), stream: rgb(156, 206, 238),
  palito: rgb(214, 204, 150), bombilla: rampOf([200, 204, 214]), foam: rgb(222, 230, 186), foamDark: rgb(176, 196, 140),
};
const rigFx = { tilt: 0, t: 0, flecks: [], scar: [], turn: null };
const MURK = [176, 172, 102], MURK_DEEP = [132, 132, 72], SCAR = [[70, 76, 40], [88, 90, 48]];
const DRY_DUST = rgb(214, 210, 150), STEAM = rgb(244, 244, 240);

function px(x, y, c) {
  x |= 0; y |= 0;
  if (x >= 0 && y >= 0 && x < W && y < H) pix[y * W + x] = c;
}
const mixRgb = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const shadeOf = (ramp, l, ix, iy) => ramp[clamp(Math.floor(l * 4.4 + .2 + (bayerAt(ix, iy) - .5) * .7), 0, 4)];

// Fills a shape given by inside(x, y) → light level or null, then outlines it in ink.
function shape(x0, y0, x1, y1, inside, ramp) {
  const mask = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const l = inside(x + .5, y + .5);
    if (l == null) continue;
    mask.push(x, y);
    px(x, y, l < 16 ? shadeOf(ramp, l, x, y) : l); // small numbers are light levels, large ones packed colours
  }
  const isIn = (x, y) => inside(x + .5, y + .5) != null;
  for (let k = 0; k < mask.length; k += 2) {
    const x = mask[k], y = mask[k + 1];
    if (!isIn(x - 1, y) || !isIn(x + 1, y) || !isIn(x, y - 1) || !isIn(x, y + 1)) px(x, y, C.ink);
  }
  return mask;
}

// A forearm from the bottom edge: tapered, a sleeve with a ribbed cuff, then skin to the wrist.
function arm(fromX, fromY, toX, toY, w0, w1, sleeveTo) {
  const len = Math.hypot(toX - fromX, toY - fromY), dx = (toX - fromX) / len, dy = (toY - fromY) / len;
  const pad = Math.max(w0, w1) + 1;
  shape(Math.min(fromX, toX) - pad, Math.min(fromY, toY) - pad, Math.max(fromX, toX) + pad, Math.min(H - 1, Math.max(fromY, toY) + pad), (x, y) => {
    const a = (x - fromX) * dx + (y - fromY) * dy, b = (x - fromX) * -dy + (y - fromY) * dx;
    const u = a / len, w = lerp(w0, w1, u);
    if (a < 0 || a > len || Math.abs(b) > w) return null;
    const side = b / w; // -1 lit edge, +1 shaded edge
    if (u < sleeveTo - .1) return C.sleeve[clamp(Math.round(2.7 - side * 1.3 + (hash(x | 0, y | 0) > .9 ? -.5 : 0)), 1, 4)];
    if (u < sleeveTo) return C.cuff[(Math.round(a) % 2 ? 2 : 3) - (side > .5 ? 1 : 0)];
    return C.skin[clamp(Math.round(2.9 - side * 1.2), 1, 4)];
  });
}

// Cartoon mitten hands: a few rounded lobes with one ink outline each and flat two-tone shading.
function lobe(cx, cy, rx, ry, rot = 0, tone = 0) {
  const c = Math.cos(rot), sn = Math.sin(rot), r = Math.max(rx, ry) + 1;
  return shape(cx - r, cy - r, cx + r, cy + r, (x, y) => {
    const dx = x - cx, dy = y - cy, u = (dx * c + dy * sn) / rx, v = (-dx * sn + dy * c) / ry;
    if (u * u + v * v > 1) return null;
    if (u * -.6 + v * -.8 > .55) return C.skin[4];          // highlight on the upper-left
    return C.skin[(u * .5 + v * .85 > .35 ? 2 : 3) + tone];  // shade on the lower-right
  });
}

// Your left hand around the thermos: a mitten wrapped across the body, a thumb pointing to the spout.
function thermosHand(local, toScreen, half) {
  const angle = Math.atan2(toScreen(1, 0)[0] - toScreen(0, 0)[0], -(toScreen(1, 0)[1] - toScreen(0, 0)[1]));
  const rot = angle; // the mitten's long side runs across the thermos
  const c = toScreen(-1.4, -.6);
  lobe(c[0], c[1], half + 2.4, 6, rot);
  // finger notches on the far edge
  for (const a of [-3.2, -.6, 2]) {
    for (let k = 0; k < 2; k++) {
      const p = toScreen(a, half + 1.6 - k);
      px(p[0], p[1], C.ink);
    }
  }
  const th = toScreen(4.4, -half - .4);
  lobe(th[0], th[1], 2.2, 4, rot);
}

// An Argentine thermos: hammered green body, steel bands, a dark cup for a cap and the steel pouring spout.
function drawThermos(angle, glow) {
  const { x: ox, y: oy } = RIG.pivot, { back, front, half } = RIG.thermo;
  const ax = Math.sin(angle), ay = -Math.cos(angle);
  const local = (x, y) => [(x - ox) * ax + (y - oy) * ay, (x - ox) * -ay + (y - oy) * ax];
  const toScreen = (a, b) => [ox + ax * a - ay * b, oy + ay * a + ax * b];
  const r = back + front + 4;
  const mask = shape(ox - r, oy - r, ox + r, oy + r, (x, y) => {
    const [a, b] = local(x, y);
    const spout = a > front - 3, cup = a > front - 9 && !spout;
    const w = spout ? half - 2.6 : cup ? half - .6 : half;
    if (a < -back || a > front || Math.abs(b) > w) return null;
    const cyl = .8 - (b / w) * .45 - (Math.abs(b / w + .35) < .16 ? -.22 : 0); // lit from the left, with a highlight stripe
    const ix = x | 0, iy = y | 0;
    if (spout || (a > front - 10 && a <= front - 9) || a < -back + 1.4) return shadeOf(C.steel, cyl + .05, ix, iy);
    if (cup) return shadeOf(C.cup, cyl + (Math.round(a) % 3 === 0 ? -.12 : 0), ix, iy);
    const hammer = (hash(Math.round(a * .7), Math.round(b * .9)) - .5) * .28;
    return shadeOf(C.thermos, cyl + hammer, ix, iy);
  });
  if (glow) outlineGlow(mask);
  thermosHand(local, toScreen, half);
  return toScreen(front, 0);
}

// Your right hand under the gourd: a cupped mitten with the fingers up one side and the thumb up the other.
function gourdHand(full) {
  const { body: g } = RIG;
  if (!full) {
    lobe(g.x + 2, g.y + g.ry - 3, 11, 5);
    lobe(g.x - 6, g.y + g.ry - 7, 4, 3.4, -.5);
    return;
  }
  // fingers and thumb first, so the palm overlaps their roots and they read as one hand
  lobe(g.x - g.rx + 5, g.y + 9, 3.6, 6.4, .55);
  lobe(g.x + g.rx - 4, g.y + 11, 2.6, 4.4, -.6);
  lobe(g.x, g.y + g.ry - 1, 13, 5);
  for (let k = 0; k < 2; k++) px(g.x - g.rx + 6 + k * 2, g.y + 6 + k * 3, C.ink);  // finger notches
}

function outlineGlow(mask) {
  const set = new Set();
  for (let k = 0; k < mask.length; k += 2) set.add(mask[k] + ',' + mask[k + 1]);
  for (let k = 0; k < mask.length; k += 2) {
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const x = mask[k] + dx, y = mask[k + 1] + dy;
      if (!set.has(x + ',' + y)) px(x, y, SIGNAL);
    }
  }
}

// Inside the mouth: u, v in the unit ellipse (v = -1 far wall, +1 near wall).
function moundEdge(u, height) {
  return lerp(-.55, .25, height) - .55 * u;   // the mound covers v below this line, sloping to the hole
}

function drawRigGourd(fill, yerba, wetTop, overflow, glow, dry = 0, murk = 0) {
  const water1 = rgb(...mixRgb([132, 186, 222], MURK, murk)), water2 = rgb(...mixRgb([92, 150, 196], MURK_DEEP, murk));
  const { mouth: m, body: b } = RIG;
  // belly
  const belly = shape(b.x - b.rx - 1, m.y, b.x + b.rx + 1, b.y + b.ry + 1, (x, y) => {
    const u = (x - b.x) / b.rx, v = (y - b.y) / b.ry;
    const neck = y < m.y + m.ry ? Math.abs(x - m.x) <= m.rx + 1 + (y - m.y) * .3 : true;
    if (u * u + v * v > 1 || !neck) return null;
    return .72 - u * .45 - v * .2;
  }, C.gourd);
  // rim and inside
  const height = lerp(.35, 1, clamp(yerba, 0, 1));
  const hole = [RIG.hole.u, RIG.hole.v];
  const water = clamp(fill, 0, 1);
  const wr = lerp(.08, .62, Math.sqrt(water));
  const mask = shape(m.x - m.rx - 1, m.y - m.ry - 1, m.x + m.rx + 1, m.y + m.ry + 1, (x, y) => {
    const u = (x - m.x) / m.rx, v = (y - m.y) / m.ry, d = u * u + v * v;
    if (d > 1) return null;
    if (d > .7) return C.rim[clamp(Math.round(3.2 - v * 1.2), 1, 4)];
    const ix = x | 0, iy = y | 0;
    const du = (u - hole[0]) / 1.2, dv = v - hole[1] + water * .18, hd = Math.hypot(du, dv);
    if (water > 0 && (hd < wr || (water >= .999 && v > moundEdge(u, height)))) {
      if (water >= T.FILL_OK && hd < wr * .78) {
        // a full mate foams on top: the cue that it is ready to hand over
        const f = hash(ix * 5, iy * 7);
        if (f > .25) return f > .7 ? C.foamDark : C.foam;
      }
      if (Math.abs(du + .12) < .12 && Math.abs(dv + wr * .55) < .08) return C.shine;
      // washed yerba clouds the water: clear blue when you pour into the hole, murky when you hit the mound
      if (murk > .3 && hash(ix * 7, iy * 3) > 1.05 - murk * .25) return C.palito;
      return hd > wr * .7 ? water2 : water1;
    }
    if (v < moundEdge(u, height)) {
      const crest = clamp((moundEdge(u, height) - v) / .9, 0, 1);
      // a dark wet scar where the stream has been digging into the mound this turn
      for (const [su, sv] of rigFx.scar) {
        const d = ((u - su) / .9) ** 2 + (v - sv) ** 2;
        if (d < .08 + .03 * hash(ix, iy)) return rgb(...SCAR[hash(ix * 3, iy) > .5 ? 1 : 0]);
      }
      // dry yerba before the first pour is dusty; once wet it turns deep green
      if (dry > 0 && hash(ix * 3, iy * 5) < .3 * dry) return DRY_DUST;
      let c = mixRgb(C.yerba, C.yerbaPale, clamp((1 - yerba) * 1.1, 0, 1));
      c = mixRgb(c, [150, 168, 92], dry * .7);
      c = mixRgb(c, C.yerbaWet, clamp(wetTop * (1.2 - crest * .4), 0, 1) * .85);
      return shadeOf(rampOf(c.map(Math.round)), .55 + crest * .35 - u * .15, ix, iy);
    }
    return C.hole;
  });
  // palitos: pale stalks floating once the yerba is washed
  if (yerba <= T.LAVADO_AT && water > .15) {
    const cx = m.x + hole[0] * m.rx, cy = m.y + (hole[1] - water * .18) * m.ry;
    for (const [ox, oy, dir] of [[-4, -1, 1], [1, 1, -1], [3, -2, 1], [-1, 2, 1]].slice(0, 2 + Math.round(water * 2))) {
      for (let k = 0; k < 3; k++) px(cx + ox + k, cy + oy + (dir > 0 ? 0 : k > 1 ? 1 : 0), C.palito);
    }
  }
  // bombilla, rising from the near-right side of the mouth
  for (let k = 0; k < 18; k++) {
    const x = m.x + 7 + k * .45, y = m.y + 2 - k;
    px(x, y, C.bombilla[3]); px(x + 1, y, C.bombilla[1]);
  }
  px(m.x + 15, m.y - 17, C.bombilla[4]); px(m.x + 16, m.y - 17, C.bombilla[3]);
  // overflow: water running down the outside of the gourd
  if (overflow > 0) {
    const run = Math.min(1, overflow * 6 + .3);
    for (const [ox, len] of [[-9, 10], [-3, 14], [5, 12], [10, 8]]) {
      const n = Math.round(len * run);
      for (let k = 0; k < n; k++) {
        const x = m.x + ox + Math.round(Math.sin((k + ox) * .7) * .6), y = m.y + m.ry - 1 + k;
        px(x, y, k % 4 === (Math.floor(rigFx.t * 12) % 4) ? C.shine : C.stream);
      }
    }
  }
  if (glow) { outlineGlow(belly); outlineGlow(mask); }
}

function landingPoint(land, yerba) {
  const { mouth: m } = RIG, height = lerp(.35, 1, clamp(yerba, 0, 1));
  const top = { u: RIG.moundTop.u, v: Math.min(RIG.moundTop.v, moundEdge(RIG.moundTop.u, height) - .25) };
  const u = lerp(RIG.hole.u, top.u, land), v = lerp(RIG.hole.v, top.v, land);
  return [m.x + u * m.rx, m.y + v * m.ry];
}

function drawStream(from, to, flow) {
  const width = 1 + Math.round(2 * clamp(flow / T.FLOW_MAX, 0, 1));
  const n = Math.ceil(Math.hypot(to[0] - from[0], to[1] - from[1]) * 1.5);
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    // a short arc out of the spout, then falling
    const x = lerp(from[0], to[0], 1 - (1 - t) * (1 - t)), y = lerp(from[1], to[1], t * t * .6 + t * .4);
    for (let w = 0; w < width; w++) px(x + w - (width >> 1), y, (k + Math.floor(rigFx.t * 20)) % 7 === 0 ? C.shine : C.stream);
  }
  for (let k = 0; k < 3; k++) px(to[0] - 2 + k * 2, to[1] - 1, C.shine); // splash
}

export function drawRig(state, t) {
  const dt = clamp(t - rigFx.t, 0, .1);
  rigFx.t = t;
  rigFx.tilt += (state.tilt - rigFx.tilt) * (1 - Math.exp(-dt * 30));
  const inHand = state.phase === 'pour' || (state.tutorial && state.phase === 'drink') || state.phase === 'over';
  const pulse = state.tutorial && state.phase === 'pour' && state.turn.fill === 0 && (STILL || Math.floor(t * 2) % 2 === 0);
  let fill = state.turn.fill;
  if (state.tutorial && state.phase === 'drink') fill *= 1 - clamp(state.phaseTime / T.DRINK_TIME, 0, 1);
  const angle = lerp(0, 105 * Math.PI / 180, inHand ? rigFx.tilt : 0);

  // your right hand under the gourd (or empty and cupped while the mate goes round)
  arm(RIG.body.x + 22, H + 8, RIG.body.x + 5, RIG.body.y + RIG.body.ry + 1, 8, 5, .62);
  if (inHand) {
    const dry = state.tutorial && state.phase === 'pour' ? 1 - clamp(fill / T.FILL_OK, 0, 1) : 0;
    if (rigFx.turn !== state.turn) { rigFx.turn = state.turn; rigFx.scar = []; }
    if (state.phase === 'pour' && state.flow > 0 && state.topFrac > .25) {
      const [lx, ly] = landingPoint(state.land, state.yerba), m = RIG.mouth;
      const uv = [(lx - m.x) / m.rx, (ly - m.y) / m.ry + .12];
      if (!rigFx.scar.some(([u, v]) => Math.hypot(u - uv[0], v - uv[1]) < .06) && rigFx.scar.length < 60) rigFx.scar.push(uv);
    }
    const murk = clamp((state.turn.washed || 0) / .035, 0, 1);
    drawRigGourd(fill, state.yerba, state.wetTop, state.phase === 'pour' ? state.turn.overflow : 0, pulse, dry, murk);
    gourdHand(true);
    if (fill > .15) drawSteam(t, fill);
  } else gourdHand(false);

  // your left hand on the thermos
  const wrist = [RIG.pivot.x - Math.cos(angle) * (RIG.thermo.half + 3), RIG.pivot.y - Math.sin(angle) * (RIG.thermo.half + 3) + 2];
  arm(RIG.pivot.x - 34, H + 8, wrist[0], wrist[1], 8, 4.5, .6);
  const spout = drawThermos(angle, pulse);
  if (state.flow > 0 && state.phase !== 'over') {
    const land = landingPoint(state.land, state.yerba);
    drawStream(spout, land, state.flow);
    // yerba kicked up where the stream hits the mound: the wash, made visible
    if (!STILL && state.topFrac > .2) {
      const n = dt * 160 * state.topFrac * state.flow / T.FLOW_MAX;
      for (let k = 0; k < n || (k === 0 && Math.random() < n); k++) {
        rigFx.flecks.push({ x: land[0], y: land[1], vx: (Math.random() - .6) * 40, vy: -20 - Math.random() * 30, born: t });
      }
    }
  }
  drawFlecks(t);
}

function drawFlecks(t) {
  const g = 160;
  rigFx.flecks = rigFx.flecks.filter(f => t - f.born < .4 && t >= f.born);
  for (const f of rigFx.flecks) {
    const a = t - f.born, x = f.x + f.vx * a, y = f.y + f.vy * a + g * a * a / 2;
    px(x, y, hash(f.vx, f.vy) > .5 ? rgb(...C.yerba) : rgb(...C.yerbaPale));
  }
}

// hot water: thin wisps rising off the mate, every other pixel so they read as see-through
function drawSteam(t, fill) {
  if (STILL) return;
  const { mouth: m } = RIG;
  for (let k = 0; k < 3; k++) {
    const rise = (t * 9 + k * 6.3) % 14, sway = Math.sin(t * 2.2 + k * 2 + rise * .35) * 2.2;
    for (let j = 0; j < 4; j++) {
      const y = Math.round(m.y - 3 - rise - j), x = Math.round(m.x - 4 + k * 5 + sway + j * .4);
      if ((x + y) % 2 === 0 && hash(k * 13 + j, Math.floor(t * 6)) < fill * .9 - rise / 20) px(x, y, STEAM);
    }
  }
}

/* ---------- the furniture truck, the guest and dusk ---------- */
const ROAD_MID = -6.5, TRUCK_FROM = -15, TRUCK_TO = 15;
const CAB = [70, 112, 72], RUST = rgb(150, 92, 52), PLANK = [[132, 104, 76], [116, 92, 70], [146, 118, 88]];
const TYRE = [40, 38, 40], MATTRESS = [232, 226, 210], HORN = [176, 180, 176];
const GUEST_WALK = 1.5;
const dust = [];
const truckFx = { signalAt: -99, stopAt: -99, leaveAt: -99, lastT: 0 };

export function truckX(progress) { return lerp(TRUCK_FROM, TRUCK_TO, progress); }

function rustDots(x0, x1, y0, y1, z) {
  for (let x = x0; x < x1; x += .09) for (let y = y0; y < y1; y += .09) {
    if (hash(x * 31, y * 17 + z) > .93) plot(x, y, z + .01, RUST);
  }
}

function drawTruck(state, t) {
  const tr = state.truck;
  const leaving = state.time - truckFx.leaveAt < GUEST_WALK;
  if (!tr.active) return;
  const x = truckX(tr.progress), y = ROAD_MID;
  // wheels, with a two-frame stipple while rolling
  const roll = STILL || tr.speed === 0 ? 0 : Math.floor(t * 10) % 2;
  for (const a of [-1.7, 1.75]) for (const b of [-.78, .78]) {
    sphere(x + a, y + b, .34, .34, TYRE, 'solid');
    plot(x + a + (roll ? .12 : -.12), y + b + .36, .34 + (roll ? .1 : -.1), rgb(150, 146, 140));
  }
  // chassis and bed floor
  obox(x - .9, y, .45, 1.6, .74, .1, 0, [52, 50, 52], 3);
  // slatted wooden side boards and tailgate
  for (let row = 0; row < 4; row++) {
    const z = .7 + row * .24, tone = PLANK[row % 3];
    obox(x - 1.05, y + .74, z, 1.45, .035, .1, 0, tone, row * 5);
    obox(x - 1.05, y - .74, z, 1.45, .035, .1, 0, tone, row * 5 + 1);
    obox(x - 2.48, y, z, .035, .72, .1, 0, tone, row * 5 + 2);
  }
  for (const a of [-2.45, -1.5, -.6, .35]) for (const b of [-.74, .74]) obox(x + a, y + b, .6, .05, .05, .55, 0, [70, 82, 92], a * 9);
  // a mattress standing in the back
  obox(x - 1.2, y - .1, .7, .9, .22, .62, -.05, MATTRESS, 11, .4);
  // cab: lower body, hood, roof on pillars, so the driver shows through the window
  obox(x + 1.1, y, .55, .55, .72, .32, 0, CAB, 21);
  obox(x + 2.05, y, .55, .45, .7, .3, 0, CAB, 22);
  obox(x + 1.1, y, 1.72, .55, .74, .05, 0, CAB, 23);
  for (const a of [.6, 1.6]) for (const b of [-.7, .7]) obox(x + a, y + b, 1.18, .04, .04, .28, 0, CAB, 24);
  obox(x + 1.62, y, 1.2, .02, .7, .25, 0, [60, 72, 84], 25, -.6);     // windscreen
  obox(x + 2.52, y, .6, .02, .55, .16, 0, [228, 226, 218], 26, .4);   // white grille
  sphere(x + 2.53, y + .52, .78, .08, [240, 236, 214], 'gloss');
  sphere(x + 2.53, y - .52, .78, .08, [240, 236, 214], 'gloss');
  rustDots(x + 1.6, x + 2.5, y - .7, y + .7, 1.15);
  rustDots(x + .55, x + 1.65, y - .74, y + .74, 1.82);
  // loudspeaker horn on the roof
  capsule([x + .9, y, 1.82], [x + .9, y, 2.0], .05, .05, () => HORN, 'solid');
  capsule([x + .85, y, 2.08], [x + 1.25, y, 2.12], .1, .2, () => HORN, 'solid');
  sphere(x + 1.27, y, 2.12, .12, [60, 60, 64], 'solid');
  pendingShadows.push([x - .9, y, .9], 1.1, [x + 2, y, .9], 1.1);
  // the driver, unless he is out at the fence
  const out = state.seats[6] || leaving || (tr.stopped && state.time - truckFx.stopAt >= 0);
  if (!out) {
    const wave = state.time - truckFx.signalAt < T.GUEST_SLOW_TIME;
    seatedFigure(x + 1.05, y + .2, 0, { palm: wave, z: .1 }, LOOKS[5], dynamicAdd);
  }
  // dust trail
  if (!STILL && tr.speed > 0) {
    const dt = clamp(t - truckFx.lastT, 0, .1);
    for (let k = 0; k < dt * 40; k++) dust.push({ x: x - 2.6 + (Math.random() - .5) * .5, y: y + (Math.random() - .5) * 1.4, z: .1, born: t });
  }
}

function drawDust(t) {
  for (let i = dust.length - 1; i >= 0; i--) {
    const d = dust[i], age = t - d.born;
    if (age > 1.5 || age < 0) { dust.splice(i, 1); continue; }
    const z = d.z + age * .5, fade = age / 1.5;
    for (let k = 0; k < 4; k++) {
      if (hash(i * 7 + k, Math.floor(age * 8)) < fade) continue;
      plot(d.x - age * .4 + (k % 2) * .1, d.y + (k > 1 ? .1 : 0), z, rgb(190 - k * 8, 168 - k * 8, 132 - k * 6));
    }
  }
}

// Where the driver stands: walking from the cab to the gate after the stop, and back after his mate.
function guestPlace(state) {
  const cab = [truckX(T.GUEST_STOP_AT) + 1.1, ROAD_MID + .9];
  const there = [GUEST_SPOT[0], GUEST_SPOT[1] - .2];
  if (state.seats[6]) {
    const u = ease(clamp((state.time - truckFx.stopAt) / GUEST_WALK, 0, 1));
    return { x: lerp(cab[0], there[0], u), y: lerp(cab[1], there[1], u), walking: u < 1, yaw: u < 1 ? Math.atan2(there[1] - cab[1], there[0] - cab[0]) : Math.PI / 2 };
  }
  const u = ease(clamp((state.time - truckFx.leaveAt) / GUEST_WALK, 0, 1));
  if (u >= 1) return null;
  return { x: lerp(there[0], cab[0], u), y: lerp(there[1], cab[1], u), walking: true, yaw: Math.atan2(cab[1] - there[1], cab[0] - there[0]) };
}

function drawWalkingDriver(at, t) {
  const stride = STILL ? 0 : Math.sin(t * 8) * .35;
  return figure(at.x, at.y, at.yaw, { stance: .15 + stride * .2, armR: stride, armL: -stride, scale: 1.15 }, LOOKS[5], dynamicAdd);
}

export function truckEvents(events, state) {
  for (const e of events) {
    if (e.type === 'guestSignal') truckFx.signalAt = state.time;
    else if (e.type === 'truckStop') truckFx.stopAt = state.time;
    else if (e.type === 'guestLeave') truckFx.leaveAt = state.time;
  }
}

const VIOLET = [70, 52, 120], ORANGE = [255, 150, 70];
export function gradeDusk(dusk) {
  const k = .35 * clamp(dusk, 0, 1);
  if (k <= 0) return;
  for (let i = 0; i < pix.length; i++) {
    const c = pix[i];
    if (c === 0xffffffff) continue; // the paper stays white
    const r = c & 255, g = c >> 8 & 255, b = c >> 16 & 255;
    const L = (.3 * r + .59 * g + .11 * b) / 255;
    const w = clamp((L - .25) / .45, 0, 1), tw = w * w * (3 - 2 * w);
    const tr = lerp(VIOLET[0], ORANGE[0], tw), tg = lerp(VIOLET[1], ORANGE[1], tw), tb = lerp(VIOLET[2], ORANGE[2], tw);
    const scale = L * 255 / Math.max(1, .3 * tr + .59 * tg + .11 * tb);
    pix[i] = rgb(lerp(r, tr * scale, k), lerp(g, tg * scale, k), lerp(b, tb * scale, k));
  }
}

/* ---------- the patio dog ---------- */
const DOG_COAT = [184, 132, 74], DOG_CHEST = [236, 226, 206], DOG_DARK = [92, 64, 44];

export function drawDog(dog, t) {
  const fx = Math.cos(dog.yaw), fy = Math.sin(dog.yaw), sx = -fy, sy = fx;
  const k = 1.3; // a medium street dog: at true scale it is only a few pixels
  const P = (a, b, c) => [dog.x + (fx * a + sx * b) * k, dog.y + (fy * a + sy * b) * k, c * k];
  const add = (a, b, r0, r1, c) => dynamicAdd(a, b, r0 * k, r1 * k, () => c);
  const since = t - dog.barkAt, barking = since < .25;
  const lying = dog.mode === 'lie' && since > 1.2;
  const step = dog.mode === 'run' && !STILL ? Math.sin(t * 16) * .12 : 0;
  const hop = barking && !STILL ? .05 : 0;
  const bodyZ = lying ? .14 : .34 + hop;
  // legs
  if (lying) {
    add(P(.3, .1, .06), P(.5, .12, .05), .05, .045, DOG_COAT);
    add(P(.3, -.1, .06), P(.5, -.12, .05), .05, .045, DOG_COAT);
  } else {
    for (const [a, b, ph] of [[.22, .09, 0], [.22, -.09, Math.PI], [-.2, .09, Math.PI], [-.2, -.09, 0]]) {
      const swing = step * Math.sin(ph + 1);
      add(P(a, b, bodyZ - .05), P(a + swing, b, .04), .05, .04, DOG_COAT);
    }
  }
  // body, chest, head
  add(P(-.24, 0, bodyZ + .02), P(.2, 0, bodyZ + .04), .14, .15, DOG_COAT);
  add(P(.24, 0, bodyZ - .02), P(.26, 0, bodyZ + .04), .1, .1, DOG_CHEST);
  const headUp = lying ? 0 : barking ? .12 : .06;
  const head = P(lying ? .42 : .36, 0, bodyZ + (lying ? .02 : .16) + headUp);
  dynamicAdd(head, head, .12 * k, .12 * k, () => DOG_COAT);
  const hz = head[2] / k, snout = P(lying ? .58 : .5, 0, hz - .03 + (barking ? .03 : 0));
  add(head, snout, .07, .055, DOG_COAT);
  plot(snout[0] + fx * .05, snout[1] + fy * .05, snout[2] + .02, rgb(...DOG_DARK));
  if (barking) plot(snout[0] + fx * .04, snout[1] + fy * .04, snout[2] - .05, rgb(160, 60, 60));
  for (const b of [.08, -.08]) add(P(lying ? .38 : .32, b, hz + .1), P(lying ? .34 : .28, b * 1.3, hz + .17), .045, .03, DOG_DARK); // ears
  // tail: wags after a good mate or while barking, rests otherwise
  const wag = !STILL && (t < dog.wagUntil || barking || dog.mode !== 'lie') ? Math.sin(t * 18) * .12 : 0;
  add(P(-.36, 0, bodyZ + .06), P(-.52, wag, bodyZ + (lying ? .04 : .22)), .045, .035, DOG_COAT);
}

/* ---------- per frame ---------- */
export function drawScene(state, t, amb) {
  pix.set(bakedPix);
  zb.set(bakedZ);
  pendingShadows.length = 0;
  drawTruck(state, t);
  if (amb) drawDog(amb.dog, t);
  drawPeople(state, t);
  drawDust(t);
  truckFx.lastT = t;
  const windT = STILL ? 0 : Math.floor(t * WIND_FPS) / WIND_FPS;
  drawLeaves(windT);
  drawTufts(windT);
  flushShadows();
  applyShadows(bakedZ);
  shadeEdges();
  gradeDusk(state.rondaTime / T.DUSK_TIME);
  drawRig(state, t);
  ctx.putImageData(image, 0, 0);
}

export function headScreen(index, state) {
  const at = (index === 6 && state && guestPlace(state)) || (state ? personAt(index, state) : seatPosition(index));
  const top = index === 6 ? 2.6 : at.walking ? 2.1 : 1.85;
  const p = project(at.x, at.y, top);
  return { sx: p.sx, sy: p.sy };
}
