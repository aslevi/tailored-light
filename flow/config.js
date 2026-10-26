// Shared settings for Tailored Light flow pages. Change Dana's number here only.
export const DANA_SMS = '+12017453300';
export const BRAND = { ink:'#3D4034', linen:'#F4EEE4', paper:'#FBF8F2', gold:'#E2A54B', clay:'#B7836D', sage:'#8DB09A' };
export const isIOS = () => /iPhone|iPad|Macintosh/i.test(navigator.userAgent) && 'ontouchend' in document || /iPhone|iPad/i.test(navigator.userAgent);
export const smsHref = (num, body) => `sms:${num}${isIOS() ? '&' : '?'}body=${encodeURIComponent(body)}`;
export const b64urlEncode = obj => btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
export const b64urlDecode = s => JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g,'+').replace(/_/g,'/')))));
