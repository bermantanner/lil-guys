import type { AvatarSpec } from './generate.js';
import { parts } from './parts/index.js';
import { CATEGORIES, weight, type Category } from './parts/types.js';

export interface Odds {
  /** Probability of this exact combination, 0–1. */
  chance: number;
  /** The same thing as "1 in N". */
  oneIn: number;
  /** Chance of each picked part within its category. */
  by: Record<Category, number>;
}

/** How likely `generate()` is to roll this exact spec with the current parts and weights. */
export function odds(spec: AvatarSpec): Odds {
  const by = {} as Record<Category, number>;
  let chance = 1;
  for (const c of CATEGORIES) {
    const list = parts[c];
    const total = list.reduce((sum, p) => sum + weight(p), 0);
    const part = list.find((p) => p.id === spec[c]);
    by[c] = part && total ? weight(part) / total : 0;
    chance *= by[c];
  }
  return { chance, oneIn: chance ? Math.round(1 / chance) : Infinity, by };
}
