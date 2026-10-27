// Tailored Light pricing. Real per-size prices are waiting on supplier quotes, so PRICE_GRID is null.
// While it is null, every "See your price" module says "Your exact price in minutes by text" and sends
// the size and product to Dana. Turning prices on is only adding data here; no page changes needed.
//
// PRICE_GRID shape (all sizes in inches, prices in whole dollars, before tax and shipping):
// {
//   roller: { widths: [24, 36, 48, 60, 72], heights: [36, 48, 60, 72, 84, 96],
//             prices: [ [95, 105, ...one per width],   // row for heights[0]
//                       [ ... ], ... ],               // one row per height
//             fabric: { 'Deep Sleep': 1.1 } },          // optional multiplier per fabric family
//   roman:  { ... }, zebra: { ... }
// }
// A size is priced at the first width and height breakpoint that is >= the size. Sizes beyond the grid
// return null, and the module falls back to "your exact price by text".
export const PRICE_GRID = null;

export const PRICE_HOLD_NOTE = 'Price held unless our check finds a different size.';

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

// Returns a whole-dollar price, or null when there is no grid, no entry for the style, or the size is off the grid.
export function priceFor({ style, family, width, height }) {
  const g = PRICE_GRID && PRICE_GRID[style];
  if (!g || !(width > 0) || !(height > 0)) return null;
  const wi = g.widths.findIndex(x => x >= width), hi = g.heights.findIndex(x => x >= height);
  if (wi < 0 || hi < 0) return null;
  const base = g.prices[hi]?.[wi];
  if (!(base > 0)) return null;
  return Math.round(base * ((g.fabric && g.fabric[family]) || 1));
}

export const money = n => '$' + n.toLocaleString('en-US');
