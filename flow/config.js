// Shared settings for Hello Shade flow pages. Change Dana's number here only.
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
export const DESIGNER_PHOTO = 'images/people/dana-avatar.webp';
// Lifestyle photos for the page slots below. Each value: { src, alt }. Empty slots stay hidden.
// Slots: home-hero, step-1, step-2, step-3, text-designer, samples, rooms, about.
// Our own photos, saved in images/people/.
export const PEOPLE_PHOTOS = {
  'home-hero': { src: 'images/people/hero-couple.webp', alt: 'A couple relaxing on a linen sofa under a Roman shade' },
  'step-1': { src: 'images/people/coffee-window.webp', alt: 'Morning coffee in the kitchen under a woven shade' },
  'step-2': { src: 'images/people/measuring.webp', alt: 'Measuring a window with a metal tape' },
  'text-designer': { src: 'images/people/texting.webp', alt: 'A woman texting her designer from the sofa' },
  'samples': { src: 'images/people/samples.webp', alt: 'Holding fabric samples up to a window' },
  'rooms': { src: 'images/people/bedroom.webp', alt: 'A quiet bedroom with a blackout roller shade' },
  'about': { src: 'images/people/about.webp', alt: 'Looking through fabric samples at a desk' },
};
export const BRAND = { name:'Hello Shade', cream:'#FBF6F0', surface:'#FFFDFB', blush:'#F3DCD3', rose:'#A9594A', roseHover:'#8E4A3D', honey:'#E8AE45', cocoa:'#4A3530', muted:'#7A5F57' };
export const isIOS = () => /iPhone|iPad|Macintosh/i.test(navigator.userAgent) && 'ontouchend' in document || /iPhone|iPad/i.test(navigator.userAgent);
export const smsHref = (num, body) => `sms:${num}${isIOS() ? '&' : '?'}body=${encodeURIComponent(body)}`;
export const b64urlEncode = obj => btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
export const b64urlDecode = s => JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g,'+').replace(/_/g,'/')))));
