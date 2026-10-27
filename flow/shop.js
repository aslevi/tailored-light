// Store behavior for Tailored Light: listing filters, product pages and swatch-kit picks.
// Plain ES module, no build step. Dana's number comes from flow/config.js.
import { DANA_SMS, SWATCH_KIT_URL, SWATCH_KIT_MAX, smsHref } from './config.js';
import { parseInches, formatInches, quote, fromPrice, money, PRICE_HOLD_NOTE, OUT_OF_RANGE_NOTE } from './pricing.js';
import { designCode } from './code.js';

const root = document.querySelector('meta[name="tl-root"]')?.content || './';
const KIT_KEY = 'tl.swatchPicks';
const readPicks = () => { try { return JSON.parse(localStorage.getItem(KIT_KEY)) || []; } catch { return []; } };
const writePicks = list => { try { localStorage.setItem(KIT_KEY, JSON.stringify(list)); } catch { /* storage blocked */ } };

/* ---------- Listing filters (light control, color family) ---------- */
document.querySelectorAll('[data-listing]').forEach(list => {
  const state = { light: '', colors: '' };
  const cards = [...list.querySelectorAll('.pcard')];
  const count = list.querySelector('[data-count]');
  const empty = list.querySelector('[data-empty]');
  const apply = () => {
    let n = 0;
    for (const c of cards) {
      const ok = (!state.light || c.dataset.light === state.light) && (!state.colors || c.dataset.colors.split(' ').includes(state.colors));
      c.hidden = !ok; if (ok) n++;
    }
    count.textContent = `${n} shade${n === 1 ? '' : 's'}`;
    empty.hidden = n > 0;
    list.querySelectorAll('[data-filter]').forEach(b => b.setAttribute('aria-pressed', String(state[b.dataset.filter] === b.dataset.value)));
  };
  list.addEventListener('click', e => {
    const b = e.target.closest('[data-filter]');
    if (b) { state[b.dataset.filter] = b.dataset.value; apply(); }
    if (e.target.closest('[data-clear]')) { state.light = state.colors = ''; apply(); }
  });
});

