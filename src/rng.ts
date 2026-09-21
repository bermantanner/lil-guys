// Everything about an avatar derives from its seed string.

export type Rng = () => number; // uniform in [0, 1)

/** 32-bit string hash (xmur3). */
export function hashString(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

/** mulberry32. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** An rng keyed on any values, e.g. rngFor("frame", seed, 1). */
export function rngFor(...keys: (string | number)[]): Rng {
  return createRng(hashString(keys.join('|')));
}

export function randomSeed(): string {
  return Math.random().toString(36).slice(2, 10);
}
