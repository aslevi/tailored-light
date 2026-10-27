// Tailored Light: customer measuring form (/measure/).
// Intro → tape photos (instructions only; photos go in the text) → one width + one height per window → sent.
// Reads #d=<base64url JSON> per /flow spec ({code, name, windows:[{id, room, label, style}]}) and submits by
// opening a prefilled text to Dana. The last line (TLM1:...) is read by Dana's board; mount is left blank
// because the designer picks it from the photos.
import { DANA_SMS, smsHref, b64urlEncode, b64urlDecode } from '../flow/config.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const FRACS = ['', '1/8', '1/4', '3/8', '1/2', '5/8', '3/4', '7/8'];
const ROOMS = [['living-room', 'Living room'], ['bedroom', 'Bedroom'], ['nursery', 'Nursery'], ['kitchen', 'Kitchen'],
  ['bathroom', 'Bathroom'], ['home-office', 'Home office'], ['dining-room', 'Dining room'], ['other', 'Other']];
const roomLabel = id => (ROOMS.find(r => r[0] === id) || [, ''])[1];
const W_RANGE = [12, 96], H_RANGE = [12, 120];

// ---------- link + state ----------
function readLink() {
  const m = location.hash.match(/[#&]d=([^&]+)/);
  if (!m) return null;
  try { const d = b64urlDecode(m[1]); return d && typeof d === 'object' ? d : null; } catch { return null; }
}
let seq = 0;
const newWindow = (src = {}) => ({
  id: String(src.id || `w${Date.now().toString(36)}${(seq++).toString(36)}`),
  room: ROOMS.some(r => r[0] === src.room) ? src.room : (src.room ? 'other' : ''),
  label: src.label || '', style: src.style || '', w: { i: '', f: 0 }, h: { i: '', f: 0 }
});
const link = readLink();
const KEY = 'tl.measure2.' + (location.hash || 'blank');
const load = () => { try { const s = JSON.parse(localStorage.getItem(KEY)); return s && Array.isArray(s.windows) && s.windows.length ? s : null; } catch { return null; } };
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage blocked */ } };
let state = load() || { windows: (link?.windows?.length ? link.windows : [{}]).map(newWindow), cur: 0, view: 'intro' };
if (state.cur >= state.windows.length) state.cur = 0;
const cur = () => state.windows[state.cur];

// ---------- numbers ----------
const val = m => (m && String(m.i).trim() !== '' ? Number(m.i) + (Number(m.f) || 0) / 8 : null);
function fmt(v) {
  if (v == null) return '—';
  const e = Math.round(v * 8), whole = Math.floor(e / 8), f = e % 8;
  return whole && f ? `${whole} ${FRACS[f]}` : whole ? `${whole}` : f ? FRACS[f] : '0';
}
const nameOf = (w, i = state.windows.indexOf(w)) => (w.label || '').trim() || roomLabel(w.room) || `Window ${i + 1}`;
function problem(m, [lo, hi], word) {
  const v = val(m);
  if (v == null) return `Add the ${word}.`;
  if (!Number.isFinite(v) || v < lo || v > hi) return `We make ${word}s from ${lo}" to ${hi}". Text Dana and she'll help.`;
  return '';
}
const complete = w => !problem(w.w, W_RANGE, 'width') && !problem(w.h, H_RANGE, 'height');

// ---------- output ----------
function machine() {
  return {
    code: link?.code || null,
    windows: state.windows.map((w, i) => {
      const r = { id: w.id, label: nameOf(w, i), room: w.room || '', mount: '', w: [val(w.w)], h: [val(w.h)], depth: null, notes: '' };
      if (w.style) r.style = w.style;
      return r;
    })
  };
}
function smsBody() {
  const code = link?.code, name = (link?.name || '').trim();
  const hi = `Hi Dana${name ? `, it's ${name}` : ''}! Here are my measurements${code ? ` for ${code}` : ''}:`;
  const lines = state.windows.map((w, i) => `${nameOf(w, i)}: W ${fmt(val(w.w))} × H ${fmt(val(w.h))} in`);
  return `${hi}\n\n${lines.join('\n')}\n\nI'll attach my tape photos (width and height) in this text.\n\nTLM1:${b64urlEncode(machine())}`;
}
const helpHref = () => smsHref(DANA_SMS, "Hi Dana! Can you walk me through measuring my window?");
const threadHref = () => `sms:${DANA_SMS}`;

