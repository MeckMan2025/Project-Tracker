// notebook-voice: everything the EN Helper needs on the server.
//
//   { action: "process", entry_id }   called by the Helper right after a voice
//                                     entry saves (student's own token)
//   { action: "tick" }                called every 15 minutes by pg_cron
//                                     (x-cron-secret header): sends
//                                     end-of-meeting reminders and retries any
//                                     voice entry the AI hasn't finished
//
// The entry is already saved, and its attendance already claimed, before any
// of this runs. Nothing here can lose an entry: the worst case is an entry
// that shows "Polishing..." until the next tick tries again.
//
// Deploy with --no-verify-jwt: the cron call carries a shared secret, not a
// user token, so this function checks callers itself (see EN_HELPER.md).

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
// @ts-ignore: esm.sh's types claim no default export; the module has one (send-push uses it the same way).
import webpush from "https://esm.sh/web-push@3.6.7";
import { transcribe, polish, cleanAiFields } from "./ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Max-Age": "86400",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const AUDIO_BUCKET = "notebook-audio";
const MAX_ATTEMPTS = 5;
const HOME_TEAM = "7196";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceRoleKey);

  let body: { action?: string; entry_id?: string } = {};
  try { body = await req.json(); } catch { /* empty body */ }

  const cronSecret = Deno.env.get("CRON_SECRET") || "";
  const isCron = !!cronSecret && req.headers.get("x-cron-secret") === cronSecret;

  try {
    if (body.action === "tick") {
      if (!isCron) return json({ error: "tick is for the scheduler" }, 401);
      return json(await tick(admin));
    }

    if (body.action === "process") {
      if (!body.entry_id) return json({ error: "entry_id required" }, 400);
      if (!isCron) {
        const caller = await callerProfile(admin, req);
        if (!caller) return json({ error: "sign in first" }, 401);
        const { data: entry } = await admin
          .from("notebook_entries").select("id, team_number").eq("id", body.entry_id).maybeSingle();
        if (!entry) return json({ error: "no such entry" }, 404);
        if (teamKey(entry.team_number) !== teamKey(caller.team_number)) return json({ error: "not your team" }, 403);
      }
      // Answer straight away and keep working. The student's phone may close
      // the Helper the moment it sees "Saved", and that must not cancel this.
      const work = processEntry(admin, body.entry_id);
      // deno-lint-ignore no-explicit-any
      const rt = (globalThis as any).EdgeRuntime;
      if (rt?.waitUntil) { rt.waitUntil(work); return json({ accepted: true }, 202); }
      return json(await work);
    }

    return json({ error: "unknown action" }, 400);
  } catch (err) {
    console.error("notebook-voice error:", err);
    return json({ error: String((err as Error)?.message || err) }, 500);
  }
});

// ─── Who is calling ──────────────────────────────────────────────────────────

async function callerProfile(admin: SupabaseClient, req: Request) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data } = await admin.auth.getUser(token);
  const user = data?.user;
  if (!user) return null;
  const { data: profile } = await admin
    .from("profiles").select("id, display_name, team_number").eq("id", user.id).maybeSingle();
  return profile;
}

// NULL and '7196' both mean Radical, the same rule as src/lib/teamScope.js.
function teamKey(n: unknown): string {
  const s = String(n ?? "").trim();
  return s && s !== HOME_TEAM ? s : "";
}

// ─── One voice entry: clip -> transcript -> filled-in entry ─────────────────

