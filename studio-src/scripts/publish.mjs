// npm run build && node scripts/publish.mjs
// Copies dist/ into the site's studio/ folder. Vite inlines the shared site files (fonts, favicons,
// Dana's photo, the first-frame still) as hashed copies; this puts the original ../ links back so the
// studio shares the site's cached files, and adds the site analytics script.
import fs from 'node:fs';
import path from 'node:path';
const here = path.dirname(new URL(import.meta.url).pathname), dist = path.join(here, '../dist'), out = path.join(here, '../../studio');
const src = fs.readFileSync(path.join(here, '../index.html'), 'utf8');
let html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const shared = { 'favicon-': '../favicon.svg', 'favicon-32-': '../favicon-32.png', 'favicon-16-': '../favicon-16.png', 'apple-touch-icon-': '../apple-touch-icon.png', 'dana-avatar-': '../images/people/dana-avatar.webp', 'raw-linen-flax-': '../images/studio/raw-linen-flax.webp' };
const assets = fs.readdirSync(path.join(dist, 'assets'));
const keep = new Set();
for (const a of assets) {
  if (/\.(js|css)$/.test(a)) { keep.add(a); continue; }
  const prefix = Object.keys(shared).sort((x, y) => y.length - x.length).find(p => a.startsWith(p) && /^[A-Za-z0-9_-]{8}\./.test(a.slice(p.length)));
  if (prefix) html = html.split('./assets/' + a).join(shared[prefix]);
}
// fonts: drop the inlined @font-face copies, link the site's fonts.css instead
for (const a of assets.filter(a => a.endsWith('.css'))) {
  const f = path.join(dist, 'assets', a);
  fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace(/@font-face\{[^}]*\}/g, ''));
}
if (src.includes('../fonts/fonts.css') && !html.includes('../fonts/fonts.css'))
  html = html.replace('<link rel="apple-touch-icon"', '<link rel="stylesheet" href="../fonts/fonts.css">\n<link rel="apple-touch-icon"');
if (!html.includes('flow/analytics.js')) html = html.replace('</head>', '<script defer src="../flow/analytics.js"></script>\n</head>');
const leftover = [...html.matchAll(/\.\/assets\/([^"')\s]+)/g)].map(m => m[1]).filter(a => !/\.(js|css)$/.test(a));
if (leftover.length) throw new Error('unmapped assets: ' + leftover.join(', '));
fs.rmSync(path.join(out, 'assets'), { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'assets'), { recursive: true });
for (const a of keep) fs.copyFileSync(path.join(dist, 'assets', a), path.join(out, 'assets', a));
fs.writeFileSync(path.join(out, 'index.html'), html);
console.log('published', [...keep].join(', '));
