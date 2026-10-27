// Hello Shade design code: reproducible from the look link.
// Code = 'TL-' + first 4 chars of a base36 hash (FNV-1a 32-bit) of the canonical look query string.
// Canonical query = keys room,s,f,c,r,l in that order (only those present and non-empty), serialized
// with URLSearchParams. 'ref' and anything else is excluded. Keep this file identical to /flow/code.js.
export const LOOK_KEYS = ['room', 's', 'f', 'c', 'r', 'l'];

export function canonicalLook(input) {
  const src = input instanceof URLSearchParams ? input
    : typeof input === 'string' ? new URLSearchParams(input.includes('?') ? input.slice(input.indexOf('?') + 1).split('#')[0] : input)
    : new URLSearchParams(Object.entries(input || {}).filter(([, v]) => v != null));
  const out = new URLSearchParams();
  for (const k of LOOK_KEYS) { const v = src.get(k); if (v) out.set(k, v); }
  return out.toString();
}

export function hash36(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  // mod 36^6 keeps the leading digits well spread (a raw 32-bit value always starts with 0 or 1 in base36)
  return ((h >>> 0) % 2176782336).toString(36).toUpperCase().padStart(6, '0');
}

export const designCode = input => 'TL-' + hash36(canonicalLook(input)).slice(0, 4);
