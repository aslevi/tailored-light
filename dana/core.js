// Pure logic for Dana's board (no DOM, no storage): parsing pasted texts, building links, quote math.
import { b64urlEncode, b64urlDecode } from '../flow/config.js';
import { designCode, canonicalLook } from '../flow/code.js';

export { designCode, canonicalLook };

export const STAGES = ['new', 'qualified', 'swatches', 'measuring', 'ready_to_quote', 'quoted', 'paid', 'ordered', 'shipped', 'delivered', 'review_asked', 'closed'];
export const STAGE_LABEL = { new: 'New', qualified: 'Qualified', swatches: 'Swatches', measuring: 'Measuring', ready_to_quote: 'Ready to quote', quoted: 'Quoted', paid: 'Paid', ordered: 'Ordered', shipped: 'Shipped', delivered: 'Delivered', review_asked: 'Review asked', closed: 'Closed' };
export const stageIndex = s => STAGES.indexOf(s);

export const ROOMS = { 'living-room': 'Living room', bathroom: 'Bathroom', kitchen: 'Kitchen', 'dining-room': 'Dining room', 'home-office': 'Home office', bedroom: 'Bedroom', nursery: 'Nursery' };
export const STYLES = { roller: 'Roller', roman: 'Roman', zebra: 'Zebra' };
export const FOLDS = { flat: 'Flat', hobbled: 'Hobbled', relaxed: 'Relaxed' };
export const roomLabel = id => ROOMS[id] || (id ? String(id).replace(/-/g, ' ').replace(/^./, c => c.toUpperCase()) : '');
export const roomSlug = r => { const s = String(r || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); return ROOMS[s] ? s : s === 'office' ? 'home-office' : s === 'living' ? 'living-room' : s === 'dining' ? 'dining-room' : ''; };

export const uid = (p = 'L') => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const now = () => new Date().toISOString();

// "Raw Linen roman in Flax", with fold and lining when they matter.
export function designSummary(l) {
  if (!l) return '';
  const st = (STYLES[l.style] || l.style || 'shade').toLowerCase();
  const fold = l.style === 'roman' && l.fold && l.fold !== 'flat' ? (FOLDS[l.fold] || l.fold).toLowerCase() + ' ' : '';
  return `${fold}${l.family || ''} ${st}${l.color ? ' in ' + l.color : ''}${l.lining ? ' with room-darkening lining' : ''}`.trim();
}

// ---------- parsing pasted text ----------
const URL_RE = /https?:\/\/[^\s<>"]+/g;
const lookFromURL = u => {
  try {
    const url = new URL(u.replace(/[).,!?]+$/, ''));
    const q = url.searchParams;
    if (!q.get('room') && !q.get('s')) return null;
    return { url: url.href, q };
  } catch { return null; }
};

// Returns {kind:'lead'|'measure'|'quote', ...} or {kind:null, error}
export function parseText(raw) {
  const text = String(raw || '').trim();
  if (!text) return { kind: null, error: 'Paste a text first.' };
  const tlm = /TLM1:\s*([A-Za-z0-9_-]+)/.exec(text);
  if (tlm) {
    try {
      const d = b64urlDecode(tlm[1]);
      const windows = Array.isArray(d.windows) ? d.windows.map(normalizeWindow) : [];
      return { kind: 'measure', code: d.code || codeIn(text), name: d.name || '', windows, raw: d };
    } catch { return { kind: null, error: 'Found a TLM1 line but could not read it. Ask the customer to resend, or copy the whole text including the TLM1 line.' }; }
  }
  const tlq = /TLQ1:\s*([A-Za-z0-9_-]+)/.exec(text);
  if (tlq || /\bYES\b[^\n]*approve[^\n]*quote/i.test(text)) {
    const total = /\$\s?([\d,]+(?:\.\d{1,2})?)/.exec(text);
    return { kind: 'quote', code: codeIn(text), hash: tlq ? tlq[1] : '', total: total ? Number(total[1].replace(/,/g, '')) : null };
  }
  const look = (text.match(URL_RE) || []).map(lookFromURL).find(Boolean);
  if (!look) return { kind: null, error: "Didn't find a design link, a TLM1 measurement line or a TLQ1 approval in that text." };
  const q = look.q;
  const style = STYLES[q.get('s')] ? q.get('s') : '';
  const lead = {
    room: q.get('room') || '', style, family: q.get('f') || '', color: q.get('c') || '',
    fold: style === 'roman' && q.get('r') ? q.get('r') : '', lining: q.get('l') === 'dark',
  };
  const canonical = canonicalLook(q);
  const code = designCode(q);
  const typed = codeIn(text);
  const refM = /\(via ([\w.-]{1,30})\)/.exec(text) || [null, q.get('ref')];
  const kit = /swatch kit/i.test(text);
  const lookUrl = look.url.split('?')[0] + '?' + canonical + (refM[1] ? '&ref=' + encodeURIComponent(refM[1]) : '');
  return { kind: 'lead', lead: { ...lead, code, ref: refM[1] || '', lookUrl }, kit, typedCode: typed, codeMismatch: !!typed && typed !== code, message: text };
}
const codeIn = t => (/\bTL-[0-9A-Z]{4}\b/.exec(t) || [''])[0];

