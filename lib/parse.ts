import { GoogleGenAI } from "@google/genai";

export type ParsedItem = { hanzi: string; pinyin: string; meaning: string; kind: "word" | "phrase" | "sentence" };
export type ParseInput = { n: number; text: string; image?: string }[]; // image: base64 JPEG for pages with no text
export type ParseResult = { ok: true; title: string; summary: string; items: ParsedItem[] } | { ok: false; error: string };

const MODELS = [process.env.GEMINI_MODEL || "gemini-3.8-flash", "gemini-3.5-flash-lite"];

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

export async function parseLesson(slides: ParseInput): Promise<ParseResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "The AI parser isn't set up yet. Add GEMINI_API_KEY in Vercel's environment variables and redeploy." };
  }
  const baseUrl = process.env.GEMINI_BASE_URL; // only used for local testing
  const client = new GoogleGenAI({ apiKey, ...(baseUrl ? { httpOptions: { baseUrl } } : {}) });

  const input: ({ type: "text"; text: string } | { type: "image"; data: string; mime_type: "image/jpeg" })[] = [];
  let text = INSTRUCTIONS + "\n\n--- SLIDES ---\n";
  for (const s of slides) {
    text += `\n[Slide ${s.n}]\n${s.image ? "(this slide is a picture; it follows as an image)" : s.text}\n`;
  }
  input.push({ type: "text", text });
  for (const s of slides) {
    if (!s.image) continue;
    input.push({ type: "text", text: `Image of slide ${s.n}:` });
    input.push({ type: "image", data: s.image, mime_type: "image/jpeg" });
  }

  let lastError = "";
  for (const model of MODELS) {
    try {
      const interaction = await client.interactions.create({
        model,
        input,
        store: false,
        generation_config: { thinking_level: "low" },
        response_format: { type: "text", mime_type: "application/json", schema: SCHEMA },
      });
      const out = JSON.parse(interaction.output_text ?? "");
      const seen = new Set<string>();
      const items: ParsedItem[] = [];
      for (const it of Array.isArray(out.items) ? out.items : []) {
        const hanzi = String(it.hanzi ?? "").trim();
        if (!hanzi || !HAN.test(hanzi) || seen.has(hanzi)) continue;
        seen.add(hanzi);
        const kind = it.kind === "word" || it.kind === "sentence" ? it.kind : "phrase";
        items.push({ hanzi, pinyin: String(it.pinyin ?? "").trim(), meaning: String(it.meaning ?? "").trim(), kind });
      }
      return { ok: true, title: String(out.title ?? "").trim(), summary: String(out.summary ?? "").trim(), items };
    } catch (e) {
      const err = e as { status?: number; statusCode?: number; message?: string };
      const status = err.status ?? err.statusCode ?? 0;
      const msg = String(err.message ?? e);
      console.error(`Gemini parse failed (${model}):`, status, msg.slice(0, 500));
      if (status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(msg)) {
        lastError = "Gemini's free quota is used up for the moment. Wait a little and choose the file again, or save the lesson now and add words by hand.";
        continue; // the lighter model has its own quota
      }
      if (status === 404 || /not found|not supported/i.test(msg)) {
        lastError = `The model "${model}" isn't available for this key.`;
        continue;
      }
      if (status === 400 && /API key/i.test(msg) || status === 401 || status === 403) {
        return { ok: false, error: "Gemini rejected the API key. Check GEMINI_API_KEY in Vercel, then redeploy." };
      }
      if (e instanceof SyntaxError) {
        lastError = "Gemini's reply couldn't be read. Choose the file again to retry.";
        continue;
      }
      return { ok: false, error: "The AI parser failed (" + (status || "no response") + "). Choose the file again to retry, or save the lesson and add words by hand." };
    }
  }
  return { ok: false, error: lastError };
}
