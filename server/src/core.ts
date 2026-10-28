/**
 * Hello Shade customer API — platform-neutral core.
 *
 * GET /project?token=…  -> one customer's windows (looked up by Customers."Project token")
 * GET /order?token=…    -> one order's status   (looked up by Orders."Status token")
 *
 * Plain fetch() against the Airtable REST API. No SDK, no Node APIs, so it runs on
 * Cloudflare Workers and Supabase Edge Functions (Deno) unchanged.
 *
 * Safety:
 *  - Every Airtable request passes an explicit fields[] allow-list. Internal notes, costs,
 *    supplier info, phone/email/address and check notes are never requested, so they cannot leak.
 *  - Tokens must match TOKEN_RE before they touch a formula (no formula injection).
 *  - Unknown token -> 404 with no detail. Responses are no-store.
 */

export interface Env {
  AIRTABLE_TOKEN: string; // Airtable personal access token: data.records:read on this base only
  BASE_ID: string; // appXvoZEwBTM7Uj7A
  ALLOWED_ORIGINS?: string; // comma-separated; default https://aslevi.github.io
}

const API = "https://api.airtable.com/v0";
const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;
const DEFAULT_ORIGINS = "https://aslevi.github.io";

const T = {
  customers: "Customers",
  windows: "Windows",
  orders: "Orders",
  kits: "Swatch kits",
  colors: "Colors",
} as const;

/* Exact Airtable field names this API reads (allow-lists). */
export const FIELDS = {
  customers: ["Name", "Design code(s)", "Project token", "Windows", "Orders", "Swatch kits"],
  windows: [
    "Room", "Label", "Style", "Fabric family", "Color", "Color (link)", "Mount", "Control", "Control side",
    "Width 1 (in)", "Width 2 (in)", "Width 3 (in)",
    "Height 1 (in)", "Height 2 (in)", "Height 3 (in)", "Depth (in)",
    "Order width (in)", "Order height (in)",
    "Photos", "Measured date", "Checked date", "Price",
  ],
  orders: [
    "Order", "Quote total", "Quote sent date", "Stripe link", "Paid date", "Ordered date",
    "Tracking", "Shipped date", "Delivered date", "Lost / cancelled", "Free remake until",
    "Status", "Status token", "Customer", "Windows",
  ],
  kits: ["Mailed date"],
  colors: ["Color name", "Hex", "Swatch file"],
};

type Rec = { id: string; fields: Record<string, any> };

/* ---------------- HTTP entry ---------------- */

export async function handle(req: Request, env: Env): Promise<Response> {
  const origin = req.headers.get("Origin") || "";
  const cors = corsHeaders(origin, env);

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "GET") return json({ error: "method_not_allowed" }, 405, cors);

  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "");
  const token = url.searchParams.get("token") || "";

  // Supabase serves at /functions/v1/<name>/project; Cloudflare at /project. Match the suffix.
  const route = path.endsWith("/project") ? "project" : path.endsWith("/order") ? "order" : null;
  if (!route) return json({ error: "not_found" }, 404, cors);
  if (!TOKEN_RE.test(token)) return json({ error: "not_found" }, 404, cors);
  if (!env.AIRTABLE_TOKEN || !env.BASE_ID) return json({ error: "server_not_configured" }, 500, cors);

  try {
    const body = route === "project" ? await getProject(env, token) : await getOrder(env, token);
    if (!body) return json({ error: "not_found" }, 404, cors);
    return json(body, 200, cors);
  } catch (e) {
    console.error("hs-api error", e instanceof Error ? e.message : e);
    return json({ error: "upstream" }, 502, cors);
  }
}

function corsHeaders(origin: string, env: Env): Record<string, string> {
  const allowed = (env.ALLOWED_ORIGINS || DEFAULT_ORIGINS).split(",").map((s) => s.trim()).filter(Boolean);
  const h: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Accept, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (allowed.includes(origin)) h["Access-Control-Allow-Origin"] = origin;
  return h;
}

function json(body: unknown, status: number, extra: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      ...extra,
    },
  });
}

