import { defineConfig } from 'vite';
import { partsPlugin } from './scripts/parts.mjs';

// The dev server serves the demo pages and the parts API; the library itself is built with tsc.
export default defineConfig({
  root: 'demo',
  plugins: [partsPlugin()],
});
