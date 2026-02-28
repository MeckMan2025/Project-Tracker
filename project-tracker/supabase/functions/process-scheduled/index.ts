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

    // Fetch all pending scheduled notifications that are due
    const { data: due, error: fetchErr } = await supabaseAdmin
      .from("scheduled_notifications")
      .select("*")
      .eq("status", "pending")
      .lte("send_at", new Date().toISOString());

    if (fetchErr) {
      console.error("Failed to fetch scheduled notifications:", fetchErr);
      return new Response(
        JSON.stringify({ error: fetchErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!due || due.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch all user profiles once
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, notification_prefs");

    let totalProcessed = 0;

    for (const sn of due) {
      // Mark as sent first to prevent duplicate processing by concurrent callers
      const { error: updateErr } = await supabaseAdmin
        .from("scheduled_notifications")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", sn.id)
        .eq("status", "pending"); // Only update if still pending (idempotent)

      if (updateErr) {
        console.error(`Failed to mark ${sn.id} as sent:`, updateErr);
        continue;
      }

      // Send in-app + push notifications to all users except creator
      if (profiles) {
        for (const p of profiles) {
          if (p.id === sn.created_by_user_id) continue;

          const notifId =
            String(Date.now()) +
            Math.random().toString(36).slice(2) +
            p.id.slice(0, 4);

          const notifRecord = {
            id: notifId,
            user_id: p.id,
            type: sn.type || "calendar_event",
            title: sn.title,
            body: sn.body || "",
            force: sn.force || false,
          };

          // Insert in-app notification
          await supabaseAdmin.from("notifications").insert(notifRecord);

          // Send web push (same pattern as send-push)
          const prefs = p.notification_prefs || {
            enabled: true,
            calendar: true,
            chat: true,
          };

          let shouldPush = true;
          if (!notifRecord.force) {
            if (!prefs.enabled) shouldPush = false;
            if (
              notifRecord.type === "calendar_event" &&
              !prefs.calendar
            )
              shouldPush = false;
          }

          if (shouldPush) {
            const { data: subscriptions } = await supabaseAdmin
              .from("push_subscriptions")
              .select("*")
              .eq("user_id", p.id);

            if (subscriptions && subscriptions.length > 0) {
              const payload = JSON.stringify({
                title: notifRecord.title || "Notification",
                body: notifRecord.body || "",
              });
              const expiredIds: string[] = [];

              for (const sub of subscriptions) {
                try {
                  await webpush.sendNotification(
                    {
                      endpoint: sub.endpoint,
                      keys: { p256dh: sub.p256dh, auth: sub.auth },
                    },
                    payload
                  );
                } catch (err: any) {
                  if (err.statusCode === 410 || err.statusCode === 404) {
                    expiredIds.push(sub.id);
                  } else {
                    console.error("Push send error:", err.statusCode, err.message);
                  }
                }
              }

              if (expiredIds.length > 0) {
                await supabaseAdmin
                  .from("push_subscriptions")
                  .delete()
                  .in("id", expiredIds);
              }
            }
          }
        }
      }

      totalProcessed++;
    }

    return new Response(
      JSON.stringify({ processed: totalProcessed }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("process-scheduled error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