async function processEntry(admin: SupabaseClient, id: string) {
  // Claim it, so two callers (the Helper and the 15 minute tick) can't both
  // spend AI allowance on the same entry.
  const { data: claimed } = await admin
    .from("notebook_entries")
    .update({ ai_status: "working", ai_updated_at: new Date().toISOString() })
    .eq("id", id)
    .in("ai_status", ["pending", "failed"])
    .lt("ai_attempts", MAX_ATTEMPTS)
    .select("id, transcript, audio_path, ai_attempts");
  const entry = claimed?.[0];
  if (!entry) return { id, status: "skipped" };

  await admin.from("notebook_entries").update({ ai_attempts: (entry.ai_attempts || 0) + 1 }).eq("id", id);

  try {
    let transcript: string = entry.transcript || "";

    if (!transcript) {
      if (!entry.audio_path) throw new Error("No recording and no transcript");
      const { data: blob, error } = await admin.storage.from(AUDIO_BUCKET).download(entry.audio_path);
      if (error || !blob) throw new Error(`Could not download the clip: ${error?.message || "missing"}`);
      transcript = await transcribe(new Uint8Array(await blob.arrayBuffer()));

      // Saved the moment it exists, then the clip goes. If the AI step below
      // fails, the retry starts from this text and never needs the audio.
      await admin.from("notebook_entries")
        .update({ transcript, audio_path: null }).eq("id", id);
      await admin.storage.from(AUDIO_BUCKET).remove([entry.audio_path]).catch(() => {});
    }

    // Silence, or a pocket recording. The entry stays (it is still the
    // student's), but there is nothing to polish.
    if (transcript.split(/\s+/).filter(Boolean).length < 3) {
      await admin.from("notebook_entries").update({
        ai_status: "empty", ai_error: null, ai_updated_at: new Date().toISOString(),
      }).eq("id", id);
      return { id, status: "empty" };
    }

    const fields = cleanAiFields(await polish(transcript));
    await admin.from("notebook_entries").update({
      ...fields,
      ai_status: "done",
      ai_error: null,
      ai_updated_at: new Date().toISOString(),
    }).eq("id", id);
    return { id, status: "done" };
  } catch (err) {
    const message = String((err as Error)?.message || err).slice(0, 500);
    console.error(`notebook-voice: entry ${id} failed:`, message);
    await admin.from("notebook_entries").update({
      ai_status: "failed", ai_error: message, ai_updated_at: new Date().toISOString(),
    }).eq("id", id);
    return { id, status: "failed", error: message };
  }
}

// ─── Every 15 minutes ───────────────────────────────────────────────────────

async function tick(admin: SupabaseClient) {
  const reminders = await sendReminders(admin).catch((err) => {
    console.error("notebook-voice: reminders failed:", err);
    return { error: String(err?.message || err) };
  });
  const retries = await retryUnfinished(admin).catch((err) => {
    console.error("notebook-voice: retries failed:", err);
    return { error: String(err?.message || err) };
  });
  return { reminders, retries };
}

// A 'working' entry older than this was abandoned mid-way (the function was
// stopped), so it goes back in the queue.
const STUCK_MINUTES = 10;
// Leave brand new entries to the Helper's own call.
const RETRY_AFTER_MINUTES = 2;
// Stay well inside the function's time limit.
const RETRIES_PER_TICK = 4;

async function retryUnfinished(admin: SupabaseClient) {
  const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

  await admin.from("notebook_entries")
    .update({ ai_status: "failed", ai_error: "Stopped mid-way; retrying" })
    .eq("ai_status", "working")
    .lt("ai_updated_at", ago(STUCK_MINUTES));

  const { data: due } = await admin.from("notebook_entries")
    .select("id")
    .eq("source", "voice")
    .in("ai_status", ["pending", "failed"])
    .lt("ai_attempts", MAX_ATTEMPTS)
    .lt("created_at", ago(RETRY_AFTER_MINUTES))
    .order("created_at", { ascending: true })
    .limit(RETRIES_PER_TICK);

  const results = [];
  for (const row of due || []) results.push(await processEntry(admin, row.id));
  return results;
}

// Meeting times are stored as local wall-clock times ("14:00"), so "now" has
// to be read in the team's time zone, not the server's UTC.
function localNow(tz: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date()).map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

const toMinutes = (hhmm: string | null) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm || "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

// Reminders go out this long after a meeting's scheduled end, to cover a
// meeting that runs a little over, and stop being sent this long after it.
const REMIND_AFTER_MIN = 15;
const REMIND_UNTIL_MIN = 4 * 60;

