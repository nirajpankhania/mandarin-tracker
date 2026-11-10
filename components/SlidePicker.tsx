"use client";

import { useState } from "react";
import { readPptx, type Slide } from "@/lib/pptx";
import { detectVocab, type Candidate } from "@/lib/detect";

export type Picked = { slides: Slide[]; filename: string | null; candidates: Candidate[] };

/** Choose a .pptx; its text is read here in the browser and the words found are listed to tick. */
export function SlidePicker({ known, value, onChange }: { known: string[]; value: Picked; onChange: (p: Picked) => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [skipped, setSkipped] = useState(0);

  async function onFile(file: File | undefined) {
    setError("");
    if (!file) return;
    if (!/\.pptx$/i.test(file.name)) {
      setError("That isn't a .pptx file. Older .ppt files and PDFs need saving as .pptx first.");
      return;
    }
    setBusy(true);
    try {
      const slides = await readPptx(file);
      const { candidates, skippedKnown } = detectVocab(slides.map((s) => s.text).join("\n"), new Set(known));
      setSkipped(skippedKnown);
      onChange({ slides, filename: file.name, candidates });
    } catch (e) {
      setError(`Couldn't read that file: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  const set = (i: number, patch: Partial<Candidate>) =>
    onChange({ ...value, candidates: value.candidates.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  const kept = value.candidates.filter((c) => c.keep).length;

  return (
    <div className="space-y-4">
      <label className="field">
        <span className="eyebrow">Lesson slides (.pptx)</span>
        <input type="file" accept=".pptx" onChange={(e) => onFile(e.target.files?.[0])} />
      </label>
      {busy && <p className="text-sm">Reading slides…</p>}
      {error && <p className="text-sm text-rust">{error}</p>}
      {value.filename && !busy && (
        <div className="frame frame-khaki">
          <p className="meta text-center mb-3">{value.slides.length} slides read</p>
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
