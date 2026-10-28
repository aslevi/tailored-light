// Try on your window: photo + 4 corners -> a shade drawn in perspective (WebGL homography).
// Everything runs on the phone; the photo is never uploaded.
import { CATALOG } from './catalog-lite.js';
import { fromPrice, money, ESTIMATE_NOTE } from '../flow/pricing.js';

const PHONE = '+12017453300';
const SAMPLE = { src: './sample-window.webp', corners: [[208 / 950, 128 / 633], [740 / 950, 128 / 633], [740 / 950, 491 / 633], [208 / 950, 491 / 633]] };
const TYPES = [
  { id: 'roller', label: 'Roller' }, { id: 'roman', label: 'Roman' },
  { id: 'zebra', label: 'Zebra' }, { id: 'woven', label: 'Woven' },
];
const LEVELS = ['Light filtering', 'Blackout', 'Sheer'];
const WOVEN = 'Natural Reed';
const slug = s => s.toLowerCase().replace(/&/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const $ = id => document.getElementById(id);

const familiesFor = type =>
  type === 'woven' ? CATALOG.roman.filter(f => f.family === WOVEN)
  : type === 'roman' ? CATALOG.roman.filter(f => f.family !== WOVEN)
  : CATALOG[type] || [];
const levelOf = f => f.block >= 0.95 ? 'Blackout' : f.family === 'Sheer Voile' ? 'Sheer' : 'Light filtering';

// How each fabric handles light. alpha: how much it hides the view; glow: backlight it lets through.
function optics(f, type) {
  const lvl = levelOf(f);
  if (lvl === 'Blackout') return { alpha: 1, glow: 0.03, leak: 0.55 };
  if (lvl === 'Sheer') return { alpha: 0.5, glow: 0.45, leak: 0 };
  if (f.screen) return { alpha: 0.8, glow: 0.75, leak: 0 };
  if (type === 'woven') return { alpha: 0.9, glow: 0.8, leak: 0 };
  if (type === 'zebra') return { alpha: 1, glow: clamp((1 - f.block) * 1.7, 0.2, 0.75), leak: 0 };
  return { alpha: 1, glow: clamp((1 - f.block) * 1.7, 0.25, 0.95), leak: 0 };
}

const state = {
  type: 'roller', level: 'Light filtering', family: null, color: null,
  drop: 0.62, night: 0, corners: null, photo: null, sample: false, done: false,
};

/* ---------------- UI ---------------- */
const typesEl = $('types'), levelsEl = $('levels'), famsEl = $('fams');
function segButton(label, pressed, onClick, disabled) {
  const b = document.createElement('button');
  b.type = 'button'; b.textContent = label; b.setAttribute('aria-pressed', pressed ? 'true' : 'false');
  if (disabled) b.disabled = true;
  b.addEventListener('click', onClick);
  return b;
}
function ensureSelection() {
  const fams = familiesFor(state.type);
  if (!fams.some(f => levelOf(f) === state.level)) state.level = levelOf(fams[0]);
  const ok = fams.filter(f => levelOf(f) === state.level);
  if (!ok.some(f => f === state.family)) { state.family = ok[0]; state.color = ok[0].colors[0]; }
  if (!state.family.colors.includes(state.color)) state.color = state.family.colors[0];
}
function renderControls() {
  ensureSelection();
  typesEl.replaceChildren(...TYPES.map(t => segButton(t.label, t.id === state.type, () => { state.type = t.id; update(); })));
  const avail = new Set(familiesFor(state.type).map(levelOf));
  levelsEl.replaceChildren(...LEVELS.map(l => segButton(l, l === state.level, () => { state.level = l; update(); }, !avail.has(l))));
  const fams = familiesFor(state.type).filter(f => levelOf(f) === state.level);
  famsEl.replaceChildren(...fams.map(f => {
    const box = document.createElement('div');
    const name = document.createElement('p'); name.className = 'fam-name'; name.textContent = f.family;
    const row = document.createElement('div'); row.className = 'swatches';
    for (const c of f.colors) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'sw' + (c.swatch ? '' : ' reed');
      b.setAttribute('aria-label', `${f.family} in ${c.name}`); b.title = c.name;
      b.setAttribute('aria-pressed', f === state.family && c === state.color ? 'true' : 'false');
      b.style.backgroundColor = c.hex;
      if (c.swatch) b.style.backgroundImage = `url(../swatches/${c.swatch}.webp)`;
      b.addEventListener('click', () => { state.family = f; state.color = c; update(); });
      row.append(b);
    }
    box.append(name, row);
    return box;
  }));
  $('fabName').textContent = `${state.family.family}, ${state.color.name}`;
}
function productName() {
  const t = state.type === 'woven' ? 'Woven' : TYPES.find(t => t.id === state.type).label;
  return `${state.family.family} ${t}`;
}
function renderPrice() {
  const p = state.type === 'woven' ? fromPrice('roman', WOVEN) : fromPrice(state.type, state.family.family);
  $('price').textContent = 'From ' + money(p);
  $('pick').textContent = `${productName()} in ${state.color.name} · ${state.level}`;
  $('priceNote').textContent = state.type === 'zebra' ? ESTIMATE_NOTE
    : 'Custom made to your size. Exact price once you measure.';
  $('shadeLink').href = `../shades/${state.type}/${slug(state.family.family)}/`;
  const body = state.photo && !state.sample
    ? `Hi! I tried on the ${productName()} in ${state.color.name} (${state.level}) on my window with Try on. Can you help me with size and price? I'm attaching a photo of my window.`
    : `Hi! I tried on the ${productName()} in ${state.color.name} (${state.level}) with Try on. Can you help me with size and price? I'll attach a photo of my window.`;
  $('textBtn').href = `sms:${PHONE}?body=${encodeURIComponent(body)}`;
}
function setRangeFill(el) { el.style.setProperty('--p', el.value + '%'); }
const dropEl = $('drop'), nightEl = $('night');
function renderSliders() {
  const d = Math.round(state.drop * 100);
  $('dropVal').textContent = d >= 98 ? 'All the way down' : d <= 2 ? 'All the way up' : `${d}% down`;
  setRangeFill(dropEl);
}
dropEl.addEventListener('input', () => { state.drop = dropEl.value / 100; renderSliders(); drawPlate(); requestRender(); });
nightEl.addEventListener('input', () => { state.night = nightEl.value / 100; requestRender(); });
function update() { renderControls(); renderPrice(); renderSliders(); loadSwatch(state.color); drawPlate(); requestRender(); }

