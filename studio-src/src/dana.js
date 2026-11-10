// Dana's texting number. Swap for the Google Voice number when it's ready.
export const DANA_SMS=''; // business texting line; '' = not live yet
export const smsHref=(num,body)=>num?`sms:${num}${/iPhone|iPad|Macintosh/i.test(navigator.userAgent)?'&':'?'}body=${encodeURIComponent(body)}`:new URL('/contact.html',location.href).href;
