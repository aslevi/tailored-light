// Store behavior for Tailored Light: listing filters, product pages and swatch-kit picks.
// Plain ES module, no build step. Dana's number comes from flow/config.js.
import { DANA_SMS, SWATCH_KIT_URL, smsHref } from './config.js';
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
  const fmt = v => {
    // Accepts 34, 34.5, 34 3/8, 34-3/8, 34 3/8" ; returns a tidy string to the nearest 1/8 or '' if unreadable.
    const s = String(v).trim().replace(/["”″]|in(ches)?\.?$/gi, '').trim();
    if (!s) return '';
    let n = NaN;
    const m = s.match(/^(\d+(?:\.\d+)?)(?:[\s-]+(\d+)\/(\d+))?$/) || s.match(/^()(\d+)\/(\d+)$/);
    if (m) n = (m[1] ? parseFloat(m[1]) : 0) + (m[2] ? +m[2] / +m[3] : 0);
    if (!isFinite(n) || n <= 0 || n > 400) return null;
    const eighths = Math.round(n * 8), whole = Math.floor(eighths / 8), rem = eighths % 8;
    if (!rem) return `${whole}"`;
    const g = rem % 4 === 0 ? 4 : rem % 2 === 0 ? 2 : 1;
    return `${whole} ${rem / g}/${8 / g}"`;
  };
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
    $('[data-size-hint]').classList.toggle('warn', bad);
    const opts = [];
    if (document.querySelector('[data-fold]') && st.fold !== 'flat') opts.push(`${st.fold} fold`);
    if (st.lining) opts.push('room-darkening lining');
    const size = w && h ? `${w} wide x ${h} high` : w ? `${w} wide (height not measured yet)` : h ? `${h} high (width not measured yet)` : "I haven't measured yet";
    const q = look();
    const link = new URL(root + 'studio/?' + q, location.href).href;
    const body = `Hi Dana! I'd like my exact price for the ${P.name} in ${st.color.name}${opts.length ? ', ' + opts.join(', ') : ''} (${designCode(q)}). ${st.mount} mount, ${size}. ${link}`;
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
      if (!list.includes(key)) { list.push(key); writePicks(list); }
    }
  });
  document.querySelectorAll('[data-size]').forEach(i => i.addEventListener('input', render));
  render();
}

/* ---------- Swatch kit picks ---------- */
const catEl = document.getElementById('catalog-data');
if (catEl) {
  const CAT = JSON.parse(catEl.textContent);
  const valid = k => { const [f, c] = k.split('|'); return CAT[f]?.colors[c]; };
  let list = readPicks().filter(valid);
  const add = new URLSearchParams(location.search).get('add');
  if (add && valid(add) && !list.includes(add)) { list.push(add); writePicks(list); }
  const ul = document.querySelector('[data-picks]');
  const kit = document.querySelector('[data-swatch-kit]');
  const draw = () => {
    ul.innerHTML = list.map((k, i) => {
      const [f, c] = k.split('|'); const info = CAT[f].colors[c];
      return `<li><span class="dot" style="--c:${info.hex};background-image:url(${root}${info.swatch})"></span><div><b>${f}</b><span>${c} · ${CAT[f].name}</span></div><button type="button" data-remove="${i}" aria-label="Remove ${f} in ${c}">&times;</button></li>`;
    }).join('');
    document.querySelector('[data-picks-empty]').hidden = list.length > 0;
    const picks = list.map(k => { const [f, c] = k.split('|'); return `${f} in ${c}`; }).join(', ');
    const body = list.length ? `Hi Dana! I'd like the $9 swatch kit with: ${picks}.` : kit.dataset.body;
    if (!SWATCH_KIT_URL) kit.href = smsHref(DANA_SMS, body);
  };
  ul.addEventListener('click', e => {
    const b = e.target.closest('[data-remove]'); if (!b) return;
    list.splice(+b.dataset.remove, 1); writePicks(list); draw();
  });
  draw();
}
