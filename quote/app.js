import { DANA_SMS, smsHref } from '../flow/config.js';
import { parseQuote, totals, money, pct, approvalText, questionText, inches, swatchSlug, roomImage, parseDate, validUntil, fmtDate } from './quote-core.js';

const $ = id => document.getElementById(id);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const cap = s => String(s || '').replace(/[-_]+/g, ' ').replace(/^\s*\w/, c => c.toUpperCase()).trim();
const prettyPhone = n => { const d = n.replace(/\D/g, '').slice(-10); return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : n; };

// Fallback dot colors when a swatch photo isn't available (from catalog.js).
const HEX = { 'daylight weave|white': '#E1E0DF', 'daylight weave|oat': '#E1D1C4', 'daylight weave|mocha': '#B1A696', 'morning haze|cream': '#DCD8D5', 'morning haze|oat': '#C9C9CB', 'morning haze|harbor blue': '#5978A1', 'deep sleep|white': '#E7E7E7', 'deep sleep|oat': '#CEC0A9', 'deep sleep|latte': '#AEA79B', 'deep sleep|fog': '#727581', 'clear view|white': '#D9D7DE', 'clear view|mist': '#DCDBDF', 'clear view|slate': '#979B9A', 'twin light|white': '#E9ECF4', 'twin light|oat': '#F3F0E6', 'twin light|mist': '#C1C3CD', 'twin light|slate': '#A9AFBC', 'sand stripe|oat': '#DDDBD8', 'sand stripe|walnut': '#ACA49A', 'twin shade|mist': '#E2E4EB', 'twin shade|sand': '#DFDCD6', 'raw linen|flax': '#D9D8CA', 'raw linen|cream': '#C9C9BB', 'soft cotton|sand': '#B1AA97', 'soft cotton|mist': '#AEAAA1', 'soft cotton|sage': '#ACB49F', 'soft cotton|slate': '#858E94', 'ticking stripe|cream & fog': '#BEBCBA', 'sheer voile|harbor': '#6B738C', 'blackout linen|cream': '#D4D4C4' };
const NAMED = { white: '#ECEAE6', cream: '#E6DFD0', oat: '#D9CDB8', flax: '#D9D8CA', sand: '#CFC4AE', linen: '#E4DCCB', mist: '#D5D6DA', fog: '#8C8F98', slate: '#7F878D', grey: '#9A9A98', gray: '#9A9A98', sage: '#ACB49F', mocha: '#9C8C7A', latte: '#AEA79B', walnut: '#7A6655', navy: '#38455E', blue: '#5978A1', harbor: '#6B738C', black: '#2E2E2C', charcoal: '#4A4A48' };
const dotColor = (f, c) => HEX[`${String(f).toLowerCase()}|${String(c).toLowerCase()}`] || NAMED[String(c).toLowerCase().split(/\s+/).pop()] || '#CDBFA8';

const STYLE = { roller: 'Roller shade', roman: 'Roman shade', zebra: 'Zebra shade' };
const FOLD = { flat: 'Flat fold', hobbled: 'Hobbled fold', relaxed: 'Relaxed fold' };
const LINING = { dark: 'Room-darkening lining', 'room-darkening': 'Room-darkening lining', darkening: 'Room-darkening lining', blackout: 'Blackout lining', privacy: 'Privacy lining', standard: 'Standard lining', none: 'Unlined', unlined: 'Unlined' };
const MOUNT = { inside: 'Inside mount', outside: 'Outside mount' };
const label = (map, v, suffix = '') => map[String(v || '').toLowerCase()] || (v ? cap(v) + suffix : '');

function swatchEl(line) {
  const wrap = el('span', 'swatch');
  wrap.style.setProperty('--dot', dotColor(line.family, line.color));
  const slug = swatchSlug(line.family, line.color);
  if (slug && line.family && line.color) {
    const img = new Image();
    img.alt = ''; img.decoding = 'async';
    img.onload = () => wrap.classList.add('has-img');
    img.onerror = () => img.remove();
    img.src = `../swatches/${slug}.webp`;
    wrap.append(img);
  }
  return wrap;
}

function lineCard(line, i) {
  const li = el('li', 'line');
  const vis = el('div', 'visual');
  const room = roomImage(line.room);
  if (room) {
    const img = new Image();
    img.src = `../rooms/frontal-v2/${room}.webp`; img.alt = ''; img.decoding = 'async';
    img.onerror = () => { img.remove(); vis.classList.add('plain'); };
    vis.append(img);
  } else vis.classList.add('plain');
  vis.style.setProperty('--dot', dotColor(line.family, line.color));
  vis.append(swatchEl(line));
  li.append(vis);

  const body = el('div', 'body');
  const head = el('div', 'line-head');
  const titles = el('div');
  const where = line.label || cap(line.room) || `Window ${i + 1}`;
  titles.append(el('p', 'where', where));
  const fabric = [line.family, line.color].filter(Boolean).join(' · ');
  titles.append(el('h3', null, fabric ? `${fabric}` : label(STYLE, line.style)));
  head.append(titles, el('p', 'price', money(Math.round(Number(line.price) * 100))));
  body.append(head);

  const specs = el('dl', 'specs');
  const add = (k, v, cls) => { if (!v) return; const d = el('div', cls); d.append(el('dt', null, k), el('dd', null, v)); specs.append(d); };
  add('Style', label(STYLE, line.style, ' shade'));
  if (line.label && line.room) add('Room', cap(line.room));
  if (line.fold) add('Fold', label(FOLD, line.fold, ' fold'));
  if (line.lining) add('Lining', label(LINING, line.lining, ' lining'));
  add('Mount', label(MOUNT, line.mount, ' mount'));
  const w = inches(line.w), h = inches(line.h);
  if (w || h) add('Finished size', `${w || '—'}″ W × ${h || '—'}″ H`, 'wide');
  body.append(specs);
  if (line.checked) body.append(el('p', 'checked', 'Measurements checked by our team'));
  li.append(body);
  return li;
}

