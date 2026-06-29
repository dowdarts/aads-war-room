// Fans out a real Web Push notification to one recipient's devices whenever
// a chat message is sent. Called directly from staff-chat.html and
// StaffChatWidget.jsx right after a message insert succeeds — not
// triggered by a DB hook, same pattern as send-cue-light-push/
// send-players-portal-push. Recipient is identified by staff_accounts.id,
// the universal person-ID every claimed account already has.
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

const PREVIEW_MAX_LEN = 120;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const body = await req.json();
    const recipientId: string | undefined = body.recipientId;
    const senderName: string = body.senderName ?? "AADS Event Chat";
    const rawPreview: string = body.preview ?? "";
    const preview = rawPreview.length > PREVIEW_MAX_LEN
      ? rawPreview.slice(0, PREVIEW_MAX_LEN) + "…"
      : rawPreview;

    if (!recipientId) {
      return new Response(JSON.stringify({ error: "recipientId is required" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: subs, error: subsError } = await supabase
      .from("staff_chat_push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("account_id", recipientId);
    if (subsError) throw subsError;

    const payload = JSON.stringify({ title: senderName, body: preview || "Sent a photo" });
    const results = await Promise.allSettled(
      (subs ?? []).map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
          );
        } catch (err) {
          const statusCode = (err as { statusCode?: number })?.statusCode;
          if (statusCode === 404 || statusCode === 410) {
            await supabase.from("staff_chat_push_subscriptions").delete().eq("id", sub.id);
          }
          throw err;
        }
      }),
    );
    const sent = results.filter((r) => r.status === "fulfilled").length;

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
