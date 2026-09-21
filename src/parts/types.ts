import type { Pen, Pt } from '../pen.js';

export interface Part {
  id: string;
  /** Relative pick probability within its category. Default 1. */
  weight?: number;
  /** Drawn behind the body. */
  back?: (pen: Pen) => void;
  draw?: (pen: Pen) => void;
}

export type Category = 'hair' | 'eyes' | 'mouth' | 'eyewear';

/** Also the draw order. */
export const CATEGORIES: readonly Category[] = ['hair', 'eyes', 'mouth', 'eyewear'];

// Landmarks in the 64x64 space.
export const HEAD = { cx: 32, cy: 30, rx: 18, ry: 17 } as const;
export const EYE_L: Pt = [25, 28];
export const EYE_R: Pt = [39, 28];
export const MOUTH: Pt = [32, 39];
