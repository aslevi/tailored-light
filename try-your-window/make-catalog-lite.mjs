// Regenerates catalog-lite.js from ../catalog.js without the inline swatch photos (1.4 MB -> ~3 KB).
// Run from this folder after catalog changes:  node make-catalog-lite.mjs
import { readFileSync, writeFileSync } from 'node:fs';
const src = readFileSync(new URL('../catalog.js', import.meta.url), 'utf8');
const window = {}; new Function('window', src)(window);
const slug = s => s.toLowerCase().replace(/&/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const out = {};
for (const [style, v] of Object.entries(window.TL_CATALOG)) {
  if (!v || !v.groups) continue;
  out[style] = v.groups.map(g => ({
    family: g.family, block: g.block, t: g.t, screen: !!g.screen, weave: !!g.weave,
    colors: g.colors.map(c => ({ name: c[0], hex: c[1], swatch: c[2] ? slug(g.family + ' ' + c[0]) : null })),
  }));
}
writeFileSync(new URL('./catalog-lite.js', import.meta.url),
  '// Generated from ../catalog.js by make-catalog-lite.mjs (swatch photos live in ../swatches/). Do not edit by hand.\n' +
  'export const CATALOG = ' + JSON.stringify(out) + ';\n');
