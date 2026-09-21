import { parts } from './parts/index.js';
import type { Category, Part } from './parts/types.js';
import { randomSeed, rngFor, type Rng } from './rng.js';

/** Which part was picked in each category. Plain JSON, fine to send over the wire. */
export interface AvatarSpec {
  seed: string;
  hair: string;
  eyes: string;
  mouth: string;
  eyewear: string;
}

function pick(rng: Rng, list: readonly Part[]): Part {
  const total = list.reduce((sum, p) => sum + (p.weight ?? 1), 0);
  let r = rng() * total;
  for (const p of list) {
    r -= p.weight ?? 1;
    if (r < 0) return p;
  }
  return list[list.length - 1]!;
}

/** Same seed, same spec. No seed, random. */
export function generate(seed: string | number = randomSeed()): AvatarSpec {
  const s = String(seed);
  const rng = rngFor('spec', s);
  const choose = (c: Category) => pick(rng, parts[c]).id;
  return { seed: s, hair: choose('hair'), eyes: choose('eyes'), mouth: choose('mouth'), eyewear: choose('eyewear') };
}
