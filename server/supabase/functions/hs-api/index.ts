// Supabase Edge Function entry (Deno). Deploy: see ../../../README.md
// Served at https://<ref>.supabase.co/functions/v1/hs-api/project and /order.
// Deploy with --no-verify-jwt: customers have no Supabase session; the link token is the auth.
import { handle } from "../../../src/core.ts";

Deno.serve((req: Request) =>
  handle(req, {
    AIRTABLE_TOKEN: Deno.env.get("AIRTABLE_TOKEN") ?? "",
    BASE_ID: Deno.env.get("BASE_ID") ?? "appXvoZEwBTM7Uj7A",
    ALLOWED_ORIGINS: Deno.env.get("ALLOWED_ORIGINS") ?? "https://aslevi.github.io",
  })
);
