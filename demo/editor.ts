import {
  CATEGORIES,
  EYE_L,
  EYE_R,
  MOUTH,
  UNIT,
  Pen,
  drawBase,
  drawShape,
  findPart,
  generate,
  mount,
  partFromJSON,
  parts,
  type Avatar,
  type AvatarSpec,
  type Category,
  type Part,
  type PartJSON,
  type Pt,
  type ShapeJSON,
} from '../src/index.js';

type Layer = 'front' | 'back';
type Tool = ShapeJSON['kind'];

interface EditorShape {
  kind: Tool;
  /** For 'shape' this is the fill; the outline gets the other colour. */
  color: 'ink' | 'base';
  layer: Layer;
  width: number;
  closed: boolean;
  sharp: boolean;
  wobble: number;
  points: Pt[];
  /** The mouse path, kept so the simplify slider can re-run. */
  raw?: Pt[];
}

const ID_RE = /^[a-z0-9][a-z0-9_-]*$/i;
const SESSION_KEY = 'avatar-editor';
const NEUTRAL: Record<Category, string> = { hair: 'none', eyes: 'round', mouth: 'smile', eyewear: 'none' };

const $ = <T extends HTMLElement = HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;

let shapes: EditorShape[] = [];
let selected = -1;
let inProgress: EditorShape | null = null;
let drag: { shape: EditorShape; vertex: number } | null = null;
const undoStack: EditorShape[][] = [];
let library: PartJSON[] = [];

// The part being edited lives in the bank under this id so the previews can use it.
const EDITING = '__editing';
const editing: Part = { id: EDITING, weight: 0 };
for (const c of CATEGORIES) parts[c].unshift(editing);

const categoryEl = $<HTMLSelectElement>('#category');
const idEl = $<HTMLInputElement>('#id');
const weightEl = $<HTMLInputElement>('#weight');
const openEl = $<HTMLSelectElement>('#open');
const statusEl = $('#status');
const widthEl = $<HTMLInputElement>('#width');
const wobbleEl = $<HTMLInputElement>('#wobble');
const simplifyEl = $<HTMLInputElement>('#simplify');
const closedEl = $<HTMLInputElement>('#closed');
const sharpEl = $<HTMLInputElement>('#sharp');
const listEl = $('#shapes');

const category = (): Category => categoryEl.value as Category;
const radio = (name: string): string => $<HTMLInputElement>(`input[name=${name}]:checked`).value;
const setRadio = (name: string, value: string): void => {
  $<HTMLInputElement>(`input[name=${name}][value=${value}]`).checked = true;
};

function readProps(): Omit<EditorShape, 'points' | 'raw'> {
  return {
    kind: radio('tool') as Tool,
    color: radio('color') as 'ink' | 'base',
    layer: radio('layer') as Layer,
    width: +widthEl.value,
    closed: closedEl.checked,
    sharp: sharpEl.checked,
    wobble: +wobbleEl.value,
  };
}

function writeProps(s: EditorShape): void {
  setRadio('tool', s.kind);
  setRadio('color', s.color);
  setRadio('layer', s.layer);
  widthEl.value = String(s.width);
  wobbleEl.value = String(s.wobble);
  closedEl.checked = s.closed;
  sharpEl.checked = s.sharp;
  updateOutputs();
}

function updateOutputs(): void {
  for (const el of [widthEl, wobbleEl, simplifyEl]) $(`#${el.id}-out`).textContent = el.value;
}

function status(msg: string, error = false): void {
  statusEl.textContent = msg;
  statusEl.classList.toggle('error', error);
}

// Simplification (Ramer–Douglas–Peucker)

function perpDist(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

function rdp(pts: readonly Pt[], eps: number): Pt[] {
  if (pts.length < 3) return [...pts];
  const a = pts[0]!;
  const b = pts[pts.length - 1]!;
  let maxD = 0;
  let idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = perpDist(pts[i]!, a, b);
    if (d > maxD) {
      maxD = d;
      idx = i;
    }
  }
  if (maxD <= eps) return [a, b];
  return [...rdp(pts.slice(0, idx + 1), eps).slice(0, -1), ...rdp(pts.slice(idx), eps)];
}

const isLoop = (s: { kind: Tool; closed: boolean }): boolean => s.kind !== 'stroke' || s.closed;

