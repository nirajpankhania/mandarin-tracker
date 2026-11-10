"use client";

import { useState, useTransition } from "react";
import { attachSlides } from "@/app/actions";
import { SlidePicker, emptyPick, keptVocab, type Picked } from "./SlidePicker";

export function AddSlides({ lessonId, known }: { lessonId: number; known: string[] }) {
  const [pick, setPick] = useState<Picked>(emptyPick);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-4">
      <SlidePicker known={known} value={pick} onChange={setPick} />
      {pick.filename && (
        <button className="btn" disabled={pending}
          onClick={() => start(async () => { await attachSlides(lessonId, { slides: pick.slides, filename: pick.filename, vocab: keptVocab(pick) }); setPick(emptyPick); })}>
          {pending ? "Saving" : "Save slides and words"}
        </button>
      )}
    </div>
  );
}