/* ---------------- fabric textures ---------------- */
const tiles = new Map(); // swatch slug -> mirrored, seamless tile canvas (400px)
function loadSwatch(c) {
  if (!c.swatch || tiles.has(c.swatch)) return;
  tiles.set(c.swatch, null);
  const img = new Image();
  img.onload = () => {
    const s = 200, cv = document.createElement('canvas'); cv.width = cv.height = s * 2;
    const x = cv.getContext('2d');
    const rotate = c.swatch.startsWith('ticking-stripe');
    for (let i = 0; i < 4; i++) {
      x.save(); x.translate((i & 1) ? s * 2 : 0, (i & 2) ? s * 2 : 0); x.scale((i & 1) ? -1 : 1, (i & 2) ? -1 : 1);
      if (rotate) { x.translate(s, 0); x.rotate(Math.PI / 2); }
      x.drawImage(img, 0, 0, s, s); x.restore();
    }
    tiles.set(c.swatch, cv);
    if (state.color === c) { drawPlate(); requestRender(); }
  };
  img.src = `../swatches/${c.swatch}.webp`;
}
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const f = v => Math.round(clamp(k < 0 ? v * (1 + k) : v + (255 - v) * k, 0, 255));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}
// A fill style for the fabric, sized so one swatch photo is about 1/7 of the window width.
function fabricFill(ctx, W) {
  const c = state.color, size = Math.max(48, Math.round(W / 3.5));
  const tile = c.swatch && tiles.get(c.swatch);
  const key = `${c.swatch || c.hex}|${size}|${state.type}|${tile ? 1 : 0}`;
  if (fabricFill.key === key) return fabricFill.pat;
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const x = cv.getContext('2d');
  if (state.type === 'woven' || !c.swatch) {
    // Natural reed: horizontal reeds of varied tone with sparse vertical warp threads.
    x.fillStyle = c.hex; x.fillRect(0, 0, size, size);
    let y = 0, seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    while (y < size) {
      const h = 2 + rnd() * 2.6;
      x.fillStyle = shade(c.hex, (rnd() - 0.5) * 0.34); x.fillRect(0, y, size, h);
      x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(0, y + h - 0.6, size, 0.6);
      y += h;
    }
    x.fillStyle = 'rgba(70,50,30,.28)';
    for (let i = 0; i < 4; i++) x.fillRect(Math.round(i * size / 4 + size / 8), 0, 1.2, size);
  } else if (state.type === 'zebra' || !tile) {
    x.fillStyle = c.hex; x.fillRect(0, 0, size, size);
    for (let i = 0; i < size; i += 2) { x.fillStyle = `rgba(0,0,0,${0.025 + 0.02 * Math.sin(i * 1.7)})`; x.fillRect(0, i, size, 1); }
    for (let i = 0; i < size; i += 3) { x.fillStyle = 'rgba(255,255,255,.035)'; x.fillRect(i, 0, 1, size); }
    if (tile && state.type !== 'zebra') { x.globalAlpha = 1; x.drawImage(tile, 0, 0, size, size); }
  } else {
    x.drawImage(tile, 0, 0, size, size);
  }
  fabricFill.key = key; fabricFill.pat = ctx.createPattern(cv, 'repeat');
  return fabricFill.pat;
}