function renderTotals(q, t) {
  const dl = $('totals');
  const row = (k, v, cls) => { const d = el('div', cls); d.append(el('dt', null, k), el('dd', null, v)); dl.append(d); };
  row(`Subtotal (${q.lines.length} ${q.lines.length === 1 ? 'shade' : 'shades'})`, money(t.subtotal));
  row('Shipping', t.shipping ? money(t.shipping) : 'Free', t.shipping ? '' : 'free');
  row(t.rate ? `Sales tax (${pct(t.rate)})` : 'Sales tax', money(t.tax));
  row('Total', money(t.total), 'grand');
}

function show(id) { for (const s of ['loading', 'invalid', 'quote']) $(s).hidden = s !== id; }

function invalid() {
  show('invalid');
  $('invalid-sms').href = smsHref(DANA_SMS, 'Hi Dana, my quote link looks incomplete. Could you resend it?');
  document.title = 'Quote link incomplete · Tailored Light';
}

function render(q) {
  const t = totals(q);
  const first = String(q.name || '').trim().split(/\s+/)[0];
  const date = parseDate(q.date), until = validUntil(q);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const expired = until && until < today;

  document.title = `Quote ${q.code} · Tailored Light`;
  $('top-code').textContent = q.code;
  $('q-code').textContent = q.code;
  $('q-title').textContent = first ? `${first}, here are your shades` : 'Here are your shades';
  $('q-date').textContent = fmtDate(date) || '—';
  $('q-valid').textContent = fmtDate(until) || '—';
  $('q-count').textContent = String(q.lines.length);
  if (expired) { $('q-expired').hidden = false; $('q-expired').textContent = `This quote expired on ${fmtDate(until)}. Text us and we'll refresh it.`; }

  const ol = $('lines');
  q.lines.forEach((l, i) => ol.append(lineCard(l, i)));
  if (q.notes && String(q.notes).trim()) { $('note').hidden = false; $('note-text').textContent = String(q.notes); }

  renderTotals(q, t);
  $('mbar-total').textContent = money(t.total);

  const askHref = smsHref(DANA_SMS, questionText(q));
  $('ask-btn').href = askHref; $('trust-sms').href = askHref;
  const yes = approvalText(q, t), yesHref = smsHref(DANA_SMS, yes);
  $('send-yes').href = yesHref;
  $('yes-text').textContent = yes;
  $('dana-num').textContent = prettyPhone(DANA_SMS);
  document.querySelectorAll('.dana-pretty').forEach(n => n.textContent = prettyPhone(DANA_SMS));
  $('confirm-summary').textContent = `You're approving ${q.lines.length} custom ${q.lines.length === 1 ? 'shade' : 'shades'} for ${money(t.total)}, quote ${q.code}. Nothing is charged now.`;

  if (expired) {
    const b = $('approve-btn');
    b.textContent = 'Ask Dana to refresh this quote';
    b.onclick = () => { location.href = smsHref(DANA_SMS, `Hi Dana, my quote ${q.code} expired. Could you refresh it?`); };
  } else {
    $('approve-btn').onclick = () => step('confirm');
  }
  $('back-btn').onclick = () => step('approve');
  $('send-yes').addEventListener('click', () => setTimeout(() => step('sent'), 400));
  $('again-btn').onclick = () => { location.href = yesHref; };
  $('copy-btn').onclick = async () => {
    try { await navigator.clipboard.writeText(yes); $('copied').textContent = 'Copied'; }
    catch { const r = document.createRange(); r.selectNodeContents($('yes-text')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); $('copied').textContent = 'Selected — copy it'; }
  };

  // Payment: placeholder until Stripe. A https payUrl in the quote JSON turns it on.
  const pay = $('pay-btn');
  let payUrl = null;
  try { if (q.payUrl) { const u = new URL(q.payUrl); if (u.protocol === 'https:') payUrl = u.href; } } catch { /* ignore */ }
  if (payUrl && !expired) {
    pay.href = payUrl; pay.removeAttribute('aria-disabled'); pay.removeAttribute('tabindex'); pay.removeAttribute('role');
    pay.rel = 'noopener'; pay.classList.add('live');
    pay.lastChild.textContent = `Pay ${money(t.total)} securely`;
    $('pay-note').textContent = 'Secure checkout. Approve first if you haven\'t texted Dana yet.';
  }

  show('quote');
  setupMobileBar();
}

function step(name) {
  $('approve-step').hidden = name !== 'approve';
  $('confirm-step').hidden = name !== 'confirm';
  $('sent-step').hidden = name !== 'sent';
  const target = { approve: $('approve-btn'), confirm: $('confirm-step'), sent: $('sent-step') }[name];
  target.focus({ preventScroll: true });
  target.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}

function setupMobileBar() {
  const bar = $('mbar'), sum = $('summary');
  if (!('IntersectionObserver' in window)) return;
  bar.hidden = false;
  new IntersectionObserver(([e]) => bar.classList.toggle('away', e.isIntersecting || e.boundingClientRect.top < 0), { threshold: 0 }).observe(sum);
  $('mbar-btn').addEventListener('click', ev => { ev.preventDefault(); sum.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
}

function init() {
  const r = parseQuote(location.hash);
  if (!r.ok) return invalid();
  try { render(r.quote); } catch (e) { console.warn('quote render failed', e); invalid(); }
}
addEventListener('hashchange', () => location.reload());
init();
