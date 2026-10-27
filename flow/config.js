// Shared settings for Tailored Light flow pages. Change Dana's number here only.
export const DANA_SMS = '+12017453300';
// Public contact email for policy pages. Leave '' to hide the email line.
export const CONTACT_EMAIL = '';
// Free samples (up to 5 fabrics, free shipping). Leave '' and the samples button texts a designer,
// which also captures the customer's number. Set it to a free order form later; the picked fabrics are
// passed as ?fabrics=Family|Color,Family|Color. Its confirmation page can be https://aslevi.github.io/tailored-light/thanks.html
export const SWATCH_KIT_URL = '';
export const SWATCH_KIT_MAX = 5;
// "Prefer we text you?" form endpoint. Leave '' to hide the phone field everywhere and keep only the text buttons.
// When set, the form POSTs JSON {phone, consent, consentText, context, page, ts} to this URL.
export const LEAD_FORM_URL = '';
// Reply-time line (used in the studio if shown).
export const REPLY_PROMISE = 'We usually reply within minutes.';
// The designer card next to "Text a designer". DESIGNER_PHOTO: path or URL of a real team photo.
// Leave '' to show a monogram (gold circle, first initial).
export const DESIGNER_NAME = 'Dana';
export const DESIGNER_PHOTO = '';
// Lifestyle photos for the page slots below. Each value: { src, alt }. Empty slots stay hidden.
// Slots: home-hero, step-1, step-2, step-3, text-designer, samples, rooms, about.
// Use photos licensed for commercial use with no attribution (Unsplash or Pexels license), saved in images/people/.
export const PEOPLE_PHOTOS = {};
export const BRAND = { walnut:'#2B2420', linen:'#F6F0E6', paper:'#FFFCF7', gold:'#E3A33F', sage:'#56624A', oat:'#D9CBB4', driftwood:'#6E6258' };
export const isIOS = () => /iPhone|iPad|Macintosh/i.test(navigator.userAgent) && 'ontouchend' in document || /iPhone|iPad/i.test(navigator.userAgent);
export const smsHref = (num, body) => `sms:${num}${isIOS() ? '&' : '?'}body=${encodeURIComponent(body)}`;
export const b64urlEncode = obj => btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
export const b64urlDecode = s => JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g,'+').replace(/_/g,'/')))));
