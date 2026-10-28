/* Hello Shade customer client (shared by /my-windows/ and /order/).
   - Reads window.HS_API_URL (set in /api/config.js).
   - Empty URL: returns sample data flagged {demo:true}.
   - The browser never holds an Airtable token. It sends only the customer's secret link token.
   Response shapes are documented in /api/README.md and match /server/src/core.ts. */
(function () {
  'use strict';

  var DANA_PHONE = '+12017453300';
  var DAY = 86400000;

  function iso(offsetDays) {
    var d = new Date(Date.now() + offsetDays * DAY);
    return d.toISOString().slice(0, 10);
  }

  /* ---------- Demo data (relative to today so it always looks current) ---------- */
  function demoProject() {
    var windows = [
      {
        id: 'demo-1', room: 'Living room', label: 'Left', style: 'Roman',
        fabric: 'Raw Linen', color: 'Flax', colorHex: '#CDBA9C', swatch: 'swatches/raw-linen-flax.webp',
        mount: 'Inside', control: 'Cordless', controlSide: null,
        widths: [35.625, 35.5, 35.625], heights: [59.25, 59.375, 59.25], depth: 3.25,
        orderWidth: 35.5, orderHeight: 59.375,
        check: 'checked', measuredDate: iso(-4), checkedDate: iso(-3),
        photos: [{ url: 'images/p/raw-linen-flax-win.webp', alt: 'Living room left window' }],
        price: 289
      },
      {
        id: 'demo-2', room: 'Living room', label: 'Right', style: 'Roman',
        fabric: 'Raw Linen', color: 'Flax', colorHex: '#CDBA9C', swatch: 'swatches/raw-linen-flax.webp',
        mount: 'Inside', control: 'Cordless', controlSide: null,
        widths: [35.75, 35.625, 35.75], heights: [59.25, 59.25, 59.125], depth: 3.25,
        orderWidth: 35.625, orderHeight: 59.25,
        check: 'checked', measuredDate: iso(-4), checkedDate: iso(-3),
        photos: [{ url: 'images/p/raw-linen-cream-win.webp', alt: 'Living room right window' }],
        price: 289
      },
      {
        id: 'demo-3', room: 'Bedroom', label: 'Over bed', style: 'Roller',
        fabric: 'Deep Sleep', color: 'Oat', colorHex: '#D8CBB6', swatch: 'swatches/deep-sleep-oat.webp',
        mount: 'Outside', control: 'Cordless', controlSide: null,
        widths: [42.5, null, null], heights: [64, null, null], depth: 2.5,
        orderWidth: 42.5, orderHeight: 64,
        check: 'checking', measuredDate: iso(-1), checkedDate: null,
        photos: [{ url: 'images/p/deep-sleep-oat-win.webp', alt: 'Bedroom window' }],
        price: 239
      }
    ];
    return {
      demo: true,
      customer: { firstName: 'Jane', designCode: 'TL-4821' },
      windows: windows,
      total: windows.reduce(function (s, w) { return s + (w.price || 0); }, 0),
      order: { statusToken: 'demo', status: 'Quote sent', paid: false, payUrl: null }
    };
  }

  function demoOrder() {
    return {
      demo: true,
      customer: { firstName: 'Jane', designCode: 'TL-4821' },
      order: {
        name: 'Order #1042', status: 'In production', total: 817, windowCount: 3,
        samplesSentDate: iso(-24), measuredDate: iso(-12), checkedDate: iso(-11),
        quoteSentDate: iso(-11), paidDate: iso(-9), orderedDate: iso(-8),
        shippedDate: null, tracking: null, deliveredDate: null, freeRemakeUntil: null,
        projectToken: 'demo', payUrl: null
      }
    };
  }

  /* ---------- Fetch ---------- */
  function apiBase() { return String(window.HS_API_URL || '').replace(/\/+$/, ''); }
  function isDemo() { return !apiBase(); }

  function get(path, token) {
    if (!token) return Promise.reject(err('no-token', 'Open the link Dana texted you to see your project.'));
    var url = apiBase() + path + '?token=' + encodeURIComponent(token);
    return fetch(url, { headers: { Accept: 'application/json' }, credentials: 'omit' })
      .then(function (r) {
        if (r.status === 404) throw err('not-found', 'We couldn’t find that link. Text Dana and she’ll send a fresh one.');
        if (!r.ok) throw err('server', 'Something went wrong loading your project. Try again in a minute.');
        return r.json();
      });
  }
  function err(code, message) { var e = new Error(message); e.code = code; return e; }

  function getProject(token) {
    if (isDemo()) return Promise.resolve(demoProject());
    return get('/project', token);
  }
  function getOrder(token) {
    if (isDemo()) return Promise.resolve(demoOrder());
    return get('/order', token);
  }

  /* ---------- Helpers ---------- */
  function readToken() {
    var q = new URLSearchParams(location.search).get('t');
    if (q) return q;
    var h = new URLSearchParams(location.hash.replace(/^#/, '')).get('t');
    return h || '';
  }

  var FR = ['', '⅛', '¼', '⅜', '½', '⅝', '¾', '⅞'];
  /* 35.5 -> 35½″ (rounded to nearest 1/8) */
  function inches(n) {
    if (n === null || n === undefined || n === '' || isNaN(n)) return '—';
    var eighths = Math.round(Number(n) * 8);
    var whole = Math.floor(eighths / 8), rem = eighths % 8;
    return (whole || !rem ? String(whole) : '') + FR[rem] + '″';
  }

  function money(n) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    var v = Number(n);
    return '$' + v.toLocaleString('en-US', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });
  }

  function parseDate(s) {
    if (!s) return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(s);
  }
  function addDays(s, n) { var d = parseDate(s); if (!d) return null; d.setDate(d.getDate() + n); return d; }
  function date(s, opts) {
    var d = s instanceof Date ? s : parseDate(s);
    if (!d || isNaN(d)) return '';
    return d.toLocaleDateString('en-US', opts || { month: 'short', day: 'numeric' });
  }

  function smsHref(body) {
    return 'sms:' + DANA_PHONE + '?&body=' + encodeURIComponent(body || '');
  }

  function trackingUrl(t) {
    if (!t) return null;
    t = String(t).trim();
    if (/^https?:\/\//i.test(t)) return t;
    var n = t.replace(/\s+/g, '');
    if (/^1Z[0-9A-Z]{16}$/i.test(n)) return 'https://www.ups.com/track?tracknum=' + encodeURIComponent(n);
    if (/^\d{12}$|^\d{15}$/.test(n)) return 'https://www.fedex.com/fedextrack/?trknbr=' + encodeURIComponent(n);
    return 'https://tools.usps.com/go/TrackConfirmAction?tLabels=' + encodeURIComponent(n);
  }

  function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* Only same-site relative paths or https URLs are rendered as images/links. */
  function safeUrl(u, root) {
    if (!u) return '';
    u = String(u);
    if (/^https:\/\//i.test(u)) return u;
    if (/^[a-z0-9][a-z0-9/_.-]*$/i.test(u)) return (root || '../') + u;
    return '';
  }

  window.HS = {
    getProject: getProject, getOrder: getOrder, isDemo: isDemo, readToken: readToken,
    inches: inches, money: money, date: date, addDays: addDays, parseDate: parseDate,
    smsHref: smsHref, trackingUrl: trackingUrl, esc: esc, safeUrl: safeUrl,
    DANA_PHONE: DANA_PHONE,
    DEMO_BANNER: 'Sample data — your real project appears here once Dana sends your link'
  };
})();
