import { bank } from './bank.js';
import { partFromJSON, type PartJSON } from './json.js';
import type { Category, Part } from './types.js';

/** Everything the randomizer can pick from. Mutable, so apps can adjust it at runtime. */
export const parts: Record<Category, Part[]> = { hair: [], eyes: [], mouth: [], eyewear: [] };

export function findPart(category: Category, id: string): Part | undefined {
  return parts[category].find((p) => p.id === id);
}

/** Add parts; one with the same id and category replaces the existing one. */
export function registerParts(list: readonly PartJSON[]): void {
  for (const json of list) {
    const bucket = parts[json.category];
    const part = partFromJSON(json);
    const i = bucket.findIndex((p) => p.id === json.id);
    if (i >= 0) bucket[i] = part;
    else bucket.push(part);
  }
}

export function removePart(category: Category, id: string): boolean {
  const bucket = parts[category];
  const i = bucket.findIndex((p) => p.id === id);
  if (i < 0) return false;
  bucket.splice(i, 1);
  return true;
}

registerParts(bank);