function simplify(raw: readonly Pt[], loop: boolean): Pt[] {
  const eps = +simplifyEl.value;
  let pts = rdp(raw, eps);
  // A loop drawn back to its start would get a tiny closing segment; drop the duplicate end.
  if (loop && pts.length > 3) {
    const a = pts[0]!;
    const z = pts[pts.length - 1]!;
    if (Math.hypot(a[0] - z[0], a[1] - z[1]) < Math.max(2, eps * 2)) pts = pts.slice(0, -1);
  }
  return pts;
}

// JSON

const r1 = (v: number): number => Math.round(v * 10) / 10;

function shapeJSON(s: EditorShape): ShapeJSON {
  const j: ShapeJSON = { kind: s.kind, color: s.color, points: s.points.map(([x, y]) => [r1(x), r1(y)]) };
  if (s.kind === 'shape') j.line = s.color === 'ink' ? 'base' : 'ink';
  if (s.kind !== 'fill') j.width = s.width;
  if (s.kind === 'stroke' && s.closed) j.closed = true;
  if (s.sharp) j.sharp = true;
  if (s.wobble !== 1) j.wobble = s.wobble;
  return j;
}

function visible(): EditorShape[] {
  return inProgress ? [...shapes, inProgress] : shapes;
}

function toJSON(includeInProgress = false): PartJSON {
  const all = includeInProgress ? visible() : shapes;
  const json: PartJSON = {
    id: idEl.value.trim() || 'untitled',
    category: category(),
    weight: +weightEl.value || 1,
    front: all.filter((s) => s.layer === 'front').map(shapeJSON),
  };
  const back = all.filter((s) => s.layer === 'back').map(shapeJSON);
  if (back.length) json.back = back;
  return json;
}

function load(json: PartJSON): void {
  pushUndo();
  idEl.value = json.id;
  categoryEl.value = json.category;
  weightEl.value = String(json.weight ?? 1);
  const from = (list: ShapeJSON[] | undefined, layer: Layer): EditorShape[] =>
    (list ?? []).map((j) => ({
      kind: j.kind,
      layer,
      color: j.color ?? (j.kind === 'shape' ? 'base' : 'ink'),
      width: j.width ?? (j.kind === 'shape' ? 1.6 : 2),
      closed: !!j.closed,
      sharp: !!j.sharp,
      wobble: j.wobble ?? 1,
      points: j.points.map(([x, y]) => [x, y]),
    }));
  shapes = [...from(json.back, 'back'), ...from(json.front, 'front')];
  onCategoryChange();
  select(-1);
  render();
}

// Board

const board = $<HTMLCanvasElement>('#board');
const BOARD = 512;
const dpr = devicePixelRatio || 1;
board.width = board.height = BOARD * dpr;
board.style.width = board.style.height = `${BOARD}px`;
const bctx = board.getContext('2d')!;
const S = (BOARD * dpr) / UNIT;

const GHOST = { base: '#dedad1', ink: '#c4bfb3' };
const BOARD_PALETTE = { base: '#1a1a1a', ink: '#2f6fed' };

function drawBoard(): void {
  bctx.setTransform(1, 0, 0, 1, 0, 0);
  bctx.clearRect(0, 0, board.width, board.height);
  bctx.scale(S, S);

  const line = (x1: number, y1: number, x2: number, y2: number): void => {
    bctx.beginPath();
    bctx.moveTo(x1, y1);
    bctx.lineTo(x2, y2);
    bctx.stroke();
  };

  bctx.strokeStyle = '#ede9df';
  bctx.lineWidth = 1 / S;
  for (let i = 0; i <= UNIT; i += 4) {
    line(i, 0, i, UNIT);
    line(0, i, UNIT, i);
  }

  const still = () => 0.5;
  const pen = new Pen(bctx, still, 0, BOARD_PALETTE);
  const ghost = new Pen(bctx, still, 0, GHOST);
  const vis = visible();

  for (const s of vis) if (s.layer === 'back') drawShape(pen, shapeJSON(s));
  drawBase(ghost);
  for (const c of CATEGORIES) if (c !== category()) findPart(c, NEUTRAL[c])?.draw?.(ghost);
  for (const s of vis) if (s.layer === 'front') drawShape(pen, shapeJSON(s));

  bctx.strokeStyle = '#a9c4ff';
  bctx.lineWidth = 2 / S;
  for (const [x, y] of [EYE_L, EYE_R, MOUTH]) {
    line(x - 1, y, x + 1, y);
    line(x, y - 1, x, y + 1);
  }

  if (inProgress?.raw) {
    bctx.strokeStyle = '#c8c3b8';
    bctx.lineWidth = 2 / S;
    bctx.beginPath();
    inProgress.raw.forEach(([x, y], i) => (i ? bctx.lineTo(x, y) : bctx.moveTo(x, y)));
    bctx.stroke();
  }

  const sel = shapes[selected];
  if (sel) {
    bctx.fillStyle = '#fff';
    bctx.strokeStyle = BOARD_PALETTE.ink;
    bctx.lineWidth = 2 / S;
    for (const [x, y] of sel.points) {
      bctx.beginPath();
      bctx.arc(x, y, 0.9, 0, Math.PI * 2);
      bctx.fill();
      bctx.stroke();
    }
  }
}

