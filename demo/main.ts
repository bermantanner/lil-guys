import { generate, mount, odds, type Avatar, type AvatarSpec } from '../src/index.js';
import { palettePicker } from './palette.js';

const heroEl = document.querySelector<HTMLElement>('#hero')!;
const heroSpecEl = document.querySelector<HTMLElement>('#hero-spec')!;
const seedInput = document.querySelector<HTMLInputElement>('#seed')!;
const gridEl = document.querySelector<HTMLElement>('#grid')!;

let gridAvatars: Avatar[] = [];
const palette = palettePicker(document.querySelector('#palette')!, (palette) => {
  for (const a of [hero, ...gridAvatars]) a.setOptions({ palette });
});

const hero = mount(heroEl, generate(), { size: 256, palette: palette() });

const pct = (p: number): string => `${(p * 100).toFixed(p < 0.1 ? 2 : 1)}%`;

function describe(spec: AvatarSpec): string {
  const o = odds(spec);
  const rows = (['hair', 'eyes', 'mouth', 'eyewear'] as const).map(
    (k) => `${k}: <code>${spec[k]}</code> <small>${pct(o.by[k])}</small>`,
  );
  return [...rows, `odds: <code>${pct(o.chance)}</code> <small>1 in ${o.oneIn.toLocaleString()}</small>`].join('<br>');
}

function setHero(spec: AvatarSpec): void {
  hero.setSpec(spec);
  seedInput.value = spec.seed;
  heroSpecEl.innerHTML = `seed: <code>${spec.seed}</code><br>${describe(spec)}`;
}
setHero(hero.spec);

function reroll(): void {
  for (const a of gridAvatars) a.destroy();
  gridAvatars = [];
  for (let i = 0; i < 32; i++) {
    const a = mount(gridEl, generate(), { size: 128, palette: palette() });
    a.canvas.addEventListener('click', () => setHero(a.spec));
    gridAvatars.push(a);
  }
}
reroll();

document.querySelector('#reroll')!.addEventListener('click', reroll);
document.querySelector('#load')!.addEventListener('click', () => setHero(generate(seedInput.value)));
seedInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') setHero(generate(seedInput.value));
});

// Library edits regenerate src/parts/bank.ts. Every page has to accept that update or Vite
// full-reloads all of them, which would wipe the editor mid-drawing. This page just reloads.
import.meta.hot?.accept('../src/index.js', () => location.reload());
