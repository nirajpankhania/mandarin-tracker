"use client";

import { useState } from "react";
import { readPptx, type Slide } from "@/lib/pptx";
import { detectVocab, type Candidate } from "@/lib/detect";

export type Picked = { slides: Slide[]; filename: string | null; candidates: Candidate[] };

/** Choose a .pptx or .pdf; its text is read here in the browser and the words found are listed to tick. */
export function SlidePicker({ known, value, onChange }: { known: string[]; value: Picked; onChange: (p: Picked) => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [ocrPages, setOcrPages] = useState(0);
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
    try {
      let slides;
      let ocr = 0;
      if (isPdf) {
        const { readPdf } = await import("@/lib/pdf");
        ({ slides, ocrPages: ocr } = await readPdf(file, setBusy));
      } else {
        slides = await readPptx(file);
      }
      setOcrPages(ocr);
      const { candidates, skippedKnown } = detectVocab(slides.map((s) => s.text).join("\n"), new Set(known));
      setSkipped(skippedKnown);
      onChange({ slides, filename: file.name, candidates });
    } catch (e) {
      setError(`Couldn't read that file: ${(e as Error).message}`);
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
        <input type="file" accept=".pptx,.pdf,application/pdf" onChange={(e) => onFile(e.target.files?.[0])} />
      </label>
      {busy && <p className="text-sm" role="status">{busy}…</p>}
      {error && <p className="text-sm text-rust">{error}</p>}
      {value.filename && !busy && (
        <div className="frame frame-khaki">
          <p className="meta text-center mb-3">
            {value.slides.length} {value.slides.length === 1 ? "slide" : "slides"} read
            {ocrPages > 0 && `, ${ocrPages} from page images`}
          </p>
          {ocrPages > 0 && (
            <p className="card px-4 py-3 mb-3 text-sm">
              {ocrPages === value.slides.length ? "These pages" : `${ocrPages} of these pages`} had no selectable text, so the words were
              recognised from the picture. Check the characters before saving; similar-looking ones can be mixed up.
            </p>
          )}
          <div className="card px-4 py-3">
            {value.candidates.length === 0 ? (
              <p className="text-sm py-2">No new Chinese words found on these slides.</p>
            ) : (
              <>
                <p className="text-sm mb-2">
                  Tick the words to keep ({kept} of {value.candidates.length} ticked). Meanings can be filled in now or later.
                </p>
                <ul>
                  {value.candidates.map((c, i) => (
                    <li key={c.hanzi} className="grid grid-cols-[auto_4.5rem_1fr] sm:grid-cols-[auto_6rem_9rem_1fr] items-center gap-x-3 gap-y-1 py-2 ">
                      <input type="checkbox" checked={c.keep} onChange={(e) => set(i, { keep: e.target.checked })} aria-label={`Keep ${c.hanzi}`} className="size-5 accent-black" />
                      <span className="hanzi text-2xl" lang="zh">{c.hanzi}</span>
                      <input className="inp !py-1" value={c.pinyin} onChange={(e) => set(i, { pinyin: e.target.value })} aria-label={`Pinyin for ${c.hanzi}`} />
                      <input className="inp !py-1 col-span-3 sm:col-span-1" value={c.meaning} placeholder="Meaning" onChange={(e) => set(i, { meaning: e.target.value, keep: true })} aria-label={`Meaning of ${c.hanzi}`} />
                    </li>
                  ))}
                </ul>
              </>
            )}
            {skipped > 0 && <p className="meta mt-3">{skipped} words already in your vocabulary were left out.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

export const emptyPick: Picked = { slides: [], filename: null, candidates: [] };
export const keptVocab = (p: Picked) => p.candidates.filter((c) => c.keep).map(({ hanzi, pinyin, meaning }) => ({ hanzi, pinyin, meaning }));
