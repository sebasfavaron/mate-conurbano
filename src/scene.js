// Bake and draw the patio through the engine's globals (engine.js is a classic script loaded first).
import { T } from './tuning.js';

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
const WALK_TIME = 2, PALM_TIME = 1.2;
const fx = { palm: [], tease: [], arrive: [], offended: -1 };
export function resetScene() {
  fx.palm = []; fx.tease = []; fx.arrive = []; fx.offended = -1;
}
export function sceneEvents(events, state) {
  for (const e of events) {
    if (e.type === 'gracias') fx.palm[e.seat] = state.time;
    else if (e.type === 'tease') fx.tease[e.seat] = state.time;
    else if (e.type === 'turn' || e.type === 'handoff') fx.tease = [];
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

function personAt(index, state) {
  const seat = seatPosition(index);
  const since = fx.arrive[index] == null ? Infinity : state.time - fx.arrive[index];
  if (since < WALK_TIME) {
    const t = ease(clamp(since / WALK_TIME, 0, 1)), from = [GUEST_SPOT[0], GUEST_SPOT[1] + .3];
    const x = lerp(from[0], seat.x, t), y = lerp(from[1], seat.y, t);
    return { walking: true, x, y, yaw: Math.atan2(seat.y - from[1], seat.x - from[0]) };
  }
  return { walking: false, ...seat };
}

function drawPeople(state, t) {
  const holder = state.phase === 'over' ? -1 : state.turn.seat;
  for (let i = 1; i <= 6; i++) {
    const occupant = state.seats[i];
    if (!occupant) continue;
    const look = LOOKS[occupant.look] || LOOKS[0], at = personAt(i, state);
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
    else if (i === holder && state.phase === 'pour' && fx.tease[i] != null) Object.assign(pose, { lean: .28, reach: .8 });
    else pose.lean = STILL ? 0 : Math.sin(t * 1.6 + i) * .015;
    if (i === 6) Object.assign(pose, { standing: true, lean: (pose.lean || 0) + .3 });
    const { handR } = seatedFigure(at.x, at.y, at.yaw, pose, look, dynamicAdd);
    if (!isHolder) continue;
    const u = ease(clamp(p / T.PASS_TIME, 0, 1));
    if (state.phase === 'out') drawGourd(lerp3(TABLE_EDGE_0, handR, u));
    else if (state.phase === 'back') drawGourd(lerp3(handR, TABLE_EDGE_0, u));
    else drawGourd(handR);
  }
  // the cebador's own first mate: drunk off-screen in the rig, nothing to draw here
}
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/* ---------- per frame ---------- */
export function drawScene(state, t) {
  pix.set(bakedPix);
  zb.set(bakedZ);
  pendingShadows.length = 0;
  drawPeople(state, t);
  const windT = STILL ? 0 : Math.floor(t * WIND_FPS) / WIND_FPS;
  drawLeaves(windT);
  drawTufts(windT);
  flushShadows();
  applyShadows(bakedZ);
  shadeEdges();
  ctx.putImageData(image, 0, 0);
}

export function headScreen(index, state) {
  const at = state ? personAt(index, state) : seatPosition(index);
  const top = index === 6 ? 2.6 : at.walking ? 2.1 : 1.85;
  const p = project(at.x, at.y, top);
  return { sx: p.sx, sy: p.sy };
}
