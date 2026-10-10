// The AI half of notebook-voice: clip -> transcript -> filled-in entry.
// Kept apart from index.ts so it can be tried on its own against Workers AI
// (see EN_HELPER.md, "Trying the AI step").

import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";
import schema from "./notebookSchema.json" with { type: "json" };

// The speech model is fixed. The text model can be swapped with the\n// CF_TEXT_MODEL secret (it must be one Workers AI lists as supporting JSON mode).
const WHISPER_MODEL = "@cf/openai/whisper-large-v3-turbo";
const DEFAULT_TEXT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

// Words a shop full of FTC students says that speech-to-text gets wrong.
// Whisper gets this as a hint before it listens, and the polish step gets it
// to repair whatever still came out misheard ("odd geometry" -> odometry).
// Add this season's game pieces and your own part names freely.
const GLOSSARY = [
  "FTC", "FIRST Tech Challenge", "engineering notebook", "Inspire Award", "Think Award",
  "Control Award", "Design Award", "Innovate Award", "Motivate Award", "Connect Award",
  "odometry", "dead wheels", "encoder", "IMU", "gyro", "PID", "feedforward", "kP", "kD",
  "servo", "motor", "gear ratio", "torque", "RPM", "drivetrain", "mecanum", "tank drive",
  "intake", "outtake", "linear slides", "viper slides", "lift", "claw", "wrist", "arm", "pivot",
  "Control Hub", "Expansion Hub", "Driver Hub", "REV", "goBILDA", "Tetrix", "Android Studio",
  "OnBot Java", "Blocks", "FTC SDK", "Road Runner", "Pedro Pathing", "AprilTag", "Limelight",
  "autonomous", "auto", "TeleOp", "driver practice", "scrimmage", "qualifier", "league meet",
  "alliance", "match", "CAD", "Onshape", "Fusion 360", "3D print", "PLA", "PETG", "TPU",
  "polycarbonate", "aluminum extrusion", "standoff", "bearing", "shaft", "hex shaft", "zip tie",
];

// ─── Cloudflare Workers AI ──────────────────────────────────────────────────

async function runModel(model: string, input: unknown) {
  const account = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
  const token = Deno.env.get("CLOUDFLARE_API_TOKEN");
  if (!account || !token) throw new Error("CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN not set");
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${model}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const text = await res.text();
  // A spent daily allowance comes back here too. The entry is marked failed
  // and the tick tries again; the allowance resets at 00:00 UTC.
  if (!res.ok) throw new Error(`Workers AI ${model} ${res.status}: ${text.slice(0, 300)}`);
  const data = JSON.parse(text);
  if (data?.success === false) throw new Error(`Workers AI ${model}: ${JSON.stringify(data.errors).slice(0, 300)}`);
  return data.result;
}

export async function transcribe(audio: Uint8Array): Promise<string> {
  const result = await runModel(WHISPER_MODEL, {
    audio: encodeBase64(audio),
    language: "en",
    vad_filter: true,
    initial_prompt: `A student on an FTC robotics team describing today's meeting. ${GLOSSARY.join(", ")}.`,
  });
  return String(result?.text || "").trim();
}

type SignalSchema = (typeof schema.signals)[number];

// The answer the model must give, with every fixed choice as an enum, so JSON
// mode can't hand back an option the app doesn't have.
function answerSchema() {
  const signalData: Record<string, unknown> = {};
  for (const sig of schema.signals as SignalSchema[]) {
    const props: Record<string, unknown> = {};
    for (const q of sig.questions) {
      props[q.id] = "options" in q && q.options ? { type: "string", enum: q.options } : { type: "string" };
    }
    signalData[sig.key] = { type: "object", properties: props };
  }
  return {
    type: "object",
    properties: {
      category: { type: "string", enum: schema.categories },
      what_did: { type: "string" },
      why_option: { type: "string", enum: schema.whyOptions },
      why_note: { type: "string" },
      mentor_help: { type: "boolean" },
      mentor_name: { type: "string" },
      next_step: { type: "string" },
      signals: { type: "array", items: { type: "string", enum: schema.signals.map((s) => s.key) } },
      signal_data: { type: "object", properties: signalData },
      polished: { type: "string" },
    },
    required: ["category", "what_did", "why_option", "signals", "signal_data", "polished"],
  };
}

