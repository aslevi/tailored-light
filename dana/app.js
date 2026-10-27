import { smsHref } from '../flow/config.js';
import * as store from './store.js';
import {
  STAGES, STAGE_LABEL, stageIndex, ROOMS, STYLES, FOLDS, roomLabel, roomSlug, uid, now, designSummary, parseText,
  parseInches, fmtIn, normalizeWindow, orderSize, isGuaranteed, windowName, windowFlags, CHECKLIST,
  measureLink, quoteLinkFor, quoteTotals, quoteHash, money, matchApproval, lastActivity, daysAgo, firstName, designCode,
} from './core.js';
import { GROUPS, fill } from './playbook.js';
import { quote as priceQuote, liningAvailable } from '../flow/pricing.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const BASE = location.href;
const TAX_NJ = 0.06625;
let leads = [];
let pending = null; // parsed paste awaiting save

// ---------- helpers ----------
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2200); }
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast('Copied'); return true; } catch {}
  const ta = document.createElement('textarea');
  ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;font-size:16px';
  document.body.appendChild(ta); ta.focus(); ta.select(); ta.setSelectionRange(0, text.length);
  let ok = false; try { ok = document.execCommand('copy'); } catch {}
  ta.remove();
  if (ok) { toast('Copied'); return true; }
  showManualCopy(text); return false;
}
function showManualCopy(text) {
  const d = document.createElement('dialog');
  d.innerHTML = `<form method="dialog" class="dlg"><h2>Copy this</h2><p class="fine">Couldn't copy automatically. Press and hold, then Copy.</p><textarea readonly rows="8">${esc(text)}</textarea><div class="btn-row end"><button class="btn ghost">Done</button></div></form>`;
  document.body.appendChild(d); d.showModal(); const ta = d.querySelector('textarea'); ta.focus(); ta.select();
  d.addEventListener('close', () => d.remove());
}
const phoneDigits = p => { const d = String(p || '').replace(/[^\d+]/g, ''); if (!d) return ''; if (d.startsWith('+')) return d; return d.length === 10 ? '+1' + d : d.length === 11 && d[0] === '1' ? '+' + d : d; };
const fmtDate = t => t ? new Date(t).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
const ago = t => { const d = daysAgo(t); return d <= 0 ? 'today' : d === 1 ? '1 day' : d + ' days'; };
const thumb = room => roomSlug(room) ? `../rooms/frontal-v2/${roomSlug(room)}.webp` : '../og.jpg';
const logEvent = (l, type, text) => { (l.events ||= []).push({ at: now(), type, text }); };
async function save(l) { const s = await store.upsert(l); const i = leads.findIndex(x => x.id === s.id); if (i >= 0) leads[i] = s; else leads.push(s); return s; }
const leadById = id => leads.find(l => l.id === id);

function newLead(fields) {
  return {
    id: uid('L'), code: '', createdAt: now(), name: '', phone: '', ref: '', room: '', style: '', family: '', color: '', fold: '', lining: false,
    lookUrl: '', stage: 'new', notes: '', needsReply: true, windows: [], quotes: [], swatchKit: {}, events: [], ...fields,
  };
}

// ---------- routing ----------
function route() {
  const h = location.hash.slice(1);
  renderList();
  if (h === 'add') { document.body.dataset.view = 'detail'; renderAdd(); }
  else if (h.startsWith('lead/') && leadById(h.slice(5))) { document.body.dataset.view = 'detail'; renderLead(leadById(h.slice(5))); }
  else { document.body.dataset.view = 'list'; renderEmptyDetail(); }
  if (document.body.dataset.view === 'detail' && matchMedia('(max-width: 899px)').matches) window.scrollTo(0, 0);
}
addEventListener('hashchange', route);

// ---------- list ----------
function renderList() {
  const sf = $('stage-filter').value, needs = $('needs-filter').checked, q = $('search').value.trim().toLowerCase();
  const cur = location.hash.startsWith('#lead/') ? location.hash.slice(6) : '';
  const rows = leads
    .filter(l => (!sf || l.stage === sf) && (!needs || l.needsReply))
    .filter(l => !q || [l.name, l.code, roomLabel(l.room), l.family, l.color, l.ref, l.phone].join(' ').toLowerCase().includes(q))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  $('lead-list').innerHTML = rows.map(l => `
    <li><a class="lead-row${l.id === cur ? ' current' : ''}" href="#lead/${esc(l.id)}">
      <img class="lead-thumb" src="${thumb(l.room)}" alt="" loading="lazy">
      <span class="lead-main">
        <span class="lead-top"><b>${esc(l.name || 'No name yet')}</b>${l.sample ? '<span class="tag sample">SAMPLE</span>' : ''}${l.needsReply ? '<span class="dot" title="Needs reply"></span>' : ''}</span>
        <span class="lead-sum">${esc(roomLabel(l.room))} · ${esc(designSummary(l))}</span>
        <span class="lead-meta"><span class="chip st-${esc(l.stage)}">${esc(STAGE_LABEL[l.stage] || l.stage)}</span><span class="code">${esc(l.code)}</span><span>${ago(lastActivity(l))}</span></span>
      </span>
    </a></li>`).join('');
  $('list-empty').hidden = leads.length > 0;
  if (leads.length && !rows.length) $('lead-list').innerHTML = '<li class="none">No leads match these filters.</li>';
}
$('stage-filter').innerHTML += STAGES.map(s => `<option value="${s}">${STAGE_LABEL[s]}</option>`).join('');
for (const id of ['stage-filter', 'needs-filter']) $(id).addEventListener('change', renderList);
$('search').addEventListener('input', renderList);

function renderEmptyDetail() {
  $('detail').innerHTML = `<div class="placeholder"><img src="../icon.svg" alt="" width="56" height="56"><h2>Pick a lead</h2><p>Or paste a new customer text with <a href="#add">Add from text</a>.</p></div>`;
}