/* ---------------- Airtable helpers ---------------- */

async function list(env: Env, table: string, fields: string[], formula: string, max = 100): Promise<Rec[]> {
  const out: Rec[] = [];
  let offset = "";
  do {
    const q = new URLSearchParams();
    for (const f of fields) q.append("fields[]", f);
    q.set("filterByFormula", formula);
    q.set("pageSize", "100");
    if (offset) q.set("offset", offset);
    const r = await fetch(`${API}/${env.BASE_ID}/${encodeURIComponent(table)}?${q}`, {
      headers: { Authorization: `Bearer ${env.AIRTABLE_TOKEN}` },
    });
    if (!r.ok) throw new Error(`Airtable ${table} ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const data: { records: Rec[]; offset?: string } = await r.json();
    out.push(...data.records);
    offset = data.offset || "";
  } while (offset && out.length < max);
  return out;
}

/** Fetch records by id (ids come from Airtable link fields, validated anyway). */
async function byIds(env: Env, table: string, fields: string[], ids: string[]): Promise<Rec[]> {
  const clean = (ids || []).filter((id) => /^rec[A-Za-z0-9]{14}$/.test(id)).slice(0, 100);
  if (!clean.length) return [];
  const out: Rec[] = [];
  for (let i = 0; i < clean.length; i += 40) {
    const chunk = clean.slice(i, i + 40);
    const formula = `OR(${chunk.map((id) => `RECORD_ID()='${id}'`).join(",")})`;
    out.push(...(await list(env, table, fields, formula)));
  }
  const order = new Map(clean.map((id, i) => [id, i]));
  return out.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

async function findOne(env: Env, table: string, fields: string[], tokenField: string, token: string): Promise<Rec | null> {
  // token already matched TOKEN_RE (no quotes/braces possible).
  const rows = await list(env, table, fields, `{${tokenField}}='${token}'`, 2);
  return rows.length === 1 ? rows[0] : null; // 0 or duplicate tokens -> not found
}

const num = (v: any): number | null => (typeof v === "number" && isFinite(v) ? v : null);
const str = (v: any): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const day = (v: any): string | null => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);
const firstName = (name: any) => (str(name) && !/^\+?[\d\s().-]+$/.test(name) ? String(name).trim().split(/\s+/)[0] : null);
const maxDate = (ds: (string | null)[]) => ds.filter(Boolean).sort().pop() || null;

function checkState(w: Rec): "waiting" | "checking" | "checked" {
  const m = day(w.fields["Measured date"]);
  const c = day(w.fields["Checked date"]);
  if (!m) return "waiting";
  if (!c || c < m) return "checking"; // re-measured after the check -> re-check
  return "checked";
}

/* ---------------- /project ---------------- */

async function getProject(env: Env, token: string) {
  const cust = await findOne(env, T.customers, FIELDS.customers, "Project token", token);
  if (!cust) return null;

  const winRecs = await byIds(env, T.windows, FIELDS.windows, cust.fields["Windows"]);
  const colorIds = [...new Set(winRecs.flatMap((w) => w.fields["Color (link)"] || []))] as string[];
  const colors = new Map((await byIds(env, T.colors, FIELDS.colors, colorIds)).map((c) => [c.id, c.fields]));

  const windows = winRecs.map((w) => {
    const f = w.fields;
    const col = colors.get((f["Color (link)"] || [])[0]) || {};
    const photos = (f["Photos"] || [])
      .filter((p: any) => /^image\//.test(p.type || ""))
      .slice(0, 4)
      .map((p: any) => ({ url: p.url, thumb: p.thumbnails?.large?.url || p.url, alt: null }));
    return {
      id: w.id,
      room: str(f["Room"]),
      label: str(f["Label"]),
      style: str(f["Style"]),
      fabric: str(f["Fabric family"]),
      color: str(col["Color name"]) || str(f["Color"]),
      colorHex: str(col["Hex"]),
      swatch: str(col["Swatch file"]), // repo-relative path, e.g. swatches/raw-linen-flax.webp
      mount: str(f["Mount"]),
      control: str(f["Control"]),
      controlSide: str(f["Control side"]),
      widths: [num(f["Width 1 (in)"]), num(f["Width 2 (in)"]), num(f["Width 3 (in)"])],
      heights: [num(f["Height 1 (in)"]), num(f["Height 2 (in)"]), num(f["Height 3 (in)"])],
      depth: num(f["Depth (in)"]),
      orderWidth: num(f["Order width (in)"]),
      orderHeight: num(f["Order height (in)"]),
      check: checkState(w),
      measuredDate: day(f["Measured date"]),
      checkedDate: day(f["Checked date"]),
      photos,
      price: num(f["Price"]),
    };
  });

  // Most recent open order (if any) for the next-step button.
  const orders = (await byIds(env, T.orders, FIELDS.orders, cust.fields["Orders"]))
    .filter((o) => !o.fields["Lost / cancelled"]);
  const o = orders[orders.length - 1];
  const paid = !!(o && day(o.fields["Paid date"]));

  return {
    demo: false,
    customer: { firstName: firstName(cust.fields["Name"]), designCode: str(cust.fields["Design code(s)"])?.split(",")[0].trim() || null },
    windows,
    total: windows.reduce((s, w) => s + (w.price || 0), 0),
    order: o
      ? {
          statusToken: TOKEN_RE.test(o.fields["Status token"] || "") ? o.fields["Status token"] : null,
          status: str(o.fields["Status"]),
          paid,
          payUrl: !paid && o.fields["Quote sent date"] && /^https:\/\//.test(o.fields["Stripe link"] || "") ? o.fields["Stripe link"] : null,
        }
      : null,
  };
}

/* ---------------- /order ---------------- */

async function getOrder(env: Env, token: string) {
  const o = await findOne(env, T.orders, FIELDS.orders, "Status token", token);
  if (!o || o.fields["Lost / cancelled"]) return null;
  const f = o.fields;

  const [cust] = await byIds(env, T.customers, FIELDS.customers, f["Customer"] || []);
  const wins = await byIds(env, T.windows, ["Measured date", "Checked date", "Price"], f["Windows"] || []);
  const kits = cust ? await byIds(env, T.kits, FIELDS.kits, cust.fields["Swatch kits"] || []) : [];

  const states = wins.map(checkState);
  const allChecked = wins.length > 0 && states.every((s) => s === "checked");
  const allMeasured = wins.length > 0 && states.every((s) => s !== "waiting");
  const paid = day(f["Paid date"]);
  const tracking = str(f["Tracking"]);

  return {
    demo: false,
    customer: cust
      ? { firstName: firstName(cust.fields["Name"]), designCode: str(cust.fields["Design code(s)"])?.split(",")[0].trim() || null }
      : {},
    order: {
      name: str(f["Order"]),
      status: str(f["Status"]),
      total: num(f["Quote total"]),
      windowCount: wins.length,
      samplesSentDate: maxDate(kits.map((k) => day(k.fields["Mailed date"]))),
      measuredDate: allMeasured ? maxDate(wins.map((w) => day(w.fields["Measured date"]))) : null,
      checkedDate: allChecked ? maxDate(wins.map((w) => day(w.fields["Checked date"]))) : null,
      quoteSentDate: day(f["Quote sent date"]),
      paidDate: paid,
      orderedDate: day(f["Ordered date"]),
      shippedDate: day(f["Shipped date"]),
      tracking: tracking && /^[A-Za-z0-9 :/._?=&-]{6,200}$/.test(tracking) ? tracking : null,
      deliveredDate: day(f["Delivered date"]),
      installedDate: null, // no Airtable field yet (optional: add "Installed date" to Orders)
      freeRemakeUntil: day(f["Free remake until"]),
      projectToken: cust && TOKEN_RE.test(cust.fields["Project token"] || "") ? cust.fields["Project token"] : null,
      payUrl: !paid && f["Quote sent date"] && /^https:\/\//.test(f["Stripe link"] || "") ? f["Stripe link"] : null,
    },
  };
}
