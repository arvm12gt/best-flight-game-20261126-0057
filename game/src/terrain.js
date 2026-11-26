// Kestrel Valley terrain: a pure function of (x, z), so the world is identical every run.
// A river valley runs along +Z; canyon walls rise on both banks; Emberwick town sits on the
// west bank; Kestrel Field's lit runway waits at the valley's end.
import { WORLD } from './config.js';
import { createRandom, fbm, valueNoise } from './random.js';

/** The river meanders down the valley floor. */
export function riverX(z) {
  return 120 * Math.sin(z * 0.00055) + 40 * Math.sin(z * 0.0016 + 1.7);
}

/** Height of the ground in metres at (x, z). */
export function groundHeight(x, z) {
  const seed = WORLD.seed;
  const dist = Math.abs(x - riverX(z));
  // Valley floor: gentle undulation, lowest near the river.
  const floor = 4 + 6 * fbm(x * 0.004, z * 0.004, seed);
  // Canyon walls: rise steeply beyond ~420 m from the river, up to ~440 m, with
  // enough relief that the wall tops read as ridges, not a flat desert.
  const wallT = Math.min(1, Math.max(0, (dist - 420) / 700));
  const wall = wallT * wallT * (280 + 160 * fbm(x * 0.002 + 7, z * 0.002, seed + 5));
  // Ridges along the valley add long swells the pilot must read, not just walls.
  const ridge = 26 * valueNoise(x * 0.0012, z * 0.0012, seed + 11);
  return floor + wall + ridge * wallT;
}

/** True when (x, z) is on the runway strip. */
export function onRunway(x, z) {
  return (
    Math.abs(x) <= WORLD.runwayWidth / 2 &&
    z >= WORLD.runwayZ - WORLD.runwayLength / 2 &&
    z <= WORLD.runwayZ + WORLD.runwayLength / 2
  );
}

/** Emberwick's window lights: fixed positions, amber, scattered along the west bank. */
export function townLights() {
  const rand = createRandom(WORLD.seed + 77);
  const lights = [];
  for (let i = 0; i < WORLD.townLights; i += 1) {
    const x = WORLD.townX + (rand() - 0.5) * 260;
    const z = WORLD.townZ + (rand() - 0.5) * 420;
    const y = groundHeight(x, z) + 3 + rand() * 4;
    lights.push({ x, y, z, s: 0.7 + rand() * 0.9 });
  }
  return lights;
}

/** Runway edge lights, alternating amber, plus green threshold bars at both ends. */
export function runwayLights() {
  const lights = [];
  const half = WORLD.runwayLength / 2;
  for (let z = WORLD.runwayZ - half; z <= WORLD.runwayZ + half; z += 60) {
    lights.push({ x: -WORLD.runwayWidth / 2 - 3, y: WORLD.runwayY + 1, z, color: '#ffc46b' });
    lights.push({ x: WORLD.runwayWidth / 2 + 3, y: WORLD.runwayY + 1, z, color: '#ffc46b' });
  }
  for (let x = -14; x <= 14; x += 7) {
    lights.push({ x, y: WORLD.runwayY + 1, z: WORLD.runwayZ - half + 4, color: '#7ee787' });
    lights.push({ x, y: WORLD.runwayY + 1, z: WORLD.runwayZ + half - 4, color: '#ff6b5e' });
  }
  return lights;
}
