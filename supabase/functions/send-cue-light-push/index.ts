// Fans out a real Web Push notification to every subscribed device when
// the cue light controller changes the light. Called directly from
// cue-light.html's setLight() — not triggered by a DB hook — so it only
// fires on an actual deliberate change, never on Off.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

webpush.setVapidDetails("mailto:admin@aadsdarts.com", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const { light } = await req.json();
    if (light !== "start" && light !== "wait") {
      return new Response(JSON.stringify({ skipped: true }), {
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Authoritative kill switch: the Controller can flip alertsEnabled off,
    // and that's enforced here regardless of how/why this function was
    // called — not just a client-side skip.
    const { data: settingsRow, error: settingsError } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "cue_light_event")
      .maybeSingle();
    if (settingsError) throw settingsError;
    const settings = settingsRow?.value
      ? (typeof settingsRow.value === "string" ? JSON.parse(settingsRow.value) : settingsRow.value)
      : {};
    if (settings.alertsEnabled === false) {
      return new Response(JSON.stringify({ skipped: true, reason: "alerts disabled" }), {
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const title = light === "start" ? "🟢 GO" : "🔴 WAIT";
    const body = light === "start" ? "The light just turned green." : "The light just turned red.";
    const payload = JSON.stringify({ title, body });

    const { data: subs, error } = await supabase
      .from("cue_light_push_subscriptions")
      .select("id, endpoint, p256dh, auth");
    if (error) throw error;

    const results = await Promise.allSettled(
      (subs ?? []).map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
          );
        } catch (err) {
          const statusCode = err?.statusCode;
          if (statusCode === 404 || statusCode === 410) {
            await supabase.from("cue_light_push_subscriptions").delete().eq("id", sub.id);
          }
          throw err;
        }
      }),
    );

    const sent = results.filter((r) => r.status === "fulfilled").length;
    return new Response(JSON.stringify({ sent, total: results.length }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : (e?.message ?? JSON.stringify(e));
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
