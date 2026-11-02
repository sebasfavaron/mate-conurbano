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

/* ---------- per frame ---------- */
export function drawScene(state, t) {
  pix.set(bakedPix);
  zb.set(bakedZ);
  pendingShadows.length = 0;
  const windT = STILL ? 0 : Math.floor(t * WIND_FPS) / WIND_FPS;
  drawLeaves(windT);
  drawTufts(windT);
  flushShadows();
  applyShadows(bakedZ);
  shadeEdges();
  ctx.putImageData(image, 0, 0);
}

export function headScreen(index) {
  const { x, y } = seatPosition(index);
  const p = project(x, y, 2.0);
  return { sx: p.sx, sy: p.sy };
}
