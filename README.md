# Tailored Light — website

- `index.html` — the try-on (rooms, fabrics, 3D shade, day/night, text Dana, swatch kit). Works with no backend.
- `inbox.html` — designer inbox (leads + swatch orders), protected by an inbox key.
- `config.js` — Supabase URL, publishable key, inbox function URL.
- `supabase/` — table + security rules (`schema.sql`) and the inbox function.

Hosting: any static host (GitHub Pages, Vercel, Netlify, Cloudflare Pages). No build step.
