# detect-window: find the window in a customer's photo

A tiny Cloudflare Worker behind `/try-your-window/`. The page shrinks the photo on the phone (768 px long side, JPEG, usually 40-90 KB), POSTs it here, and gets back the four inside corners of each window. The page places its dots there; the customer can still drag them.

**Not deployed by GitHub Pages.** Deploy it on its own, then put its URL in `DETECT_URL` in `/flow/config.js`. With `DETECT_URL = ''` the page works exactly as before (manual dots, photo stays on the phone).

```
POST /            Content-Type: image/jpeg, raw JPEG body, <= 300 KB
200 {"windows":[{"corners":[[x,y],[x,y],[x,y],[x,y]],"confidence":0.9}], "ms":1830}
```

- Corners are 0-1 fractions of the image width/height, ordered top-left, top-right, bottom-right, bottom-left.
- Best window first (largest and most confident), at most 6. `windows: []` means none found.
- Errors: `403 origin_not_allowed`, `405`, `413 too_large`, `415 send_image_jpeg`, `400 not_a_jpeg`, `502 upstream`, `504 upstream_timeout` (8 s). The page falls back to manual dots on any error, or after 4 s.

## /restyle: "See it in your room"

The same Worker also restyles a customer's room so Try on can open it (`RESTYLE_URL` in `/flow/config.js` follows `DETECT_URL`, so deploying this Worker turns it on).

```
POST /restyle     Content-Type: image/jpeg, raw JPEG body, <= 1.5 MB (the 1536 × 1024 room plate the phone builds)
200 {"image":"data:image/png;base64,...","windows":[...as above...],"floor":0.82,"ms":21000}
```

1. The phone straightens the photo so the window faces the camera and places it where Try on expects windows (`/flow/room-plate.js`).
2. The Worker sends that to an image model (`RESTYLE_MODEL`, default `google/gemini-3-pro-image-preview`) with a prompt that keeps the window, its trim and the view exactly where they are, keeps it bare, removes clutter and fills the edges.
3. Image models nudge the window a few percent, so the Worker finds it again in the result (same detector as above, plus the floor line).
4. The phone squares that window up, saves the room on the phone (`/flow/my-room.js`, IndexedDB) and opens `/studio/?room=mine`. The shade is sized to that window.

Any failure falls back to the straightened photo, so the customer always gets their room. Takes about 15-30 s. Cost is the image model's price per image (check OpenRouter; Gemini 3 Pro Image is roughly 10-15 cents) plus a fraction of a cent for detection. Set a spend limit on the key and a rate limit on the route (for example 5 restyles per hour per IP).

| Var | Default | Notes |
|---|---|---|
| `RESTYLE_MODEL` | `google/gemini-3-pro-image-preview` | Any OpenRouter model that takes an image in and returns an image (`modalities: ["image","text"]`). |

## Privacy

The photo goes to OpenRouter and on to the model provider for this one request. The Worker does not store it, log it or put it in any URL. It sends no `console.log`. If you turn on Workers Logs or Logpush, request bodies are not included, but keep it off anyway. The page copy says: "Your photo is only used to find your window and restyle your room. We don't keep it." The restyled room comes back to the phone and is saved there only.

## Deploy (about 5 minutes)

```sh
cd server/detect-window
npx wrangler login
npx wrangler secret put OPENROUTER_API_KEY     # paste the key; it never goes in a file
npx wrangler deploy                            # prints https://hs-detect-window.<account>.workers.dev
```

Then in `/flow/config.js`:

```js
export const DETECT_URL = 'https://hs-detect-window.<account>.workers.dev';
```

Settings in `wrangler.toml`:

| Var | Default | Notes |
|---|---|---|
| `ALLOWED_ORIGINS` | `https://helloshade.co` | Comma separated. Add `http://localhost:8000` only while testing. |
| `MODEL` | `anthropic/claude-sonnet-5.5` | Any OpenRouter vision model id. `google/*` models (Gemini and Gemma) automatically get the 0-1000 integer prompt they handle best. |
| `PROVIDER_ORDER` | (`makora,parasail` for `google/gemma*`, else none) | Optional comma-separated OpenRouter provider slugs to try first; others are still used as fallback. |

Suggested: add a Cloudflare rate-limiting rule on the Worker route (for example 20 requests per minute per IP) and a monthly spend limit on the OpenRouter key.

## Why this model (October 2026 test, 26 room photos, 28 windows)

| Model | Mean corner error (% of window diagonal) | Found | p50 / p90 latency | $/photo |
|---|---|---|---|---|
| claude-sonnet-5.5 (default) | 2.7 | 28/28 | 1.9 / 2.4 s | $0.0022 |
| gemma-4-26b-a4b-it (0-1000 prompt, Makora/Parasail first; 5 runs) | 2.1 | 140/140 | 0.9 / 1.4 s | $0.00004 |
| gemini-3.7-flash (0-1000 prompt) | 1.1 | 28/28 | 3.2 / 4.2 s | $0.0018 |
| claude-haiku-5.5 | 8.7 (returns the outer trim) | 27/28 | 1.7 / 2.2 s | $0.0001 |
| gemini-3.5-flash-lite (0-1000 prompt) | 3.3 | 23/28 | 1.4 / 1.6 s | $0.0006 |

Sonnet is the only one that is both accurate and inside the 2.5 s budget. It tends to return a straight rectangle on angled photos, which is what the dots are for. Gemini 3.7 Flash is more precise and follows perspective but takes about 3 s; switch `MODEL` if accuracy matters more than speed.

## Local test

```sh
node -e "import('./worker.js').then(m=>console.log(m.parseWindows('{\"windows\":[{\"corners\":[[0.3,0.1],[0.7,0.1],[0.7,0.5],[0.3,0.5]],\"confidence\":0.9}]}')))"
```
