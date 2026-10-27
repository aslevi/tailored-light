// Shared behavior for the Tailored Light site pages. Reads flow/config.js so Dana's number,
// the contact email and the swatch-kit payment link are set in one place.
// The HTML keeps working static fallbacks (sms: links) for visitors without JavaScript.
import { DANA_SMS, CONTACT_EMAIL, SWATCH_KIT_URL, LEAD_FORM_URL, DESIGNER_NAME, DESIGNER_PHOTO, PEOPLE_PHOTOS, smsHref } from './config.js';

const pretty = n => {
  const d = String(n).replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : n;
};
const DEFAULT_BODY = "Hi Dana! I'd like some help choosing shades.";
const danaHref = body => smsHref(DANA_SMS, body || DEFAULT_BODY);

// Every "Text a designer" link: number and prefilled message come from config.js.
document.querySelectorAll('[data-dana]').forEach(a => {
  a.href = a.dataset.body ? danaHref(a.dataset.body) : `sms:${DANA_SMS}`;
  if (a.hasAttribute('data-dana-number')) a.textContent = pretty(DANA_SMS);
});
document.querySelectorAll('[data-dana-text]').forEach(el => { el.textContent = pretty(DANA_SMS); });

// Free samples: an order form when SWATCH_KIT_URL is set, otherwise a text to Dana.
document.querySelectorAll('[data-swatch-kit]').forEach(a => {
  if (SWATCH_KIT_URL) {
    a.href = SWATCH_KIT_URL;
    a.removeAttribute('data-text-sheet');
    const label = a.querySelector('[data-kit-label]');
    if (label) label.textContent = label.dataset.kitLabel || 'Order free samples';
    const note = document.querySelector(a.dataset.kitNote || '#kit-optin');
    if (note) note.hidden = true;
  } else {
    a.href = danaHref(a.dataset.body);
  }
});

// Contact email: shown only when CONTACT_EMAIL is set.
document.querySelectorAll('[data-email-line]').forEach(el => {
  if (!CONTACT_EMAIL) { el.hidden = true; return; }
  el.hidden = false;
  el.querySelectorAll('[data-email]').forEach(a => {
    a.href = `mailto:${CONTACT_EMAIL}`;
    a.textContent = CONTACT_EMAIL;
  });
});

// Phone bar "Text a designer": opens a small sheet that introduces Dana and shows the
// texting disclosure before Messages opens. Without JS the link goes to the contact page.
const root = document.querySelector('meta[name="tl-root"]')?.content || './';
let sheet, lastFocus;
function closeSheet() {
  if (!sheet) return;
  sheet.hidden = true;
  document.removeEventListener('keydown', onKey);
  lastFocus?.focus();
}
function onKey(e) {
  if (e.key === 'Escape') closeSheet();
  if (e.key === 'Tab' && sheet && !sheet.hidden) {
    const f = [...sheet.querySelectorAll('a,button')];
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
}
function openSheet(body) {
  if (!sheet) {
    sheet = document.createElement('div');
    sheet.className = 'sheet';
    sheet.innerHTML = `<div class="sheet-card" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
      <button class="sheet-close" type="button" aria-label="Close">&times;</button>
      <h2 id="sheet-title">Text a designer</h2>
      <div class="designer" data-designer><span class="d-avatar" data-designer-avatar aria-hidden="true">D</span><div><b data-designer-name>Dana</b><span>Your designer · usually replies within minutes</span></div></div>
      <p>Send a photo of your window or a look you like. We'll help you pick, measure and order.</p>
      <a class="btn gold" data-sheet-go href="#">Open Messages</a>
    </div>`;
    fillDesigners(sheet);
    document.body.append(sheet);
    sheet.addEventListener('click', e => { if (e.target === sheet || e.target.closest('.sheet-close')) closeSheet(); });
  }
  sheet.querySelector('[data-sheet-go]').href = danaHref(body);
  lastFocus = document.activeElement;
  sheet.hidden = false;
  document.addEventListener('keydown', onKey);
  sheet.querySelector('[data-sheet-go]').focus();
}
document.addEventListener('click', e => {
  const a = e.target.closest('[data-text-sheet]');
  if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
  e.preventDefault();
  openSheet(a.dataset.body);
});

// Close the phone menu after choosing an in-page link.
document.querySelectorAll('.menu-panel a, .mega a').forEach(a => a.addEventListener('click', () => a.closest('details')?.removeAttribute('open')));

// Header menus (Shades mega menu, phone menu): one open at a time; close on outside click or Escape.
const menus = [...document.querySelectorAll('.site-header details')];
menus.forEach(d => d.addEventListener('toggle', () => { if (d.open) menus.forEach(o => { if (o !== d) o.open = false; }); }));
document.addEventListener('click', e => { menus.forEach(d => { if (d.open && !d.contains(e.target)) d.open = false; }); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') menus.forEach(d => { if (d.open) { d.open = false; d.querySelector('summary').focus(); } }); });

// Hero loop: respect reduced motion (show the still poster instead).
if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.querySelectorAll('[data-hero-video]').forEach(v => { v.removeAttribute('autoplay'); v.pause(); v.currentTime = 0; v.load(); });
}

// Designer card: name and photo from config.js; a monogram until a real team photo is set.
function fillDesigners(scope = document) {
  scope.querySelectorAll('[data-designer]').forEach(card => {
    card.querySelectorAll('[data-designer-name]').forEach(n => { n.textContent = DESIGNER_NAME; });
    const av = card.querySelector('[data-designer-avatar]');
    if (!av) return;
    if (DESIGNER_PHOTO) { av.textContent = ''; av.style.backgroundImage = `url("${new URL(DESIGNER_PHOTO, new URL(root, location.href)).href}")`; av.classList.add('photo'); }
    else av.textContent = (DESIGNER_NAME || 'D').trim().charAt(0).toUpperCase();
  });
}
fillDesigners();

// Lifestyle photo slots: filled from PEOPLE_PHOTOS in config.js, hidden while empty.
document.querySelectorAll('figure[data-people]').forEach(fig => {
  const ph = PEOPLE_PHOTOS && PEOPLE_PHOTOS[fig.dataset.people];
  if (!ph || !ph.src) return;
  const im = fig.querySelector('img');
  im.src = new URL(ph.src, new URL(root, location.href)).href; im.alt = ph.alt || '';
  fig.hidden = false; fig.parentElement?.classList.add('has-people');
});

// "Prefer we text you?" forms: hidden until LEAD_FORM_URL is set in config.js.
document.querySelectorAll('form[data-lead]').forEach(form => {
  if (!LEAD_FORM_URL) { form.hidden = true; return; }
  form.hidden = false;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const status = form.querySelector('[data-lead-status]');
    const phone = form.phone.value.replace(/[^\d+]/g, '');
    if (phone.replace(/\D/g, '').length < 10) { status.textContent = 'Please enter a 10-digit mobile number.'; form.phone.focus(); return; }
    if (!form.consent.checked) { status.textContent = 'Please check the box so we can text you.'; return; }
    const consentText = form.querySelector('[data-consent-text]').textContent.trim();
    status.textContent = 'Sending…';
    try {
      const r = await fetch(LEAD_FORM_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, consent: true, consentText, context: form.dataset.context || '', page: location.href, ts: new Date().toISOString() }) });
      if (!r.ok) throw new Error(r.status);
      status.textContent = "Thanks! We'll text you shortly.";
      form.querySelector('button').disabled = true;
    } catch { status.textContent = "That didn't go through. Please text a designer instead."; }
  });
});
