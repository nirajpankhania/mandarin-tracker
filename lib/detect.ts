import { pinyin } from "pinyin-pro";

export type Candidate = { hanzi: string; pinyin: string; meaning: string; keep: boolean };

const H = "\\u3400-\\u9fff";
const ALL_HAN = new RegExp(`^[${H}]+$`);
const TONE = /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]|[a-zü]+[1-5]\b/i;
// "苹果 píngguǒ apple", "1. 苹果: apple", "苹果 (píngguǒ) - apple", or a table row
const LISTED = new RegExp(`^\\s*(?:[•·▪◦●○■□➢✓*\\-–]\\s*)?(?:\\d+\\s*[.、)）]\\s*)?([${H}]{1,6})[\\s:：\\-–—=(（\\[]+([^${H}]*[a-zA-Z][^${H}]*)$`);
// Very common function words that are rarely worth a flashcard
const COMMON = new Set("的了是我你他她它们在有和不也很吗呢吧这那个一二三四五六七八九十就都还要会能说去来到对把被给让跟与或但而所以因为如果什么怎么这个那个我们你们他们一个没有可以".match(/./gu));
const COMMON_WORDS = new Set(["我们", "你们", "他们", "她们", "这个", "那个", "什么", "怎么", "没有", "可以", "一个", "所以", "因为", "如果", "但是"]);

export function toPinyin(hanzi: string): string {
  const syl = pinyin(hanzi, { toneType: "symbol", type: "array" });
  return hanzi.length <= 4 ? syl.join("") : syl.join(" ");
}

/** "laoshi teacher" or "laoshiteacher" (pinyin typed or scanned without tone marks) -> "teacher" */
function dropPinyin(hanzi: string, rest: string): string {
  const plain = pinyin(hanzi, { toneType: "none", type: "array" }).join("").replace(/ü/g, "v").toLowerCase();
  let i = 0;
  let j = 0;
  while (i < rest.length && j < plain.length) {
    const ch = rest[i].toLowerCase().replace("ü", "v");
    if (ch === plain[j] || (plain[j] === "v" && ch === "u")) { i++; j++; }
    else if (/[\s'’·-]/.test(rest[i])) i++;
    else break;
  }
  return j === plain.length && i < rest.length ? rest.slice(i) : rest;
}

/** Pick out Chinese words from slide text. Words listed with a gloss on the slide come first. */
export function detectVocab(text: string, known: Set<string>): { candidates: Candidate[]; skippedKnown: number } {
  const found = new Map<string, Candidate>();
  let skippedKnown = 0;
  const knownSeen = new Set<string>();
  const listed = new Set<string>(); // words the slides gloss themselves, including ones already saved
  const add = (c: Candidate) => {
    if (known.has(c.hanzi)) {
      if (!knownSeen.has(c.hanzi)) { knownSeen.add(c.hanzi); skippedKnown++; }
      return;
    }
    const prev = found.get(c.hanzi);
    if (!prev) found.set(c.hanzi, c);
    else if (!prev.meaning && c.meaning) found.set(c.hanzi, { ...prev, ...c });
  };

  const lines = text.split("\n");
  for (const line of lines) {
    const m = line.match(LISTED);
    if (!m) continue;
    const hanzi = m[1];
    const tokens = m[2].split(/[\s\t]+/).filter(Boolean);
    const py: string[] = [];
    while (tokens.length && TONE.test(tokens[0])) py.push(tokens.shift()!);
    const clean = (s: string) => s.replace(/^[\s()（）\[\]:：\-–—=,，;；]+|[\s()（）\[\]:：\-–—=,，;；]+$/g, "");
    const meaning = clean(dropPinyin(hanzi, clean(tokens.join(" "))));
    listed.add(hanzi);
    add({ hanzi, pinyin: clean(py.join(" ")) || toPinyin(hanzi), meaning, keep: true });
  }

  const listedWords = Array.from(listed);
  const Seg = (Intl as unknown as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  if (Seg) {
    const seg = new Seg("zh", { granularity: "word" });
    for (const line of lines) {
      for (const s of seg.segment(line)) {
        const w = s.segment;
        if (!ALL_HAN.test(w) || w.length > 4) continue;
        if (COMMON_WORDS.has(w) || (w.length === 1 && COMMON.has(w))) continue;
        if (listedWords.some((l) => l !== w && l.includes(w))) continue; // a piece of a word the slide already lists
        // When the slides list their own vocabulary, other words found in the text are offered unticked
        add({ hanzi: w, pinyin: toPinyin(w), meaning: "", keep: listedWords.length === 0 && w.length > 1 });
      }
    }
  }
  return { candidates: Array.from(found.values()), skippedKnown };
}
