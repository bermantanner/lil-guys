// Parts live in parts/<category>/<id>.json. buildBank compiles them into src/parts/bank.ts;
// partsPlugin gives the dev server the small API the editor and library pages use.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PARTS_DIR = path.join(ROOT, 'parts');
const BANK_FILE = path.join(ROOT, 'src', 'parts', 'bank.ts');
const CATEGORIES = ['hair', 'eyes', 'mouth', 'eyewear'];
const ID_RE = /^[a-z0-9][a-z0-9_-]*$/i;

const partFile = (category, id) => path.join(PARTS_DIR, category, `${id}.json`);

function compact(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

/** Stable key order, points on one line each. */
function formatPart(part) {
  const shape = ({ kind, color, line, width, closed, sharp, wobble, points, ...rest }) =>
    compact({ kind, color, line, width, closed, sharp, wobble, ...rest, points });
  const { id, category, weight, front, back, ...rest } = part;
  const ordered = compact({
    id,
    category,
    weight,
    ...rest,
    front: (front ?? []).map(shape),
    back: back?.length ? back.map(shape) : undefined,
  });
  return (
    JSON.stringify(ordered, null, 2).replace(/\[\s+(-?[\d.]+),\s+(-?[\d.]+)\s+\]/g, '[$1, $2]') + '\n'
  );
}

/** Every part on disk, in bank order. The file's location decides its id and category. */
async function readParts() {
  const out = [];
  for (const category of CATEGORIES) {
    const dir = path.join(PARTS_DIR, category);
    let files;
    try {
      files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json')).sort();
    } catch {
      continue;
    }
    for (const f of files) {
      const json = JSON.parse(await fs.readFile(path.join(dir, f), 'utf8'));
      out.push({ ...json, id: path.basename(f, '.json'), category });
    }
  }
  return out;
}

export async function buildBank() {
  const list = await readParts();
  const rows = list.map((p) => `  ${JSON.stringify(p)},`).join('\n');
  const src =
    '// Generated from parts/**/*.json by scripts/parts.mjs. Do not edit; run `npm run parts:build`.\n' +
    "import type { PartJSON } from './json.js';\n\n" +
    `export const bank: PartJSON[] = [\n${rows}\n];\n`;
  const prev = await fs.readFile(BANK_FILE, 'utf8').catch(() => '');
  if (prev !== src) await fs.writeFile(BANK_FILE, src);
  return list.length;
}

// ---- dev server API: GET /__parts, PUT|DELETE /__parts/<category>/<id>

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

export function partsPlugin() {
  return {
    name: 'avatar-parts',
    async configureServer(server) {
      await buildBank();
      // Hand-edited or Finder-moved files rebuild the bank too.
      server.watcher.add(PARTS_DIR);
      server.watcher.on('all', (_event, file) => {
        if (file.startsWith(PARTS_DIR) && file.endsWith('.json')) void buildBank();
      });

      server.middlewares.use('/__parts', async (req, res) => {
        try {
          const [category, id] = new URL(req.url ?? '/', 'http://x').pathname.split('/').filter(Boolean);
          if (req.method === 'GET' && !category) return send(res, 200, await readParts());
          if (!CATEGORIES.includes(category) || !ID_RE.test(id ?? '')) {
            return send(res, 400, { error: 'bad category or id (letters, digits, - and _ only)' });
          }
          const file = partFile(category, id);
          if (req.method === 'PUT') {
            const part = { ...JSON.parse(await readBody(req)), id, category };
            await fs.mkdir(path.dirname(file), { recursive: true });
            await fs.writeFile(file, formatPart(part));
            await buildBank();
            return send(res, 200, part);
          }
          if (req.method === 'DELETE') {
            await fs.rm(file, { force: true });
            await buildBank();
            return send(res, 200, { ok: true });
          }
          send(res, 405, { error: 'method not allowed' });
        } catch (err) {
          send(res, 500, { error: String(err) });
        }
      });
    },
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const n = await buildBank();
  console.log(`bank: ${n} parts → src/parts/bank.ts`);
}
