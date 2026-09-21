export { generate, type AvatarSpec } from './generate.js';
export { mount, renderFrame, renderFrames, DEFAULTS, type Avatar, type RenderOptions } from './render.js';
export { parts, findPart, registerParts, removePart } from './parts/index.js';
export { partFromJSON, drawShape, type PartJSON, type ShapeJSON, type ColorRef } from './parts/json.js';
export { drawBase } from './parts/base.js';
export { CATEGORIES, HEAD, EYE_L, EYE_R, MOUTH, type Category, type Part } from './parts/types.js';
export { Pen, ellipse, UNIT, type Palette, type Pt, type ShapeOpts, type StrokeOpts } from './pen.js';
export { randomSeed } from './rng.js';
