// Shared behavior for the Tailored Light site pages. Reads flow/config.js so Dana's number,
// the contact email and the swatch-kit payment link are set in one place.
// The HTML keeps working static fallbacks (sms: links) for visitors without JavaScript.
import { DANA_SMS, CONTACT_EMAIL, SWATCH_KIT_URL, smsHref } from './config.js';

const pretty = n => {
  const d = String(n).replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : n;
};
const DEFAULT_BODY = "Hi Dana! I'd like some help choosing shades.";
const danaHref = body => smsHref(DANA_SMS, body || DEFAULT_BODY);

// Every "text Dana" link: number and prefilled message come from config.js.
document.querySelectorAll('[data-dana]').forEach(a => {
  a.href = a.dataset.body ? danaHref(a.dataset.body) : `sms:${DANA_SMS}`;
  if (a.hasAttribute('data-dana-number')) a.textContent = pretty(DANA_SMS);
});
document.querySelectorAll('[data-dana-text]').forEach(el => { el.textContent = pretty(DANA_SMS); });

// Swatch kit: Stripe payment link when SWATCH_KIT_URL is set, otherwise a text to Dana.
document.querySelectorAll('[data-swatch-kit]').forEach(a => {
  if (SWATCH_KIT_URL) {
    a.href = SWATCH_KIT_URL;
    a.removeAttribute('data-text-sheet');
    const label = a.querySelector('[data-kit-label]');
    if (label) label.textContent = label.dataset.kitLabel || 'Order the $9 swatch kit';
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
      <h2 id="sheet-title">Text Dana</h2>
      <p>Dana is Tailored Light's AI design assistant. Send a photo of your window, your design, or a question, and a person on our team reviews every reply.</p>
      <a class="btn" data-sheet-go href="#"><span class="avatar" aria-hidden="true">D</span>Open Messages</a>
      <p class="optin">Opens a text to Dana, Tailored Light's AI design assistant; a person on our team reviews every reply. Msg &amp; data rates may apply. Reply STOP to opt out, HELP for help. We never share your number for marketing. <a href="${root}privacy.html">Privacy</a> · <a href="${root}sms.html">Texting terms</a></p>
    </div>`;
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
document.querySelectorAll('.menu-panel a').forEach(a => a.addEventListener('click', () => a.closest('details')?.removeAttribute('open')));