/* ---------- Product page ---------- */
const dataEl = document.getElementById('product-data');
if (dataEl) {
  const P = JSON.parse(dataEl.textContent);
  const $ = s => document.querySelector(s);
  const params = new URLSearchParams(location.search);
  const st = {
    color: P.colors.find(c => c.name === params.get('c')) || P.colors[0],
    fold: 'flat', lining: '', mount: 'Inside', shot: 'room',
  };
  const shotSrc = () => root + ({ room: st.color.room, win: st.color.win, swatch: st.color.swatch, alt: P.alt }[st.shot]);
  const fmt = v => { const n = parseInches(v); return n === '' ? '' : n === null ? null : formatInches(n); };
  const look = () => {
    const q = new URLSearchParams({ room: P.room, s: P.style, f: P.family, c: st.color.name });
    if (P.style === 'roman' && document.querySelector('[data-fold]')) q.set('r', st.fold);
    if (st.lining) q.set('l', 'dark');
    return q;
  };
  const render = () => {
    $('[data-color-name]').textContent = st.color.name;
    document.querySelectorAll('[data-color]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.color === st.color.name)));
    document.querySelectorAll('[data-fold]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.fold === st.fold)));
    document.querySelectorAll('[data-lining]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lining === st.lining)));
    document.querySelectorAll('[data-mount]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mount === st.mount)));
    const main = $('[data-main]');
    main.src = shotSrc();
    main.alt = st.shot === 'alt' ? `${P.name} in another room` : `${P.name} in ${st.color.name}`;
    const thumbs = { room: st.color.room, win: st.color.win, swatch: st.color.swatch, alt: P.alt };
    document.querySelectorAll('[data-shot]').forEach(b => { b.setAttribute('aria-current', String(b.dataset.shot === st.shot)); b.querySelector('img').src = root + thumbs[b.dataset.shot]; });
    // Texts and links
    const w = fmt($('[data-size="w"]').value), h = fmt($('[data-size="h"]').value);
    const bad = w === null || h === null;
    document.querySelector('[data-size-hint]')?.classList.toggle('warn', bad);
    const opts = [];
    if (document.querySelector('[data-fold]') && st.fold !== 'flat') opts.push(`${st.fold} fold`);
    if (st.lining) opts.push('room-darkening lining');
    const size = w && h ? `${w} wide x ${h} high` : w ? `${w} wide (height not measured yet)` : h ? `${h} high (width not measured yet)` : "I haven't measured yet";
    const wn = parseInches($('[data-size="w"]').value), hn = parseInches($('[data-size="h"]').value);
    const qt = wn && hn ? quote({ style: P.style, family: P.family, width: wn, height: hn, lining: !!st.lining }) : { price: null };
    const price = qt.price;
    const out = $('[data-price-out]');
    if (price) out.innerHTML = `<b>${money(price)}</b>${qt.estimate ? ' <span class="est">estimate</span>' : ''}`;
    else if (bad) out.textContent = 'Check the size: use inches, like 34 3/8.';
    else if (qt.outOfRange) out.textContent = 'For this size, text a designer for your price.';
    else out.textContent = 'Add your window size to see your price.';
    const note = document.querySelector('[data-price-note]'); if (note) note.hidden = !price;
    const q = look();
    const link = new URL(root + 'studio/?' + q, location.href).href;
    const body = `Hi Dana! I'd like to order the ${P.name} in ${st.color.name}${opts.length ? ', ' + opts.join(', ') : ''} (${designCode(q)}). ${st.mount} mount, ${size}.${price ? ` Shown price ${money(price)}${qt.estimate ? ' (estimate)' : ''}.` : ''} ${link}`;
    $('[data-price-cta]').href = smsHref(DANA_SMS, body);

    $('[data-studio]').href = root + 'studio/?' + q;
    $('[data-kit-add]').href = root + 'swatch-kit/?' + new URLSearchParams({ add: `${P.family}|${st.color.name}` });
    const url = new URL(location.href); url.searchParams.set('c', st.color.name);
    history.replaceState(null, '', url);
  };
  document.addEventListener('click', e => {
    const c = e.target.closest('[data-color]'); if (c) { st.color = P.colors.find(x => x.name === c.dataset.color); if (st.shot === 'alt') st.shot = 'room'; render(); }
    const f = e.target.closest('[data-fold]'); if (f) { st.fold = f.dataset.fold; const note = document.querySelector('[data-fold-note]'); if (note) note.textContent = { flat: 'Clean, tailored panel that stacks into neat folds when raised.', hobbled: 'Soft folds cascade all the way down, even when lowered.', relaxed: 'A gentle curve at the bottom edge. Casual and soft.' }[st.fold]; render(); }
    const l = e.target.closest('[data-lining]'); if (l) { st.lining = l.dataset.lining; render(); }
    const m = e.target.closest('[data-mount]'); if (m) { st.mount = m.dataset.mount; render(); }
    const s = e.target.closest('[data-shot]'); if (s) { st.shot = s.dataset.shot; render(); }
    if (e.target.closest('[data-kit-add]')) {
      const list = readPicks(); const key = `${P.family}|${st.color.name}`;
      if (!list.includes(key) && list.length < SWATCH_KIT_MAX) { list.push(key); writePicks(list); }
    }
  });
  document.querySelectorAll('[data-size]').forEach(i => i.addEventListener('input', render));
  render();
}

/* ---------- Free samples picks: Dana's picks, 1 Type, 2 Light, 3 Fabric, tray of up to 5 ---------- */
const catEl = document.getElementById('catalog-data');
if (catEl) {
  const CAT = JSON.parse(catEl.textContent);
  const TYPE_LABEL = { roller: 'Roller', roman: 'Roman', zebra: 'Zebra', woven: 'Woven' };
  const valid = k => { const [f, c] = k.split('|'); return CAT[f]?.colors[c]; };
  let list = readPicks().filter(valid);
  const full = document.querySelector('[data-picks-full]');
  const add = new URLSearchParams(location.search).get('add');
  let type = 'roman', light = 'filtering';
  if (add && valid(add)) {
    const f = add.split('|')[0]; type = CAT[f].type; light = CAT[f].blackout ? 'blackout' : 'filtering';
    if (!list.includes(add)) { if (list.length < SWATCH_KIT_MAX) { list.push(add); writePicks(list); } else if (full) full.hidden = false; }
  }
  const grid = document.querySelector('[data-fab-grid]');
  const tray = document.querySelector('[data-picks]');
  const kit = document.querySelector('[data-swatch-kit]');
  const esc = t => String(t).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const tile = (f, c) => `<button type="button" class="stile" data-sample="${esc(f)}|${esc(c)}" aria-pressed="false" aria-label="${esc(f)} in ${esc(c)}"><span class="sw"><img src="${root}${CAT[f].colors[c].swatch}" alt="" width="240" height="240" loading="lazy"><i aria-hidden="true"></i></span><span class="nm">${esc(f)} · ${esc(c)}</span></button>`;
  const fams = (t, l) => Object.keys(CAT).filter(f => CAT[f].type === t && (l == null || (l === 'blackout') === !!CAT[f].blackout));
  const drawGrid = () => {
    const hasBO = fams(type, 'blackout').length > 0;
    if (!hasBO) light = 'filtering';
    document.querySelectorAll('[data-stype]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.stype === type)));
    document.querySelectorAll('[data-slight]').forEach(b => { b.setAttribute('aria-pressed', String(b.dataset.slight === light)); if (b.dataset.slight === 'blackout') b.hidden = !hasBO; });
    const keys = fams(type, light).flatMap(f => Object.keys(CAT[f].colors).map(c => [f, c]));
    grid.innerHTML = keys.map(([f, c]) => tile(f, c)).join('');
    const cnt = document.querySelector('[data-fab-count]');
    if (cnt) cnt.textContent = `${keys.length} ${light === 'blackout' ? 'blackout ' : ''}${TYPE_LABEL[type]} fabrics`;
    mark();
  };
  const mark = () => {
    document.querySelectorAll('[data-sample]').forEach(b => {
      const on = list.includes(b.dataset.sample);
      b.setAttribute('aria-pressed', String(on));
      const [f, c] = b.dataset.sample.split('|');
      b.setAttribute('aria-label', `${f} in ${c}${on ? ', picked' : ', add to samples'}`);
    });
  };
  const drawTray = () => {
    tray.innerHTML = Array.from({ length: SWATCH_KIT_MAX }, (_, i) => {
      const k = list[i]; if (!k) return '<span class="slot"></span>';
      const [f, c] = k.split('|');
      return `<button type="button" class="slot on" data-remove="${i}" aria-label="Remove ${esc(f)} in ${esc(c)}"><img src="${root}${CAT[f].colors[c].swatch}" alt=""><i aria-hidden="true">&times;</i></button>`;
    }).join('');
    const picks = list.map(k => { const [f, c] = k.split('|'); return `${f} in ${c}`; }).join(', ');
    const body = list.length ? `Hi Dana! I'd like free samples of: ${picks}.` : kit.dataset.body;
    if (SWATCH_KIT_URL) { const u = new URL(SWATCH_KIT_URL, location.href); if (list.length) u.searchParams.set('fabrics', list.join(',')); kit.href = u.href; }
    else kit.href = smsHref(DANA_SMS, body);
    const cnt = document.querySelector('[data-picks-count]'); if (cnt) cnt.textContent = `${list.length} of ${SWATCH_KIT_MAX}`;
    if (full && list.length < SWATCH_KIT_MAX) full.hidden = true;
    mark();
  };
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-stype]'); if (t) { type = t.dataset.stype; drawGrid(); return; }
    const l = e.target.closest('[data-slight]'); if (l) { light = l.dataset.slight; drawGrid(); return; }
    const r = e.target.closest('[data-remove]'); if (r) { list.splice(+r.dataset.remove, 1); writePicks(list); drawTray(); return; }
    const s = e.target.closest('[data-sample]'); if (!s) return;
    const k = s.dataset.sample, i = list.indexOf(k);
    if (i >= 0) list.splice(i, 1);
    else if (list.length >= SWATCH_KIT_MAX) { if (full) full.hidden = false; return; }
    else list.push(k);
    writePicks(list); drawTray();
  });
  drawGrid(); drawTray();
}