// Previews

const heroSpec = (): AvatarSpec => ({ seed: 'editor', ...NEUTRAL, [category()]: EDITING });
const hero = mount($('#preview-hero'), heroSpec(), { size: 256 });
let contexts: Avatar[] = [];

const currentPalette = () => ({
  base: $<HTMLInputElement>('#base-color').value,
  ink: $<HTMLInputElement>('#ink-color').value,
});

function rerollContexts(): void {
  for (const a of contexts) a.destroy();
  const palette = currentPalette();
  contexts = Array.from({ length: 4 }, () =>
    mount($('#preview-ctx'), { ...generate(), [category()]: EDITING }, { size: 96, palette }),
  );
}

function refreshPreviews(): void {
  const p = partFromJSON(toJSON(true));
  editing.draw = p.draw;
  editing.back = p.back;
  hero.setSpec(heroSpec());
  for (const a of contexts) a.setSpec(a.spec);
}

// Editing

function pushUndo(): void {
  undoStack.push(structuredClone(shapes));
  if (undoStack.length > 50) undoStack.shift();
}

function undo(): void {
  const prev = undoStack.pop();
  if (!prev) return;
  shapes = prev;
  select(-1);
  render();
}

function select(i: number): void {
  selected = i;
  const s = shapes[i];
  if (s) writeProps(s);
  renderList();
  drawBoard();
}

function deleteSelected(): void {
  if (!shapes[selected]) return;
  pushUndo();
  shapes.splice(selected, 1);
  select(-1);
  render();
}

function newPart(cat: Category = category()): void {
  pushUndo();
  shapes = [];
  idEl.value = 'untitled';
  weightEl.value = '1';
  categoryEl.value = cat;
  status('');
  onCategoryChange();
  select(-1);
  render();
}

function onCategoryChange(): void {
  rerollContexts();
  render();
}

let queued = false;
function render(): void {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    drawBoard();
    refreshPreviews();
    persist();
  });
}

function renderList(): void {
  listEl.replaceChildren(
    ...shapes.map((s, i) => {
      const li = document.createElement('li');
      li.classList.toggle('selected', i === selected);
      const label = document.createElement('span');
      label.textContent = `${i + 1}. ${s.kind} · ${s.color} · ${s.layer} · ${s.points.length} pts`;
      const del = document.createElement('button');
      del.textContent = '×';
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        selected = i;
        deleteSelected();
      });
      li.append(label, del);
      li.addEventListener('click', () => select(i));
      return li;
    }),
  );
}

// Work in progress survives a refresh.

function persist(): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...toJSON(), shapes }));
  } catch {
    // no storage, no problem
  }
}

function restore(): void {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as PartJSON & { shapes: EditorShape[] };
    idEl.value = saved.id;
    categoryEl.value = saved.category;
    weightEl.value = String(saved.weight ?? 1);
    shapes = saved.shapes;
  } catch {
    // ignore a bad session
  }
}

// Library (the dev server's /__parts API)

async function refreshLibrary(): Promise<void> {
  const res = await fetch('/__parts');
  library = (await res.json()) as PartJSON[];
  openEl.replaceChildren(new Option('from library…', ''));
  for (const c of CATEGORIES) {
    const group = document.createElement('optgroup');
    group.label = c;
    for (const p of library) {
      if (p.category === c && p.id !== 'none') group.appendChild(new Option(p.id, `${c}/${p.id}`));
    }
    openEl.appendChild(group);
  }
}

