# EN Helper: the voice engineering notebook

EN Helper is a second home-screen app on the same site, at
`https://everythingthatsscrum.meckman.org/helper/`. It is for students who
won't type a notebook entry on their phone, forget to, or don't want to open a
laptop. They talk for a minute, and it becomes a real notebook entry.

Students end up with two icons: **Scrum** (the whole app) and **EN Helper**
(only the notebook, one tap to start talking).

## What a student does

1. Tap the **EN Helper** icon, or the reminder that arrives after a meeting.
2. Tap the big mic, talk about the meeting, tap again to stop. The card on
   screen says what to cover (what you worked on, what went wrong or what you
   tested, what's next). **Hear it** reads that out loud.
3. Tap a face for how engaged they felt, then **Done**. A photo is optional
   and uses the same upload as the typed form.

That's it. The entry is saved, and the meeting's attendance is won back,
the moment they tap Done. No review step, nothing to type.

The same recorder is in the Scrum app too: **Open EN Helper** on the Notebook
tab opens it as a full-screen panel over the notebook, and **Back to Notebook**
closes it with no reload. It runs inside the app rather than in a frame,
because a framed second copy of the app fights the first over the sign-in.

## What happens after Done

```
Phone                                   Supabase                        Cloudflare Workers AI
─────                                   ────────                        ─────────────────────
record clip, convert to 16 kHz WAV
keep a copy on the phone (IndexedDB)
upload clip ─────────────────────────▶  notebook-audio bucket (private)
save entry row (ai_status 'pending') ─▶ notebook_entries
claim attendance ────────────────────▶  attendance_records
ask notebook-voice to process ───────▶  notebook-voice function
delete phone copy                         download clip
                                          ──────────────────────────────▶ Whisper: clip -> transcript
                                          save transcript, delete clip
                                          ──────────────────────────────▶ Llama 3.3 70B: transcript ->
                                                                          category, why, signals and
                                                                          answers, next step, polished
                                          check every answer against the
                                          app's own lists, save, 'done'
```

- **The save never waits on the AI.** If Cloudflare is down or the free
  allowance is used up, the entry still exists and still counts. It shows
  "being written up…" until a retry finishes it.
- **Bad wifi can't lose a recording.** The clip stays on the phone until the
  server confirms the save, and it is sent automatically the next time EN
  Helper opens (or with the **Send** button on the yellow banner).
- **The clip is deleted** as soon as its transcript is saved. Only the text is
  kept.

## How it reads in the notebook

A voice entry is an ordinary `notebook_entries` row with `source = 'voice'`, so
the list, the book, Team Growth, the mentor log and the notebook attendance rule
all count it with no special handling.

In the book view it shows **What I said** (the transcript, word for word) and
**AI-polished** side by side, tagged *Voice · AI-assisted*. That is on purpose:
students and judges can see the AI wrote up the student's work, and didn't do
the work for them.

- The **transcript is never editable.** It is the record of what was said.
- The **polished version is editable** by its author: the pencil on a voice
  entry opens a small editor instead of the typed form.
- Fields the typed form requires (a photo or link, an engagement note) are not
  required for voice entries. The AI fills `what_did`, `why_option`,
  `category`, `signals`, `signal_data`, `next_step`, `mentor_help` and
  `mentor_name` from what was said, and leaves anything that wasn't said empty.
- A voice entry only says "Mentor helped" when the student said so.

## End-of-meeting reminders

Every 15 minutes a scheduled job looks for today's meetings on each team's
calendar. From 15 minutes after a meeting's end time until 4 hours after, it
sends one push to each student who:

- was checked in (marked present, **or** marked absent by the notebook rule,
  since that rule flips people who haven't written yet), and
- has no entry for that date yet, and
- hasn't been reminded for that meeting already (`notebook_reminders`).

The push goes to the student's EN Helper subscription if they turned reminders
on in EN Helper (the **Remind me after meetings** button after their first
save), otherwise to the main app's. Tapping it opens EN Helper; opened through
the main app, the Helper shows a **← Scrum** button that goes back to the
Notebook tab.

EN Helper's own subscription only ever gets notebook reminders. `send-push` and
`process-scheduled` skip it, so chat, tasks and calendar notifications keep
coming from the Scrum icon only.

Meetings with no end time on the calendar, or days with no attendance taken,
get no reminder.

## Setup (one time)

The app code is safe to ship before any of this: until step 1 runs, EN Helper
says "not switched on yet" and the Notebook tab hides its "Try EN Helper"
card.

You need a Supabase personal access token
(https://supabase.com/dashboard/account/tokens, starts with `sbp_`; a project
`sb_secret_` key can't do this). Commands below use
`SUPABASE_ACCESS_TOKEN=sbp_...` in front of each; put yours there. Use the
current CLI through `npx -y supabase@latest`: older installed versions lack
`--use-api`, which deploys without Docker.

Setting secrets restarts every function in the project, so their version
numbers in the dashboard all go up by one. That is expected.

### 1. Database

Supabase dashboard → SQL Editor → paste `supabase/en_helper.sql` (repo root)
→ Run. Leave the commented STEP 4 block at the bottom for later.

### 2. A Cloudflare API token for Workers AI

1. Cloudflare dashboard → My Profile → API Tokens → **Create Token**.
2. Use the **Workers AI** template (Workers AI: Read and Edit) → Create.
3. Copy the token. Your account ID is on the Workers AI page, or run
   `npx wrangler whoami`.

### 3. Secrets

Make a cron secret first and keep it for step 5:

```bash
openssl rand -hex 24
```

Then:

```bash
SUPABASE_ACCESS_TOKEN=sbp_... npx -y supabase@latest secrets set \
  CLOUDFLARE_ACCOUNT_ID=your_account_id \
  CLOUDFLARE_API_TOKEN=your_workers_ai_token \
  CRON_SECRET=the_value_from_openssl \
  --project-ref wqxjmykphkacbjfxmvzd
```

Optional:

| Secret | Default | What it changes |
|--------|---------|-----------------|
| `TEAM_TIMEZONE` | `America/Chicago` | The time zone meeting end times are read in |
| `CF_TEXT_MODEL` | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | The write-up model. Must be one Workers AI lists under JSON Mode |

The VAPID secrets the push functions already use are reused as they are.

### 4. Deploy the functions

From `project-tracker/`:

```bash
SUPABASE_ACCESS_TOKEN=sbp_... npx -y supabase@latest functions deploy notebook-voice \
  --no-verify-jwt --use-api --project-ref wqxjmykphkacbjfxmvzd
```

`--no-verify-jwt` is required: the 15 minute job sends a shared secret, not a
user token, and the function checks every caller itself.

Then redeploy the two push functions so EN Helper's icon only gets notebook
reminders. Both run with "Verify JWT" on (checked 2026-10-10), so deploy them
without `--no-verify-jwt`:

```bash
SUPABASE_ACCESS_TOKEN=sbp_... npx -y supabase@latest functions deploy send-push --use-api --project-ref wqxjmykphkacbjfxmvzd
SUPABASE_ACCESS_TOKEN=sbp_... npx -y supabase@latest functions deploy process-scheduled --use-api --project-ref wqxjmykphkacbjfxmvzd
```

### 5. The 15 minute schedule

SQL Editor → paste the commented STEP 4 block from the bottom of
`supabase/en_helper.sql`, remove the leading `-- ` from each line, put your
cron secret where it says `PASTE_CRON_SECRET_HERE` → Run. (Don't commit the
file with the secret in it.)

Check it is running after 15 minutes:

```sql
select status, return_message, start_time
from cron.job_run_details
where jobid = (select jobid from cron.job where jobname = 'en-helper-tick')
order by start_time desc limit 5;
```

### 6. Try it

1. On your phone, open `everythingthatsscrum.meckman.org/helper/` in Safari →
   Share → **Add to Home Screen**. Open it from the icon and sign in once
   (a home-screen app keeps its own sign-in on iPhone).
2. Record ten seconds, pick a face, Done.
3. In the Scrum app, Notebook → Read as a notebook: the entry shows "being
   written up…", then both versions within a minute.

## Costs and limits

Workers AI's free plan gives 10,000 "neurons" a day, shared by every team,
resetting at 00:00 UTC. Estimated from Cloudflare's published rates for a
one-minute recording:

| Step | Neurons |
|------|---------|
| Whisper, per audio minute | about 47 |
| Llama 3.3 70B write-up (about 3,300 tokens in, 500 out) | about 190 |
| **One entry** | **about 240** |

That is roughly **40 voice entries a day** for free. Check real usage in the
Cloudflare dashboard → Workers AI after the first week. Past that, the
entries still save and count; their write-up waits for the retry after the
allowance resets. If teams outgrow it, the Workers Paid plan ($5 a month) lifts
the cap, or set `CF_TEXT_MODEL` to a cheaper model.

Recordings stop at 3 minutes. A 16 kHz WAV is about 2 MB a minute, held in
storage only until it is transcribed.

## Things to know

- **Microphone prompt.** An iPhone may ask "Allow microphone?" each time EN
  Helper opens. That is Apple's behavior for home-screen web apps; it can't be
  switched off from the app.
- **"Hear it" needs a tap.** iPhones won't speak until the person taps
  something, so the prompt is read on request, not on open.
- **Separate sign-in.** On iPhone, EN Helper and Scrum keep separate storage,
  so each is signed into once. Temporary passwords work the same in both.
- **Silence.** A recording with no speech saves as an entry marked "no speech
  was heard". It still exists, so a lead can see it in the notebook.
- **Retries.** A failed write-up is retried every 15 minutes, up to 5 tries,
  and also whenever the student opens EN Helper. The last error is in
  `notebook_entries.ai_error`.
- **No Cloudflare secrets yet.** Voice entries still save, count and claim
  attendance; their write-up waits without using up retries, and runs once
  the secrets are set.

## Changing things

**The notebook's questions or choices.** Signals live in
`src/data/notebookSignals.js` and the category and "why" lists in
`src/data/notebookOptions.js`. The function can't read those, so it has a copy:

```bash
npm run sync:notebook-schema
```

then redeploy `notebook-voice`. `npm run build` warns if the copy is out of
date.

**Words that get misheard.** Add them to `GLOSSARY` in
`supabase/functions/notebook-voice/ai.ts` (this season's game pieces, your part
names) and redeploy.

**The write-up's tone.** `systemPrompt()` in the same file.

### Trying the AI step on its own

`ai.ts` runs outside Supabase, so a prompt change can be tried on a real
recording before it ships:

```ts
// try_ai.ts
import { transcribe, polish, cleanAiFields } from "./supabase/functions/notebook-voice/ai.ts";
const transcript = await transcribe(await Deno.readFile("sample.wav"));
console.log(transcript, cleanAiFields(await polish(transcript)));
```

```bash
# A test clip from the Mac's own voice:
say -o sample.aiff "Today we tested the intake ten times..." && \
  afconvert -f WAVE -d LEI16@16000 -c 1 sample.aiff sample.wav
CLOUDFLARE_ACCOUNT_ID=... CLOUDFLARE_API_TOKEN=... \
  npx deno run --allow-read --allow-net --allow-env try_ai.ts
```

## Troubleshooting

| What you see | Where to look |
|--------------|---------------|
| EN Helper says "not switched on yet" | Step 1 hasn't run: the voice columns are missing |
| Entries stay "being written up…" | `notebook_entries.ai_error` on that row; Supabase → Edge Functions → notebook-voice → Logs. Usually a missing Cloudflare secret, or the day's allowance |
| No reminders | `cron.job_run_details` (step 5); the meeting needs an end time on the calendar and attendance taken that day; the student needs notifications on |
| Reminder opens the main app, not EN Helper | They turned reminders on in Scrum but not in EN Helper. The Helper page still opens; turning reminders on in EN Helper moves them to its icon |
| Yellow "waiting on this phone" banner won't clear | The phone can't reach Supabase, or the session expired: sign out and in again in EN Helper. The recording stays on the phone until it goes |

## Files

| File | Role |
|------|------|
| `helper/index.html` | EN Helper's page (second Vite entry, see `vite.config.js`) |
| `public/helper/manifest.json`, icons | Its home-screen name and icon |
| `public/helper/sw.js` | Its own service worker (scope `/helper/`), for its own push subscription |
| `src/helper/main.jsx`, `HelperApp.jsx` | The app: sign-in, recorder, Done, saved screen. `Recorder` is also the Notebook tab's panel (`embedded`) |
| `src/helper/recorder.js` | Recording and conversion to 16 kHz WAV |
| `src/helper/voiceEntries.js` | Phone queue, upload, save, attendance claim, processing nudge |
| `src/helper/helperPush.js` | Reminder sign-up |
| `src/components/VoiceEntry.jsx` | Side-by-side view and the polished-text editor |
| `src/lib/notebookAttendance.js`, `notebookPhoto.js` | Shared with the typed form so both behave the same |
| `supabase/functions/notebook-voice/` | `index.ts` (process, reminders, retries), `ai.ts` (Whisper, Llama, checks), `notebookSchema.json` (generated) |
| `supabase/en_helper.sql` (repo root) | Columns, bucket, reminders table, schedule |
