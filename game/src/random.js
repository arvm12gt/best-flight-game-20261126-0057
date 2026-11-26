// Small seeded PRNG (mulberry32) plus a pure 2D value-noise hash.
// The terrain height function is a pure function of (x, z): same input, same mountain,
// so screenshots and replays are deterministic without any stored state.
export function createRandom(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(ix, iz, seed) {
  let h = (ix * 374761393 + iz * 668265263 + seed * 974634211) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

/** Value noise in [0, 1], continuous, deterministic for a fixed seed. */
export function valueNoise(x, z, seed) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const a = hash2(ix, iz, seed);
  const b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed);
  const d = hash2(ix + 1, iz + 1, seed);
  const u = smooth(fx);
  const v = smooth(fz);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Fractal noise, 3 octaves, roughly [0, 1]. */
export function fbm(x, z, seed) {
  let sum = 0;
  let amp = 0.55;
  let freq = 1;
  for (let o = 0; o < 3; o += 1) {
    sum += amp * valueNoise(x * freq, z * freq, seed + o * 101);
    amp *= 0.5;
    freq *= 2.1;
  }
  return sum;
}
