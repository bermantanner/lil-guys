import {
  CATEGORIES,
  mount,
  parts,
  registerParts,
  type Avatar,
  type AvatarSpec,
  type Category,
  type PartJSON,
} from '../src/index.js';

const NEUTRAL: Record<Category, string> = { hair: 'none', eyes: 'round', mouth: 'smile', eyewear: 'none' };
const libEl = document.querySelector<HTMLElement>('#lib')!;
const statusEl = document.querySelector<HTMLElement>('#status')!;
let mounted: Avatar[] = [];

async function api(method: 'PUT' | 'DELETE', part: PartJSON): Promise<boolean> {
  const res = await fetch(`/__parts/${part.category}/${part.id}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: method === 'PUT' ? JSON.stringify(part) : undefined,
  });
  if (!res.ok) {
    const { error } = (await res.json()) as { error: string };
    statusEl.textContent = `${method} ${part.category}/${part.id} failed: ${error}`;
  }
  return res.ok;
}

function card(part: PartJSON, total: number): HTMLElement {
  const fig = document.createElement('figure');
  fig.className = 'card';

  const spec: AvatarSpec = { seed: `lib-${part.category}-${part.id}`, ...NEUTRAL, [part.category]: part.id };
  mounted.push(mount(fig, spec, { size: 96 }));

  const cap = document.createElement('figcaption');
  cap.innerHTML = `<div class="id">${part.id}</div>`;

  const weightRow = document.createElement('div');
  weightRow.className = 'row';
  const weight = document.createElement('input');
  weight.type = 'number';
  weight.min = '0';
  weight.step = '0.5';
  weight.value = String(part.weight ?? 1);
  const pct = document.createElement('span');
  pct.className = 'pct';
  pct.textContent = total ? `${(((part.weight ?? 1) / total) * 100).toFixed(1)}%` : '–';
  weight.addEventListener('change', async () => {
    if (await api('PUT', { ...part, weight: Math.max(0, +weight.value || 0) })) await refresh();
  });
  weightRow.append('weight', weight, pct);

  const actions = document.createElement('div');
  actions.className = 'row';
  const edit = document.createElement('a');
  edit.href = `./editor.html?open=${part.category}/${part.id}`;
  edit.textContent = 'edit';
  const del = document.createElement('button');
  del.className = 'danger';
  del.textContent = 'delete';
  let disarm: number | undefined;
  del.addEventListener('click', async () => {
    // First click arms, second deletes.
    if (!del.classList.contains('armed')) {
      del.classList.add('armed');
      del.textContent = 'really?';
      disarm = window.setTimeout(() => {
        del.classList.remove('armed');
        del.textContent = 'delete';
      }, 3000);
      return;
    }
    clearTimeout(disarm);
    fig.classList.add('gone');
    if (await api('DELETE', part)) {
      statusEl.textContent = `deleted parts/${part.category}/${part.id}.json`;
      await refresh();
    } else {
      fig.classList.remove('gone');
    }
  });
  actions.append(edit, del);

  cap.append(weightRow, actions);
  fig.appendChild(cap);
  return fig;
}

async function refresh(): Promise<void> {
  const list = (await (await fetch('/__parts')).json()) as PartJSON[];

  // Make this page's bank match the files exactly.
  for (const c of CATEGORIES) parts[c].length = 0;
  registerParts(list);

  for (const a of mounted) a.destroy();
  mounted = [];
  libEl.replaceChildren();

  for (const c of CATEGORIES) {
    const group = list.filter((p) => p.category === c);
    const total = group.reduce((sum, p) => sum + (p.weight ?? 1), 0);
    const h = document.createElement('h2');
    h.innerHTML = `${c} <small>· ${group.length}</small><a href="./editor.html?category=${c}">+ new</a>`;
    const grid = document.createElement('div');
    grid.className = 'grid';
    for (const p of group) grid.appendChild(card(p, total));
    libEl.append(h, grid);
  }
}

// Edits regenerate src/parts/bank.ts; take the update here instead of reloading.
import.meta.hot?.accept('../src/index.js', () => void refresh());

void refresh();
