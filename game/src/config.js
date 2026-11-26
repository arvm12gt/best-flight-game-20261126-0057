// DUSK RESCUE — Kestrel Valley: a bush-plane rescue run at golden hour.
// World constants, palette and the course. One job: the numbers everything else reads.
export const STEP = 1 / 60;
export const BEST_KEY = 'dusk-rescue-best';
export const WORLD = {
  seed: 20261126,
  // The valley runs along +Z. Start at z=-1400, Kestrel Field runway at z=5800.
  startX: 0,
  startY: 85,
  startZ: -1400,
  runwayZ: 5800,
  runwayLength: 420,
  runwayWidth: 34,
  runwayY: 8,
  // Town of Emberwick, west bank of the river, lights come on at dusk.
  townX: -270,
  townZ: 4200,
  townLights: 46,
};

// The rescue course: eight lit rings down the canyon, then the runway.
export const RINGS = [
  { x: 0, y: 95, z: -700, r: 26 },
  { x: 190, y: 115, z: 300, r: 26 },
  { x: -170, y: 135, z: 1300, r: 26 },
  { x: 130, y: 150, z: 2300, r: 26 },
  { x: -210, y: 140, z: 3300, r: 26 },
  { x: 70, y: 120, z: 4300, r: 26 },
  { x: -90, y: 100, z: 5000, r: 26 },
  { x: 0, y: 62, z: 5560, r: 26 },
];

export const LEGS = [
  { rings: [0, 1, 2], name: 'LEG 1 — CANYON RUN' },
  { rings: [3, 4, 5], name: 'LEG 2 — RIVER BEND' },
  { rings: [6, 7], name: 'LEG 3 — EMBERWICK APPROACH' },
];

// Flight tuning (arcade, forgiving, but throttle and turn discipline matter).
export const FLIGHT = {
  minSpeed: 28,
  maxSpeed: 98,
  cruiseSpeed: 62,
  maxRoll: 0.96, // ~55 deg
  maxPitch: 0.44, // ~25 deg
  rollRate: 2.4,
  pitchRate: 1.6,
  throttleRate: 0.55,
  turnAuthority: 0.62,
  climbAuthority: 1.0,
  sinkBelow: 34, // below this speed the plane sinks
  fuelDrain: 0.42, // per second at full throttle
  fuelStart: 100,
  ringScore: 100,
  landingBonus: 500,
  timeBonusRate: 4, // per second under par
  parTime: 150,
  crashDescent: 9, // landing descent faster than this is a crash
  landSpeedMax: 72,
};

export const PALETTE = {
  skyTop: '#191d38',
  skyMid: '#4b2c58',
  skyLow: '#b4502e',
  horizon: '#f7a94b',
  sun: '#ffd27a',
  sunCore: '#fff3c4',
  rockDark: '#4a3226',
  rock: '#6e4a36',
  rockLit: '#a4714e',
  valleyFloor: '#3d4a2c',
  valleyLit: '#6b7a42',
  river: '#2e5a74',
  riverGlint: '#f7a94b',
  ring: '#ffb347',
  ringCore: '#ffe9a8',
  townLight: '#ffc46b',
  runway: '#23232e',
  panel: '#14161f',
  panelEdge: '#2c3040',
  gaugeGreen: '#7ee787',
  gaugeAmber: '#ffb347',
  gaugeRed: '#ff6b5e',
  hudText: '#ffe9c4',
  hudDim: '#c9a37e',
};
