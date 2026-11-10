// Turn a customer's window photo into a "room plate" for Try on: a 1536 × 1024 image where the window
// faces the camera as a clean rectangle, placed where the studio expects windows to be.
//
// Rules for where the window goes (plate pixels):
//  - centered at x = 768, its middle at y = 400 (a little above center, like the stock rooms)
//  - real proportions from the photo (width / height of the corner quad)
//  - as small as possible while the photo still fills the frame, but never smaller than 340 px tall
//    and never larger than 620 px tall or 900 px wide (the 3D shade looks best in that range)
// The photo is perspective-corrected so the 4 corners land exactly on that rectangle. Anything the photo
// doesn't cover is filled from its nearest edge (the restyle step repaints it properly).
export const PLATE_W = 1536, PLATE_H = 1024;
const CX = 768, CY = 400, H_MIN = 340, H_MAX = 620, W_MAX = 900;

// Homography mapping the unit square to quad q ([[x,y]×4], TL TR BR BL). Returns 3×3 row-major.
function squareToQuad(q) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3, dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  const den = dx1 * dy2 - dx2 * dy1, g = (dx3 * dy2 - dx2 * dy3) / den, h = (dx1 * dy3 - dx3 * dy1) / den;
  return [x1 - x0 + g * x1, x3 - x0 + h * x3, x0, y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h, 1];
}
function inv3(m) {
  const [a, b, c, d, e, f, g, h, i] = m, A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  return [A / det, -(b * i - c * h) / det, (b * f - c * e) / det, B / det, (a * i - c * g) / det, -(a * f - c * d) / det, C / det, -(a * h - b * g) / det, (a * e - b * d) / det];
}
const mul3 = (a, b) => [0, 1, 2].flatMap(r => [0, 1, 2].map(c => a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c]));
// Map plate pixel -> photo pixel for a window quad (photo px) placed on rect [x0,y0,x1,y1] (plate px).
function plateToPhoto(quad, rect) {
  const [x0, y0, x1, y1] = rect;
  const toRect = squareToQuad([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
  return mul3(squareToQuad(quad), inv3(toRect));
}
const apply = (m, x, y) => { const w = m[6] * x + m[7] * y + m[8]; return [(m[0] * x + m[1] * y + m[2]) / w, (m[3] * x + m[4] * y + m[5]) / w]; };

// Window proportions from a quad in photo pixels (average of opposite sides).
export function quadAspect(q) {
  const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  return ((d(q[0], q[1]) + d(q[3], q[2])) / 2) / ((d(q[0], q[3]) + d(q[1], q[2])) / 2);
}
export function placeWindow(quad, photoW, photoH, aspect = quadAspect(quad)) {
  const rectFor = H => { let h = H, w = h * aspect; if (w > W_MAX) { w = W_MAX; h = w / aspect; } return [CX - w / 2, CY - h / 2, CX + w / 2, CY + h / 2]; };
  const coverage = rect => {
    const m = plateToPhoto(quad, rect); let inside = 0, n = 0;
    for (let y = 8; y < PLATE_H; y += 48) for (let x = 8; x < PLATE_W; x += 48) {
      const [u, v] = apply(m, x, y); n++; if (u >= 0 && v >= 0 && u < photoW && v < photoH) inside++;
    }
    return inside / n;
  };
  for (let H = H_MIN; H <= H_MAX; H += 20) { const r = rectFor(H); if (coverage(r) >= 0.985) return r.map(Math.round); }
  return rectFor(H_MAX).map(Math.round);
}

// Warp `src` (canvas or image) so `quad` (src px) lands on `rect` (plate px). Returns a 1536 × 1024 canvas.
export function warpToPlate(src, quad, rect) {
  const sw = src.width || src.naturalWidth, sh = src.height || src.naturalHeight;
  const sc = document.createElement('canvas'); sc.width = sw; sc.height = sh;
  const sx = sc.getContext('2d'); sx.drawImage(src, 0, 0, sw, sh);
  const sd = sx.getImageData(0, 0, sw, sh).data;
  const out = document.createElement('canvas'); out.width = PLATE_W; out.height = PLATE_H;
  const ox = out.getContext('2d'), img = ox.createImageData(PLATE_W, PLATE_H), od = img.data;
  const m = plateToPhoto(quad, rect);
  for (let y = 0; y < PLATE_H; y++) for (let x = 0; x < PLATE_W; x++) {
    let [u, v] = apply(m, x + 0.5, y + 0.5); u -= 0.5; v -= 0.5;
    // Outside the photo: clamp to the nearest edge (smeared, but the restyle step paints over it).
    u = Math.min(sw - 1.001, Math.max(0, u)); v = Math.min(sh - 1.001, Math.max(0, v));
    const ix = u | 0, iy = v | 0, fx = u - ix, fy = v - iy, i = (iy * sw + ix) * 4, j = i + sw * 4, o = (y * PLATE_W + x) * 4;
    for (let c = 0; c < 3; c++) {
      od[o + c] = (sd[i + c] * (1 - fx) + sd[i + 4 + c] * fx) * (1 - fy) + (sd[j + c] * (1 - fx) + sd[j + 4 + c] * fx) * fy;
    }
    od[o + 3] = 255;
  }
  ox.putImageData(img, 0, 0);
  return out;
}

// Photo + 4 corners (0-1 fractions) -> { canvas, win } ready for Try on (or for the restyle step).
export function buildPlate(photo, cornersFrac, aspect) {
  const w = photo.width || photo.naturalWidth, h = photo.height || photo.naturalHeight;
  const quad = cornersFrac.map(([x, y]) => [x * w, y * h]);
  const win = placeWindow(quad, w, h, aspect);
  return { canvas: warpToPlate(photo, quad, win), win };
}
