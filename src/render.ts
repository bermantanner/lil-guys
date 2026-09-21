import { generate, type AvatarSpec } from './generate.js';
import { drawBase } from './parts/base.js';
import { findPart } from './parts/index.js';
import { CATEGORIES } from './parts/types.js';
import { Pen, UNIT, type Palette } from './pen.js';
import { rngFor } from './rng.js';

export interface RenderOptions {
  /** Displayed size in CSS pixels (square). */
  size?: number;
  /** Internal drawing size. Lower is chunkier. */
  resolution?: number;
  /** Jitter amount; 0 freezes the lines. */
  wobble?: number;
  /** Milliseconds per animation frame. */
  frameDuration?: number;
  palette?: Partial<Palette>;
  /** Defaults to devicePixelRatio. */
  pixelRatio?: number;
  /** Animate on mount. Always off when the OS asks for reduced motion. */
  animate?: boolean;
}

export const DEFAULTS = {
  size: 128,
  resolution: 64,
  wobble: 0.75,
  frameDuration: 300,
  palette: { base: '#111111', ink: '#ffffff' } satisfies Palette,
  animate: true,
} as const;

type Resolved = Required<Omit<RenderOptions, 'pixelRatio'>> & { palette: Palette; pixelRatio: number };

function resolve(opts: RenderOptions = {}): Resolved {
  return {
    ...DEFAULTS,
    ...opts,
    palette: { ...DEFAULTS.palette, ...opts.palette },
    pixelRatio: opts.pixelRatio ?? (typeof devicePixelRatio === 'number' ? devicePixelRatio : 1),
  };
}

/** One frame at internal resolution. Frames 0 and 1 differ only in jitter. */
export function renderFrame(spec: AvatarSpec, frame = 0, opts?: RenderOptions): HTMLCanvasElement {
  const o = resolve(opts);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = o.resolution;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');

  const rng = rngFor('frame', spec.seed, frame);
  const pen = new Pen(ctx, rng, o.wobble, o.palette);
  ctx.scale(o.resolution / UNIT, o.resolution / UNIT);
  // Whole-figure drift on top of the per-point jitter.
  ctx.translate((rng() * 2 - 1) * o.wobble * 0.6, (rng() * 2 - 1) * o.wobble * 0.6);

  findPart('hair', spec.hair)?.back?.(pen);
  drawBase(pen);
  for (const category of CATEGORIES) findPart(category, spec[category])?.draw?.(pen);
  return canvas;
}

/** Both frames, for compositing into your own canvas. */
export function renderFrames(spec: AvatarSpec, opts?: RenderOptions): [HTMLCanvasElement, HTMLCanvasElement] {
  return [renderFrame(spec, 0, opts), renderFrame(spec, 1, opts)];
}

function blit(target: HTMLCanvasElement, frame: HTMLCanvasElement, size: number, pixelRatio: number): void {
  const px = Math.round(size * pixelRatio);
  if (target.width !== px || target.height !== px) target.width = target.height = px;
  target.style.width = target.style.height = `${size}px`;
  target.style.imageRendering = 'pixelated';
  const ctx = target.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, px, px);
  ctx.drawImage(frame, 0, 0, px, px);
}

export interface Avatar {
  readonly canvas: HTMLCanvasElement;
  readonly spec: AvatarSpec;
  /** Swap in a different character, keeping the canvas. */
  setSpec(spec: AvatarSpec): void;
  /** Change size, palette, wobble... in place. */
  setOptions(opts: RenderOptions): void;
  play(): void;
  pause(): void;
  /** Stop animating and remove the canvas. */
  destroy(): void;
}

// One rAF loop drives every mounted avatar.
const running = new Set<AvatarImpl>();
let rafId = 0;

function loop(now: number): void {
  for (const a of running) a.tick(now);
  rafId = running.size ? requestAnimationFrame(loop) : 0;
}

const reducedMotion = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

class AvatarImpl implements Avatar {
  spec: AvatarSpec;
  private o: Resolved;
  private frames: [HTMLCanvasElement, HTMLCanvasElement];
  private frame = 0;
  private last = 0;

  constructor(
    readonly canvas: HTMLCanvasElement,
    spec: AvatarSpec,
    private opts: RenderOptions,
  ) {
    this.spec = spec;
    this.o = resolve(opts);
    this.frames = renderFrames(spec, this.o);
    this.show(0);
    if (this.o.animate) this.play();
  }

  private show(frame: number): void {
    this.frame = frame;
    blit(this.canvas, this.frames[frame]!, this.o.size, this.o.pixelRatio);
  }

  tick(now: number): void {
    if (now - this.last < this.o.frameDuration) return;
    this.last = now;
    this.show(this.frame ^ 1);
  }

  setSpec(spec: AvatarSpec): void {
    this.spec = spec;
    this.frames = renderFrames(spec, this.o);
    this.show(this.frame);
  }

  setOptions(opts: RenderOptions): void {
    this.opts = { ...this.opts, ...opts, palette: { ...this.opts.palette, ...opts.palette } };
    this.o = resolve(this.opts);
    this.setSpec(this.spec);
  }

  play(): void {
    if (reducedMotion()) return;
    running.add(this);
    if (!rafId) rafId = requestAnimationFrame(loop);
  }

  pause(): void {
    running.delete(this);
  }

  destroy(): void {
    this.pause();
    this.canvas.remove();
  }
}

/** Animated avatar in `target`: drawn on it if it's a canvas, otherwise a canvas is appended. */
export function mount(target: HTMLElement, spec: AvatarSpec = generate(), opts?: RenderOptions): Avatar {
  let canvas: HTMLCanvasElement;
  if (target instanceof HTMLCanvasElement) {
    canvas = target;
  } else {
    canvas = document.createElement('canvas');
    target.appendChild(canvas);
  }
  return new AvatarImpl(canvas, spec, opts ?? {});
}