// ---------- add from text ----------
function renderAdd() {
  $('detail').innerHTML = `
    <div class="detail-head"><a class="back" href="#">‹ Leads</a><h1>Add from text</h1></div>
    <div class="card">
      <label class="lbl" for="paste">Paste the customer's whole text</label>
      <textarea id="paste" rows="6" placeholder="Hi Dana! Here's my design for my kitchen: … (TL-XXXX) … https://… (via jane)&#10;&#10;Also works: a bare design link, a measuring reply with a TLM1: line, or a quote approval with TLQ1:"></textarea>
      <div class="btn-row">
        <button class="btn ghost" type="button" id="paste-clip">Paste from clipboard</button>
        <button class="btn primary" type="button" id="parse">Read it</button>
      </div>
    </div>
    <div id="preview"></div>`;
  const run = () => { pending = parseText($('paste').value); renderPreview(); };
  $('parse').onclick = run;
  $('paste').addEventListener('input', () => { if ($('paste').value.length > 20) run(); });
  $('paste-clip').onclick = async () => {
    try { $('paste').value = await navigator.clipboard.readText(); run(); }
    catch { toast('Clipboard blocked: press and hold in the box, then Paste'); $('paste').focus(); }
  };
  $('paste').focus({ preventScroll: true });
}

function renderPreview() {
  const p = pending, el = $('preview');
  if (!p) { el.innerHTML = ''; return; }
  if (!p.kind) { el.innerHTML = `<div class="card warn-card">${esc(p.error)}</div>`; return; }
  if (p.kind === 'lead') {
    const l = p.lead, dupes = leads.filter(x => x.code === l.code);
    el.innerHTML = `
      <div class="card">
        <h2>New lead${p.kit ? ' · free samples request' : ''}</h2>
        <div class="recog">
          <img src="${thumb(l.room)}" alt="">
          <dl>
            <dt>Room</dt><dd>${esc(roomLabel(l.room)) || '<i>missing</i>'}</dd>
            <dt>Style</dt><dd>${esc(STYLES[l.style] || l.style || '—')}</dd>
            <dt>Fabric</dt><dd>${esc(l.family || '—')}</dd>
            <dt>Color</dt><dd>${esc(l.color || '—')}</dd>
            ${l.fold ? `<dt>Fold</dt><dd>${esc(FOLDS[l.fold] || l.fold)}</dd>` : ''}
            <dt>Lining</dt><dd>${l.lining ? 'Room-darkening' : 'None'}</dd>
            <dt>Code</dt><dd class="code">${esc(l.code)}</dd>
            <dt>Ref</dt><dd>${esc(l.ref || '—')}</dd>
          </dl>
        </div>
        ${p.codeMismatch ? `<p class="warn-line">The text says ${esc(p.typedCode)} but the link works out to ${esc(l.code)}. The link wins (it may have been edited).</p>` : ''}
        ${dupes.length ? `<p class="warn-line">Same design code as ${dupes.map(d => `<a href="#lead/${esc(d.id)}">${esc(d.name || d.code)}</a>`).join(', ')}. Could be the same person texting again, or a different customer with the same design.</p>` : ''}
        <div class="grid2">
          <label><span class="lbl">Name (optional)</span><input id="new-name" autocomplete="off" placeholder="Jamie"></label>
          <label><span class="lbl">Phone (optional)</span><input id="new-phone" type="tel" inputmode="tel" placeholder="(201) 555-0123"></label>
        </div>
        <button class="btn primary wide" type="button" id="save-lead">Save lead</button>
      </div>`;
    $('save-lead').onclick = async () => {
      const lead = newLead({ ...l, name: $('new-name').value.trim(), phone: $('new-phone').value.trim() });
      if (p.kit) { lead.stage = 'swatches'; lead.swatchKit = { requestedAt: now() }; }
      logEvent(lead, 'created', p.kit ? 'Free samples request texted in' : 'Design texted in');
      logEvent(lead, 'message', p.message);
      const s = await save(lead); pending = null; toast('Lead saved'); location.hash = 'lead/' + s.id;
    };
    return;
  }
  if (p.kind === 'samples') {
    const digits = v => phoneDigits(v).replace(/\D/g, '').slice(-10);
    const picksText = p.picks.map(x => `${x.family} in ${x.color}`).join(', ');
    el.innerHTML = `
      <div class="card">
        <h2>Free samples request</h2>
        ${p.picks.length ? `<ul class="mini-windows">${p.picks.map(x => `<li><b>${esc(x.family)}</b> · ${esc(x.color)}</li>`).join('')}</ul>` : '<p class="warn-line">No fabrics picked yet: they asked for help choosing.</p>'}
        <div class="grid2">
          <label><span class="lbl">Name (optional)</span><input id="s-name" autocomplete="off" placeholder="Jamie"></label>
          <label><span class="lbl">Phone (optional)</span><input id="s-phone" type="tel" inputmode="tel" placeholder="(201) 555-0123"></label>
        </div>
        <label class="lbl" for="s-lead">Save to</label>
        <select id="s-lead"><option value="">New lead</option>${leads.map(l => `<option value="${esc(l.id)}">${esc(l.name || 'No name')} · ${esc(l.code)}${l.phone ? ' · ' + esc(l.phone) : ''}</option>`).join('')}</select>
        <p class="fine" id="s-match"></p>
        <button class="btn primary wide" type="button" id="save-samples">Save samples request</button>
      </div>`;
    $('s-phone').addEventListener('input', () => {
      const d = digits($('s-phone').value), hit = d.length === 10 && leads.find(l => digits(l.phone) === d);
      if (hit) { $('s-lead').value = hit.id; $('s-match').textContent = `Phone matches ${hit.name || hit.code}: the request goes on that lead.`; }
      else { $('s-match').textContent = ''; }
    });
    $('save-samples').onclick = async () => {
      const name = $('s-name').value.trim(), phone = $('s-phone').value.trim();
      let lead = $('s-lead').value ? leadById($('s-lead').value) : null;
      if (!lead) {
        const lk = p.look, code = p.code || designCode({ room: 'samples', c: String(Date.now()) });
        lead = newLead({ code, name, phone, ...(lk ? { style: lk.style, family: lk.family, color: lk.color, lookUrl: new URL('../studio/?' + lk.query, BASE).href } : {}) });
        logEvent(lead, 'created', 'Free samples request texted in');
      } else {
        if (name && !lead.name) lead.name = name;
        if (phone && !lead.phone) lead.phone = phone;
      }
      lead.swatchKit = { ...(lead.swatchKit || {}), requestedAt: now() };
      if (stageIndex(lead.stage) < stageIndex('swatches')) lead.stage = 'swatches';
      if (picksText) lead.notes = (lead.notes ? lead.notes + '\n' : '') + `Free samples: ${picksText}`;
      lead.needsReply = true;
      logEvent(lead, 'message', p.message);
      const s = await save(lead); pending = null; toast('Samples request saved'); location.hash = 'lead/' + s.id;
    };
    return;
  }
  if (p.kind === 'measure') {
    const matches = leads.filter(l => l.code === p.code).sort((a, b) => lastActivity(b) - lastActivity(a));
    el.innerHTML = `
      <div class="card">
        <h2>Measurements · <span class="code">${esc(p.code || 'no code')}</span></h2>
        <ul class="mini-windows">${p.windows.map((w, i) => `<li><b>${esc(windowName(w, i))}</b> · ${esc(w.mount || 'mount?')} · W ${w.w.map(fmtIn).join(' / ') || '—'} · H ${w.h.map(fmtIn).join(' / ') || '—'}${w.depth != null ? ` · D ${fmtIn(w.depth)}` : ''}${w.obs.length ? ` · in the way: ${esc(w.obs.join(', '))}` : ''}${w.mount === 'outside' && w.clear != null ? ` · 3" wall: ${w.clear ? 'yes' : 'no'}` : ''}${w.notes ? `<br><small>${esc(w.notes)}</small>` : ''}</li>`).join('') || '<li>No windows in the message.</li>'}</ul>
        <label class="lbl" for="m-lead">Attach to lead</label>
        <select id="m-lead">${(matches.length ? matches : leads).map(l => `<option value="${esc(l.id)}">${esc(l.name || 'No name')} · ${esc(l.code)} · ${esc(roomLabel(l.room))}</option>`).join('')}</select>
        ${!matches.length ? `<p class="warn-line">${p.code ? `No lead has code ${esc(p.code)}.` : 'No design code in this reply (form opened without a link).'} Pick the right one, or add the lead first.</p>` : matches.length > 1 ? '<p class="warn-line">More than one lead has this code. Most recent first; check it\'s the right person.</p>' : ''}
        <button class="btn primary wide" type="button" id="attach" ${leads.length ? '' : 'disabled'}>Attach ${p.windows.length} window${p.windows.length === 1 ? '' : 's'}</button>
      </div>`;
    $('attach')?.addEventListener('click', async () => {
      const l = leadById($('m-lead').value); if (!l) return;
      for (const w of p.windows) {
        const i = l.windows.findIndex(x => x.id === w.id);
        const merged = { ...(i >= 0 ? l.windows[i] : {}), ...w, measuredAt: now(), checkedAt: null, check: {}, photosReceived: i >= 0 ? l.windows[i].photosReceived : false };
        if (i >= 0) l.windows[i] = merged; else l.windows.push(merged);
      }
      if (p.name && !l.name) l.name = p.name;
      if (stageIndex(l.stage) < stageIndex('ready_to_quote')) l.stage = 'ready_to_quote';
      l.needsReply = true;
      logEvent(l, 'measure', `Measurements received for ${p.windows.length} window(s). Run Dana's check.`);
      await save(l); pending = null; toast('Measurements attached'); location.hash = 'lead/' + l.id;
    });
    return;
  }
  if (p.kind === 'quote') {
    const m = matchApproval(leads, p);
    el.innerHTML = `
      <div class="card">
        <h2>Quote approval · <span class="code">${esc(p.code || 'no code')}</span></h2>
        <p>Total in text: <b>${p.total != null ? money(Math.round(p.total * 100)) : '—'}</b>${p.hash ? ` · TLQ1 <span class="code">${esc(p.hash)}</span>` : ''}</p>
        ${m.quote ? `<p>${m.exact ? '<span class="ok">Exact match</span>' : '<span class="warn-line">Not an exact hash match. Check the total before you charge.</span>'} ${esc(m.lead.name || 'No name')} · quote of ${fmtDate(m.quote.sentAt)} · ${money(quoteTotals(m.quote.json).total)}</p>
          <button class="btn primary wide" type="button" id="approve">Mark quote approved</button>`
        : `<p class="warn-line">No saved quote matches. ${m.lead ? `Closest lead: <a href="#lead/${esc(m.lead.id)}">${esc(m.lead.name || m.lead.code)}</a>.` : ''}</p>`}
      </div>`;
    $('approve')?.addEventListener('click', async () => {
      const l = leadById(m.lead.id), q = l.quotes.find(x => x.id === m.quote.id);
      q.approvedAt = now();
      if (stageIndex(l.stage) < stageIndex('quoted')) l.stage = 'quoted';
      l.needsReply = true;
      logEvent(l, 'approved', `Customer approved quote ${q.json.code} for ${money(quoteTotals(q.json).total)}${m.exact ? '' : ' (matched by code/total)'}. Send the payment link.`);
      await save(l); pending = null; toast('Approved'); location.hash = 'lead/' + l.id;
    });
  }
}

