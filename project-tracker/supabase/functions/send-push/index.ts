import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:team@example.com";

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { record } = await req.json();
    if (!record || !record.user_id) {
      return new Response(
        JSON.stringify({ error: "Missing record or user_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { user_id, type, title, body, force } = record;

    // Look up user's notification preferences
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("notification_prefs")
      .eq("id", user_id)
      .single();

    const prefs = profile?.notification_prefs || { enabled: true, calendar: true, chat: true };

    // Check if notifications are enabled (unless forced)
    if (!force) {
      if (!prefs.enabled) {
        return new Response(
          JSON.stringify({ skipped: true, reason: "notifications disabled" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check category-specific preferences
      if (type === "calendar_event" && !prefs.calendar) {
        return new Response(
          JSON.stringify({ skipped: true, reason: "calendar notifications disabled" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (type === "chat_message" && !prefs.chat) {
        return new Response(
          JSON.stringify({ skipped: true, reason: "chat notifications disabled" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Fetch user's push subscriptions
    const { data: subscriptions } = await supabaseAdmin
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", user_id);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "no subscriptions" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload = JSON.stringify({ title: title || "Notification", body: body || "" });
    const expiredIds: string[] = [];
    let sent = 0;

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload
        );
        sent++;
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          // Subscription expired — mark for cleanup
          expiredIds.push(sub.id);
        } else {
          console.error("Push send error:", err.statusCode, err.message);
        }
      }
    }

    // Clean up expired subscriptions
    if (expiredIds.length > 0) {
      await supabaseAdmin
        .from("push_subscriptions")
        .delete()
        .in("id", expiredIds);
    }

    return new Response(
      JSON.stringify({ sent, expired: expiredIds.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("send-push error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
