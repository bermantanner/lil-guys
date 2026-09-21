import { DEFAULTS, type Palette } from '../src/index.js';

const KEY = 'lil-guys-palette';

function load(): Palette {
  try {
    return { ...DEFAULTS.palette, ...JSON.parse(sessionStorage.getItem(KEY) ?? '{}') };
  } catch {
    return { ...DEFAULTS.palette };
  }
}

/** Base/ink colour inputs in `container`. Remembered for the tab session, so every page shares them. */
export function palettePicker(container: HTMLElement, onChange: (palette: Palette) => void): () => Palette {
  let palette = load();
  container.innerHTML = `
    <span class="k">base</span><input type="color" name="base" />
    <span class="k">ink</span><input type="color" name="ink" />
    <button type="button">reset</button>`;
  const inputs = container.querySelectorAll('input');

  const show = (): void => {
    for (const el of inputs) el.value = palette[el.name as keyof Palette];
  };
  const set = (next: Palette): void => {
    palette = next;
    show();
    try {
      sessionStorage.setItem(KEY, JSON.stringify(palette));
    } catch {
      // fine without storage
    }
    onChange(palette);
  };

  for (const el of inputs) el.addEventListener('input', () => set({ ...palette, [el.name]: el.value }));
  container.querySelector('button')!.addEventListener('click', () => set({ ...DEFAULTS.palette }));
  show();
  return () => palette;
}
