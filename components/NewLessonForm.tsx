"use client";

import { useState, useTransition } from "react";
import { createLesson } from "@/app/actions";
import { SlidePicker, emptyPick, keptVocab, type Picked } from "./SlidePicker";

export function NewLessonForm({ known, today }: { known: string[]; today: string }) {
  const [date, setDate] = useState(today);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [pick, setPick] = useState<Picked>(emptyPick);
  const [pending, start] = useTransition();

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        start(() => createLesson({ date, title, notes, slides: pick.slides, filename: pick.filename, vocab: keptVocab(pick) }));
      }}
    >
      <div className="grid gap-4 sm:grid-cols-[11rem_1fr]">
        <label className="field"><span className="eyebrow">Date</span><input className="inp" type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></label>
        <label className="field"><span className="eyebrow">Title</span><input className="inp" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ordering food" required /></label>
      </div>
      <SlidePicker known={known} value={pick} onChange={setPick} />
      <label className="field"><span className="eyebrow">Notes</span><textarea className="inp" value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
      <button className="btn" disabled={pending}>{pending ? "Saving" : "Save lesson"}</button>
    </form>
  );
}
