const HAN = /[\u3400-\u9fff]/;

/** Strip subtitle furniture (VTT/SRT cue numbers, timestamps, tags) and leave the spoken lines. */
export function cleanTranscript(raw: string): string {
  const out: string[] = [];
  for (let line of raw.replace(/\r/g, "").split("\n")) {
    line = line.trim();
    if (!line) continue;
    if (/^WEBVTT/i.test(line) || /^(NOTE|STYLE|Kind:|Language:)/.test(line)) continue;
    if (/^\d+$/.test(line)) continue;
    if (/\d{1,2}:\d{2}(:\d{2})?[.,]?\d*\s*-->\s*\d/.test(line)) continue;
    line = line.replace(/<[^>]+>/g, "").trim();
    if (line) out.push(line);
  }
  return out.join("\n");
}

/** Sentences from the transcript that contain Chinese, with speaker labels and timestamps removed. */
export function sentences(transcript: string): string[] {
  const seen = new Set<string>();
  const res: string[] = [];
  for (let line of transcript.split("\n")) {
    line = line
      .replace(/^\[?\d{1,2}:\d{2}(:\d{2})?\]?\s*/, "")
      .replace(/^[^\u3400-\u9fff:：]{1,30}[:：]\s*/, "");
    for (const part of line.split(/(?<=[。！？!?])|(?<=\.)\s+/)) {
      // drop English asides before the Chinese starts ("Good. 服务员…")
      const s = part.trim().replace(/^[A-Za-z0-9\s,.'’"!?:;()-]+(?=[\u3400-\u9fff])/, "");
      if (s.length < 2 || !HAN.test(s) || seen.has(s)) continue;
      seen.add(s);
      res.push(s);
    }
  }
  return res;
}

/** Sentences containing the word, best example first (short but not trivially short). */
export function examplesFor(word: string, sents: string[], max = 4): string[] {
  const min = word.length + 2;
  return sents
    .filter((s) => s.includes(word) && s.length <= 60)
    .sort((a, b) => score(a, min) - score(b, min))
    .slice(0, max);
}

function score(s: string, min: number) {
  return s.length < min ? 1000 - s.length : s.length;
}
