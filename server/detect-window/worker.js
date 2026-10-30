// detect-window: a tiny Cloudflare Worker for "Try on your window".
// POST a JPEG (raw body, Content-Type: image/jpeg, <= 300 KB) and get back the window corners:
//   200 {"windows":[{"corners":[[x,y],[x,y],[x,y],[x,y]],"confidence":0.9}], "ms": 1830}
// Corners are normalized 0-1, ordered top-left, top-right, bottom-right, bottom-left, best window first.
// The photo is passed straight to the model and never stored or logged.
//
// Env: OPENROUTER_API_KEY (secret, required), MODEL (optional), ALLOWED_ORIGINS (optional, comma separated),
//      PROVIDER_ORDER (optional, comma separated OpenRouter provider slugs to try first; falls back to any other).

const DEFAULT_MODEL = 'google/gemma-4-26b-a4b-it';
const DEFAULT_ORIGINS = 'https://helloshade.co';
const MAX_BYTES = 300 * 1024;
const UPSTREAM_TIMEOUT_MS = 8000;
const MAX_WINDOWS = 6;

// Prompt "A" for models that return clean 0-1 decimals (Claude). Gemini and Gemma models are more reliable with
// their native 0-1000 integer scale (prompt "C" in the benchmark), so they get that wording instead.
const ASK = 'Find every window in this photo. For each window return the 4 inside corners of the window opening: ' +
  'the inner edge of the trim/casing, i.e. the area an inside-mounted window shade would fill ' +
  '(include the sash frame; ignore any existing shade or blind and use the opening behind it). ' +
  'Order corners top-left, top-right, bottom-right, bottom-left as seen in the image. ';
const PROMPT_UNIT = ASK +
  'Coordinates are normalized 0-1 (x = fraction of image width from left, y = fraction of height from top). ' +
  'Skip windows that are mostly cut off by the image edge. Largest window first. ' +
  'Reply with JSON only, no prose: {"windows":[{"corners":[[x,y],[x,y],[x,y],[x,y]],"confidence":0.0}]}';
const PROMPT_1000 = ASK +
  'Follow the perspective; corners need not form a rectangle. Coordinates are integers 0-1000: ' +
  'x = 1000*distance from left edge/width, y = 1000*distance from top edge/height. ' +
  'Skip windows mostly cut off by the image edge. Largest window first. ' +
  'Reply with JSON only: {"windows":[{"corners":[[x,y],[x,y],[x,y],[x,y]],"confidence":0.0}]}';

export default {
  async fetch(request, env) {
    const origins = (env.ALLOWED_ORIGINS || DEFAULT_ORIGINS).split(',').map(s => s.trim()).filter(Boolean);
    const origin = request.headers.get('Origin') || '';
    const allowed = origins.includes(origin);
    const cors = allowed ? {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    } : { 'Vary': 'Origin' };
    const reply = (status, body) => new Response(JSON.stringify(body), {
      status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors },
    });

    if (request.method === 'OPTIONS') return new Response(null, { status: allowed ? 204 : 403, headers: cors });
    if (!allowed) return reply(403, { error: 'origin_not_allowed' });
    if (request.method !== 'POST') return reply(405, { error: 'method_not_allowed' });
    if (!env.OPENROUTER_API_KEY) return reply(500, { error: 'not_configured' });

    const type = (request.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
    if (type !== 'image/jpeg') return reply(415, { error: 'send_image_jpeg' });
    const declared = Number(request.headers.get('Content-Length') || 0);
    if (declared > MAX_BYTES) return reply(413, { error: 'too_large', max_bytes: MAX_BYTES });
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (bytes.length > MAX_BYTES) return reply(413, { error: 'too_large', max_bytes: MAX_BYTES });
    if (bytes.length < 3 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) return reply(400, { error: 'not_a_jpeg' });

    const model = env.MODEL || DEFAULT_MODEL;
    // Gemma (open-weights, no reasoning mode) and Gemini both use the 0-1000 integer prompt and parsing.
    const gemma = model.startsWith('google/gemma');
    const gemini = model.startsWith('google/') && !gemma;
    const scale1000 = gemma || gemini;
    const body = {
      model,
      temperature: 0,
      max_tokens: model.includes('sonnet') ? 1500 : gemini ? 800 : 400,
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + toBase64(bytes) } },
          { type: 'text', text: scale1000 ? PROMPT_1000 : PROMPT_UNIT },
        ],
      }],
    };
    // Reasoning off where allowed. Sonnet 5.5 and Gemini 3.x refuse "off", so ask for the least they allow.
    // Gemma gets no reasoning field at all.
    if (!gemma) body.reasoning = gemini ? { effort: 'minimal' } : model.includes('sonnet') ? { effort: 'low' } : { enabled: false };
    // Provider routing: Gemma 4 is served by many hosts with very different speed (benchmark Oct 2026:
    // Makora p90 ~1.4 s, Parasail ~2.1 s, Google Vertex/AkashML ~3.8 s; accuracy the same). Try the fast ones first.
    const order = (env.PROVIDER_ORDER || (gemma ? 'makora,parasail' : '')).split(',').map(s => s.trim()).filter(Boolean);
    if (order.length) body.provider = { order, allow_fallbacks: true };

    const t0 = Date.now();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), UPSTREAM_TIMEOUT_MS);
    let text = '';
    try {
      const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        signal: ctrl.signal,
        headers: {
          'Authorization': 'Bearer ' + env.OPENROUTER_API_KEY,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://helloshade.co',
          'X-Title': 'Hello Shade try on',
        },
        body: JSON.stringify(body),
      });
      if (!r.ok) return reply(502, { error: 'upstream', status: r.status });
      const j = await r.json();
      text = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
    } catch (e) {
      return reply(e && e.name === 'AbortError' ? 504 : 502, { error: e && e.name === 'AbortError' ? 'upstream_timeout' : 'upstream' });
    } finally {
      clearTimeout(timer);
    }

    const windows = parseWindows(text, scale1000);
    return reply(200, { windows, ms: Date.now() - t0 });
  },
};

