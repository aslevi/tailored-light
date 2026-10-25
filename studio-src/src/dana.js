// Dana's texting number. Swap for the Google Voice number when it's ready.
export const DANA_SMS='+12017453300';
export const smsHref=(num,body)=>`sms:${num}${/iPhone|iPad|Macintosh/i.test(navigator.userAgent)?'&':'?'}body=${encodeURIComponent(body)}`;
