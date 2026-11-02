// Ambient life that does not affect the score: the patio dog and the birds. Pure and Node-safe;
// main.js turns its cues into sounds and the scene draws the dog.
export const DOG_HOME = { x: 6.6, y: -3.7 }, DOG_FENCE = { x: 1.9, y: -4.2 };
const DOG_SPEED = 3.2;

export function createAmbience(random = Math.random) {
  const between = (a, b) => a + (b - a) * random();
  const dog = { x: DOG_HOME.x, y: DOG_HOME.y, yaw: Math.PI * .8, mode: 'lie', target: null, nextBark: between(12, 30), barkAt: -9, wagUntil: -9 };
  let clock = 0, nextBird = between(10, 25);

  function bark(cues, n = 2) {
    dog.barkAt = clock;
    for (let k = 0; k < n; k++) cues.push({ type: 'bark', delay: k * .32, x: dog.x, y: dog.y });
  }
  function runTo(spot, then) { dog.mode = 'run'; dog.target = { ...spot, then }; }

  return {
    dog,
    update(state, dt, events = []) {
      const cues = [];
      clock += dt;
      const truck = state.truck.active;
      for (const e of events) {
        if (e.type === 'truckEnter') runTo(DOG_FENCE, 'guard');
        if (e.type === 'handoff' && e.good) dog.wagUntil = clock + 1.5;
      }
      if (dog.mode === 'run') {
        const dx = dog.target.x - dog.x, dy = dog.target.y - dog.y, d = Math.hypot(dx, dy);
        dog.yaw = Math.atan2(dy, dx);
        if (d < DOG_SPEED * dt) {
          dog.x = dog.target.x; dog.y = dog.target.y; dog.mode = dog.target.then;
          dog.yaw = dog.mode === 'guard' ? -Math.PI / 2 : Math.PI * .8;
          dog.nextBark = dog.mode === 'guard' ? .2 : between(25, 60);
        } else { dog.x += dx / d * DOG_SPEED * dt; dog.y += dy / d * DOG_SPEED * dt; }
      } else if (dog.mode === 'guard') {
        if (!truck) runTo(DOG_HOME, 'lie');
        else if ((dog.nextBark -= dt) <= 0) { bark(cues, 2); dog.nextBark = between(1.3, 2.4); }
      } else if (dog.mode === 'lie' && state.phase !== 'over') {
        if (truck) runTo(DOG_FENCE, 'guard');
        else if ((dog.nextBark -= dt) <= 0) { bark(cues, 1 + Math.floor(random() * 2)); dog.nextBark = between(30, 75); }
      }
      if ((nextBird -= dt) <= 0 && !truck) { cues.push({ type: 'bird', pan: between(-.8, .8) }); nextBird = between(20, 45); }
      return cues;
    },
  };
}
