# Tailored Light — website

Live at https://aslevi.github.io/tailored-light/ (GitHub Pages, branch `main`, no build step for site pages).

## Pages
- `index.html` — marketing home. Old studio links (`/?room=…&s=…`) redirect to `/studio/`.
- Store: `shades/` (all), `shades/roller|roman|zebra|woven-wood|blackout/` (listings with client-side filters), `rooms/<room>/` (picks by room), and one product page per fabric family at `shades/<style>/<family>/` (`?c=<color>` preselects a color). `fabrics/`, `swatch-kit/` (picks via `?add=Family|Color`, kept in the browser).
- Help: `measuring/`, `how-it-works/`, `faq/`, `about/`.
- `terms.html`, `privacy.html`, `sms.html` (texting terms), `contact.html`, `thanks.html` (after swatch-kit payment), `support.html` (app support).
- `studio/` — the room studio (built output; Instagram ads link here). Source: `studio-src/` (Vite + three.js).
  Build: `npm run build` in the source folder, then copy `dist/index.html` and `dist/assets/` into `studio/`.
  The studio loads `rooms/`, `swatches/`, `textures/` and `images/` from the site root via `<meta name="tl-site-root" content="../">`.
- `measure/`, `quote/`, `dana/` — customer measuring form, quote page, Dana's board.
- `try.html`, `rooms.html`, `inbox.html` — older tools, left as is.

## Shared files
- `flow/config.js` — Dana's number (`DANA_SMS`), `CONTACT_EMAIL` ('' hides the email line), `SWATCH_KIT_URL` (Stripe link; '' makes swatch-kit buttons text Dana).
- `flow/site.css`, `flow/site.js` — styles and header/menu/text-sheet behavior for the site pages (light and dark mode).
- `flow/shop.js` — listing filters, product page (color, options, size, "Get my exact price" text), swatch-kit picks.
- `images/p/` — product photos rendered in the studio: `<family>-<color>-room|sq|win.webp`, `<family>-alt.webp`.
- `images/` — marketing images rendered from our sample rooms in the studio.
- `config.js`, `supabase/` — inbox backend (Supabase).