/* ---------------- shade plate (flat picture of the shade, warped later) ---------------- */
const PLATE = 1024;
const plate = document.createElement('canvas'); plate.width = plate.height = PLATE;
const pctx = plate.getContext('2d');
let plateRail = 0, plateDirty = true;

function quadAspect() {
  const c = state.corners; if (!c) return 0.7;
  const iw = state.photo.width, ih = state.photo.height;
  const d = (a, b) => Math.hypot((a[0] - b[0]) * iw, (a[1] - b[1]) * ih);
  const w = (d(c[0], c[1]) + d(c[3], c[2])) / 2, h = (d(c[0], c[3]) + d(c[1], c[2])) / 2;
  return clamp(h / Math.max(w, 1), 0.25, 3);
}
function cassette(ctx, W, rail) {
  const g = ctx.createLinearGradient(0, 0, 0, rail);
  g.addColorStop(0, '#F7F3EC'); g.addColorStop(0.55, '#ECE6DC'); g.addColorStop(1, '#D9D1C5');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, rail);
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(0, rail - 1.5, W, 1.5);
  ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(0, 1, W, 1.2);
}
function hemBar(ctx, W, y, h, hex) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, shade(hex, 0.18)); g.addColorStop(0.5, shade(hex, -0.06)); g.addColorStop(1, shade(hex, -0.3));
  ctx.fillStyle = g; ctx.fillRect(0, y, W, h);
}
function sideShade(ctx, W, y0, y1) {
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, 'rgba(0,0,0,.10)'); g.addColorStop(0.06, 'rgba(0,0,0,0)');
  g.addColorStop(0.94, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.10)');
  ctx.fillStyle = g; ctx.fillRect(0, y0, W, y1 - y0);
}

