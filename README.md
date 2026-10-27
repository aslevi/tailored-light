# Hello Shade — website

Live at https://aslevi.github.io/tailored-light/ (GitHub Pages, branch `main`, no build step for site pages).

## Pages
- `index.html` — marketing home. Old studio links (`/?room=…&s=…`) redirect to `/studio/`.
- Store: `shades/` (all), `shades/roller|roman|zebra|woven/` plus `shades/blackout/` (old `shades/woven-wood/` URLs redirect) (listings with client-side filters), `rooms/<room>/` (picks by room), and one product page per fabric family at `shades/<style>/<family>/` (`?c=<color>` preselects a color). `fabrics/`, `swatch-kit/` = Free samples (picks via `?add=Family|Color`, kept in the browser).
- Help: `measuring/`, `how-it-works/`, `faq/`, `about/`.
- `terms.html`, `privacy.html`, `sms.html` (texting terms), `contact.html`, `thanks.html` (after swatch-kit payment), `support.html` (app support).
- `studio/` — Try on (built output; Instagram ads link here). Source: `studio-src/` (Vite + three.js).
  Build: `npm run build` in the source folder, then copy `dist/index.html` and `dist/assets/` into `studio/`.
  The studio loads `rooms/`, `swatches/`, `textures/` and `images/` from the site root via `<meta name="tl-site-root" content="../">`.
- `measure/`, `quote/`, `dana/` — customer measuring form, quote page, Dana's board.
- `try.html`, `rooms.html` — old tools, now redirects to `studio/` (query kept). `inbox.html` — older tool, left as is (noindex).

## Brand
- Name **Hello Shade** (repo and URLs keep `tailored-light`). Wordmark: lowercase "hello shade" in Fraunces
  (weight 500, `'SOFT' 100, 'WONK' 0, 'opsz' 72`, letter-spacing −0.02em) plus a rising half-sun with five rays on a
  thin horizon line. Inline markup lives in the page generators (`WORDMARK`); an outlined copy is `brand/wordmark.svg`.
- Icons: `icon.svg` (app icon, rounded "h" + rayed sun), `favicon.svg` (32px version, no rays), `brand/favicon-16.svg`,
  `favicon-16.png`, `favicon-32.png`, `favicon.ico`, `apple-touch-icon.png` (180, full-bleed), `icon-512.png`, `og.jpg` (1200×630).
- Palette "Blush & Honey", light only: cream `#FBF6F0` page, surface `#FFFDFB`, blush `#F3DCD3` tints/lines,
  rose-clay `#A9594A` primary buttons (white labels) and links (hover `#8E4A3D`), honey `#E8AE45` sun and
  "Text a designer" (cocoa labels), cocoa `#4A3530` text, muted `#7A5F57` (on blush use `#6B5049`).
  Every text pair is at least 4.5:1 (lowest: rose-clay link on cream, 4.64:1).
- Fonts are self-hosted in `fonts/` (SIL OFL): Fraunces for the wordmark and headings, DM Sans for body.

## Shared files
- `flow/config.js` — Dana's number (`DANA_SMS`), `CONTACT_EMAIL` ('' hides the email line), `SWATCH_KIT_URL` (free-samples order form; '' texts a designer), `LEAD_FORM_URL`, `DESIGNER_NAME` / `DESIGNER_PHOTO` (designer card; monogram while empty), `PEOPLE_PHOTOS` (lifestyle photo slots; hidden while empty).
- `flow/site.css`, `flow/site.js` — styles and header/menu/text-sheet behavior for the site pages (light only, also when the phone is in dark mode).
- `flow/shop.js` — listing filters, product page (color, options, size, your price, "Text a designer" text), free-samples picks.
- `flow/pricing.js` — the price formulas (one source for site, Try on and tests). `node tests/pricing.test.mjs` checks From prices and sample sizes.
- `images/p/` — product photos rendered in the studio: `<family>-<color>-room|sq|win.webp`, `<family>-alt.webp`.
- `images/` — marketing images rendered from our sample rooms in the studio.
- `config.js`, `supabase/` — inbox backend (Supabase).
