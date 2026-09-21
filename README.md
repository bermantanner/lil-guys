# lil-guys

Little wobbly cartoon heads. Pick a seed, get a character; no seed, get a random one.
Two frames drawn with slightly different jitter swap back and forth, so it "boils" like a
hand-drawn cartoon. No dependencies, transparent background, one canvas.

```
npm install github:bermantanner/lil-guys
```

```ts
import { mount } from 'lil-guys';

mount(document.querySelector('#avatar'), undefined, { size: 160 }); // new character every load
```

```ts
import { generate, mount } from 'lil-guys';

const spec = generate(player.seed); // same seed, same character on every client
mount(card, spec, { size: 64 });
```

## API

- `generate(seed?)` → `{ seed, hair, eyes, mouth, eyewear }`. Plain JSON, safe to send around.
- `mount(target, spec?, options?)` → `Avatar`. Draws on `target` if it's a canvas, otherwise appends one.
  - `avatar.setSpec(spec)` swap character · `avatar.setOptions({ palette })` recolour ·
    `play()` / `pause()` / `destroy()`
- `renderFrames(spec, options?)` → both frames as small canvases, for drawing into your own canvas.

Options (all optional):

| | default | |
|---|---|---|
| `size` | `128` | CSS pixels |
| `palette` | `{ base: '#111', ink: '#fff' }` | body colour, feature colour |
| `wobble` | `0.75` | `0` freezes the lines |
| `frameDuration` | `300` | ms per frame |
| `resolution` | `64` | drawing size; lower is chunkier |
| `animate` | `true` | off automatically for `prefers-reduced-motion` |

Everything is drawn in `base` or `ink`, so any palette works. On a dark page use something like
`{ base: '#fff', ink: '#111' }`.

## Parts

Every part is a file: `parts/<category>/<id>.json`. `npm run dev` gives you two pages for them:

- **/library.html** — everything, with live previews. Change weights (the % is the pick chance,
  0 = never picked), edit, delete.
- **/editor.html** — draw new parts with the mouse and watch them wobble as you go. The
  *simplify* slider is the important one: fewer points wobble like a hand redrawing the line,
  too many look like static. *Save to library* writes the file.

Changes rebuild `src/parts/bank.ts`, which is what the package ships, so after editing parts:
`npm run build` here, then update the package wherever it's used.

## Scripts

```
npm run dev      demo + editor + library on localhost:5173
npm run build    compile to dist/ (rebuilds the part bank first)
```