function drawPlate() { plateDirty = true; }
function paintPlate() {
  plateDirty = false;
  if (!state.family) return;
  const W = 600, H = Math.round(W * quadAspect());
  const ctx = pctx;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, PLATE, PLATE);
  ctx.setTransform(PLATE / W, 0, 0, PLATE / H, 0, 0);
  const fill = fabricFill(ctx, W), hex = state.color.hex, op = optics(state.family, state.type);
  const drop = state.drop;
  if (state.type === 'roller' || state.type === 'zebra') {
    const rail = clamp(H * 0.05, 16, 34), hem = clamp(H * 0.018, 6, 12);
    const L = rail + hem + (H - rail - hem) * drop;
    ctx.globalAlpha = op.alpha;
    if (state.type === 'roller') {
      ctx.fillStyle = fill; ctx.fillRect(0, rail, W, L - rail);
      ctx.globalAlpha = 1;
      const g = ctx.createLinearGradient(0, rail, 0, L);
      g.addColorStop(0, 'rgba(0,0,0,.10)'); g.addColorStop(0.08, 'rgba(255,255,255,.04)'); g.addColorStop(1, 'rgba(0,0,0,.05)');
      ctx.globalAlpha = op.alpha; ctx.fillStyle = g; ctx.fillRect(0, rail, W, L - rail);
    } else {
      // Zebra: sheer bands everywhere, solid bands on top; pitch about 3" on a 36" window.
      const pitch = clamp(W / 11, 26, 70), solid = pitch * 0.56;
      ctx.globalAlpha = 0.3; ctx.fillStyle = shade(hex, 0.45); ctx.fillRect(0, rail, W, L - rail);
      ctx.globalAlpha = 0.18; ctx.fillStyle = '#fff';
      for (let x = 0; x < W; x += 4) ctx.fillRect(x, rail, 0.7, L - rail);
      ctx.globalAlpha = 1; ctx.fillStyle = fill;
      // Bands travel with the fabric, so anchor them to the bottom rail.
      for (let y = L - hem - solid; y > rail - pitch; y -= pitch) {
        const a = Math.max(rail, y), b = Math.min(L, y + solid);
        if (b > a) {
          ctx.fillStyle = fill; ctx.fillRect(0, a, W, b - a);
          const g = ctx.createLinearGradient(0, a, 0, b);
          g.addColorStop(0, 'rgba(255,255,255,.10)'); g.addColorStop(1, 'rgba(0,0,0,.10)');
          ctx.fillStyle = g; ctx.fillRect(0, a, W, b - a);
        }
      }
    }
    ctx.globalAlpha = op.alpha; sideShade(ctx, W, rail, L);
    ctx.globalAlpha = 1;
    hemBar(ctx, W, L - hem, hem, state.type === 'zebra' ? '#E6E0D6' : hex);
    cassette(ctx, W, rail);
    plateRail = rail / H;
  } else {
    // Roman / woven: six soft folds that gather from the bottom up as it rises (as in the 3D studio).
    const count = 6, step = H / count, gap = clamp(H * 0.035, 9, 22), stack = count * gap;
    const top = clamp(H * 0.03, 8, 18);
    const L = top + stack + (H - top - stack) * drop;
    const bounds = []; for (let i = 0; i <= count; i++) bounds.push(Math.min(top + i * step, L - (count - i) * gap));
    bounds[0] = top;
    ctx.globalAlpha = op.alpha;
    ctx.fillStyle = fill; ctx.fillRect(0, 0, W, L);
    ctx.globalAlpha = op.alpha;
    // Headrail board covered in fabric.
    let g = ctx.createLinearGradient(0, 0, 0, top);
    g.addColorStop(0, 'rgba(255,255,255,.12)'); g.addColorStop(1, 'rgba(0,0,0,.16)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, top);
    for (let i = 0; i < count; i++) {
      const y0 = bounds[i], y1 = bounds[i + 1], span = y1 - y0;
      if (span <= 0.5) continue;
      const gat = clamp((step - span) / (step - gap), 0, 1), k = 0.35 + 0.65 * gat;
      g = ctx.createLinearGradient(0, y0, 0, y1);
      g.addColorStop(0, `rgba(0,0,0,${0.14 * k})`);
      g.addColorStop(0.18, `rgba(255,255,255,${0.05 + 0.08 * k})`);
      g.addColorStop(0.55, `rgba(255,255,255,${0.03 + 0.05 * k})`);
      g.addColorStop(0.86, `rgba(0,0,0,${0.06 + 0.10 * k})`);
      g.addColorStop(1, `rgba(0,0,0,${0.16 + 0.18 * k})`);
      ctx.fillStyle = g; ctx.fillRect(0, y0, W, span);
      // Sewn fold line.
      ctx.fillStyle = `rgba(0,0,0,${0.18 + 0.12 * k})`; ctx.fillRect(0, y1 - 1.2, W, 1.2);
      ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(0, y1, W, 0.8);
    }
    sideShade(ctx, W, 0, L);
    ctx.globalAlpha = 1;
    plateRail = top / H;
  }
  ctx.globalAlpha = 1;
  if (gl) uploadPlate();
}

