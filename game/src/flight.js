// The flight model: an arcade bush plane with throttle, banked turns, fuel and damage.
// Pure step function: given controls it advances the plane by STEP seconds and reports events.
// No randomness here — the same controls from the same start always fly the same line.
import { FLIGHT, LEGS, RINGS, WORLD } from './config.js';
import { groundHeight, onRunway } from './terrain.js';

export const EVENT_RING = 1;
export const EVENT_CRASH = 2;
export const EVENT_LANDED = 4;
export const EVENT_LEG = 8;
export const EVENT_FUEL_EMPTY = 16;
export const EVENT_FUEL_LOW = 32;

export function createFlight() {
  return {
    x: WORLD.startX,
    y: WORLD.startY,
    z: WORLD.startZ,
    heading: 0, // 0 = due +Z (north up the valley)
    pitch: 0,
    roll: 0,
    speed: 55,
    throttle: 0.7,
    fuel: FLIGHT.fuelStart,
    score: 0,
    ringsHit: 0,
    time: 0,
    leg: 0,
    over: false,
    landed: false,
    crashReason: '',
    descentRate: 0,
    searchlight: false,
    fuelWarned: false,
    fuelEmptyAnnounced: false,
  };
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Advance one fixed step. `ctl` is { pitch: -1..1 (up positive), roll: -1..1 (right
 * positive), throttle: -1..1 (delta), brake: bool }. Returns an event bitmask.
 */
export function stepFlight(f, ctl, dt) {
  if (f.over) return 0;
  let events = 0;
  f.time += dt;

  // Throttle and speed: the plane chases the speed its throttle asks for.
  f.throttle = clamp(f.throttle + ctl.throttle * FLIGHT.throttleRate * dt, 0, 1);
  const targetSpeed = FLIGHT.minSpeed + (FLIGHT.maxSpeed - FLIGHT.minSpeed) * f.throttle;
  f.speed += (targetSpeed - f.speed) * Math.min(1, 0.55 * dt);
  if (ctl.brake) f.speed = Math.max(FLIGHT.minSpeed * 0.6, f.speed - 22 * dt);

  // Bank and pitch ease toward what the pilot asks for.
  const wantRoll = ctl.roll * FLIGHT.maxRoll;
  const wantPitch = ctl.pitch * FLIGHT.maxPitch;
  f.roll += (wantRoll - f.roll) * Math.min(1, FLIGHT.rollRate * dt);
  f.pitch += (wantPitch - f.pitch) * Math.min(1, FLIGHT.pitchRate * dt);

  // A banked turn: heading follows the bank, more so at speed.
  f.heading += Math.sin(f.roll) * FLIGHT.turnAuthority * (f.speed / FLIGHT.cruiseSpeed) * dt;

  // Climb from pitch, sink when slow; the valley punishes a lazy throttle hand.
  const climb = Math.sin(f.pitch) * f.speed * FLIGHT.climbAuthority;
  const sink = f.speed < FLIGHT.sinkBelow ? (FLIGHT.sinkBelow - f.speed) * 0.35 : 0;
  const prevY = f.y;
  f.y += (climb - sink) * dt;
  f.descentRate = (prevY - f.y) / dt;

  const fx = Math.sin(f.heading);
  const fz = Math.cos(f.heading);
  f.x += fx * f.speed * dt;
  f.z += fz * f.speed * dt;

  // Fuel: throttle drinks it; empty means glide, and a glide ends on the ground.
  if (f.fuel > 0) {
    f.fuel = Math.max(0, f.fuel - FLIGHT.fuelDrain * (0.25 + f.throttle) * dt);
    if (f.fuel <= 0) {
      events |= EVENT_FUEL_EMPTY;
      f.fuelEmptyAnnounced = true;
    } else if (f.fuel < 20 && !f.fuelWarned) {
      f.fuelWarned = true;
      events |= EVENT_FUEL_LOW;
    }
  }
  if (f.fuel <= 0) f.throttle = Math.max(0, f.throttle - 0.8 * dt);

  // Rings: pass within the ring's radius of its centre and it counts.
  const ring = RINGS[f.ringsHit];
  if (ring) {
    const dx = f.x - ring.x;
    const dy = f.y - ring.y;
    const dz = f.z - ring.z;
    if (dx * dx + dy * dy + dz * dz < ring.r * ring.r) {
      f.ringsHit += 1;
      f.score += FLIGHT.ringScore;
      events |= EVENT_RING;
      const leg = LEGS.findIndex((l) => l.rings[l.rings.length - 1] === f.ringsHit - 1);
      if (leg >= 0) {
        f.leg = Math.min(LEGS.length - 1, leg + 1);
        events |= EVENT_LEG;
      }
    }
  }

  // Ground: the runway forgives a gentle touchdown; everywhere else the valley wins.
  const ground = groundHeight(f.x, f.z);
  const runway = onRunway(f.x, f.z);
  const floorY = runway ? WORLD.runwayY : ground;
  if (f.y <= floorY + 1.2) {
    f.y = floorY + 1.2;
    if (
      runway &&
      f.speed <= FLIGHT.landSpeedMax &&
      f.descentRate <= FLIGHT.crashDescent &&
      Math.abs(f.roll) < 0.45 &&
      f.ringsHit >= RINGS.length
    ) {
      f.over = true;
      f.landed = true;
      const timeBonus = Math.max(0, Math.round((FLIGHT.parTime - f.time) * FLIGHT.timeBonusRate));
      f.score += FLIGHT.landingBonus + timeBonus;
      events |= EVENT_LANDED;
    } else if (runway && f.speed <= FLIGHT.landSpeedMax && f.descentRate <= FLIGHT.crashDescent && Math.abs(f.roll) < 0.45) {
      // A gentle runway touchdown before the rings are done: a bounce, not a landing.
      f.speed *= 0.55;
      f.pitch = 0.12;
      f.y = floorY + 3;
    } else {
      f.over = true;
      f.crashReason = runway
        ? 'Too fast or too steep for Kestrel Field.'
        : f.y < ground + 1.2
          ? 'Clipped the canyon wall.'
          : 'Hit the valley floor.';
      events |= EVENT_CRASH;
    }
  }
  return events;
}

/** Heading in degrees, 0 = north, for the compass tape. */
export function headingDeg(f) {
  let deg = ((f.heading * 180) / Math.PI) % 360;
  if (deg < 0) deg += 360;
  return deg;
}