async function save(): Promise<void> {
  const json = toJSON();
  if (!ID_RE.test(json.id)) return status('id: letters, digits, - and _ only', true);
  const res = await fetch(`/__parts/${json.category}/${json.id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(json),
  });
  if (!res.ok) {
    const { error } = (await res.json()) as { error: string };
    return status(`save failed: ${error}`, true);
  }
  status(`saved parts/${json.category}/${json.id}.json`);
  await refreshLibrary();
}

function open(key: string): void {
  const part = library.find((p) => `${p.category}/${p.id}` === key);
  if (!part) return status(`no part ${key} in the library`, true);
  load(part);
  status(`opened parts/${part.category}/${part.id}.json`);
}

// Pointer input

function toUnit(e: PointerEvent): Pt {
  const r = board.getBoundingClientRect();
  return [((e.clientX - r.left) / r.width) * UNIT, ((e.clientY - r.top) / r.height) * UNIT];
}

board.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  board.setPointerCapture(e.pointerId);
  const p = toUnit(e);

  const sel = shapes[selected];
  if (sel) {
    let best = -1;
    let bestD = 1.2;
    sel.points.forEach(([x, y], i) => {
      const d = Math.hypot(x - p[0], y - p[1]);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    if (best >= 0) {
      pushUndo();
      drag = { shape: sel, vertex: best };
      return;
    }
  }

  select(-1);
  inProgress = { ...readProps(), points: [p], raw: [p] };
  render();
});

board.addEventListener('pointermove', (e) => {
  if (drag) {
    drag.shape.points[drag.vertex] = toUnit(e);
    render();
    return;
  }
  if (!inProgress?.raw) return;
  const p = toUnit(e);
  const last = inProgress.raw[inProgress.raw.length - 1]!;
  if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.25) return;
  inProgress.raw.push(p);
  inProgress.points = simplify(inProgress.raw, isLoop(inProgress));
  render();
});

function finish(): void {
  if (drag) {
    drag = null;
    renderList();
    return;
  }
  if (!inProgress) return;
  const s = inProgress;
  inProgress = null;
  const min = s.kind === 'stroke' ? 2 : 3;
  if (s.points.length >= min) {
    pushUndo();
    shapes.push(s);
    select(shapes.length - 1);
  }
  render();
}
board.addEventListener('pointerup', finish);
board.addEventListener('pointercancel', finish);

// Wiring

for (const el of document.querySelectorAll<HTMLInputElement>('#props input')) {
  el.addEventListener('input', () => {
    updateOutputs();
    const s = shapes[selected];
    if (!s) return;
    Object.assign(s, readProps());
    if (s.raw) s.points = simplify(s.raw, isLoop(s));
    render();
    renderList();
  });
}

for (const el of [idEl, weightEl]) el.addEventListener('input', render);
categoryEl.addEventListener('change', onCategoryChange);

openEl.addEventListener('change', () => {
  open(openEl.value);
  openEl.value = '';
});
$('#save').addEventListener('click', () => void save());
$('#new').addEventListener('click', () => newPart());
$('#undo').addEventListener('click', undo);
$('#delete').addEventListener('click', deleteSelected);
$('#clear').addEventListener('click', () => {
  if (!shapes.length) return;
  pushUndo();
  shapes = [];
  select(-1);
  render();
});
$('#reroll').addEventListener('click', rerollContexts);

for (const id of ['#base-color', '#ink-color']) {
  $(id).addEventListener('input', () => {
    const palette = currentPalette();
    hero.setOptions({ palette });
    for (const a of contexts) a.setOptions({ palette });
  });
}

window.addEventListener('keydown', (e) => {
  const inField = (e.target as HTMLElement).matches('input, textarea, select');
  if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !inField) {
    e.preventDefault();
    undo();
  } else if ((e.key === 'Delete' || e.key === 'Backspace') && !inField) {
    e.preventDefault();
    deleteSelected();
  } else if (e.key === 'Escape') {
    select(-1);
  }
});

// Saving regenerates src/parts/bank.ts; take that update here instead of reloading mid-edit.
import.meta.hot?.accept('../src/index.js', () => void refreshLibrary());

async function start(): Promise<void> {
  updateOutputs();
  await refreshLibrary();
  const params = new URLSearchParams(location.search);
  const openKey = params.get('open');
  const cat = params.get('category') as Category | null;
  if (openKey) {
    open(openKey);
    // A refresh should restore the session, not reopen the file.
    history.replaceState(null, '', location.pathname);
  } else if (cat && CATEGORIES.includes(cat)) {
    newPart(cat);
    history.replaceState(null, '', location.pathname);
  } else {
    restore();
  }
  rerollContexts();
  select(-1);
  render();
}

void start();
