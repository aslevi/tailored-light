// node tools/render-cards/run.mjs  -> images/b/<family>-<color>.webp (700x700, plain backdrop)
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const ROOT = new URL('../..', import.meta.url).pathname;
const srv = spawn('python3', ['-m', 'http.server', '8799'], { cwd: ROOT, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 800));
const slug = s => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const only = process.argv[2];
try {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const pg = await b.newPage({ viewport: { width: 900, height: 900 } });
  pg.on('console', m => m.type() === 'error' && console.log('page:', m.text())); pg.on('pageerror', e => console.log('pageerror:', e.message));
  await pg.goto('http://localhost:8799/tools/render-cards/render.html');
  await pg.waitForFunction('window.ready');
  const shots = await pg.evaluate('window.shots.map(({src, ...r}) => r)');
  fs.mkdirSync(ROOT + 'images/b', { recursive: true });
  let i = 0;
  for (const s of shots) {
    if (only && !`${s.family} ${s.color}`.toLowerCase().includes(only.toLowerCase())) { i++; continue; }
    await pg.evaluate(i2 => window.build(window.shots[i2]), i);
    const png = ROOT + `images/b/.tmp.png`;
    await pg.locator('canvas').screenshot({ path: png });
    const out = ROOT + `images/b/${slug(s.family)}-${slug(s.color)}.webp`;
    execFileSync('python3', ['-c', `from PIL import Image;Image.open('${png}').convert('RGB').resize((700,700),Image.LANCZOS).save('${out}','WEBP',quality=84,method=6)`]);
    console.log(out.replace(ROOT, '')); i++;
  }
  fs.rmSync(ROOT + 'images/b/.tmp.png', { force: true });
  await b.close();
} finally { srv.kill(); }