// ---------- lead detail ----------
function ctxFor(l) {
  const latest = (l.quotes || []).slice(-1)[0];
  return {
    name: firstName(l.name), room: roomLabel(l.room).toLowerCase(), fabric: l.family, color: l.color,
    type: (STYLES[l.style] || '').toLowerCase(), look: l.lookUrl, measure: measureLink(l, BASE),
    quote: latest ? quoteLinkFor(latest.json, BASE) : '', quoteText: latest ? quoteText(latest.json) : '',
    readback: readback(l), n: String(Math.max(1, (l.windows || []).length)),
  };
}
function quoteText(q) {
  const t = quoteTotals(q);
  const lines = q.lines.map(x => `${x.label || x.room}: ${designSummary(x).replace(/^./, c => c.toUpperCase())}, ${fmtIn(x.w)}" x ${fmtIn(x.h)}" ${x.mount || ''}: ${money(Math.round(+x.price * 100))}`.replace(/\s+:/, ':'));
  return [`Here's your quote${q.name ? ', ' + q.name : ''}:`, ...lines,
    `Subtotal ${money(t.subtotal)} · shipping ${t.shipping ? money(t.shipping) : 'free'} · tax ${money(t.tax)}`,
    `Total ${money(t.total)}, ships in 2–4 weeks. Measurements checked, so the fit guarantee applies.`].join('\n');
}
function readback(l) {
  const ws = (l.windows || []).map((w, i) => { const o = orderSize(w); return o ? `${windowName(w, i)}: ${w.mount || 'inside'}, ${fmtIn(o.w)}" x ${fmtIn(o.h)}"${w.mount === 'outside' ? '' : ' (exact opening, we make the adjustments)'}` : null; }).filter(Boolean);
  return ws.length ? `Here's what I'm sending to production:\n${ws.join('\n')}\nReply YES if that all looks right.` : '';
}
const hl = s => esc(s).replace(/\[[^\]]+\]/g, m => `<mark>${m}</mark>`);

