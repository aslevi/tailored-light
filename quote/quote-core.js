// Pure quote logic (no DOM). /dana/ can import this to build links and match approvals.
import { b64urlDecode, b64urlEncode } from '../flow/config.js';

export const DEFAULT_VALID_DAYS = 14;

// Dana's board: build the customer link for a quote object.
export const quoteLink = (quote, base = 'https://aslevi.github.io/tailored-light/quote/') => `${base}#d=${b64urlEncode(quote)}`;

// FNV-1a 32-bit over JSON.stringify(quote), base36, 6 chars. Dana's board computes the same
// from the quote JSON it stored, so a "TLQ1:xxxxxx" line in a reply identifies the exact quote.
export function quoteHash(quote) {
  const s = JSON.stringify(quote);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36).padStart(7, '0').slice(-6);
}

const num = v => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);
const cents = v => Math.round(num(v) * 100);

// Read '#d=...' (or a bare hash string). Returns {ok:true, quote} or {ok:false, reason}.
export function parseQuote(hash) {
  const m = /(?:^#?|[#&])d=([A-Za-z0-9_-]+)/.exec(hash || '');
  if (!m) return { ok: false, reason: 'missing' };
  let q;
  try { q = b64urlDecode(m[1]); } catch { return { ok: false, reason: 'decode' }; }
  if (!q || typeof q !== 'object' || q.v !== 1) return { ok: false, reason: 'version' };
  if (typeof q.code !== 'string' || !q.code.trim()) return { ok: false, reason: 'code' };
  if (!Array.isArray(q.lines) || !q.lines.length) return { ok: false, reason: 'lines' };
  for (const l of q.lines) {
    if (!l || typeof l !== 'object' || !Number.isFinite(num(l.price)) || num(l.price) < 0) return { ok: false, reason: 'price' };
  }
  return { ok: true, quote: q };
}

// taxRate may be a fraction (0.06625) or a percent (6.625).
export const taxFraction = r => { const n = num(r); if (!Number.isFinite(n) || n <= 0) return 0; return n > 1 ? n / 100 : n; };

// All money in integer cents. Tax applies to (subtotal - swatch credit + shipping):
// NJ taxes delivery charges on taxable goods, and the credit works as a discount.
export function totals(q) {
  const subtotal = q.lines.reduce((s, l) => s + cents(l.price), 0);
  const credit = Math.min(Math.max(0, cents(q.swatchCredit) || 0), subtotal);
  const shipping = Math.max(0, cents(q.shipping) || 0);
  const rate = taxFraction(q.taxRate);
  const taxable = subtotal - credit + shipping;
  const tax = Math.round(taxable * rate);
  return { subtotal, credit, shipping, rate, taxable, tax, total: taxable + tax };
}

export const money = c => (c < 0 ? '−' : '') + '$' + (Math.abs(c) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const pct = r => (Math.round(r * 100000) / 1000).toString() + '%';

export const approvalText = (q, t) => `YES — I approve quote ${q.code} for ${money(t.total)}\nTLQ1:${quoteHash(q)}`;
export const questionText = q => `Hi Dana, I have a question about quote ${q.code}: `;

// Inches (number like 35.375, or a string like "35 3/8") → "35 ⅜", rounded to the nearest 1/8.
const FR = ['', '⅛', '¼', '⅜', '½', '⅝', '¾', '⅞'];
export function inches(v) {
  let n = num(v);
  if (!Number.isFinite(n) && typeof v === 'string') {
    const m = /^\s*(\d+)?\s*(?:(\d+)\s*\/\s*(\d+))?\s*["″]?\s*$/.exec(v);
    if (m && (m[1] || m[2])) n = (+m[1] || 0) + (m[2] ? +m[2] / +m[3] : 0);
  }
  if (!Number.isFinite(n) || n <= 0) return '';
  let e = Math.round(n * 8), whole = Math.floor(e / 8), f = e % 8;
  return whole ? `${whole}${f ? ' ' + FR[f] : ''}` : FR[f];
}

// "Raw Linen" + "Flax" → raw-linen-flax; "Cream & Fog" → cream-fog (runs collapse to one dash).
export const swatchSlug = (family, color) => `${family || ''}-${color || ''}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const ROOMS = ['living-room', 'bathroom', 'kitchen', 'dining-room', 'home-office', 'bedroom', 'nursery'];
export const roomSlug = r => String(r || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const roomImage = r => { const s = roomSlug(r); return ROOMS.includes(s) ? s : (s === 'office' ? 'home-office' : s === 'living' ? 'living-room' : s === 'dining' ? 'dining-room' : null); };

// Local-date helpers ('2026-10-26' must not shift a day in US time zones).
export function parseDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || '');
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  const d = new Date(s); return isNaN(d) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
export function validUntil(q) {
  const d = parseDate(q.date); if (!d) return null;
  const days = Number.isFinite(num(q.validDays)) && num(q.validDays) > 0 ? num(q.validDays) : DEFAULT_VALID_DAYS;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}
export const fmtDate = d => d ? d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '';
