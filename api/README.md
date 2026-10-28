# /api: shared client for customer pages

Used by `/my-windows/` and `/order/`. Static files only; the backend lives in `/server/`.

- `config.js`: sets `window.HS_API_URL`. If it's empty, the pages show **sample data** with the banner "Sample data — your real project appears here once Dana sends your link".
- `client.js`: `HS.getProject(token)` and `HS.getOrder(token)` return Promises. It also has helpers: `inches(35.5)` gives `35½″`, `money`, `date`, `smsHref`, `trackingUrl` (UPS/FedEx/USPS), `readToken()` (`?t=` or `#t=`).
- `pages.css`: shared brand styles.

Never put an Airtable token here. Everything in this folder is public.

## `GET /project?token=` response

```json
{
  "demo": false,
  "customer": { "firstName": "Jane", "designCode": "TL-4821" },
  "windows": [{
    "id": "rec…", "room": "Living room", "label": "Left", "style": "Roman",
    "fabric": "Raw Linen", "color": "Flax", "colorHex": "#CDBA9C", "swatch": "swatches/raw-linen-flax.webp",
    "mount": "Inside", "control": "Cordless", "controlSide": null,
    "widths": [35.625, 35.5, 35.625], "heights": [59.25, 59.375, 59.25], "depth": 3.25,
    "orderWidth": 35.5, "orderHeight": 59.375,
    "check": "waiting | checking | checked", "measuredDate": "2026-10-24", "checkedDate": "2026-10-25",
    "photos": [{ "url": "https://…", "thumb": "https://…", "alt": null }],
    "price": 289
  }],
  "total": 817,
  "order": { "statusToken": "…", "status": "Quote sent", "paid": false, "payUrl": "https://buy.stripe.com/…" }
}
```

## `GET /order?token=` response

```json
{
  "demo": false,
  "customer": { "firstName": "Jane", "designCode": "TL-4821" },
  "order": {
    "name": "Order #1042", "status": "In production", "total": 817, "windowCount": 3,
    "samplesSentDate": "…", "measuredDate": "…", "checkedDate": "…", "quoteSentDate": "…",
    "paidDate": "…", "orderedDate": "…", "shippedDate": null, "tracking": null,
    "deliveredDate": null, "installedDate": null, "freeRemakeUntil": null,
    "projectToken": "…", "payUrl": null
  }
}
```

All dates are `YYYY-MM-DD` or `null`. The estimated ship window is worked out on the page as 2–4 weeks from `paidDate`. Fit guarantee runs to `freeRemakeUntil`, or `deliveredDate` + 30 days if that's empty.
