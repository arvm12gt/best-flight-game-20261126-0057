// Staged screenshot scenes: the same autopilot a careful pilot would fly, steering for the
// next ring and then for the runway, simulated forward a fixed number of steps from a fresh
// world. The frame is what a real sortie looks like at that moment, and the same seed always
// gives the same frame. Times were tuned from the flight model (see node sim in the repo log).
import { RINGS, STEP, WORLD } from './config.js';
import { createFlight, stepFlight } from './flight.js';

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Steer for the next ring, or for the runway once the rings are done. */
function autopilot(f) {
  let target;
  let throttle = 0.35;
  let brake = false;
  if (f.ringsHit < RINGS.length) {
    target = RINGS[f.ringsHit];
  } else if (f.z < 5400) {
    // Line up on the valley centre, high enough to bleed speed before the field.
    target = { x: 0, y: 55, z: 5450 };
    throttle = -1;
    brake = f.speed > 55;
  } else {
    // Final: the runway threshold, gentle and slow.
    target = { x: 0, y: WORLD.runwayY + 3, z: WORLD.runwayZ };
    throttle = -1;
    brake = f.speed > 45;
  }
  const dx = target.x - f.x;
  const dz = target.z - f.z;
  const wantHeading = Math.atan2(dx, dz);
  let err = wantHeading - f.heading;
  while (err > Math.PI) err -= Math.PI * 2;
  while (err < -Math.PI) err += Math.PI * 2;
  // Near the target, cap the bank so the plane does not swing past it and turn back.
  const dist = Math.sqrt(dx * dx + dz * dz);
  const rollCap = dist < 350 ? 0.35 : 1;
  const roll = clamp(err * 1.4, -rollCap, rollCap);
  const altErr = target.y - f.y;
  const pitch = clamp(altErr * 0.03, -0.8, 0.8);
  return { pitch, roll, throttle, brake };
}

/** Run the autopilot for `seconds` and return the flight state at the freeze frame. */
function simulate(seconds) {
  const f = createFlight();
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (f.over) break;
    stepFlight(f, autopilot(f), STEP);
  }
  return f;
}

export const SHOTS = {
  // Banking left out of ring 2, canyon walls lit, ring 3 glowing ahead.
  cover: { seconds: 19, mode: 'chase' },
  // A breath from ring 4: the ring fills the frame as the plane threads it.
  ring: { seconds: 39, mode: 'chase' },
  // Final approach: low over the lit runway, Emberwick's lights, storm front behind.
  approach: { seconds: 78, mode: 'chase' },
  // Cockpit view: lit instruments, ring 7 ahead over the river.
  cockpit: { seconds: 62, mode: 'cockpit' },
};

/** Stage a named scene and return { flight, mode } for the renderer. */
export function stageShot(name) {
  const shot = SHOTS[name] || SHOTS.cover;
  const f = simulate(shot.seconds);
  // Chase camera: settle it behind the plane at the freeze frame.
  const fx = Math.sin(f.heading);
  const fz = Math.cos(f.heading);
  f.camX = f.x - fx * 44;
  f.camY = f.y + 7;
  f.camZ = f.z - fz * 44;
  return { flight: f, mode: shot.mode };
}
