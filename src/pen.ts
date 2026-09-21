import type { Rng } from './rng.js';

export type Pt = readonly [number, number];

export interface Palette {
  /** Body colour. */
  base: string;
  /** Feature colour: eyes, mouth, outlines. */
  ink: string;
}

export interface ShapeOpts {
  /** Multiplier on the pen's wobble. Small shapes want less. */
  wobble?: number;
  /** Straight segments instead of a smooth curve. */
  sharp?: boolean;
}

export interface StrokeOpts extends ShapeOpts {
  width?: number;
  closed?: boolean;
}

/** Parts are drawn in a 64x64 space and scaled to the canvas. */
export const UNIT = 64;

/**
 * Draws shapes from point lists, nudging every point by a seeded random amount.
 * Drawing the same shape with two different rngs gives the two animation frames.
 */
export class Pen {
  constructor(
    readonly ctx: CanvasRenderingContext2D,
    readonly rng: Rng,
    readonly wobble: number,
    readonly palette: Palette,
  ) {}

  get ink(): string {
    return this.palette.ink;
  }

  get base(): string {
    return this.palette.base;
  }

  private jitter(pts: readonly Pt[], scale: number): Pt[] {
    const amp = this.wobble * scale;
    return pts.map(([x, y]) => [x + (this.rng() * 2 - 1) * amp, y + (this.rng() * 2 - 1) * amp]);
  }

  /** Catmull-Rom spline through the jittered points, or a polyline when sharp. */
  path(pts: readonly Pt[], closed: boolean, opts: ShapeOpts = {}): Path2D {
    const p = this.jitter(pts, opts.wobble ?? 1);
    const n = p.length;
    const path = new Path2D();
    if (n === 0) return path;
    path.moveTo(p[0]![0], p[0]![1]);

    if (opts.sharp) {
      for (let i = 1; i < n; i++) path.lineTo(p[i]![0], p[i]![1]);
      if (closed) path.closePath();
      return path;
    }

    const at = (i: number): Pt => (closed ? p[((i % n) + n) % n]! : p[Math.max(0, Math.min(n - 1, i))]!);
    const segments = closed ? n : n - 1;
    for (let i = 0; i < segments; i++) {
      const p0 = at(i - 1);
      const p1 = at(i);
      const p2 = at(i + 1);
      const p3 = at(i + 2);
      path.bezierCurveTo(
        p1[0] + (p2[0] - p0[0]) / 6,
        p1[1] + (p2[1] - p0[1]) / 6,
        p2[0] - (p3[0] - p1[0]) / 6,
        p2[1] - (p3[1] - p1[1]) / 6,
        p2[0],
        p2[1],
      );
    }
    if (closed) path.closePath();
    return path;
  }

  fill(pts: readonly Pt[], color: string = this.ink, opts: ShapeOpts = {}): void {
    this.ctx.fillStyle = color;
    this.ctx.fill(this.path(pts, true, opts));
  }

  stroke(pts: readonly Pt[], color: string = this.ink, opts: StrokeOpts = {}): void {
    const { ctx } = this;
    ctx.strokeStyle = color;
    ctx.lineWidth = opts.width ?? 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke(this.path(pts, opts.closed ?? false, opts));
  }

  /** Fill and outline the same jittered path. */
  shape(pts: readonly Pt[], fill: string, line: string, opts: StrokeOpts = {}): void {
    const { ctx } = this;
    const path = this.path(pts, true, opts);
    ctx.fillStyle = fill;
    ctx.fill(path);
    ctx.strokeStyle = line;
    ctx.lineWidth = opts.width ?? 1.6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke(path);
  }
}

export function ellipse(cx: number, cy: number, rx: number, ry = rx, n = 10): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return pts;
}