// ---------- measurements ----------
// Accepts 34.375, "34.375", "34 3/8", "34-3/8", '34 3/8"', "3/8". Returns a number or null.
export function parseInches(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).trim().replace(/["″]|in(ches)?$/gi, '').trim();
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s);
  const m = /^(\d+)?(?:[\s-]+)?(?:(\d+)\s*\/\s*(\d+))?$/.exec(s);
  if (m && (m[1] || m[2]) && (!m[2] || +m[3])) return (+m[1] || 0) + (m[2] ? +m[2] / +m[3] : 0);
  return null;
}
const FR = ['', '1/8', '1/4', '3/8', '1/2', '5/8', '3/4', '7/8'];
export function fmtIn(v) {
  const n = parseInches(v);
  if (n == null) return '';
  const e = Math.round(n * 8), whole = Math.floor(e / 8), f = e % 8;
  return whole ? `${whole}${f ? ' ' + FR[f] : ''}` : FR[f] || '0';
}
export function normalizeWindow(w, i = 0) {
  const arr = a => (Array.isArray(a) ? a : a == null || a === '' ? [] : [a]).map(parseInches);
  return {
    id: String(w.id || 'w' + (i + 1)), room: w.room || '', label: w.label || '', style: w.style || '',
    mount: w.mount === 'outside' ? 'outside' : w.mount === 'inside' ? 'inside' : '',
    w: arr(w.w), h: arr(w.h), depth: parseInches(w.depth), notes: w.notes || '',
    obs: Array.isArray(w.obs) ? w.obs.filter(o => o && o !== 'none') : [], clear: typeof w.clear === 'boolean' ? w.clear : null,
    photosReceived: !!w.photosReceived, measuredAt: w.measuredAt || null, checkedAt: w.checkedAt || null, checkedBy: w.checkedBy || null, check: w.check || {},
  };
}
// Inside: smallest width, largest height. Outside: the (first) width and height given.
export function orderSize(w) {
  const ws = (w.w || []).filter(n => n > 0), hs = (w.h || []).filter(n => n > 0);
  if (!ws.length || !hs.length) return null;
  return w.mount === 'outside' ? { w: ws[0], h: hs[0] } : { w: Math.min(...ws), h: Math.max(...hs) };
}
export const isGuaranteed = w => !!(w.checkedAt && (!w.measuredAt || new Date(w.checkedAt) > new Date(w.measuredAt)));
export const windowName = (w, i) => w.label || [roomLabel(w.room) || w.room, i + 1].filter(Boolean).join(' ');

// Automatic flags from dana-check.md (steps 3, 4, 8). Dana still does the real check.
export function windowFlags(w) {
  const f = [], ws = (w.w || []).filter(n => n > 0), hs = (w.h || []).filter(n => n > 0);
  if (!w.mount) { f.push('Pick mount from photos'); if (!ws.length || !hs.length) f.push('Needs width and height'); }
  if (w.mount === 'inside') {
    if (ws.length < 3) f.push('Needs 3 widths');
    if (hs.length < 3) f.push('Needs 3 heights');
    if (w.depth == null) f.push('Depth missing');
    else if (w.depth < 2) f.push(`Depth ${fmtIn(w.depth)}" under 2" working rule: outside mount`);
  } else if (w.mount === 'outside' && (!ws.length || !hs.length)) f.push('Needs width and height');
  const spread = a => a.length > 1 ? Math.max(...a) - Math.min(...a) : 0;
  if (spread(ws) > 0.5 || spread(hs) > 0.5) f.push('Spread over 1/2": ask for diagonals');
  else if (spread(ws) > 0.25) f.push('Widths spread over 1/4": slightly bigger gap');
  if (ws.some(n => n < 12 || n > 84)) f.push('Width outside 12–84"');
  if (hs.some(n => n < 18 || n > 96)) f.push('Height outside 18–96"');
  if (ws.length && ws.some(n => !Number.isInteger(n * 8))) f.push('Not to 1/8": width rounds down');
  if (w.mount === 'outside' && w.clear === false) f.push('Under 3" flat wall: check clearance');
  if (w.obs && w.obs.length) f.push('In the way: ' + w.obs.join(', '));
  if (!w.photosReceived) f.push('Photos not received');
  return f;
}

