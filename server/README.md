# hs-api: the Hello Shade customer API

A small read-only backend for `/my-windows/` and `/order/`. It looks up one customer or order in Airtable by a secret link token and returns only fields that are safe to show the customer. The browser never sees the Airtable token.

**This folder is not deployed by GitHub Pages.** You deploy it on its own, then set `window.HS_API_URL` in `/api/config.js`.

```
GET /project?token=<Customers."Project token">   -> windows, prices, Dana check status
GET /order?token=<Orders."Status token">         -> order timeline dates, tracking
```

Any unknown, malformed or duplicate token returns `404 {"error":"not_found"}`.

## 1. Add two fields in Airtable (one time, by hand)

These fields **do not exist yet**. Add them in base `appXvoZEwBTM7Uj7A`:

| Table     | New field       | Type             | Value |
|-----------|-----------------|------------------|-------|
| Customers | `Project token` | Single line text | Random string, 20 to 64 chars from `A-Z a-z 0-9 _ -` |
| Orders    | `Status token`  | Single line text | Random string, same rules |

Generate a token (24 random bytes, URL-safe):

```sh
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
```

or in an Airtable automation script: `crypto.randomUUID().replaceAll('-', '')`.

Customer links Dana texts:

- `https://helloshade.co/my-windows/?t=<Project token>`
- `https://helloshade.co/order/?t=<Status token>`

`#t=` works too and keeps the token out of server logs and `Referer`. To revoke a link, change or clear the token.

Optional: an `Installed date` field on Orders would light up the last timeline step. The API does not read it yet (Airtable rejects requests for fields that don't exist), so add it to `FIELDS.orders` in `src/core.ts` once it exists.

## 2. Airtable token

Create a personal access token at airtable.com/create/tokens:

- Scope: `data.records:read` only
- Access: only base `appXvoZEwBTM7Uj7A`

## 3. Deploy: pick one

### Option A: Cloudflare Worker

```sh
cd server
npm install
npx wrangler login
npx wrangler secret put AIRTABLE_TOKEN      # paste the PAT
npx wrangler deploy                          # prints https://hs-api.<you>.workers.dev
```

`BASE_ID` and `ALLOWED_ORIGINS` are set in `wrangler.toml`. Then in `/api/config.js`:

```js
window.HS_API_URL = 'https://hs-api.<you>.workers.dev';
```

### Option B: Supabase Edge Function

The repo already has a `/supabase` folder for other functions. To keep this one separate, deploy from `server/`:

```sh
cd server
supabase link --project-ref <ref>
supabase secrets set AIRTABLE_TOKEN=pat_xxx BASE_ID=appXvoZEwBTM7Uj7A ALLOWED_ORIGINS=https://aslevi.github.io
supabase functions deploy hs-api --no-verify-jwt
```

If the CLI won't bundle the `../../../src/core.ts` import (older CLIs only bundle files inside `supabase/functions/`), copy `src/core.ts` to `supabase/functions/hs-api/core.ts` and change the import to `./core.ts`.

`--no-verify-jwt` is required: customers have no Supabase session, and the link token is the only credential. Then:

```js
window.HS_API_URL = 'https://<ref>.supabase.co/functions/v1/hs-api';
```

### Check it

```sh
curl -i "$URL/project?token=<a real Project token>" -H "Origin: https://aslevi.github.io"
```

Expect `200`, `Access-Control-Allow-Origin: https://aslevi.github.io` and `Cache-Control: no-store`.

## Environment variables

| Name              | Required | Default                    | Notes |
|-------------------|----------|----------------------------|-------|
| `AIRTABLE_TOKEN`  | yes      | (none)                     | Secret. Read-only PAT scoped to this base. |
| `BASE_ID`         | yes      | `appXvoZEwBTM7Uj7A`        | |
| `ALLOWED_ORIGINS` | no       | `https://aslevi.github.io` | Comma-separated. Add `http://localhost:8000` for local testing. A custom domain needs adding here. |

## Exactly what it reads from Airtable

Every request sends a `fields[]` allow-list, so nothing else ever leaves Airtable. The lists live in `FIELDS` in `src/core.ts`.

- **Customers**: `Name` (first word only is returned; a phone number in this field is never returned), `Design code(s)`, `Project token`, `Windows`, `Orders`, `Swatch kits`
- **Windows**: `Room`, `Label`, `Style`, `Fabric family`, `Color`, `Color (link)`, `Mount`, `Control`, `Control side`, `Width 1 (in)`, `Width 2 (in)`, `Width 3 (in)`, `Height 1 (in)`, `Height 2 (in)`, `Height 3 (in)`, `Depth (in)`, `Order width (in)`, `Order height (in)`, `Photos`, `Measured date`, `Checked date`, `Price`
- **Orders**: `Order`, `Quote total`, `Quote sent date`, `Stripe link`, `Paid date`, `Ordered date`, `Tracking`, `Shipped date`, `Delivered date`, `Lost / cancelled`, `Free remake until`, `Status`, `Status token`, `Customer`, `Windows`
- **Swatch kits**: `Mailed date`
- **Colors**: `Color name`, `Hex`, `Swatch file`

**It never reads:** Phone, Email, address fields, Notes, Check notes, Checked by, Source / ref, Stage, Owner, Supplier, Supplier order #, Supplier cost, Supplier spec and its rollups, Factory width/height, Remake notes, Fabrics table (supplier names and codes), Colors' supplier code, or Supplier specs.

## How the values are worked out

- **Dana check status** per window: no `Measured date` gives `waiting` ("Waiting for numbers"). Measured but no `Checked date`, or checked *before* it was measured, gives `checking`. Otherwise `checked`. This matches the `Guarantee eligible` formula.
- **Order timeline**: Samples sent is the latest swatch kit `Mailed date`. Measured is set once every window on the order is measured, and Checked by Dana once every window is checked; both use the latest date. Paid, In production, Shipped and Delivered come from `Paid date`, `Ordered date`, `Shipped date` and `Delivered date`.
- **Pay button** shows only when `Quote sent date` is set, the order is unpaid and `Stripe link` is `https://`.
- **Lost / cancelled** orders return 404 on `/order` and are skipped on `/project`.
- Photo URLs are Airtable's signed attachment URLs. They expire after a few hours, which is fine because each page load fetches fresh ones.

## Files

- `src/core.ts`: all logic (plain `fetch`, platform-neutral)
- `cloudflare/worker.ts` and `wrangler.toml`: Cloudflare entry
- `supabase/functions/hs-api/index.ts`: Supabase/Deno entry
- `/api/README.md`: response shapes the pages expect
