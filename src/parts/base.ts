import { ellipse, type Pen } from '../pen.js';
import { HEAD } from './types.js';

/** Head and neck. The neck runs off the bottom edge. */
export function drawBase(pen: Pen): void {
  pen.fill([[26, 44], [38, 44], [40, 68], [24, 68]], pen.base);
  pen.fill(ellipse(HEAD.cx, HEAD.cy, HEAD.rx, HEAD.ry, 14), pen.base);
}
