import { generate, mount, type Avatar, type AvatarSpec } from '../src/index.js';

const heroEl = document.querySelector<HTMLElement>('#hero')!;
const heroSpecEl = document.querySelector<HTMLElement>('#hero-spec')!;
const seedInput = document.querySelector<HTMLInputElement>('#seed')!;
const gridEl = document.querySelector<HTMLElement>('#grid')!;

const hero = mount(heroEl, generate(), { size: 256 });

function describe(spec: AvatarSpec): string {
  return (['hair', 'eyes', 'mouth', 'eyewear'] as const)
    .map((k) => `${k}: <code>${spec[k]}</code>`)
    .join('<br>');
}

function setHero(spec: AvatarSpec): void {
  hero.setSpec(spec);
  seedInput.value = spec.seed;
  heroSpecEl.innerHTML = `seed: <code>${spec.seed}</code><br>${describe(spec)}`;
}
setHero(hero.spec);

let gridAvatars: Avatar[] = [];
function reroll(): void {
  for (const a of gridAvatars) a.destroy();
  gridAvatars = [];
  for (let i = 0; i < 32; i++) {
    const a = mount(gridEl, generate(), { size: 128 });
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
