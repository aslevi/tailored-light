// Designer inbox API. Reads leads with the service role, only for callers holding INBOX_KEY.
import { createClient } from "jsr:@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "x-inbox-key, content-type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.headers.get("x-inbox-key") !== Deno.env.get("INBOX_KEY")) return new Response("Unauthorized", { status: 401, headers: cors });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  if (req.method === "POST") {
    const { id, status } = await req.json();
    const { error } = await sb.from("leads").update({ status }).eq("id", id);
    return new Response(JSON.stringify({ ok: !error }), { headers: { ...cors, "Content-Type": "application/json" } });
  }
  const { data, error } = await sb.from("leads").select("*").order("created_at", { ascending: false }).limit(200);
  return new Response(JSON.stringify(error ? { error: error.message } : data), { headers: { ...cors, "Content-Type": "application/json" } });
});
