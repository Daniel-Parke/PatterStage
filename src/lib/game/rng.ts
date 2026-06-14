// Tiny deterministic PRNG (mulberry32) + a string→seed hash (xmur3). Pure and
// seedable so gacha pulls and battle sims are reproducible in tests and can be
// replayed from a seed; production seeds with crypto/time.

export function hashSeed(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

/** Returns a function yielding floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed: string | number): () => number {
  return mulberry32(typeof seed === "string" ? hashSeed(seed) : seed >>> 0);
}

/** A non-deterministic seed string for production pulls. */
export function randomSeed(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