function toBase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

const NUM = '(-?\\d+(?:\\.\\d+)?)';
const PT = `\\[\\s*${NUM}\\s*,\\s*${NUM}\\s*\\]`;
const QUAD = new RegExp(`\\[\\s*${PT}\\s*,\\s*${PT}\\s*,\\s*${PT}\\s*,\\s*${PT}\\s*\\]([^\\[\\]]{0,80})`, 'g');
const CONF = /"?confidence"?\s*:\s*(\d*\.?\d+)/;

// Lenient: models sometimes wrap JSON in ``` fences or emit slightly broken JSON, so pull out every
// 4-point array (and the confidence that follows it) with a regex instead of trusting JSON.parse.
export function parseWindows(text, scale1000) {
  const raw = [];
  for (const m of String(text || '').matchAll(QUAD)) {
    const v = m.slice(1, 9).map(Number);
    const c = CONF.exec(m[9] || '');
    raw.push({ pts: [[v[0], v[1]], [v[2], v[3]], [v[4], v[5]], [v[6], v[7]]], confidence: c ? Number(c[1]) : 0.5 });
  }
  if (!raw.length) return [];
  const max = Math.max(...raw.flatMap(w => w.pts.flat().map(Math.abs)));
  const div = scale1000 || max > 1.5 ? 1000 : 1;
  const out = [];
  for (const w of raw) {
    const pts = order(w.pts.map(([x, y]) => [clamp01(x / div), clamp01(y / div)]));
    const area = polyArea(pts);
    if (area < 0.002 || !convex(pts)) continue; // degenerate or self-crossing: drop it
    out.push({ corners: pts.map(([x, y]) => [round4(x), round4(y)]), confidence: round4(clamp01(w.confidence)), area });
  }
  // Best first: big, confident windows. Drop near-duplicates of a window already kept.
  out.sort((a, b) => b.area * (0.5 + b.confidence) - a.area * (0.5 + a.confidence));
  const kept = [];
  for (const w of out) {
    if (kept.some(k => centerDist(k.corners, w.corners) < 0.04)) continue;
    kept.push(w);
    if (kept.length >= MAX_WINDOWS) break;
  }
  return kept.map(({ corners, confidence }) => ({ corners, confidence }));
}

const clamp01 = v => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));
const round4 = v => Math.round(v * 10000) / 10000;
function order(p) {
  // Top-left, top-right, bottom-right, bottom-left: sort clockwise around the center, start nearest the top-left.
  const cx = p.reduce((s, q) => s + q[0], 0) / 4, cy = p.reduce((s, q) => s + q[1], 0) / 4;
  const s = p.slice().sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));
  let i = 0;
  for (let k = 1; k < 4; k++) if (s[k][0] + s[k][1] < s[i][0] + s[i][1]) i = k;
  return s.slice(i).concat(s.slice(0, i));
}
function polyArea(p) {
  let a = 0;
  for (let i = 0; i < 4; i++) { const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % 4]; a += x1 * y2 - x2 * y1; }
  return Math.abs(a) / 2;
}
function convex(p) {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = p[i], [bx, by] = p[(i + 1) % 4], [cx, cy] = p[(i + 2) % 4];
    const z = (bx - ax) * (cy - by) - (by - ay) * (cx - bx);
    if (Math.abs(z) < 1e-9) continue;
    if (sign && Math.sign(z) !== sign) return false;
    sign = Math.sign(z);
  }
  return sign !== 0;
}
function centerDist(a, b) {
  const c = q => [q.reduce((s, p) => s + p[0], 0) / 4, q.reduce((s, p) => s + p[1], 0) / 4];
  const [ax, ay] = c(a), [bx, by] = c(b);
  return Math.hypot(ax - bx, ay - by);
}