function renderLead(l) {
  const c = ctxFor(l);
  const g = l.windows.length ? l.windows.filter(isGuaranteed).length : 0;
  $('detail').innerHTML = `
    <div class="detail-head"><a class="back" href="#">‹ Leads</a>
      <h1>${esc(l.name || 'No name yet')}${l.sample ? ' <span class="tag sample">SAMPLE</span>' : ''}</h1>
    </div>
    <div class="card hero">
      <img src="${thumb(l.room)}" alt="${esc(roomLabel(l.room))}">
      <div>
        <p class="hero-sum"><b>${esc(roomLabel(l.room))}</b> · ${esc(designSummary(l))}</p>
        <p class="hero-meta"><span class="code">${esc(l.code)}</span>${l.ref ? ` · via <b>${esc(l.ref)}</b>` : ''} · added ${fmtDate(l.createdAt)}</p>
        <div class="btn-row">
          ${l.lookUrl ? `<a class="btn ghost sm" href="${esc(l.lookUrl)}" target="_blank" rel="noopener">Open design</a>` : ''}
          <label class="toggle"><input type="checkbox" data-f="needsReply" ${l.needsReply ? 'checked' : ''}> <span>Needs reply</span></label>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="grid2">
        <label><span class="lbl">Stage</span><select data-f="stage">${STAGES.map(s => `<option value="${s}" ${s === l.stage ? 'selected' : ''}>${STAGE_LABEL[s]}</option>`).join('')}</select></label>
        <label><span class="lbl">Name</span><input data-f="name" value="${esc(l.name)}" autocomplete="off"></label>
        <label><span class="lbl">Phone</span><input data-f="phone" type="tel" inputmode="tel" value="${esc(l.phone)}"></label>
        <label><span class="lbl">Swatch kit</span><span class="kit">${['requestedAt', 'paidAt', 'shippedAt'].map(k => `<button type="button" class="pill${l.swatchKit?.[k] ? ' on' : ''}" data-kit="${k}">${{ requestedAt: 'Asked', paidAt: 'Paid', shippedAt: 'Shipped' }[k]}</button>`).join('')}</span></label>
      </div>
      <label><span class="lbl">Notes</span><textarea data-f="notes" rows="3" placeholder="Windows, timing, who decides…">${esc(l.notes)}</textarea></label>
    </div>

    <h2 class="sec">Reply</h2>
    <div class="playbook">${GROUPS.map(gr => `
      <details ${gr === GROUPS.find(x => x.stages.includes(l.stage)) ? 'open' : ''}><summary>${esc(gr.title)}</summary>
        ${gr.items.map(([title, tpl], i) => { const txt = fill(tpl, c); if (!txt.trim() || /^\[(readback|quote text)\]$/.test(txt)) return `<div class="tpl muted"><b>${esc(title)}</b><p>${title === 'Read back' ? 'Add measurements first.' : 'Build a quote first.'}</p></div>`;
          return `<div class="tpl"><b>${esc(title)}</b><p>${hl(txt)}</p><div class="btn-row"><button class="btn sm primary" type="button" data-copy="${gr.id}:${i}">Copy</button>${l.phone ? `<a class="btn sm ghost" href="${esc(smsHref(phoneDigits(l.phone), txt))}" data-sms="${gr.id}:${i}">Open Messages</a>` : ''}</div></div>`; }).join('')}
      </details>`).join('')}
      ${l.phone ? '' : '<p class="fine">Add a phone number to get an Open Messages button on each text.</p>'}
    </div>

    <h2 class="sec">Links to send</h2>
    <div class="card">
      <h3>Measuring form</h3>
      <p class="fine">Opens the step-by-step measuring guide with ${l.windows.length || 1} window${l.windows.length > 1 ? 's' : ''} prefilled (${esc(roomLabel(l.room))}, ${esc(STYLES[l.style] || '')}).</p>
      <p class="url">${esc(c.measure)}</p>
      <div class="btn-row"><button class="btn sm primary" type="button" id="copy-measure">Copy link</button>${l.phone ? `<a class="btn sm ghost" href="${esc(smsHref(phoneDigits(l.phone), fill(GROUPS.find(x => x.id === 'measure').items[0][1], c)))}">Text it</a>` : ''}<a class="btn sm ghost" href="${esc(c.measure)}" target="_blank" rel="noopener">Preview</a></div>
    </div>
    <div class="card" id="quote-card"></div>

    <h2 class="sec">Windows <span class="sub">${l.windows.length ? `${g} of ${l.windows.length} guaranteed` : ''}</span></h2>
    <div id="windows"></div>
    <button class="btn ghost wide" type="button" id="add-window">+ Add a window by hand</button>

    <h2 class="sec">Activity</h2>
    <div class="card">
      <div class="note-row"><input id="event-text" placeholder="Log something (called, texted, sent swatches…)"><button class="btn sm primary" type="button" id="add-event">Log</button></div>
      <ol class="events">${[...l.events].reverse().map(e => `<li><time>${fmtDate(e.at)}</time><span class="etype">${esc(e.type)}</span><p>${esc(e.text)}</p></li>`).join('')}</ol>
    </div>
    <button class="btn danger wide" type="button" id="delete-lead">Delete lead</button>`;

  // field edits
  $('detail').querySelectorAll('[data-f]').forEach(inp => {
    const f = inp.dataset.f;
    const commit = async () => {
      const v = inp.type === 'checkbox' ? inp.checked : inp.value;
      if (l[f] === v) return;
      if (f === 'stage') logEvent(l, 'stage', `${STAGE_LABEL[l.stage]} → ${STAGE_LABEL[v]}`);
      l[f] = typeof v === 'string' && f !== 'notes' ? v.trim() : v;
      await save(l);
      if (f === 'notes') return renderList();
      route();
    };
    if (f === 'notes') { let t; inp.addEventListener('input', () => { clearTimeout(t); t = setTimeout(commit, 500); }); inp.addEventListener('blur', commit); }
    else inp.addEventListener('change', commit);
  });
  $('detail').querySelectorAll('[data-kit]').forEach(b => b.onclick = async () => {
    const k = b.dataset.kit; l.swatchKit ||= {};
    l.swatchKit[k] = l.swatchKit[k] ? null : now();
    if (l.swatchKit[k]) logEvent(l, 'swatch', `Swatch kit ${b.textContent.toLowerCase()}`);
    await save(l); route();
  });
  $('detail').querySelectorAll('[data-copy]').forEach(b => b.onclick = async () => {
    const [gid, i] = b.dataset.copy.split(':'), gr = GROUPS.find(x => x.id === gid), [title, tpl] = gr.items[+i];
    if (await copyText(fill(tpl, ctxFor(l)))) { logEvent(l, 'copy', `Copied "${title}"`); await save(l); renderList(); }
  });
  $('detail').querySelectorAll('[data-sms]').forEach(a => a.addEventListener('click', async () => {
    const [gid, i] = a.dataset.sms.split(':'); logEvent(l, 'text', `Opened Messages: "${GROUPS.find(x => x.id === gid).items[+i][0]}"`); await save(l);
  }));
  $('copy-measure').onclick = async () => { if (await copyText(c.measure)) { logEvent(l, 'link', 'Copied measuring form link'); if (stageIndex(l.stage) < stageIndex('measuring')) { logEvent(l, 'stage', `${STAGE_LABEL[l.stage]} → Measuring`); l.stage = 'measuring'; } await save(l); route(); } };
  $('add-event').onclick = async () => { const t = $('event-text').value.trim(); if (!t) return; logEvent(l, 'note', t); await save(l); route(); };
  $('event-text').addEventListener('keydown', e => { if (e.key === 'Enter') $('add-event').click(); });
  $('delete-lead').onclick = async () => { if (!confirm(`Delete ${l.name || l.code}? This can't be undone (unless you have a backup).`)) return; await store.remove(l.id); leads = leads.filter(x => x.id !== l.id); location.hash = ''; };
  $('add-window').onclick = async () => { const n = l.windows.length; l.windows.push(normalizeWindow({ id: 'w' + Date.now().toString(36), room: l.room, label: `${roomLabel(l.room)} ${n + 1}`, style: l.style }, n)); await save(l); route(); };
  renderWindows(l);
  renderQuote(l);
}

