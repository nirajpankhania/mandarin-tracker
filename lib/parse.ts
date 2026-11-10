import { GoogleGenAI } from "@google/genai";
import AnthropicFoundry from "@anthropic-ai/foundry-sdk";

export type ParsedItem = { hanzi: string; pinyin: string; meaning: string; kind: "word" | "phrase" | "sentence" };
export type ParseInput = { n: number; text: string; image?: string }[]; // image: base64 JPEG for pages with no text
export type ParseResult = { ok: true; title: string; summary: string; items: ParsedItem[]; via: string } | { ok: false; error: string };

const GEMINI_MODELS = Array.from(new Set([process.env.GEMINI_MODEL || "gemini-3.8-flash", "gemini-3.5-flash-lite", "gemini-3.6-flash"]));

const INSTRUCTIONS = `You are helping an English-speaking adult who is learning Mandarin with a private teacher.
Below is the content of the teacher's lesson slides. Build the study list for this lesson.

Return:
- "title": a short English title for the lesson (use the slide deck's own title if it has one).
- "summary": 2-4 plain sentences in English on what the lesson covers, including any sentence patterns it teaches (for example "最近 + adjective").
- "items": everything worth a flashcard, in the order it appears:
  1. Every Chinese phrase and sentence shown on the slides, exactly as written, keeping its punctuation. kind is "phrase" for short expressions and "sentence" for full sentences or questions.
  2. After those, the individual building-block words used in them that a beginner should learn on their own (for example 最近, 忙, 但是). kind is "word". Leave out words that are already listed as a phrase.

For every item:
- "hanzi": simplified Chinese, as on the slide.
- "pinyin": with tone marks, a space between every syllable, all lower case, no punctuation (for example "zuì jìn zěn me yàng").
- "meaning": natural English. Use the slide's own translation when it gives one; otherwise translate it yourself. Keep it short.

Do not include slide headings, the teacher's name, English-only lines, or pattern formulas such as "最近 + 忙". Do not list the same hanzi twice.`;

const SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          hanzi: { type: "string" },
          pinyin: { type: "string" },
          meaning: { type: "string" },
          kind: { type: "string", enum: ["word", "phrase", "sentence"] },
        },
        required: ["hanzi", "pinyin", "meaning", "kind"],
      },
    },
  },
  required: ["title", "summary", "items"],
};

const HAN = /[㐀-鿿]/;

const JSON_SHAPE =
  '\n\nReply with one JSON object only, no other text, in this shape:\n{"title": string, "summary": string, "items": [{"hanzi": string, "pinyin": string, "meaning": string, "kind": "word" | "phrase" | "sentence"}]}';

type Parsed = { title: string; summary: string; items: ParsedItem[] };
type Attempt = { ok: true; data: Parsed } | { ok: false; failures: string[]; quota?: boolean };

/** Turn the model's JSON into clean items: Chinese only, no duplicates. */
function tidy(raw: string): Parsed {
  // tolerate a ```json fence or stray words around the object
  const out = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
  const seen = new Set<string>();
  const items: ParsedItem[] = [];
  for (const it of Array.isArray(out.items) ? out.items : []) {
    const hanzi = String(it.hanzi ?? "").trim();
    if (!hanzi || !HAN.test(hanzi) || seen.has(hanzi)) continue;
    seen.add(hanzi);
    const kind = it.kind === "word" || it.kind === "sentence" ? it.kind : "phrase";
    items.push({ hanzi, pinyin: String(it.pinyin ?? "").trim(), meaning: String(it.meaning ?? "").trim(), kind });
  }
  return { title: String(out.title ?? "").trim(), summary: String(out.summary ?? "").trim(), items };
}

function slideText(slides: ParseInput): string {
  let text = INSTRUCTIONS + "\n\n--- SLIDES ---\n";
  for (const s of slides) {
    text += `\n[Slide ${s.n}]\n${s.image ? "(this slide is a picture; it follows as an image)" : s.text}\n`;
  }
  return text;
}

function describe(e: unknown): { status: number; msg: string } {
  const err = e as { status?: number; statusCode?: number; message?: string };
  return { status: err.status ?? err.statusCode ?? 0, msg: String(err.message ?? e).replace(/\s+/g, " ").slice(0, 300) };
}

// ---------- Claude on Microsoft Foundry (first choice when configured) ----------

const FOUNDRY_MODEL = process.env.FOUNDRY_MODEL || "claude-fable-5-2"; // the deployment name in Foundry

function foundryConfigured() {
  return !!process.env.ANTHROPIC_FOUNDRY_API_KEY && !!(process.env.ANTHROPIC_FOUNDRY_RESOURCE || process.env.ANTHROPIC_FOUNDRY_BASE_URL);
}

/**
 * Where the Foundry resource lives. Accepts what people tend to paste: a bare resource name,
 * the resource's URL, or the full "Target URI" from the Foundry portal.
 */
function foundryEndpoint(): { baseURL: string; resource: null } | { resource: string; baseURL: null } {
  const raw = (process.env.ANTHROPIC_FOUNDRY_BASE_URL || process.env.ANTHROPIC_FOUNDRY_RESOURCE || "").trim();
  if (/^https?:\/\//i.test(raw)) {
    const u = new URL(raw);
    const path = u.pathname.replace(/\/v1\/messages\/?$/, "").replace(/\/+$/, "");
    return { baseURL: `${u.origin}${path.includes("/anthropic") ? path : "/anthropic"}/`, resource: null };
  }
  return { resource: raw.replace(/\.services\.ai\.azure\.com.*$/i, ""), baseURL: null };
}

