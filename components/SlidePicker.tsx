"use client";

import { useState } from "react";
import { readPptx, type Slide } from "@/lib/pptx";
import { parseSlides } from "@/app/actions";

export type Candidate = { hanzi: string; pinyin: string; meaning: string; kind: "word" | "phrase" | "sentence"; keep: boolean };
export type Picked = { slides: Slide[]; filename: string | null; candidates: Candidate[]; title: string; summary: string };

const KIND_LABEL = { word: "Word", phrase: "Phrase", sentence: "Sentence" } as const;

/**
 * Choose a .pptx or .pdf. Its text is read here in the browser, then sent to the AI parser,
 * which returns the lesson's phrases, sentences and key words to tick.
 */
export function SlidePicker({ known, value, onChange }: { known: string[]; value: Picked; onChange: (p: Picked) => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [skipped, setSkipped] = useState(0);

  async function onFile(file: File | undefined) {
    setError("");
    if (!file) return;
    const isPdf = /\.pdf$/i.test(file.name);
    if (!isPdf && !/\.pptx$/i.test(file.name)) {
      setError("Choose a .pptx or .pdf file. Older .ppt files need saving as one of those first.");
      return;
    }
    setBusy("Reading slides");
    let slides: (Slide & { image?: string })[];
    try {
      if (isPdf) {
        const { readPdf } = await import("@/lib/pdf");
        slides = await readPdf(file, setBusy);
      } else {
        slides = await readPptx(file);
      }
    } catch (e) {
      setError(`Couldn't read that file: ${(e as Error).message}`);
      setBusy("");
      return;
    }

    const stored: Slide[] = slides.map((s) => ({ n: s.n, text: s.text || (s.image ? "(picture slide)" : "") }));
    setBusy("Working out the words and phrases");
    try {
      const res = await parseSlides(slides);
      if (!res.ok) {
        setError(res.error);
        onChange({ slides: stored, filename: file.name, candidates: [], title: "", summary: "" });
        return;
      }
      const have = new Set(known);
      const fresh = res.items.filter((i) => !have.has(i.hanzi));
      setSkipped(res.items.length - fresh.length);
      onChange({ slides: stored, filename: file.name, candidates: fresh.map((i) => ({ ...i, keep: true })), title: res.title, summary: res.summary });
    } catch {
      setError("Couldn't reach the AI parser. Check your connection and choose the file again. The slide text is kept, so you can still save the lesson.");
      onChange({ slides: stored, filename: file.name, candidates: [], title: "", summary: "" });
    } finally {
      setBusy("");
    }
  }

  const set = (i: number, patch: Partial<Candidate>) =>
    onChange({ ...value, candidates: value.candidates.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  const kept = value.candidates.filter((c) => c.keep).length;

  return (
    <div className="space-y-4">
      <label className="field">
        <span className="eyebrow">Lesson slides (.pptx or .pdf)</span>
        <input type="file" accept=".pptx,.pdf,application/pdf" onChange={(e) => onFile(e.target.files?.[0])} disabled={!!busy} />
      </label>
      {busy && <p className="text-sm" role="status">{busy}…</p>}
      {error && <p className="text-sm text-rust" role="alert">{error}</p>}
      {value.filename && !busy && (
        <div className="frame frame-khaki">
          <p className="meta text-center mb-3">
            {value.slides.length} {value.slides.length === 1 ? "slide" : "slides"} read
          </p>
          <div className="card px-4 py-3">
            {value.candidates.length === 0 ? (
              <p className="text-sm py-2">
                {error ? "No words were picked out. You can still save the lesson and add words by hand." : "Nothing new to learn was found on these slides."}
              </p>
            ) : (
              <>
                <p className="text-sm mb-2">
                  Untick anything you don&apos;t want as a flashcard ({kept} of {value.candidates.length} ticked). Pinyin and meanings were written by
                  AI, so correct any that look wrong.
                </p>
                <ul className="rule">
                  {value.candidates.map((c, i) => (
                    <li key={c.hanzi} className="grid grid-cols-[auto_1fr] items-start gap-x-3 py-3">
                      <input type="checkbox" checked={c.keep} onChange={(e) => set(i, { keep: e.target.checked })} aria-label={`Keep ${c.hanzi}`} className="size-5 mt-1.5 accent-black" />
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-baseline gap-x-3">
                          <span className="hanzi text-2xl leading-tight" lang="zh">{c.hanzi}</span>
                          <span className="meta">{KIND_LABEL[c.kind]}</span>
                        </p>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          <input className="inp !py-1" value={c.pinyin} onChange={(e) => set(i, { pinyin: e.target.value })} aria-label={`Pinyin for ${c.hanzi}`} />
                          <input className="inp !py-1" value={c.meaning} placeholder="Meaning" onChange={(e) => set(i, { meaning: e.target.value })} aria-label={`Meaning of ${c.hanzi}`} />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {skipped > 0 && <p className="meta mt-3">{skipped} already in your vocabulary were left out.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

export const emptyPick: Picked = { slides: [], filename: null, candidates: [], title: "", summary: "" };
export const keptVocab = (p: Picked) => p.candidates.filter((c) => c.keep).map(({ hanzi, pinyin, meaning }) => ({ hanzi, pinyin, meaning }));
