// Fans out real Web Push notifications to score keepers'/callers' devices.
// Called directly from cue-light.html: once when Matthew uploads/replaces
// the shift schedule, and again as the match progression advances (a match
// going live). Stays "dumb": given names, resolve to accounts then
// subscriptions, then send — all sequencing decided by the caller.
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

// Matthew types shift names freehand from the CSV, so they don't always
// match an account's registered display_name exactly — wrong case, or a
// nickname he's used to ("Darrall Cormier" on the sheet for an account
// registered as "Dee Cormier"). Match case-insensitively, and treat known
// first-name aliases as equivalent as long as the last name matches.
const NAME_ALIAS_GROUPS = [
  ["michel", "michal", "michael", "mike"],
  ["darrell", "darrall", "dee"],
];
function nameKey(s: string | null | undefined) {
  return (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}
function canonicalFirstName(first: string) {
  for (const group of NAME_ALIAS_GROUPS) if (group.includes(first)) return group[0];
  return first;
}
function namesMatch(a: string, b: string) {
  const ka = nameKey(a);
  const kb = nameKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  const pa = ka.split(" ");
  const pb = kb.split(" ");
  if (pa[pa.length - 1] !== pb[pb.length - 1]) return false;
  return canonicalFirstName(pa[0]) === canonicalFirstName(pb[0]);
}

async function subscriptionsForNames(supabase: ReturnType<typeof createClient>, names: string[]) {
  const cleaned = (names ?? []).filter((n) => typeof n === "string" && n.trim() !== "");
  if (!cleaned.length) return [];
  const { data: allAccounts, error: accountsError } = await supabase
    .from("scorekeeper_portal_accounts")
    .select("id, display_name");
  if (accountsError) throw accountsError;
  const ids = (allAccounts ?? [])
    .filter((a) => cleaned.some((n) => namesMatch(n, a.display_name)))
    .map((a) => a.id);
  if (!ids.length) return [];
  const { data: subs, error: subsError } = await supabase
    .from("scorekeeper_portal_push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("scorekeeper_id", ids);
  if (subsError) throw subsError;
  return subs ?? [];
}

// Accounts with notify_all=true (e.g. Matthew Dow, who's always the admin)
// get every "live"/"up next" push regardless of whose name the schedule
// matched — mirrors send-players-portal-push's alwaysNotifySubs.
async function alwaysNotifySubs(supabase: ReturnType<typeof createClient>) {
  const { data: accounts, error: accountsError } = await supabase
    .from("scorekeeper_portal_accounts")
    .select("id")
    .eq("notify_all", true);
  if (accountsError) throw accountsError;
  const ids = (accounts ?? []).map((a) => a.id);
  if (!ids.length) return [];
  const { data: subs, error: subsError } = await supabase
    .from("scorekeeper_portal_push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("scorekeeper_id", ids);
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
          await supabase.from("scorekeeper_portal_push_subscriptions").delete().eq("id", sub.id);
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

    // Authoritative kill switch: the Controller can flip
    // scorekeeperAlertsEnabled off for the event it's currently managing,
    // and that's enforced here regardless of how/why this function was
    // called — not just a client-side skip in cue-light.html. Mirrors the
    // same pattern send-players-portal-push uses for portalAlertsEnabled.
    const { data: eventRow, error: eventError } = await supabase
      .from("events")
      .select("state")
      .eq("id", body.eventId)
      .maybeSingle();
    if (eventError) throw eventError;
    const settings = eventRow?.state
      ? (typeof eventRow.state === "string" ? JSON.parse(eventRow.state) : eventRow.state)
      : {};
    if (settings.scorekeeperAlertsEnabled === false) {
      return new Response(JSON.stringify({ skipped: true, reason: "alerts disabled" }), {
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    let sent = 0;

    if (body.action === "schedule_updated") {
      const { data: subs, error } = await supabase
        .from("scorekeeper_portal_push_subscriptions")
        .select("id, endpoint, p256dh, auth");
      if (error) throw error;
      sent += await sendToSubs(
        supabase,
        subs ?? [],
        "🗒️ Schedule Updated",
        "The score keeper schedule has been updated — check your shifts.",
      );
    } else if (body.action === "called") {
      // Fired when the cue light turns red for this match — everyone
      // assigned to it (caller, scorekeeper, backups, floor control, etc)
      // gets the same message naming the full lineup, not just their own
      // role, so backups know who's primary and can follow along.
      const roles: { role: string; name: string }[] = (body.roles ?? []).filter(
        (r: { role: string; name: string }) => r?.name,
      );
      const names = roles.map((r) => r.name);
      const always = await alwaysNotifySubs(supabase);
      const subs = mergeSubs(await subscriptionsForNames(supabase, names), always);
      const lineup = roles.map((r) => `${r.role}: ${r.name}`).join(" · ");
      const matchLabel = body.match ? `${body.match.playerA} vs ${body.match.playerB} — ` : "";
      sent += await sendToSubs(supabase, subs, "🔴 Next Match Called", `${matchLabel}${lineup}`);
    } else if (body.action === "live") {
      const always = await alwaysNotifySubs(supabase);
      const liveSubs = mergeSubs(await subscriptionsForNames(supabase, body.liveNames), always);
      sent += await sendToSubs(supabase, liveSubs, "🟢 You're Up", "Your match is live now.");
      const nextSubs = mergeSubs(await subscriptionsForNames(supabase, body.nextNames), always);
      sent += await sendToSubs(
        supabase,
        nextSubs,
        "⏭️ You're Up Next",
        "You're up next — please be ready.",
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