async function sendReminders(admin: SupabaseClient) {
  const tz = Deno.env.get("TEAM_TIMEZONE") || "America/Chicago";
  const { date, minutes } = localNow(tz);

  const { data: meetings } = await admin.from("calendar_events")
    .select("id, end_time, team_number")
    .eq("date_key", date)
    .eq("category", "meeting");

  const due = (meetings || []).filter((m) => {
    const end = toMinutes(m.end_time);
    return end !== null && minutes >= end + REMIND_AFTER_MIN && minutes <= end + REMIND_UNTIL_MIN;
  });
  if (due.length === 0) return { date, sent: 0 };

  webpush.setVapidDetails(
    Deno.env.get("VAPID_SUBJECT") || "mailto:team@example.com",
    Deno.env.get("VAPID_PUBLIC_KEY")!,
    Deno.env.get("VAPID_PRIVATE_KEY")!,
  );

  let sent = 0;
  const doneTeams = new Set<string>();
  for (const meeting of due) {
    const team = teamKey(meeting.team_number);
    if (doneTeams.has(team)) continue; // two meetings on one day: one reminder
    doneTeams.add(team);

    // Rows for this team: Radical's are unstamped (NULL), like teamScope().
    // deno-lint-ignore no-explicit-any
    const scoped = (q: any) => (team ? q.eq("team_number", team) : q.is("team_number", null));

    const { data: sessions } = await scoped(
      admin.from("attendance_sessions").select("id").eq("session_date", date),
    );
    const session = sessions?.[0];
    if (!session) continue; // no attendance taken, so nobody to remind

    const [{ data: records }, { data: written }, { data: already }] = await Promise.all([
      admin.from("attendance_records").select("username, status, marked_by").eq("session_id", session.id),
      scoped(admin.from("notebook_entries").select("username").eq("meeting_date", date)),
      admin.from("notebook_reminders").select("username").eq("session_id", session.id),
    ]);

    // Everyone who was there. The notebook rule flips people who haven't
    // written yet to absent, so its absences count as "was there" too: they
    // are exactly the people this reminder is for.
    const attended = (records || [])
      .filter((r) => r.status === "present" || (r.status === "absent" && r.marked_by === "notebook-rule"))
      .map((r) => r.username);
    const skip = new Set([...(written || []), ...(already || [])].map((r) => r.username));
    const todo = [...new Set(attended)].filter((u) => !skip.has(u));
    if (todo.length === 0) continue;

    const { data: profiles } = await admin.from("profiles")
      .select("id, display_name, team_number, notification_prefs")
      .in("display_name", todo);

    for (const username of todo) {
      // Claim the reminder first; the unique key makes a second send for this
      // meeting impossible even if two ticks overlap.
      const { data: claimed } = await admin.from("notebook_reminders")
        .upsert({ session_id: session.id, username, meeting_date: date, team_number: team || null },
          { onConflict: "session_id,username", ignoreDuplicates: true })
        .select("id");
      if (!claimed?.length) continue;

      const profile = (profiles || []).find((p) => p.display_name === username && teamKey(p.team_number) === team);
      if (!profile || profile.notification_prefs?.enabled === false) continue;
      sent += await pushTo(admin, profile.id, date);
    }
  }
  return { date, sent };
}

async function pushTo(admin: SupabaseClient, userId: string, date: string) {
  const { data: subs } = await admin.from("push_subscriptions").select("*").eq("user_id", userId);
  if (!subs?.length) return 0;
  // EN Helper's own subscription if they installed it, so the tap opens the
  // Helper; otherwise the main app's, which opens the Helper page inside it.
  const helper = subs.filter((s) => s.app === "helper");
  const targets = helper.length ? helper : subs;

  const payload = JSON.stringify({
    title: "EN Helper",
    body: "How did today's meeting go? Tap and tell your notebook. It takes about a minute.",
    url: "/helper/",
    tag: `en-helper-${date}`,
  });

  let sent = 0;
  const expired: string[] = [];
  for (const sub of targets) {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
      sent++;
    } catch (err) {
      // deno-lint-ignore no-explicit-any
      const code = (err as any)?.statusCode;
      if (code === 404 || code === 410) expired.push(sub.id);
      else console.error("notebook-voice: push failed:", code, (err as Error)?.message);
    }
  }
  if (expired.length) await admin.from("push_subscriptions").delete().in("id", expired);
  return sent ? 1 : 0;
}
