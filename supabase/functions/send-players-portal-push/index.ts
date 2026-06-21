// Fans out real Web Push notifications to specific players' devices.
// Called directly from cue-light.html as Matthew works through the event
// schedule (doors open, a match called, the light going green) — not
// triggered by a DB hook. Stays "dumb": given names, resolve to accounts
// then subscriptions, then send. All sequencing (which match is current,
// which is next) is decided by the caller, not here.
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

async function subscriptionsForNames(supabase: ReturnType<typeof createClient>, names: string[]) {
  const cleaned = (names ?? []).filter((n) => typeof n === "string" && n.trim() !== "");
  if (!cleaned.length) return [];
  const { data: accounts, error: accountsError } = await supabase
    .from("player_portal_accounts")
    .select("id")
    .in("display_name", cleaned);
  if (accountsError) throw accountsError;
  const ids = (accounts ?? []).map((a) => a.id);
  if (!ids.length) return [];
  const { data: subs, error: subsError } = await supabase
    .from("player_portal_push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("player_id", ids);
  if (subsError) throw subsError;
  return subs ?? [];
}

// Accounts with notify_all=true (e.g. a test device) get every "called"/
// "live"/"up next" push regardless of whose name the schedule matched —
// doors_open already reaches them since it already broadcasts to every
// subscription with no name filter at all.
async function alwaysNotifySubs(supabase: ReturnType<typeof createClient>) {
  const { data: accounts, error: accountsError } = await supabase
    .from("player_portal_accounts")
    .select("id")
    .eq("notify_all", true);
  if (accountsError) throw accountsError;
  const ids = (accounts ?? []).map((a) => a.id);
  if (!ids.length) return [];
  const { data: subs, error: subsError } = await supabase
    .from("player_portal_push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("player_id", ids);
  if (subsError) throw subsError;
  return subs ?? [];
}

function mergeSubs(
  ...lists: { id: string; endpoint: string; p256dh: string; auth: string }[][]
) {
  const byId = new Map<string, { id: string; endpoint: string; p256dh: string; auth: string }>();
  for (const list of lists) for (const sub of list) byId.set(sub.id, sub);
  return [...byId.values()];
}

async function sendToSubs(
  supabase: ReturnType<typeof createClient>,
  subs: { id: string; endpoint: string; p256dh: string; auth: string }[],
  title: string,
  body: string,
) {
  const payload = JSON.stringify({ title, body });
  const results = await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from("player_portal_push_subscriptions").delete().eq("id", sub.id);
        }
        throw err;
      }
    }),
  );
  return results.filter((r) => r.status === "fulfilled").length;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const body = await req.json();
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Authoritative kill switch: the Controller can flip portalAlertsEnabled
    // off, and that's enforced here regardless of how/why this function was
    // called — not just a client-side skip in cue-light.html. Mirrors the
    // same pattern send-cue-light-push uses for its own alertsEnabled flag.
    const { data: settingsRow, error: settingsError } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "cue_light_event")
      .maybeSingle();
    if (settingsError) throw settingsError;
    const settings = settingsRow?.value
      ? (typeof settingsRow.value === "string" ? JSON.parse(settingsRow.value) : settingsRow.value)
      : {};
    if (settings.portalAlertsEnabled === false) {
      return new Response(JSON.stringify({ skipped: true, reason: "alerts disabled" }), {
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    let sent = 0;

    if (body.action === "doors_open") {
      const { data: subs, error } = await supabase
        .from("player_portal_push_subscriptions")
        .select("id, endpoint, p256dh, auth");
      if (error) throw error;
      sent += await sendToSubs(
        supabase,
        subs ?? [],
        "🚪 Doors Open",
        "Doors are open — the event has started.",
      );
    } else if (body.action === "called") {
      const always = await alwaysNotifySubs(supabase);
      const subs = mergeSubs(await subscriptionsForNames(supabase, body.names), always);
      sent += await sendToSubs(
        supabase,
        subs,
        "📣 You're Called",
        "You're called — report to the board and wait for the green light.",
      );
    } else if (body.action === "live") {
      const always = await alwaysNotifySubs(supabase);
      const liveSubs = mergeSubs(await subscriptionsForNames(supabase, body.liveNames), always);
      sent += await sendToSubs(supabase, liveSubs, "🟢 GO!", "Start your match now.");
      const nextSubs = mergeSubs(await subscriptionsForNames(supabase, body.nextNames), always);
      sent += await sendToSubs(
        supabase,
        nextSubs,
        "⏭️ You're Up Next",
        "You're up next — please be prepared.",
      );
    } else {
      return new Response(JSON.stringify({ error: "Unrecognized action" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ sent }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : (e as { message?: string })?.message ?? JSON.stringify(e);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