function systemPrompt() {
  const signals = (schema.signals as SignalSchema[]).map((s) => {
    const qs = s.questions.map((q) => {
      const when = "onlyWhen" in q && q.onlyWhen ? ` (only when ${q.onlyWhen})` : "";
      const opts = "options" in q && q.options ? ` One of: ${q.options.map((o) => `"${o}"`).join(", ")}` : " Free text.";
      return `    - ${q.id}: ${q.label}${when}${opts}`;
    }).join("\n");
    return `- ${s.key}: "${s.label}" (${s.helper})\n${qs}`;
  }).join("\n");

  return `You turn a high school FTC robotics student's spoken recap of a team meeting into their engineering notebook entry.

The transcript is the student's own words and is the only source of facts. Never add a fact, number, part, person, result or plan that the student did not say. If something wasn't said, leave that answer out rather than guessing.

Fields:
- category: Technical (building, hardware, mechanical design, CAD), Programming (code, software, autonomous, sensors), or Business (outreach, fundraising, sponsors, marketing, the notebook itself).
- what_did: one plain sentence saying what they worked on.
- why_option: the closest reason this work mattered, from the allowed list. Robot building, fixing or testing work almost always "Directly advances the robot design" or "Fixes a critical bug or issue". Use "Other" (and say why in why_note) only when nothing on the list is close.
- mentor_help: true only if they said a mentor or coach helped. mentor_name only if they named one.
- next_step: what they said happens next, or empty.
- signals: every one of these the student clearly described, usually one to four. If an adult or teammate helped them, that is "help". If they worked with a named teammate, that is "collaborated". Testing something is "tested"; changing something because of a result is "improved". Never include one that wasn't described.
${signals}
- signal_data: an object with one key per signal you chose. Under each, answer that signal's questions that the transcript answers. Choice answers must be one of that question's options exactly. Leave out questions the transcript doesn't answer.
- polished: the notebook entry itself. First person, past tense, written the way a thoughtful student would write it: clear, specific, and in their voice. Keep every concrete detail they gave (measurements, counts, part names, what failed, what they changed and why). Fix speech-to-text mistakes using this glossary: ${GLOSSARY.join(", ")}. Remove filler ("um", "like", "so yeah"). Two short paragraphs at most. Do not use em dashes. Do not use headings or bullet points.

Example. Transcript: "So I was coding the arm, um, the PID was overshooting like crazy so Sam and I lowered kP and tried it a bunch, it's way better now, still a little wobble. Tomorrow add feedforward."
Answer:
{"category":"Programming","what_did":"I tuned the PID controller on the arm.","why_option":"Fixes a critical bug or issue","why_note":"","mentor_help":false,"mentor_name":"","next_step":"Add feedforward to the arm controller.","signals":["tested","improved","collaborated"],"signal_data":{"tested":{"what":"The arm's PID tuning after lowering kP","how":"Repeated trials","outcome":"It partly worked"},"improved":{"what":"Lowered kP on the arm's PID controller","why":"Test results","better":"Somewhat","next":"Add feedforward"},"collaborated":{"who":"Someone in my group","what":"Tuning the arm's PID controller"}},"polished":"I worked on the arm code with Sam. The PID controller was overshooting a lot, so we lowered kP and tested it several times. It is much better now, but there is still a little wobble. Next time I plan to add feedforward."}`;
}

export async function polish(transcript: string) {
  const model = Deno.env.get("CF_TEXT_MODEL") || DEFAULT_TEXT_MODEL;
  const result = await runModel(model, {
    messages: [
      { role: "system", content: systemPrompt() },
      { role: "user", content: `Transcript:\n"""${transcript}"""` },
    ],
    response_format: { type: "json_schema", json_schema: answerSchema() },
    max_tokens: 1500,
    temperature: 0.2,
  });
  const out = result?.response;
  if (out && typeof out === "object") return out;
  try { return JSON.parse(String(out)); } catch { throw new Error("The AI's answer wasn't valid JSON"); }
}

// The model is asked for valid choices, but this is the check that counts:
// anything outside the app's own lists is dropped, never stored.
// deno-lint-ignore no-explicit-any
export function cleanAiFields(ai: any) {
  const text = (v: unknown, max: number) =>
    typeof v === "string" ? v.replace(/\s*\u2014\s*/g, ", ").trim().slice(0, max) : "";

  const signalKeys = new Set(schema.signals.map((s) => s.key));
  const signals = [...new Set<string>(Array.isArray(ai?.signals) ? ai.signals : [])].filter((k) => signalKeys.has(k));

  const signal_data: Record<string, Record<string, string>> = {};
  for (const key of signals) {
    const sig = (schema.signals as SignalSchema[]).find((s) => s.key === key)!;
    const given = ai?.signal_data?.[key] || {};
    const answers: Record<string, string> = {};
    for (const q of sig.questions) {
      const v = text(given[q.id], 500);
      if (!v) continue;
      if ("options" in q && q.options && !q.options.includes(v)) continue;
      answers[q.id] = v;
    }
    signal_data[key] = answers;
  }

  const why_option = schema.whyOptions.includes(ai?.why_option) ? ai.why_option : "Other";
  const mentor_help = ai?.mentor_help === true;
  return {
    category: schema.categories.includes(ai?.category) ? ai.category : "Technical",
    what_did: text(ai?.what_did, 300),
    why_option,
    why_note: why_option === "Other" ? text(ai?.why_note, 300) : "",
    mentor_help,
    mentor_name: mentor_help ? text(ai?.mentor_name, 80) : "",
    next_step: text(ai?.next_step, 300),
    signals,
    signal_data,
    polished: text(ai?.polished, 4000),
  };
}
