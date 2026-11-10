"use client";

import { useState } from "react";
import { saveTranscript } from "@/app/actions";

export function TranscriptForm({ lessonId, initial }: { lessonId: number; initial: string }) {
  const [text, setText] = useState(initial);
  return (
    <form action={saveTranscript} className="space-y-3">
      <input type="hidden" name="id" value={lessonId} />
      <label className="field">
        <span className="eyebrow">Transcript file (.vtt, .srt or .txt)</span>
        <input type="file" accept=".vtt,.srt,.txt,text/plain" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setText(await f.text()); }} />
      </label>
      <label className="field">
        <span className="eyebrow">Or paste it here</span>
        <textarea className="inp" name="transcript" value={text} onChange={(e) => setText(e.target.value)} style={{ minHeight: 160 }} lang="zh" />
      </label>
      <button className="btn btn-sm">Save transcript</button>
    </form>
  );
}