export const CHECKLIST = [
  ['complete', 'Everything is there', 'Inside: 3 widths, 3 heights, depth, 3 photos. Outside: width, height, clearance answer, 3 photos. Nearest 1/8".'],
  ['number', 'Right number picked', 'Inside: smallest width, largest height, exact opening. Never deduct twice.'],
  ['square', 'Square enough', 'Widths ≤ 1/4" apart. Over 1/2" (or heights): diagonals; > 1/4" apart → outside.'],
  ['depth', 'Depth fits', 'Inside needs 2" clear (working rule). Fully inside: 3½" roller/zebra, 2½" Roman.'],
  ['photos', 'Photos match the numbers', 'Metal tape, hooked, read right (3/8 vs 5/8, 1" off, feet vs inches). Same window. Frame, not glass.'],
  ['reference', 'Cross-checked a known size', 'Estimate one width from the photo (tape, paper, outlet, door). Within ~10%.'],
  ['obstructions', 'Obstructions noted', 'Cranks, locks, alarm sensors, tile, molding. French door / arch / bay → flag to Arieh, don\'t approve.'],
  ['sanity', 'Sanity ranges OK', 'Width 12–84", height 18–96", within 1" of matching neighbors, W/H not swapped.'],
  ['mount', 'Mount makes sense', 'Dark bedroom/nursery → outside. Shallow or out of square → outside. Outside overlap 2½–3" sides, 3–4" above.'],
  ['readback', 'Read back, customer said YES', 'Final order sizes texted back and a "YES" in writing.'],
];

// ---------- links ----------
export function measurePayload(lead) {
  const wins = lead.windows && lead.windows.length
    ? lead.windows.map(w => ({ id: w.id, room: roomLabel(w.room) || w.room || roomLabel(lead.room), label: w.label || undefined, style: w.style || lead.style }))
    : [{ id: 'w1', room: roomLabel(lead.room), label: roomLabel(lead.room) + ' 1', style: lead.style }];
  const d = { v: 1, code: lead.code };
  if (lead.name) d.name = firstName(lead.name);
  d.windows = wins.map(w => JSON.parse(JSON.stringify(w)));
  return d;
}
export const firstName = n => String(n || '').trim().split(/\s+/)[0] || '';
export const pageURL = (page, base) => new URL(`../${page}/`, base).href;
export const measureLink = (lead, base) => pageURL('measure', base) + '#d=' + b64urlEncode(measurePayload(lead));
export const quoteLinkFor = (json, base) => pageURL('quote', base) + '#d=' + b64urlEncode(json);
export const decodeHash = url => b64urlDecode(/#d=([A-Za-z0-9_-]+)/.exec(url)[1]);

// ---------- quote math: single source of truth is /quote/quote-core.js so TLQ1 hashes match ----------
import { quoteHash, totals, taxFraction } from '../quote/quote-core.js';
export { quoteHash, taxFraction };
export const quoteTotals = q => totals({ ...q, lines: (q.lines || []).map(l => ({ ...l, price: Number(l.price) || 0 })) });
export const money = c => '$' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Find the quote an approval refers to. Exact hash first; then code + total.
export function matchApproval(leads, p) {
  for (const l of leads) for (const q of l.quotes || []) if (p.hash && quoteHash(q.json) === p.hash) return { lead: l, quote: q, exact: true };
  const byCode = leads.filter(l => p.code && (l.code === p.code || (l.quotes || []).some(q => q.json.code === p.code)));
  for (const l of byCode) for (const q of [...(l.quotes || [])].reverse()) {
    if (p.total != null && Math.abs(quoteTotals(q.json).total - Math.round(p.total * 100)) < 1) return { lead: l, quote: q, exact: false };
  }
  return { lead: byCode[0] || null, quote: byCode[0] ? (byCode[0].quotes || []).slice(-1)[0] || null : null, exact: false };
}

// Days since the last event (or creation).
export function lastActivity(l) {
  const ts = [l.createdAt, ...(l.events || []).map(e => e.at)].filter(Boolean).map(t => +new Date(t));
  return ts.length ? Math.max(...ts) : 0;
}
export const daysAgo = t => Math.floor((Date.now() - t) / 86400000);