// ---------- windows ----------
function renderWindows(l) {
  const box = $('windows');
  if (!l.windows.length) { box.innerHTML = '<p class="fine card">No windows yet. They arrive when the customer sends the measuring form (paste their reply in Add from text), or add one by hand.</p>'; return; }
  box.innerHTML = l.windows.map((w, i) => {
    const o = orderSize(w), flags = windowFlags(w), guar = isGuaranteed(w), stale = w.checkedAt && !guar;
    const checkedCount = CHECKLIST.filter(([k]) => w.check?.[k]).length;
    const nums = (arr, key, n) => Array.from({ length: n }, (_, j) => `<input class="num" inputmode="decimal" data-wi="${i}" data-wk="${key}" data-wj="${j}" value="${esc(fmtIn(arr[j]))}" aria-label="${key === 'w' ? ['Top', 'Middle', 'Bottom'][j] + ' width' : ['Left', 'Center', 'Right'][j] + ' height'}" placeholder="${key === 'w' ? ['top', 'mid', 'bot'][j] : ['left', 'ctr', 'right'][j]}">`).join('');
    const n = w.mount === 'outside' ? 1 : 3;
    return `<div class="card window">
      <div class="win-head">
        <input class="win-label" data-wi="${i}" data-wk="label" value="${esc(windowName(w, i))}" aria-label="Window name">
        ${guar ? '<span class="badge good">Guaranteed</span>' : stale ? '<span class="badge warn">Re-check: changed after check</span>' : '<span class="badge">Not checked</span>'}
      </div>
      <div class="win-grid">
        <label><span class="lbl">Mount</span><select data-wi="${i}" data-wk="mount"><option value="">—</option><option value="inside" ${w.mount === 'inside' ? 'selected' : ''}>Inside</option><option value="outside" ${w.mount === 'outside' ? 'selected' : ''}>Outside</option></select></label>
        <label><span class="lbl">Style</span><select data-wi="${i}" data-wk="style">${Object.entries(STYLES).map(([k, v]) => `<option value="${k}" ${w.style === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        ${w.mount !== 'outside' ? `<label><span class="lbl">Depth</span><input class="num" inputmode="decimal" data-wi="${i}" data-wk="depth" value="${esc(fmtIn(w.depth))}" placeholder="in"></label>` : ''}
      </div>
      <div class="meas"><span class="lbl">Width${n > 1 ? 's' : ''} (in)</span><div class="nums">${nums(w.w || [], 'w', n)}</div></div>
      <div class="meas"><span class="lbl">Height${n > 1 ? 's' : ''} (in)</span><div class="nums">${nums(w.h || [], 'h', n)}</div></div>
      <p class="order">${o ? `Order size <b>${fmtIn(o.w)}" × ${fmtIn(o.h)}"</b> ${w.mount === 'outside' ? '(area to cover)' : '(exact opening; factory deducts)'}` : 'Order size: needs width and height'}</p>
      ${w.notes ? `<p class="fine">Customer note: ${esc(w.notes)}</p>` : ''}
      ${flags.length ? `<ul class="flags">${flags.map(f => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}
      <label class="toggle"><input type="checkbox" data-wi="${i}" data-wk="photosReceived" ${w.photosReceived ? 'checked' : ''}> <span>3 photos received in the thread</span></label>
      <details class="check" ${w.checkedAt && guar ? '' : ''}><summary>Dana's check <span class="sub">${guar ? `passed ${fmtDate(w.checkedAt)}` : `${checkedCount}/${CHECKLIST.length}`}</span></summary>
        <ol class="checklist">${CHECKLIST.map(([k, t, d]) => `<li><label><input type="checkbox" data-wi="${i}" data-ck="${k}" ${w.check?.[k] ? 'checked' : ''}><span><b>${esc(t)}</b><small>${esc(d)}</small></span></label></li>`).join('')}</ol>
        <button class="btn primary wide" type="button" data-stamp="${i}" ${checkedCount === CHECKLIST.length ? '' : 'disabled'}>${guar ? 'Checked ✓ (stamp again)' : 'All 10 pass: stamp as checked'}</button>
      </details>
      <button class="linkish danger-text" type="button" data-wdel="${i}">Remove window</button>
    </div>`;
  }).join('');
  box.querySelectorAll('[data-wk]').forEach(inp => inp.addEventListener('change', async () => {
    const w = l.windows[+inp.dataset.wi], k = inp.dataset.wk;
    if (k === 'w' || k === 'h') {
      const v = parseInches(inp.value); if (inp.value && v == null) { toast('Use inches like 34 3/8 or 34.375'); return; }
      (w[k] ||= [])[+inp.dataset.wj] = v; w.measuredAt = now();
    } else if (k === 'depth') { w.depth = parseInches(inp.value); w.measuredAt = now(); }
    else if (k === 'photosReceived') w.photosReceived = inp.checked;
    else { w[k] = inp.value; if (k === 'mount') w.measuredAt = now(); }
    await save(l); renderWindows(l); refreshHeadCount(l);
  }));
  box.querySelectorAll('[data-ck]').forEach(cb => cb.addEventListener('change', async () => {
    const w = l.windows[+cb.dataset.wi]; (w.check ||= {})[cb.dataset.ck] = cb.checked; await save(l);
    const n = CHECKLIST.filter(([k]) => w.check[k]).length, det = cb.closest('details');
    det.querySelector('[data-stamp]').disabled = n !== CHECKLIST.length;
    if (!isGuaranteed(w)) det.querySelector('summary .sub').textContent = `${n}/${CHECKLIST.length}`;
  }));
  box.querySelectorAll('[data-stamp]').forEach(b => b.onclick = async () => {
    const w = l.windows[+b.dataset.stamp]; w.checkedAt = now(); w.checkedBy = 'Dana';
    logEvent(l, 'check', `Dana's check passed: ${windowName(w, +b.dataset.stamp)} ${orderSize(w) ? `${fmtIn(orderSize(w).w)}" × ${fmtIn(orderSize(w).h)}" ${w.mount}` : ''}`);
    await save(l); route(); toast('Checked and logged');
  });
  box.querySelectorAll('[data-wdel]').forEach(b => b.onclick = async () => {
    if (!confirm('Remove this window?')) return; l.windows.splice(+b.dataset.wdel, 1); await save(l); route();
  });
}
function refreshHeadCount(l) { const s = [...document.querySelectorAll('h2.sec')].find(h => h.textContent.startsWith('Windows')); if (s) s.querySelector('.sub').textContent = `${l.windows.filter(isGuaranteed).length} of ${l.windows.length} guaranteed`; }

// ---------- quote builder ----------
function defaultDraft(l) {
  const base = { style: l.style, family: l.family, color: l.color, fold: l.style === 'roman' ? l.fold : '', lining: l.lining ? 'room-darkening' : '' };
  const lines = l.windows.length ? l.windows.map((w, i) => { const o = orderSize(w); return { winId: w.id, room: roomLabel(w.room) || w.room || roomLabel(l.room), label: windowName(w, i), ...base, style: w.style || l.style, mount: w.mount || 'inside', w: o ? o.w : '', h: o ? o.h : '', price: '' }; })
    : [{ room: roomLabel(l.room), label: roomLabel(l.room) + ' 1', ...base, mount: 'inside', w: '', h: '', price: '' }];
  lines.forEach(autoPrice);
  return { lines, shipping: 0, taxRate: TAX_NJ, notes: '', validDays: 14, auto: 1 };
}
// The site's price for a quote line (flow/pricing.js), so the quote matches the price the customer saw.
function sitePrice(x) {
  const q = priceQuote({ style: x.style, family: x.family, width: parseInches(x.w), height: parseInches(x.h), lining: !!x.lining && liningAvailable(x.style, x.family) });
  return q.price ? { price: q.price, estimate: q.estimate } : null;
}
// Fill the price from the site formula unless Dana typed her own.
function autoPrice(x) {
  if (x.priceManual) return;
  const p = sitePrice(x); x.price = p ? String(p.price) : '';
}
function buildQuoteJSON(l, d) {
  const lines = d.lines.map(x => {
    const o = { room: x.room, label: x.label, style: x.style, family: x.family, color: x.color };
    if (x.style === 'roman' && x.fold) o.fold = x.fold;
    if (x.lining) o.lining = x.lining;
    Object.assign(o, { mount: x.mount, w: parseInches(x.w), h: parseInches(x.h), price: Number(x.price) });
    const win = x.winId && l.windows.find(w => w.id === x.winId);
    if (win && isGuaranteed(win)) { const os = orderSize(win); if (os && os.w === o.w && os.h === o.h && win.mount === o.mount) o.checked = true; }
    return o;
  });
  const d8 = new Date(), date = `${d8.getFullYear()}-${String(d8.getMonth() + 1).padStart(2, '0')}-${String(d8.getDate()).padStart(2, '0')}`;
  return { v: 1, code: l.code, name: firstName(l.name), date, lines, shipping: Number(d.shipping) || 0, taxRate: Number(d.taxRate) || 0, notes: d.notes || '', validDays: Number(d.validDays) || 14 };
}
function renderQuote(l) {
  const box = $('quote-card');
  const d = l.quoteDraft || defaultDraft(l);
  // Drafts saved before prices filled in automatically: keep the prices Dana typed.
  if (!d.auto) { d.lines.forEach(x => { if (String(x.price ?? '').trim()) x.priceManual = true; else autoPrice(x); }); d.auto = 1; delete d.swatchCredit; }
  const t = quoteTotals({ ...d, lines: d.lines.map(x => ({ price: x.price })) });
  const famOpts = (style, cur) => { const set = { roller: ['Daylight Weave', 'Morning Haze', 'Deep Sleep', 'Clear View'], roman: ['Raw Linen', 'Soft Cotton', 'Ticking Stripe', 'Sheer Voile', 'Blackout Linen', 'Natural Reed'], zebra: ['Twin Light', 'Sand Stripe', 'Twin Shade'] }[style] || []; if (cur && !set.includes(cur)) set.unshift(cur); return set.map(f => `<option ${f === cur ? 'selected' : ''}>${esc(f)}</option>`).join(''); };
  box.innerHTML = `
    <h3>Quote</h3>
    <p class="fine">Prices fill in from the site's price formula for each size and option. Type over one to set your own.</p>
    ${d.lines.map((x, i) => `
      <fieldset class="qline">
        <legend><input data-q="label" data-i="${i}" value="${esc(x.label)}" aria-label="Line label"></legend>
        <div class="qgrid">
          <label><span class="lbl">Room</span><input data-q="room" data-i="${i}" value="${esc(x.room)}"></label>
          <label><span class="lbl">Style</span><select data-q="style" data-i="${i}">${Object.entries(STYLES).map(([k, v]) => `<option value="${k}" ${x.style === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
          <label><span class="lbl">Fabric</span><select data-q="family" data-i="${i}">${famOpts(x.style, x.family)}</select></label>
          <label><span class="lbl">Color</span><input data-q="color" data-i="${i}" value="${esc(x.color)}"></label>
          ${x.style === 'roman' ? `<label><span class="lbl">Fold</span><select data-q="fold" data-i="${i}">${Object.entries(FOLDS).map(([k, v]) => `<option value="${k}" ${x.fold === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
          ${liningAvailable(x.style, x.family) ? `<label><span class="lbl">Lining</span><select data-q="lining" data-i="${i}"><option value="">None</option><option value="room-darkening" ${x.lining ? 'selected' : ''}>Room-darkening</option></select></label>` : ''}` : ''}
          <label><span class="lbl">Mount</span><select data-q="mount" data-i="${i}"><option value="inside" ${x.mount === 'inside' ? 'selected' : ''}>Inside</option><option value="outside" ${x.mount === 'outside' ? 'selected' : ''}>Outside</option></select></label>
          <label><span class="lbl">W (in)</span><input data-q="w" data-i="${i}" inputmode="decimal" value="${esc(fmtIn(x.w))}"></label>
          <label><span class="lbl">H (in)</span><input data-q="h" data-i="${i}" inputmode="decimal" value="${esc(fmtIn(x.h))}"></label>
          <label class="price"><span class="lbl">Price $${(() => { const sp = sitePrice(x); return sp ? ` <small>${x.priceManual && String(sp.price) !== String(x.price) ? `site $${sp.price}` : 'site price'}${sp.estimate ? ', estimate' : ''}</small>` : x.w && x.h ? ' <small>no site price for this size</small>' : ''; })()}</span><input data-q="price" data-i="${i}" inputmode="decimal" value="${esc(x.price)}" placeholder="0"></label>
        </div>
        ${d.lines.length > 1 ? `<button type="button" class="linkish danger-text" data-qdel="${i}">Remove line</button>` : ''}
      </fieldset>`).join('')}
    <button class="btn ghost sm" type="button" id="q-add">+ Line</button>
    <div class="qgrid totals-in">
      <label><span class="lbl">Shipping $</span><input data-qt="shipping" inputmode="decimal" value="${esc(d.shipping)}"></label>
      <label><span class="lbl">Tax %</span><input data-qt="taxRate" inputmode="decimal" value="${esc(+(d.taxRate * 100).toFixed(4))}"></label>
      <label><span class="lbl">Valid days</span><input data-qt="validDays" inputmode="numeric" value="${esc(d.validDays)}"></label>
    </div>
    <label><span class="lbl">Notes for the customer</span><textarea data-qt="notes" rows="2" placeholder="e.g. Natural Reed is woven by hand; that's why it costs a little more.">${esc(d.notes)}</textarea></label>
    <p class="totals">Subtotal ${money(t.subtotal)} · ship ${money(t.shipping)} · tax ${money(t.tax)} · <b>Total ${money(t.total)}</b></p>
    <div class="btn-row">
      <button class="btn primary" type="button" id="q-build">Save quote &amp; copy link</button>
      <button class="btn ghost sm" type="button" id="q-reset">Reset from windows</button>
    </div>
    ${l.windows.length && !l.windows.every(isGuaranteed) ? '<p class="warn-line">Not every window has passed Dana\'s check. The quote page says the fit guarantee applies, so check first.</p>' : ''}
    ${l.quotes.length ? `<h3>Sent quotes</h3><ul class="quotes">${[...l.quotes].reverse().map(q => `<li>
      <span><b>${money(quoteTotals(q.json).total)}</b> · ${q.json.lines.length} shade${q.json.lines.length > 1 ? 's' : ''} · ${fmtDate(q.sentAt)} · <span class="code">TLQ1:${quoteHash(q.json)}</span></span>
      ${q.approvedAt ? `<span class="badge good">Approved ${fmtDate(q.approvedAt)}</span>` : `<button class="btn sm ghost" type="button" data-qapprove="${esc(q.id)}">Mark approved</button>`}
      <button class="btn sm ghost" type="button" data-qcopy="${esc(q.id)}">Copy link</button>
      <a class="btn sm ghost" href="${esc(quoteLinkFor(q.json, BASE))}" target="_blank" rel="noopener">Preview</a></li>`).join('')}</ul>` : ''}`;

  const persist = async (rerender = true) => { l.quoteDraft = d; await save(l); if (rerender) renderQuote(l); };
  box.querySelectorAll('[data-q]').forEach(inp => inp.addEventListener('change', () => {
    const x = d.lines[+inp.dataset.i], k = inp.dataset.q;
    x[k] = k === 'w' || k === 'h' ? (parseInches(inp.value) ?? '') : inp.value;
    if (k === 'style') { x.family = famOpts(x.style).match(/<option[^>]*>([^<]*)/)?.[1]?.replace(/&amp;/g, '&') || ''; if (x.style !== 'roman') { x.fold = ''; x.lining = ''; } else x.fold ||= 'flat'; }
    if (!liningAvailable(x.style, x.family)) x.lining = '';
    if (k === 'price') x.priceManual = String(x.price).trim() !== '';
    else autoPrice(x);
    persist(['style', 'family', 'price', 'w', 'h', 'lining'].includes(k));
  }));
  box.querySelectorAll('[data-qt]').forEach(inp => inp.addEventListener('change', () => {
    const k = inp.dataset.qt;
    d[k] = k === 'taxRate' ? (Number(inp.value) || 0) / 100 : k === 'notes' ? inp.value : Number(inp.value) || 0;
    persist(k !== 'notes');
  }));
  box.querySelectorAll('[data-qdel]').forEach(b => b.onclick = () => { d.lines.splice(+b.dataset.qdel, 1); persist(); });
  $('q-add').onclick = () => { const last = d.lines[d.lines.length - 1]; d.lines.push({ ...last, winId: undefined, label: `${last.room} ${d.lines.length + 1}`, w: '', h: '', price: '', priceManual: false }); persist(); };
  $('q-reset').onclick = () => { if (!confirm('Replace the draft with lines from the windows?')) return; l.quoteDraft = defaultDraft(l); save(l).then(() => renderQuote(l)); };
  $('q-build').onclick = async () => {
    const bad = d.lines.findIndex(x => !(Number(x.price) > 0) || !(parseInches(x.w) > 0) || !(parseInches(x.h) > 0));
    if (bad >= 0) { toast(`Line ${bad + 1}: needs W, H and a price`); return; }
    const json = buildQuoteJSON(l, d), link = quoteLinkFor(json, BASE);
    l.quotes.push({ id: uid('Q'), json, sentAt: now(), approvedAt: null });
    logEvent(l, 'quote', `Quote built: ${money(quoteTotals(json).total)} for ${json.lines.length} shade(s)`);
    if (stageIndex(l.stage) < stageIndex('quoted')) { logEvent(l, 'stage', `${STAGE_LABEL[l.stage]} → Quoted`); l.stage = 'quoted'; }
    await save(l); await copyText(link); route();
  };
  box.querySelectorAll('[data-qcopy]').forEach(b => b.onclick = () => copyText(quoteLinkFor(l.quotes.find(q => q.id === b.dataset.qcopy).json, BASE)));
  box.querySelectorAll('[data-qapprove]').forEach(b => b.onclick = async () => {
    const q = l.quotes.find(x => x.id === b.dataset.qapprove); q.approvedAt = now();
    logEvent(l, 'approved', `Quote ${money(quoteTotals(q.json).total)} marked approved by hand`); await save(l); route();
  });
}

// ---------- backup ----------
async function doExport() {
  const data = await store.exportAll();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `tailored-light-leads-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  $('backup-status').textContent = `Exported ${data.leads.length} lead(s).`; showLastBackup(); toast('Backup downloaded');
}
function showLastBackup() { const m = store.getMeta(); $('last-backup').textContent = m.lastExport ? `Last backup ${fmtDate(m.lastExport)}.` : 'No backup yet.'; }
$('backup-btn').onclick = () => { $('backup-status').textContent = `${leads.length} lead(s) in this browser.`; $('backup-dialog').showModal(); };
$('export-btn').onclick = doExport;
$('warn-export').onclick = doExport;
$('import-file').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    const mode = $('import-replace').checked ? 'replace' : 'merge';
    if (mode === 'replace' && !confirm('Replace every lead in this browser with the file?')) return;
    const r = await store.importAll(data, mode);
    leads = await store.list();
    $('backup-status').textContent = `Imported: ${r.added} added, ${r.updated} updated. ${r.total} total.`; route();
  } catch (err) { $('backup-status').textContent = 'Import failed: ' + err.message; }
  e.target.value = '';
});

// ---------- sample ----------
$('load-sample').onclick = async () => {
  const look = new URL('../studio/?room=kitchen&s=roman&f=Natural+Reed&c=Honey&ref=sample', BASE).href;
  const p = parseText(`Hi Dana! Here's my design for my kitchen: Natural Reed roman in Honey. Can you help me measure and price it? ${look}`);
  const lead = newLead({ ...p.lead, name: 'Jamie Sample', phone: '', sample: true, notes: 'SAMPLE LEAD: fake customer for trying the board. Delete any time.' });
  lead.windows = [normalizeWindow({ id: 'w1', room: 'Kitchen', label: 'Kitchen 1', style: 'roman', mount: 'inside', w: [34.5, 34.375, 34.5], h: [52.375, 52.5, 52.375], depth: 3.25, photosReceived: true, measuredAt: now() })];
  logEvent(lead, 'created', 'Sample lead loaded');
  const s = await save(lead); location.hash = 'lead/' + s.id;
};

// ---------- boot ----------
if (!store.isPersistent()) $('local-warn').innerHTML = '<b>This browser is blocking storage</b> (private mode?). Leads will vanish when you close the tab. Export before leaving.';
showLastBackup();
leads = await store.list();
route();