async function viaFoundry(slides: ParseInput): Promise<Attempt> {
  const content: (
    | { type: "text"; text: string }
    | { type: "image"; source: { type: "base64"; media_type: "image/jpeg"; data: string } }
  )[] = [
    {
      type: "text",
      text:
        slideText(slides) + JSON_SHAPE,
    },
  ];
  for (const s of slides) {
    if (!s.image) continue;
    content.push({ type: "text", text: `Image of slide ${s.n}:` });
    content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: s.image } });
  }
  try {
    const client = new AnthropicFoundry({ apiKey: process.env.ANTHROPIC_FOUNDRY_API_KEY, ...foundryEndpoint(), timeout: 50_000, maxRetries: 0 });
    const message = await client.messages.create({ model: FOUNDRY_MODEL, max_tokens: 8000, messages: [{ role: "user", content }] });
    const text = message.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    return { ok: true, data: tidy(text) };
  } catch (e) {
    const { status, msg } = describe(e);
    console.error(`Foundry parse failed (${FOUNDRY_MODEL}):`, status, msg);
    return { ok: false, failures: [`Foundry ${FOUNDRY_MODEL}: ${e instanceof SyntaxError ? "reply was not valid JSON" : msg}`] };
  }
}

// ---------- Gemini (fallback, or the only parser when Foundry isn't configured) ----------

async function viaGemini(slides: ParseInput, deadline: number): Promise<Attempt & { model?: string }> {
  const baseUrl = process.env.GEMINI_BASE_URL; // only used for local testing
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { timeout: 40_000, ...(baseUrl ? { baseUrl } : {}) } });
  const input: ({ type: "text"; text: string } | { type: "image"; data: string; mime_type: "image/jpeg" })[] = [
    { type: "text", text: slideText(slides) + JSON_SHAPE },
  ];
  for (const s of slides) {
    if (!s.image) continue;
    input.push({ type: "text", text: `Image of slide ${s.n}:` });
    input.push({ type: "image", data: s.image, mime_type: "image/jpeg" });
  }

  // Each model is tried in turn. If Gemini rejects a request as invalid (400), the same model
  // is tried again with fewer optional settings, ending with the barest request possible.
  const format = { response_format: { type: "text" as const, mime_type: "application/json" as const, schema: SCHEMA } };
  const variants = [
    { label: "full", extra: { store: false, generation_config: { thinking_level: "low" as const }, ...format } },
    { label: "no thinking setting", extra: { store: false, ...format } },
    { label: "bare", extra: {} },
  ];
  const failures: string[] = [];
  let quota = false;
  for (const model of GEMINI_MODELS) {
    if (Date.now() > deadline) break;
    for (const v of variants) {
      const withThinking = v !== variants[variants.length - 1];
      try {
        const interaction = await client.interactions.create({ model, input, ...v.extra });
        return { ok: true, data: tidy(interaction.output_text ?? ""), model };
      } catch (e) {
        const { status, msg } = describe(e);
        console.error(`Gemini parse failed (${model}, ${v.label} request):`, status, msg);
        failures.push(`Gemini ${model} (${v.label}): ${e instanceof SyntaxError ? "reply was not valid JSON" : msg}`);
        if (status === 429 || /RESOURCE_EXHAUSTED/i.test(msg)) quota = true;
        if (status === 401 || status === 403 || /API key not valid|API_KEY_INVALID/i.test(msg)) return { ok: false, failures, quota };
        if (status === 400 && withThinking) continue; // same model again, plainer request (withThinking = not yet the bare one)
        break; // next model
      }
    }
  }
  return { ok: false, failures, quota };
}

/** Foundry first if it is set up, then Gemini. The first one that answers wins. */
export async function parseLesson(slides: ParseInput): Promise<ParseResult> {
  const useFoundry = foundryConfigured();
  const useGemini = !!process.env.GEMINI_API_KEY;
  if (!useFoundry && !useGemini) {
    return {
      ok: false,
      error:
        "The AI parser isn't set up yet. In Vercel's environment variables add ANTHROPIC_FOUNDRY_API_KEY and ANTHROPIC_FOUNDRY_RESOURCE, or GEMINI_API_KEY, then redeploy.",
    };
  }
  const started = Date.now();
  const failures: string[] = [];
  let quota = false;
  if (useFoundry) {
    const r = await viaFoundry(slides);
    if (r.ok) return { ok: true, ...r.data, via: `Claude on Foundry (${FOUNDRY_MODEL})` };
    failures.push(...r.failures);
  }
  if (useGemini) {
    const r = await viaGemini(slides, started + 100_000);
    if (r.ok) return { ok: true, ...r.data, via: useFoundry ? `Gemini (${r.model}), because Foundry failed` : `Gemini (${r.model})` };
    failures.push(...r.failures);
    quota = !!r.quota;
  }
  const lead = quota
    ? "Gemini's free quota is used up for the moment. Wait a little and choose the file again, or save the lesson now and add words by hand."
    : "The AI parser couldn't read these slides. You can save the lesson and add words by hand, or choose the file again to retry.";
  return { ok: false, error: `${lead} What went wrong: ${failures.join(" / ")}` };
}