// ---------- rendering ----------
function chip() {
  const n = state.windows.length, w = cur();
  return `<button class="win-chip" type="button" data-open-wins aria-haspopup="dialog">${esc(nameOf(w))} · ${state.cur + 1} of ${n}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>`;
}
function renderSize() {
  const w = cur();
  $('#room').value = w.room || '';
  $('#w-i').value = w.w.i; $('#w-f').value = String(w.w.f || 0);
  $('#h-i').value = w.h.i; $('#h-f').value = String(w.h.f || 0);
  ['w', 'h'].forEach(k => { $(`#${k}-msg`).textContent = ''; $(`#${k}-i`).classList.remove('bad'); });
  updatePrimary();
}
function updatePrimary() {
  const last = state.cur === state.windows.length - 1, p = $('#primary'), nl = $('#next-line');
  if (last) {
    p.textContent = state.windows.length > 1 ? `Send ${state.windows.length} windows to Dana` : 'Send to Dana';
    p.href = state.windows.every(complete) ? smsHref(DANA_SMS, smsBody()) : '#';
    nl.hidden = true;
  } else {
    p.textContent = 'Next window'; p.href = '#';
    nl.hidden = false; nl.textContent = `Next: ${nameOf(state.windows[state.cur + 1])}`;
  }
}
function renderSent() {
  const n = state.windows.length;
  $('#recv-line').textContent = `${n} window${n > 1 ? 's' : ''} · add 2 tape photos per window in the text`;
  $('#sizes').innerHTML = state.windows.map((w, i) => `${esc(nameOf(w, i))} · ${fmt(val(w.w))} × ${fmt(val(w.h))}`).join('<br>');
  $('#resend').href = smsHref(DANA_SMS, smsBody());
  $('#to-texts').href = threadHref();
}
function show(view) {
  if (view) state.view = view;
  save();
  $$('.view').forEach(v => { v.hidden = v.id !== 'v-' + state.view; });
  $$('.win-chip-slot').forEach(s => { s.innerHTML = state.windows.length > 1 || cur().label || cur().room ? chip() : ''; });
  if (state.view === 'size') renderSize();
  if (state.view === 'sent') renderSent();
  window.scrollTo(0, 0);
}
function validate(showAll) {
  const w = cur(); let ok = true;
  for (const [k, range, word] of [['w', W_RANGE, 'width'], ['h', H_RANGE, 'height']]) {
    const msg = problem(w[k], range, word), filled = String(w[k].i).trim() !== '';
    const visible = msg && (showAll || filled) ? msg : '';
    $(`#${k}-msg`).textContent = visible; $(`#${k}-i`).classList.toggle('bad', !!visible);
    if (msg) ok = false;
  }
  return ok;
}

// ---------- window sheet ----------
function openWins() {
  const list = $('#win-list');
  list.innerHTML = state.windows.map((w, i) => `<li><button type="button" data-pick-win="${i}" aria-current="${i === state.cur}">${esc(nameOf(w, i))}<span>${complete(w) ? `${fmt(val(w.w))} × ${fmt(val(w.h))}` : 'Not measured yet'}</span></button>${state.windows.length > 1 ? `<button type="button" class="rm" data-rm-win="${i}" aria-label="Remove ${esc(nameOf(w, i))}">&times;</button>` : ''}</li>`).join('');
  $('#win-name').value = cur().label || '';
  $('#win-sheet').hidden = false;
}
function closeWins() { $('#win-sheet').hidden = true; show(); }

// ---------- init ----------
function init() {
  $('#room').innerHTML = '<option value="">Pick a room</option>' + ROOMS.map(([id, l]) => `<option value="${id}">${l}</option>`).join('');
  const fr = FRACS.map((f, i) => `<option value="${i}">${i ? f : '0/8'}</option>`).join('');
  $('#w-f').innerHTML = fr; $('#h-f').innerHTML = fr;
  if (link?.name) $('#intro-sub').textContent = `Hi ${link.name}! A metal tape and your phone. Dana checks every number before anything is made.`;
  $$('[data-help]').forEach(a => { a.href = helpHref(); });

  document.addEventListener('click', e => {
    const go = e.target.closest('[data-go]');
    if (go) { show(go.dataset.go); return; }
    if (e.target.closest('[data-open-wins]')) { openWins(); return; }
    const pw = e.target.closest('[data-pick-win]');
    if (pw) { state.cur = +pw.dataset.pickWin; closeWins(); return; }
    const rm = e.target.closest('[data-rm-win]');
    if (rm) { state.windows.splice(+rm.dataset.rmWin, 1); state.cur = Math.min(state.cur, state.windows.length - 1); save(); openWins(); return; }
    if (e.target.closest('#win-done') || e.target.id === 'win-sheet') { closeWins(); return; }
  });
  $('#win-name').addEventListener('input', e => { cur().label = e.target.value.slice(0, 40); save(); });

  const onInput = () => {
    const w = cur();
    w.room = $('#room').value;
    w.w = { i: $('#w-i').value.replace(/[^0-9]/g, '').slice(0, 3), f: +$('#w-f').value };
    w.h = { i: $('#h-i').value.replace(/[^0-9]/g, '').slice(0, 3), f: +$('#h-f').value };
    if ($('#w-i').value !== w.w.i) $('#w-i').value = w.w.i;
    if ($('#h-i').value !== w.h.i) $('#h-i').value = w.h.i;
    save(); updatePrimary();
    $$('.win-chip-slot').forEach(s => { s.innerHTML = chip(); });
  };
  ['#room', '#w-i', '#w-f', '#h-i', '#h-f'].forEach(s => { $(s).addEventListener('input', onInput); $(s).addEventListener('change', onInput); });
  ['#w-i', '#h-i'].forEach(s => $(s).addEventListener('blur', () => validate(false)));

  $('#primary').addEventListener('click', e => {
    if (!validate(true)) { e.preventDefault(); return; }
    const last = state.cur === state.windows.length - 1;
    if (!last) { e.preventDefault(); state.cur++; show('photos'); return; }
    const bad = state.windows.findIndex(w => !complete(w));
    if (bad >= 0) { e.preventDefault(); state.cur = bad; show('size'); validate(true); return; }
    // Let the sms: link open Messages, then show the sent screen.
    setTimeout(() => show('sent'), 300);
  });
  $('#add').addEventListener('click', () => {
    if (!validate(true)) return;
    state.windows.push(newWindow({ room: cur().room })); state.cur = state.windows.length - 1; show('photos');
  });
  $('#edit').addEventListener('click', () => { state.cur = 0; show('size'); });
  $('#copy').addEventListener('click', async () => {
    const b = $('#copy');
    try { await navigator.clipboard.writeText(smsBody()); b.textContent = 'copied'; }
    catch { b.textContent = 'copy failed'; }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#win-sheet').hidden) closeWins(); });
  show();
}
addEventListener('hashchange', () => location.reload());
init();
