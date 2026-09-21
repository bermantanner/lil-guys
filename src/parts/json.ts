import type { Pen } from '../pen.js';
import type { Category, Part } from './types.js';

export type ColorRef = 'ink' | 'base';

/** One drawing call: Pen.fill, Pen.stroke or Pen.shape (fill + outline). */
export interface ShapeJSON {
  kind: 'fill' | 'stroke' | 'shape';
  points: [number, number][];
  /** Fill colour for fill/shape, line colour for stroke. */
  color?: ColorRef;
  /** Outline colour, shape only. */
  line?: ColorRef;
  width?: number;
  /** Stroke only: join the last point back to the first. */
  closed?: boolean;
  sharp?: boolean;
  wobble?: number;
}

/** What lives in parts/<category>/<id>.json. */
export interface PartJSON {
  id: string;
  category: Category;
  weight?: number;
  front?: ShapeJSON[];
  /** Drawn behind the body: long hair, scarves. */
  back?: ShapeJSON[];
}

const color = (pen: Pen, ref: ColorRef | undefined, fallback: ColorRef): string =>
  (ref ?? fallback) === 'ink' ? pen.ink : pen.base;

export function drawShape(pen: Pen, s: ShapeJSON): void {
  const opts = { wobble: s.wobble, sharp: s.sharp, width: s.width };
  if (s.kind === 'fill') pen.fill(s.points, color(pen, s.color, 'ink'), opts);
  else if (s.kind === 'stroke') pen.stroke(s.points, color(pen, s.color, 'ink'), { ...opts, closed: s.closed });
  else pen.shape(s.points, color(pen, s.color, 'base'), color(pen, s.line, 'ink'), opts);
}

export function partFromJSON(json: PartJSON): Part {
  const part: Part = { id: json.id, weight: json.weight };
  const { front, back } = json;
  if (front?.length) part.draw = (pen) => front.forEach((s) => drawShape(pen, s));
  if (back?.length) part.back = (pen) => back.forEach((s) => drawShape(pen, s));
  return part;
}
