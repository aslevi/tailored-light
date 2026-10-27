// Tailored Light pricing: one source for every price on the site, the studio and Dana's board.
// Costs are from our supplier's landed (DDP) quotes, with conservative formulas so a held price
// never loses money. Sizes are the order size in inches.
//
//   sqft = W * H / 144
//   roller     cost = 90 + 1.0 * max(0, sqft - 8) + 1.2 * max(0, W - 40)
//   roman      cost = max(110, 9.25 * sqft)          (+10% with a room-darkening lining; folds don't change it;
//              no lining for Sheer Voile, Blackout Linen or Natural Reed)
//   woven wood cost = max(115, 60 + 7.5 * sqft)       (Natural Reed, made as a Roman)
//   zebra      cost = 1.15 * roller cost              (shown as an estimate until confirmed by text)
//
//   retail = cost * 2.3, rounded UP to the next price ending in 9:  ceil((p + 1) / 10) * 10 - 1, minimum $149.
//   Instant prices for width 12–96" and height 12–120"; outside that we quote by text.
//   "From" prices are the formula at the smallest standard size, 24 x 24.

export const LIMITS = { minW: 12, maxW: 96, minH: 12, maxH: 120 };
export const FROM_SIZE = { width: 24, height: 24 };
export const MARKUP = 2.3;
export const MIN_PRICE = 149;
export const PRICE_HOLD_NOTE = 'Price held unless our check finds a different size.';
export const MULTI_WINDOW_NOTE = 'Each window is priced separately; text a designer for a whole room.';
export const ESTIMATE_NOTE = 'Zebra prices are an estimate until we confirm by text.';
export const OUT_OF_RANGE_NOTE = 'For this size, text a designer for your price.';

const WOVEN = new Set(['Natural Reed']);
// The pricing line for a product: roller, roman, woven or zebra.
export const priceLine = (style, family) => (style === 'roman' && WOVEN.has(family)) ? 'woven' : style;
// Room-darkening lining: Roman fabrics only, not the sheer, the blackout or the woven.
const NO_LINING = new Set(['Sheer Voile', 'Blackout Linen', 'Natural Reed']);
export const liningAvailable = (style, family) => style === 'roman' && !NO_LINING.has(family);

const rollerCost = (w, h) => { const sq = w * h / 144; return 90 + 1.0 * Math.max(0, sq - 8) + 1.2 * Math.max(0, w - 40); };

export function costFor({ style, family, width, height, lining = false }) {
  const w = +width, h = +height, sq = w * h / 144, line = priceLine(style, family);
  let c;
  if (line === 'roller') c = rollerCost(w, h);
  else if (line === 'roman') c = Math.max(110, 9.25 * sq) * (lining && liningAvailable(style, family) ? 1.1 : 1);
  else if (line === 'woven') c = Math.max(115, 60 + 7.5 * sq);
  else if (line === 'zebra') c = 1.15 * rollerCost(w, h);
  else return null;
  return c;
}

export const retailFromCost = c => Math.max(MIN_PRICE, Math.ceil((c * MARKUP + 1) / 10) * 10 - 1);

export const inRange = (w, h) => w >= LIMITS.minW && w <= LIMITS.maxW && h >= LIMITS.minH && h <= LIMITS.maxH;

// Full answer for the price modules: { price, estimate, outOfRange }.
export function quote({ style, family, width, height, lining = false }) {
  const w = +width, h = +height;
  if (!(w > 0) || !(h > 0)) return { price: null, estimate: false, outOfRange: false };
  if (!inRange(w, h)) return { price: null, estimate: false, outOfRange: true };
  const c = costFor({ style, family, width: w, height: h, lining });
  return { price: c == null ? null : retailFromCost(c), estimate: priceLine(style, family) === 'zebra', outOfRange: false };
}

// Whole-dollar price, or null (no size, off the limits, unknown style). Kept for older callers.
export const priceFor = args => quote(args).price;

// "From" price for a product or style, at the smallest standard size.
export const fromPrice = (style, family) => retailFromCost(costFor({ style, family, ...FROM_SIZE }));
export const FROM = { roller: fromPrice('roller'), roman: fromPrice('roman'), woven: fromPrice('roman', 'Natural Reed'), zebra: fromPrice('zebra') };
export const LOWEST_FROM = Math.min(...Object.values(FROM));

// Parses 34, 34.5, 34 3/8, 34-3/8, 3/8, with or without " or in. Returns inches, '' for empty, or null if unreadable.
export function parseInches(v) {
  const s = String(v ?? '').trim().replace(/["”″]|in(ches)?\.?$/gi, '').trim();
  if (!s) return '';
  const m = s.match(/^(\d+(?:\.\d+)?)(?:[\s-]+(\d+)\/(\d+))?$/) || s.match(/^()(\d+)\/(\d+)$/);
  if (!m) return null;
  const n = (m[1] ? parseFloat(m[1]) : 0) + (m[2] ? +m[2] / +m[3] : 0);
  return isFinite(n) && n > 0 && n <= 400 ? n : null;
}

// 34.375 -> 34 3/8"
export function formatInches(n) {
  const e = Math.round(n * 8), whole = Math.floor(e / 8), rem = e % 8;
  if (!rem) return `${whole}"`;
  const g = rem % 4 === 0 ? 4 : rem % 2 === 0 ? 2 : 1;
  return `${whole} ${rem / g}/${8 / g}"`;
}

export const money = n => '$' + n.toLocaleString('en-US');
