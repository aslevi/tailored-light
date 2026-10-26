// Tailored Light: customer measuring form (/measure/).
// Reads #d=<base64url JSON> per /flow spec, submits by opening a prefilled text to Dana.
import { DANA_SMS, smsHref, b64urlEncode, b64urlDecode } from '../flow/config.js';

const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

const FRACS = ['', '1/8', '1/4', '3/8', '1/2', '5/8', '3/4', '7/8'];
const OBS = [['handle', 'Handle or crank'], ['sensor', 'Alarm sensor'], ['tile', 'Tile or trim in the way'], ['none', 'Nothing in the way']];
const OBS_TEXT = { handle: 'handle/crank', sensor: 'alarm sensor', tile: 'tile or trim' };
const STYLES = { roller: 'Roller', roman: 'Roman', zebra: 'Zebra' };
// Working rules from dana-check.md (until supplier specs arrive)
const MIN_DEPTH = 2, FLUSH = { roman: 2.5, roller: 3.5, zebra: 3.5 };
const W_RANGE = [12, 84], H_RANGE = [18, 96], D_MAX = 10;

// ---------- link + state ----------
function readLink() {
  const m = location.hash.match(/[#&]d=([^&]+)/);
  if (!m) return null;
  try { const d = b64urlDecode(m[1]); return d && typeof d === 'object' ? d : null; } catch { return null; }
}
const blankM = () => ({ i: '', f: 0 });
let seq = 0;
function newWindow(src = {}) {
  const id = String(src.id || `w${Date.now().toString(36)}${(seq++).toString(36)}`);
  return {
    id, room: src.room || '', label: src.label || (src.room ? cap(src.room) : ''), style: src.style || '',
    mount: '', w: [blankM(), blankM(), blankM()], h: [blankM(), blankM(), blankM()], depth: blankM(),
    ow: blankM(), oh: blankM(), clear: '', obs: [], notes: ''
  };
}
const link = readLink();
const KEY = 'tl.measure.' + (location.hash || 'blank');
let state = load() || { windows: (link?.windows?.length ? link.windows : [{}]).map(newWindow), view: 'form' };

function load() {
  try { const s = JSON.parse(sessionStorage.getItem(KEY)); return s && Array.isArray(s.windows) && s.windows.length ? s : null; } catch { return null; }
}
function save() { try { sessionStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode etc. */ } }

// ---------- numbers ----------
const val = m => (m && String(m.i).trim() !== '' ? Number(m.i) + (Number(m.f) || 0) / 8 : null);
function fmt(v) {
  if (v == null) return '—';
  const e = Math.round(v * 8), whole = Math.floor(e / 8), f = e % 8;
  return whole && f ? `${whole} ${FRACS[f]}` : whole ? `${whole}` : f ? FRACS[f] : '0';
}
const spread = a => { const v = a.filter(x => x != null); return v.length > 1 ? Math.max(...v) - Math.min(...v) : 0; };
const nameOf = w => (w.label || '').trim() || cap(w.room) || 'Window';

// ---------- rendering ----------
const fracSelect = (name, label) =>
  `<select data-k="${name}.f" aria-label="${esc(label)}, fraction">${FRACS.map((f, i) => `<option value="${i}">${i ? f : '+ 0'}</option>`).join('')}</select>`;
const measureRow = (name, label, ariaBase) => `
  <div class="mrow">
    <label for="__ID__-${name}">${label}</label>
    <div class="minput">
      <input id="__ID__-${name}" data-k="${name}.i" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="in" aria-label="${esc(ariaBase)}, whole inches">
      ${fracSelect(name, ariaBase)}
      <span class="unit" aria-hidden="true">in</span>
    </div>
  </div>`;

const SVG_W = `<svg viewBox="0 0 240 190" aria-hidden="true"><rect x="20" y="10" width="200" height="170" rx="3" fill="#3D4034"/><rect x="34" y="24" width="172" height="146" fill="#E6ECE4"/><g stroke="#E2A54B" stroke-width="3" marker-start="url(#arr)" marker-end="url(#arr)"><line x1="38" y1="50" x2="202" y2="50"/><line x1="38" y1="99" x2="202" y2="99"/><line x1="38" y1="148" x2="202" y2="148"/></g><g font-family="DM Sans,Helvetica,Arial,sans-serif" font-size="13" font-weight="700" fill="#3D4034" text-anchor="middle"><text x="120" y="43">top</text><text x="120" y="92">middle</text><text x="120" y="141">bottom</text></g></svg>`;
const SVG_H = `<svg viewBox="0 0 240 200" aria-hidden="true"><rect x="20" y="10" width="200" height="160" rx="3" fill="#3D4034"/><rect x="34" y="24" width="172" height="146" fill="#E6ECE4"/><rect x="12" y="166" width="216" height="12" rx="2" fill="#3D4034"/><g stroke="#E2A54B" stroke-width="3" marker-start="url(#arr)" marker-end="url(#arr)"><line x1="62" y1="28" x2="62" y2="162"/><line x1="120" y1="28" x2="120" y2="162"/><line x1="178" y1="28" x2="178" y2="162"/></g><g font-family="DM Sans,Helvetica,Arial,sans-serif" font-size="13" font-weight="700" fill="#3D4034" text-anchor="middle"><text x="62" y="195">left</text><text x="120" y="195">center</text><text x="178" y="195">right</text></g></svg>`;
const SVG_D = `<svg viewBox="0 0 260 170" aria-hidden="true"><rect x="10" y="14" width="200" height="34" fill="#3D4034"/><rect x="57" y="48" width="7" height="112" fill="#B9C7C9"/><line x1="210" y1="48" x2="210" y2="160" stroke="#3D4034" stroke-width="1.5" stroke-dasharray="4 4"/><rect x="64" y="124" width="34" height="9" rx="3" fill="#B7836D"/><line x1="66" y1="76" x2="207" y2="76" stroke="#E2A54B" stroke-width="3" marker-start="url(#arr)" marker-end="url(#arr)"/><g font-family="DM Sans,Helvetica,Arial,sans-serif" font-size="13" fill="#3D4034"><text x="136" y="68" text-anchor="middle" font-weight="700">depth</text><text x="18" y="37" fill="#F4EEE4">top of frame</text><text x="50" y="100" text-anchor="end">glass</text><text x="104" y="133">crank? start here</text><text x="214" y="100">front</text><text x="214" y="114">edge</text></g></svg>`;
const SVG_O = `<svg viewBox="0 0 320 260" aria-hidden="true"><rect x="100" y="70" width="120" height="128" rx="2" fill="#3D4034"/><rect x="112" y="82" width="96" height="116" fill="#E6ECE4"/><rect x="90" y="198" width="140" height="10" rx="2" fill="#3D4034"/><rect x="74" y="40" width="172" height="158" rx="3" fill="#E2A54B" fill-opacity=".18" stroke="#E2A54B" stroke-width="2" stroke-dasharray="6 5"/><g stroke="#3D4034" stroke-width="2" marker-start="url(#arrk)" marker-end="url(#arrk)"><line x1="77" y1="140" x2="97" y2="140"/><line x1="223" y1="140" x2="243" y2="140"/></g><g stroke="#E2A54B" stroke-width="3" marker-start="url(#arr)" marker-end="url(#arr)"><line x1="103" y1="228" x2="217" y2="228"/><line x1="272" y1="43" x2="272" y2="195"/><line x1="58" y1="43" x2="58" y2="67"/></g><g font-family="DM Sans,Helvetica,Arial,sans-serif" font-size="15" fill="#3D4034"><text x="160" y="28" text-anchor="middle">3" of flat wall each side</text><text x="160" y="250" text-anchor="middle" font-weight="700">width: outer edge of trim</text><text x="50" y="61" text-anchor="end" font-weight="700">3–4"</text><text x="292" y="119" text-anchor="middle" font-weight="700" transform="rotate(90 292 119)">height</text></g></svg>`;

function cardHTML(w, n, total) {
  const meta = [cap(w.room), STYLES[w.style] || cap(w.style)].filter(Boolean).join(' · ');
  const html = `
  <article class="win" data-id="${esc(w.id)}" aria-labelledby="__ID__-title">
    <div class="win-head">
      <h2 id="__ID__-title">Window ${n}</h2>
      ${meta ? `<span class="chip">${esc(meta)}</span>` : ''}
      ${total > 1 ? `<button type="button" class="link remove" data-act="remove" aria-label="Remove window ${n}">Remove</button>` : ''}
    </div>

    <label class="field" for="__ID__-label">What should we call it?</label>
    <input id="__ID__-label" class="text" data-k="label" type="text" autocomplete="off" placeholder="e.g. Kitchen, over the sink" value="${esc(w.label)}">

    <fieldset class="mount">
      <legend>Where will the shade go?</legend>
      <div class="mount-opts">
        <label class="opt"><input type="radio" name="__ID__-mount" value="inside" data-k="mount" ${w.mount === 'inside' ? 'checked' : ''}>
          <span><b>Inside the frame</b><small>Clean, built-in look. Needs a frame at least 2" deep.</small></span></label>
        <label class="opt"><input type="radio" name="__ID__-mount" value="outside" data-k="mount" ${w.mount === 'outside' ? 'checked' : ''}>
          <span><b>Outside, on the wall</b><small>Covers the trim, blocks the most light, makes the window look bigger.</small></span></label>
      </div>
      <p class="help">Not sure? Choose inside if the frame is at least 2" deep. Still unsure, measure both ways and say so in the notes.</p>
    </fieldset>

    <div class="panel" data-panel="inside" ${w.mount === 'inside' ? '' : 'hidden'}>
      <div class="group">
        <h3>Width, inside the frame</h3>
        <p class="help">Side to side at the top, middle and bottom. Wood to wood, not the glass.</p>
        <figure class="diag">${SVG_W}</figure>
        ${measureRow('w0', 'Top', 'Width at top')}${measureRow('w1', 'Middle', 'Width at middle')}${measureRow('w2', 'Bottom', 'Width at bottom')}
      </div>
      <div class="group">
        <h3>Height, top of the opening to the sill</h3>
        <p class="help">On the left, center and right.</p>
        <figure class="diag">${SVG_H}</figure>
        ${measureRow('h0', 'Left', 'Height at left')}${measureRow('h1', 'Center', 'Height at center')}${measureRow('h2', 'Right', 'Height at right')}
      </div>
      <div class="group">
        <h3>Depth, at the top of the frame</h3>
        <p class="help">From the glass to the front edge. If a crank or handle sticks out, measure from that.</p>
        <figure class="diag">${SVG_D}</figure>
        ${measureRow('depth', 'Depth', 'Depth')}
      </div>
    </div>

    <div class="panel" data-panel="outside" ${w.mount === 'outside' ? '' : 'hidden'}>
      <div class="group">
        <h3>The area to cover</h3>
        <p class="help">Width: outer edge of the trim, left to right. Height: from where the top of the shade goes (3–4" above the trim) down to the sill, or where it should stop.</p>
        <figure class="diag wide">${SVG_O}</figure>
        ${measureRow('ow', 'Width', 'Width of area to cover')}${measureRow('oh', 'Height', 'Height of area to cover')}
      </div>
      <fieldset class="group yn">
        <legend>Is there 3 inches of flat wall on each side and above?</legend>
        <div class="seg">
          <label><input type="radio" name="__ID__-clear" value="yes" data-k="clear" ${w.clear === 'yes' ? 'checked' : ''}><span>Yes</span></label>
          <label><input type="radio" name="__ID__-clear" value="no" data-k="clear" ${w.clear === 'no' ? 'checked' : ''}><span>No</span></label>
        </div>
      </fieldset>
    </div>

    <div class="panel" data-panel="any" ${w.mount ? '' : 'hidden'}>
      <fieldset class="group obs">
        <legend>Anything in the way?</legend>
        ${OBS.map(([v, t]) => `<label class="check"><input type="checkbox" value="${v}" data-k="obs" ${w.obs.includes(v) ? 'checked' : ''}><span>${t}</span></label>`).join('')}
      </fieldset>
      <label class="field" for="__ID__-notes">Notes for Dana <span class="opt-l">(optional)</span></label>
      <textarea id="__ID__-notes" data-k="notes" rows="2" placeholder="e.g. faucet sticks up, curtain rod above">${esc(w.notes)}</textarea>
    </div>

    <div class="warns" aria-live="polite"></div>
  </article>`;
  return html.replaceAll('__ID__', 'x' + esc(w.id).replace(/[^\w-]/g, ''));
}

function fillValues(card, w) {
  const set = (k, m) => {
    const i = card.querySelector(`[data-k="${k}.i"]`), f = card.querySelector(`[data-k="${k}.f"]`);
    if (i) i.value = m.i; if (f) f.value = String(m.f || 0);
  };
  w.w.forEach((m, j) => set('w' + j, m)); w.h.forEach((m, j) => set('h' + j, m));
  set('depth', w.depth); set('ow', w.ow); set('oh', w.oh);
}

function renderForm() {
  const box = $('#windows');
  box.innerHTML = state.windows.map((w, i) => cardHTML(w, i + 1, state.windows.length)).join('');
  [...box.children].forEach((card, i) => { fillValues(card, state.windows[i]); updateWarnings(card); });
}

// ---------- checks ----------
function checks(w) {
  const out = [];
  const range = (v, [lo, hi], what) => {
    if (v == null) return;
    if (v < lo || v > hi) out.push(['warn', `${cap(what)} of ${fmt(v)}" looks ${v < lo ? 'very small' : 'very large'}. Is that in inches? Double-check it.`]);
  };
  if (w.mount === 'inside') {
    const W = w.w.map(val), H = w.h.map(val), D = val(w.depth);
    W.forEach(v => range(v, W_RANGE, 'a width')); H.forEach(v => range(v, H_RANGE, 'a height'));
    const sw = spread(W), sh = spread(H);
    if (sw > 0.5) out.push(['warn', `Your widths differ by ${fmt(sw)}". Older windows are often a bit out of square. Please re-check, and if it holds, measure corner to corner both ways and add both numbers in the notes.`]);
    else if (sw > 0.25) out.push(['warn', `Your widths differ by ${fmt(sw)}". That's more than 1/4", so give them a quick re-check. If they hold, no problem: we'll use the narrowest.`]);
    if (sh > 0.5) out.push(['warn', `Your heights differ by ${fmt(sh)}". Please re-check them.`]);
    if (D != null) {
      if (D < MIN_DEPTH) out.push(['warn', `${fmt(D)}" is shallow for an inside shade. We suggest outside mount instead.`, 'outside']);
      else if (D > D_MAX) out.push(['warn', `A depth of ${fmt(D)}" is unusual. Double-check it's measured from the glass to the front edge.`]);
      else if (D < (FLUSH[w.style] || 3.5)) out.push(['info', `Inside works. At ${fmt(D)}" the shade will stick out a little past the frame.`]);
    }
  } else if (w.mount === 'outside') {
    range(val(w.ow), [W_RANGE[0], 120], 'the width'); range(val(w.oh), H_RANGE, 'the height');
    if (w.clear === 'no') out.push(['info', 'No problem. Note what\'s in the way (molding, a corner, a vent) and we\'ll suggest options.']);
  }
  return out;
}

function updateWarnings(card) {
  const w = byId(card.dataset.id);
  const box = card.querySelector('.warns');
  box.innerHTML = checks(w).map(([lvl, msg, act]) =>
    `<p class="note ${lvl}">${esc(msg)}${act ? ` <button type="button" class="link" data-act="to-${act}">Switch to outside</button>` : ''}</p>`).join('');
}

function missing(w) {
  const m = [];
  if (!w.mount) { m.push('mount'); return m; }
  if (w.mount === 'inside') {
    w.w.forEach((x, j) => val(x) == null && m.push('w' + j));
    w.h.forEach((x, j) => val(x) == null && m.push('h' + j));
    if (val(w.depth) == null) m.push('depth');
  } else {
    if (val(w.ow) == null) m.push('ow');
    if (val(w.oh) == null) m.push('oh');
    if (!w.clear) m.push('clear');
  }
  return m;
}

// ---------- events ----------
const byId = id => state.windows.find(w => w.id === id);

function onChange(e) {
  const el = e.target, k = el.dataset.k, card = el.closest('.win');
  if (!k || !card) return;
  const w = byId(card.dataset.id);
  if (k === 'label' || k === 'notes') w[k] = el.value;
  else if (k === 'mount') { w.mount = el.value; showPanels(card, w); }
  else if (k === 'clear') w.clear = el.value;
  else if (k === 'obs') {
    const boxes = [...card.querySelectorAll('[data-k="obs"]')];
    if (el.value === 'none' && el.checked) boxes.forEach(b => { if (b.value !== 'none') b.checked = false; });
    else if (el.checked) boxes.forEach(b => { if (b.value === 'none') b.checked = false; });
    w.obs = boxes.filter(b => b.checked).map(b => b.value);
  } else {
    const [name, part] = k.split('.');
    const m = name[0] === 'w' && name.length === 2 ? w.w[+name[1]] : name[0] === 'h' && name.length === 2 ? w.h[+name[1]] : w[name];
    if (part === 'i') {
      // accept "35.5" or "35 1/2" typed on a full keyboard; keep digits otherwise
      const raw = el.value.trim();
      if (/^\d{0,3}$/.test(raw)) m.i = raw;
      else if (e.type === 'input' && /^\d+[\s.,/\d]*$/.test(raw)) { /* still typing "35.5" or "35 1/2" */ }
      else {
        const frac = raw.match(/^(\d+)\s+(\d)\/(\d)$/), dec = raw.match(/^(\d+)[.,](\d*)$/);
        const v = frac && +frac[3] ? +frac[1] + frac[2] / frac[3] : dec ? parseFloat(raw.replace(',', '.')) : parseInt(raw, 10);
        if (Number.isFinite(v)) {
          const eighths = Math.round(v * 8);
          m.i = String(Math.floor(eighths / 8)).slice(0, 3);
          if (frac || dec) { m.f = eighths % 8; card.querySelector(`[data-k="${name}.f"]`).value = String(m.f); }
        } else m.i = '';
        el.value = m.i;
      }
    } else m.f = Number(el.value) || 0;
  }
  el.closest('.mrow, fieldset')?.classList.remove('missing');
  updateWarnings(card);
  save();
}

function showPanels(card, w) {
  card.querySelector('[data-panel="inside"]').hidden = w.mount !== 'inside';
  card.querySelector('[data-panel="outside"]').hidden = w.mount !== 'outside';
  card.querySelector('[data-panel="any"]').hidden = !w.mount;
}

function onClick(e) {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const card = btn.closest('.win'), w = card && byId(card.dataset.id);
  if (btn.dataset.act === 'remove' && w) {
    if (!confirm(`Remove ${nameOf(w)}?`)) return;
    state.windows = state.windows.filter(x => x !== w);
    save(); renderForm();
  } else if (btn.dataset.act === 'to-outside' && w) {
    w.mount = 'outside';
    card.querySelector('input[data-k="mount"][value="outside"]').checked = true;
    showPanels(card, w); updateWarnings(card); save();
    card.querySelector('[data-panel="outside"]').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function addWindow() {
  const last = state.windows[state.windows.length - 1];
  const w = newWindow({ room: last?.room, style: last?.style, label: '' });
  state.windows.push(w); save(); renderForm();
  const card = $(`.win[data-id="${CSS.escape(w.id)}"]`);
  card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  card.querySelector('[data-k="label"]').focus({ preventScroll: true });
}

function goReview() {
  document.querySelectorAll('.missing').forEach(x => x.classList.remove('missing'));
  for (const w of state.windows) {
    const miss = missing(w);
    if (!miss.length) continue;
    const card = $(`.win[data-id="${CSS.escape(w.id)}"]`);
    let first;
    for (const k of miss) {
      const el = k === 'mount' ? card.querySelector('fieldset.mount') : k === 'clear' ? card.querySelector('fieldset.yn') : card.querySelector(`[data-k="${k}.i"]`).closest('.mrow');
      el.classList.add('missing'); first ??= el;
    }
    const warn = card.querySelector('.warns');
    warn.insertAdjacentHTML('afterbegin', `<p class="note warn">${miss[0] === 'mount' ? 'Pick inside or outside first.' : 'A few numbers are still empty (marked in gold).'}</p>`);
    first.scrollIntoView({ behavior: 'smooth', block: 'center' });
    (first.querySelector('input'))?.focus({ preventScroll: true });
    return;
  }
  state.view = 'review'; save(); show();
  window.scrollTo(0, 0);
}

// ---------- output ----------
function obsText(w) { return w.obs.filter(o => o !== 'none').map(o => OBS_TEXT[o]); }
function lineFor(w) {
  if (w.mount === 'inside') {
    return `${nameOf(w)} — INSIDE — W ${w.w.map(m => fmt(val(m))).join(' | ')} — H ${w.h.map(m => fmt(val(m))).join(' | ')} — D ${fmt(val(w.depth))}`;
  }
  return `${nameOf(w)} — OUTSIDE — W ${fmt(val(w.ow))} — H ${fmt(val(w.oh))} — 3in flat wall each side & above: ${w.clear || '?'}`;
}
function extraFor(w) {
  const o = obsText(w), parts = [];
  if (o.length) parts.push(`In the way: ${o.join(', ')}`);
  else if (w.obs.includes('none')) parts.push('Nothing in the way');
  if (w.notes.trim()) parts.push(`Note: ${w.notes.trim()}`);
  return parts.join('. ');
}
function machine() {
  const code = link?.code || null;
  return {
    code,
    windows: state.windows.map(w => {
      const o = obsText(w), n = [];
      if (o.length) n.push(`In the way: ${o.join(', ')}.`);
      if (w.mount === 'outside') n.push(`3in flat wall each side & above: ${w.clear}.`);
      if (w.notes.trim()) n.push(w.notes.trim());
      const r = {
        id: w.id, label: nameOf(w), room: w.room || '', mount: w.mount,
        w: w.mount === 'inside' ? w.w.map(val) : [val(w.ow)],
        h: w.mount === 'inside' ? w.h.map(val) : [val(w.oh)],
        depth: w.mount === 'inside' ? val(w.depth) : null,
        notes: n.join(' ')
      };
      if (w.style) r.style = w.style;
      if (w.obs.length) r.obs = w.obs;
      if (w.mount === 'outside') r.clear = w.clear === 'yes';
      return r;
    })
  };
}
function smsBody() {
  const code = link?.code, name = (link?.name || '').trim();
  const hi = `Hi Dana${name ? `, it's ${name}` : ''}! Here are my measurements${code ? ` for ${code}` : ''}:`;
  const lines = state.windows.map(w => { const x = extraFor(w); return lineFor(w) + (x ? `\n  ${x}` : ''); });
  return `${hi}\n\n${lines.join('\n')}\n\nI'll attach 3 photos per window in this thread.\n\nTLM1:${b64urlEncode(machine())}`;
}

function renderReview() {
  $('#summary').innerHTML = state.windows.map(w => {
    const warns = checks(w).filter(c => c[0] === 'warn');
    const rows = w.mount === 'inside'
      ? `<dt>Width</dt><dd>${w.w.map(m => fmt(val(m))).join(' · ')}<small>top · middle · bottom</small></dd>
         <dt>Height</dt><dd>${w.h.map(m => fmt(val(m))).join(' · ')}<small>left · center · right</small></dd>
         <dt>Depth</dt><dd>${fmt(val(w.depth))}</dd>`
      : `<dt>Width</dt><dd>${fmt(val(w.ow))}</dd><dt>Height</dt><dd>${fmt(val(w.oh))}</dd>
         <dt>Room around it</dt><dd>${w.clear === 'yes' ? 'Yes, 3" each side &amp; above' : 'Less than 3" somewhere'}</dd>`;
    const x = extraFor(w);
    return `<div class="sum">
      <div class="sum-head"><h2>${esc(nameOf(w))}</h2><span class="badge">${w.mount}</span></div>
      <dl>${rows}</dl>
      ${x ? `<p class="sum-x">${esc(x)}</p>` : ''}
      ${warns.map(([, m]) => `<p class="note warn">${esc(m)}</p>`).join('')}
    </div>`;
  }).join('') + `<p class="sub center">All in inches, exact opening. We make the adjustments.</p>`;
  $('#send').href = smsHref(DANA_SMS, smsBody());
  $('#after').hidden = true;
}

function show() {
  const review = state.view === 'review';
  $('#form-view').hidden = review; $('#review-view').hidden = !review; $('#bar').hidden = review;
  if (review) renderReview(); else renderForm();
}

// ---------- init ----------
function init() {
  if (link?.code) { const c = $('#code'); c.textContent = link.code; c.hidden = false; c.title = 'Your design code'; }
  if (link?.name) $('#dana-line').firstChild.textContent = `Hi ${link.name}! Take your time. I check every number and photo before anything gets made, so you can't really get this wrong. `;
  $('#num').textContent = DANA_SMS.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, '($1) $2-$3');
  const box = $('#windows');
  box.addEventListener('input', onChange); box.addEventListener('change', onChange); box.addEventListener('click', onClick);
  $('#add').addEventListener('click', addWindow);
  $('#review').addEventListener('click', goReview);
  $('#back').addEventListener('click', () => { state.view = 'form'; save(); show(); window.scrollTo(0, 0); });
  $('#send').addEventListener('click', () => { $('#after').hidden = false; });
  $('#copy').addEventListener('click', async () => {
    const b = $('#copy');
    try { await navigator.clipboard.writeText(smsBody()); b.textContent = 'Copied'; }
    catch { b.textContent = 'Copy failed. Long-press to select instead.'; }
  });
  show();
}
addEventListener('hashchange', () => location.reload());
init();