/* ---------------- WebGL ---------------- */
const canvas = $('gl');
let gl = null, prog = null, texPhoto = null, texPlate = null, U = {};
const VS = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`;
const FS = `precision highp float;
uniform sampler2D uPhoto,uPlate;uniform vec2 uRes,uC;uniform mat3 uHinv;
uniform float uNight,uGlow,uLeak,uPx,uGain,uSpill,uR,uRail,uHas;
void main(){
  vec2 px=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y);
  vec3 photo=texture2D(uPhoto,px/uRes).rgb;
  float n=uNight;
  vec3 cool=mix(vec3(1.),vec3(.70,.74,.92),n);
  float d=length((px-uC)/uR);
  vec3 room=photo*cool*(1.-.84*n)+photo*vec3(1.,.93,.82)*uSpill*n*exp(-d*d*1.4);
  if(uHas<.5){gl_FragColor=vec4(room,1.);return;}
  vec3 q=uHinv*vec3(px,1.);vec2 uv=q.xy/q.z;
  float e=min(min(uv.x,1.-uv.x),min(uv.y,1.-uv.y));
  float inside=q.z>0.?clamp(e/uPx+.5,0.,1.):0.;
  vec4 s=texture2D(uPlate,clamp(uv,0.,1.));
  vec3 outside=photo*(1.-.5*n);
  float body=step(uRail,uv.y);
  vec3 warm=vec3(1.,.94,.82)*s.a;
  vec3 front=s.rgb*uGain*(1.-.8*n)*cool;
  vec3 glow=mix(s.rgb,warm,.45)*uGlow*n*(1.-.45*n)*body*1.15;
  float leak=uLeak*n*(1.-smoothstep(0.,.014,min(uv.x,1.-uv.x)))*body*s.a;
  vec3 fab=front+glow+vec3(1.,.93,.8)*leak*.7;
  vec3 col=outside*(1.-s.a)+fab;
  gl_FragColor=vec4(mix(room,col,inside),1.);
}`;
function initGL() {
  try { gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: true }); } catch (e) { gl = null; }
  if (!gl) return false;
  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
  prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog); gl.useProgram(prog);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  for (const k of ['uPhoto', 'uPlate', 'uRes', 'uC', 'uHinv', 'uNight', 'uGlow', 'uLeak', 'uPx', 'uGain', 'uSpill', 'uR', 'uRail', 'uHas']) U[k] = gl.getUniformLocation(prog, k);
  const mk = () => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); return t; };
  texPhoto = mk(); texPlate = mk();
  gl.uniform1i(U.uPhoto, 0); gl.uniform1i(U.uPlate, 1);
  return true;
}
function uploadPhoto() {
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texPhoto);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, state.photo);
}
function uploadPlate() {
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texPlate);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, plate);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
}

// Homography from the unit square to the quad (Heckbert), and its inverse.
function squareToQuad(p) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = p;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3, dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  let g = 0, h = 0;
  if (Math.abs(dx3) > 1e-9 || Math.abs(dy3) > 1e-9) {
    const den = dx1 * dy2 - dx2 * dy1 || 1e-9;
    g = (dx3 * dy2 - dx2 * dy3) / den; h = (dx1 * dy3 - dx3 * dy1) / den;
  }
  return [x1 - x0 + g * x1, x3 - x0 + h * x3, x0, y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h, 1];
}
function invert3(m) {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C || 1e-12;
  return [A, -(b * i - c * h), b * f - c * e, B, a * i - c * g, -(a * f - c * d), C, -(a * h - b * g), a * e - b * d].map(v => v / det);
}

let raf = 0;
function requestRender() { if (!raf) raf = requestAnimationFrame(render); }
function render() {
  raf = 0;
  if (!gl || !state.photo) return;
  if (plateDirty) paintPlate();
  const W = canvas.width, H = canvas.height;
  gl.viewport(0, 0, W, H);
  const pts = state.corners.map(([x, y]) => [x * W, y * H]);
  const inv = invert3(squareToQuad(pts));
  // GLSL mat3 is column-major.
  gl.uniformMatrix3fv(U.uHinv, false, new Float32Array([inv[0], inv[3], inv[6], inv[1], inv[4], inv[7], inv[2], inv[5], inv[8]]));
  gl.uniform2f(U.uRes, W, H);
  const cx = pts.reduce((s, p) => s + p[0], 0) / 4, cy = pts.reduce((s, p) => s + p[1], 0) / 4;
  const side = (Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]) + Math.hypot(pts[3][0] - pts[0][0], pts[3][1] - pts[0][1])) / 2;
  const op = optics(state.family, state.type);
  gl.uniform2f(U.uC, cx, cy); gl.uniform1f(U.uR, Math.max(side * 1.3, 1));
  gl.uniform1f(U.uPx, 1.2 / Math.max(side, 1));
  gl.uniform1f(U.uNight, state.night);
  gl.uniform1f(U.uGlow, op.glow); gl.uniform1f(U.uLeak, op.leak);
  gl.uniform1f(U.uRail, plateRail);
  gl.uniform1f(U.uGain, roomGain);
  const open = (1 - state.drop) * 0.9 + state.drop * (1 - op.alpha + op.glow * 0.5);
  gl.uniform1f(U.uSpill, 0.55 * clamp(open, 0.03, 1));
  gl.uniform1f(U.uHas, 1);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

/* ---------------- photo + stage ---------------- */
const stage = $('stage'), stageWrap = $('stageWrap'), startEl = $('start');
const handles = [...document.querySelectorAll('.handle')];
const outline = $('outline').querySelector('polygon');
let roomGain = 1;

function computeGain() {
  // Match the fabric to the photo's exposure: average brightness of the room around the window.
  const s = 48, cv = document.createElement('canvas'); cv.width = s; cv.height = Math.max(8, Math.round(s * state.photo.height / state.photo.width));
  const x = cv.getContext('2d'); x.drawImage(state.photo, 0, 0, cv.width, cv.height);
  const d = x.getImageData(0, 0, cv.width, cv.height).data;
  const c = state.corners, minX = Math.min(...c.map(p => p[0])), maxX = Math.max(...c.map(p => p[0])), minY = Math.min(...c.map(p => p[1])), maxY = Math.max(...c.map(p => p[1]));
  let sum = 0, n = 0;
  for (let j = 0; j < cv.height; j++) for (let i = 0; i < cv.width; i++) {
    const u = i / cv.width, v = j / cv.height;
    if (u > minX && u < maxX && v > minY && v < maxY) continue;
    const k = (j * cv.width + i) * 4; sum += (0.2126 * d[k] + 0.7152 * d[k + 1] + 0.0722 * d[k + 2]) / 255; n++;
  }
  const lum = n ? sum / n : 0.55;
  roomGain = clamp(0.62 + lum * 0.62, 0.72, 1.04);
}

function setPhoto(img, corners, sample) {
  const max = 1600, sc = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(img.naturalWidth * sc)); cv.height = Math.max(1, Math.round(img.naturalHeight * sc));
  cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
  state.photo = cv; state.sample = sample;
  state.corners = corners.map(p => p.slice());
  startEl.hidden = true; stageWrap.hidden = false;
  setDone(false);
  if (!gl && !initGL()) { showError("This browser can't show the try on. Text a designer and we'll help by photo."); return; }
  uploadPhoto(); computeGain(); layout(); drawPlate(); renderPrice(); requestRender();
}
function showError(msg) { const e = $('err'); e.textContent = msg; e.hidden = false; startEl.hidden = false; stageWrap.hidden = true; }

function layout() {
  if (!state.photo) return;
  const avail = stage.parentElement.clientWidth;
  const aspect = state.photo.height / state.photo.width;
  const maxH = Math.max(260, Math.min(window.innerHeight * 0.66, 760));
  let w = avail, h = w * aspect;
  if (h > maxH) { h = maxH; w = h / aspect; }
  stage.style.width = Math.round(w) + 'px'; stage.style.height = Math.round(h) + 'px';
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  placeHandles();
  requestRender();
}
function placeHandles() {
  const w = stage.clientWidth, h = stage.clientHeight;
  handles.forEach((el, i) => { const [x, y] = state.corners[i]; el.style.left = x * w + 'px'; el.style.top = y * h + 'px'; });
  outline.setAttribute('points', state.corners.map(([x, y]) => `${x * w},${y * h}`).join(' '));
}
new ResizeObserver(() => layout()).observe(stage.parentElement);

// Dragging corners, with a magnifier so a finger doesn't hide the corner.
const loupe = $('loupe'), lctx = loupe.querySelector('canvas').getContext('2d');
function drawLoupe(i) {
  const w = stage.clientWidth, h = stage.clientHeight, [x, y] = state.corners[i];
  const L = 104, zoom = 2.6, sx = state.photo.width / w;
  const srcW = (L / zoom) * sx;
  lctx.fillStyle = '#000'; lctx.fillRect(0, 0, 208, 208);
  lctx.drawImage(state.photo, x * state.photo.width - srcW / 2, y * state.photo.height - srcW / 2, srcW, srcW, 0, 0, 208, 208);
  lctx.strokeStyle = '#fff'; lctx.lineWidth = 3; lctx.beginPath(); lctx.moveTo(104, 80); lctx.lineTo(104, 128); lctx.moveTo(80, 104); lctx.lineTo(128, 104); lctx.stroke();
  lctx.strokeStyle = '#A9594A'; lctx.lineWidth = 1.5; lctx.stroke();
  const px = x * w, py = y * h;
  loupe.style.left = clamp(px - L / 2, 0, w - L) + 'px';
  loupe.style.top = (py - L - 40 < 0 ? Math.min(py + 40, h - L) : py - L - 40) + 'px';
  loupe.style.display = 'block';
}
handles.forEach((el, i) => {
  let off = null;
  el.addEventListener('pointerdown', e => {
    e.preventDefault(); el.setPointerCapture(e.pointerId); el.classList.add('drag');
    const r = stage.getBoundingClientRect(), [x, y] = state.corners[i];
    off = [x * r.width - (e.clientX - r.left), y * r.height - (e.clientY - r.top)];
    drawLoupe(i);
  });
  el.addEventListener('pointermove', e => {
    if (!off) return;
    const r = stage.getBoundingClientRect();
    state.corners[i] = [clamp((e.clientX - r.left + off[0]) / r.width, 0, 1), clamp((e.clientY - r.top + off[1]) / r.height, 0, 1)];
    placeHandles(); drawLoupe(i); drawPlate(); requestRender();
  });
  const end = () => { if (!off) return; off = null; el.classList.remove('drag'); loupe.style.display = 'none'; computeGain(); requestRender(); };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); el.addEventListener('lostpointercapture', end);
  el.addEventListener('keydown', e => {
    const k = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!k) return; e.preventDefault();
    const s = e.shiftKey ? 0.02 : 0.005, [x, y] = state.corners[i];
    state.corners[i] = [clamp(x + k[0] * s, 0, 1), clamp(y + k[1] * s, 0, 1)];
    placeHandles(); drawPlate(); requestRender();
  });
});

function setDone(on) {
  state.done = on; stage.classList.toggle('done', on);
  $('doneBtn').textContent = on ? 'Adjust corners' : 'Done';
  $('doneBtn').classList.toggle('on', !on);
  $('hint').textContent = on ? 'Looking good? Try other fabrics, or slide Day to night.' : 'Drag the 4 dots to the inside corners of your window.';
}
$('doneBtn').addEventListener('click', () => setDone(!state.done));

function readFile(input) {
  const f = input.files && input.files[0]; input.value = '';
  if (!f) return;
  const url = URL.createObjectURL(f), img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(url);
    setPhoto(img, [[0.24, 0.2], [0.76, 0.2], [0.76, 0.72], [0.24, 0.72]], false);
  };
  img.onerror = () => { URL.revokeObjectURL(url); showError("We couldn't open that photo. Try a JPG or PNG, or take a new one."); };
  img.src = url;
}
$('cam').addEventListener('change', e => readFile(e.target));
$('lib').addEventListener('change', e => readFile(e.target));
$('sample').addEventListener('click', () => {
  const img = new Image();
  img.onload = () => setPhoto(img, SAMPLE.corners, true);
  img.src = SAMPLE.src;
});

update();
if (new URLSearchParams(location.search).has('sample')) $('sample').click();
