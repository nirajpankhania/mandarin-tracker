"use client";

import { useState } from "react";
import { updateVocab, deleteVocab } from "@/app/actions";
import { Hanzi } from "./Hanzi";

export type VocabRow = { id: number; hanzi: string; pinyin: string; meaning: string; example: string };

export function VocabItem({ v, examples = [], lesson }: { v: VocabRow; examples?: string[]; lesson?: React.ReactNode }) {
  const [editing, setEditing] = useState(false);
  const [example, setExample] = useState(v.example);

  if (!editing) {
    return (
      <li className="flex flex-wrap items-center gap-x-5 gap-y-2 py-4 ">
        <Hanzi text={v.hanzi} />
        <div className="min-w-40 flex-1">
          <p><span className="meta">{v.pinyin}</span></p>
          <p>{v.meaning || <span className="tag tag-note">Needs a meaning</span>}</p>
          {v.example && <p className="hanzi text-lg mt-1" lang="zh">{v.example}</p>}
          {lesson}
        </div>
        <button className="tag" onClick={() => { setExample(v.example); setEditing(true); }}>Edit</button>
      </li>
    );
  }
  return (
    <li className="py-4 ">
      <form action={async (f) => { await updateVocab(f); setEditing(false); }} className="space-y-3">
        <input type="hidden" name="id" value={v.id} />
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="field"><span className="eyebrow">Word</span><input className="inp hanzi text-xl" name="hanzi" defaultValue={v.hanzi} lang="zh" required /></label>
          <label className="field"><span className="eyebrow">Pinyin</span><input className="inp" name="pinyin" defaultValue={v.pinyin} /></label>
          <label className="field"><span className="eyebrow">Meaning</span><input className="inp" name="meaning" defaultValue={v.meaning} autoFocus /></label>
        </div>
        <label className="field">
          <span className="eyebrow">Example sentence</span>
          <input className="inp hanzi text-lg" name="example" value={example} onChange={(e) => setExample(e.target.value)} lang="zh" />
        </label>
        {examples.length > 0 && (
          <div>
            <p className="eyebrow mb-2">Said in the lesson</p>
            <div className="flex flex-col items-start gap-2">
              {examples.map((s) => (
                <button type="button" key={s} onClick={() => setExample(s)} lang="zh"
                  className={`hanzi text-lg text-left rounded-lg border px-3 py-1 ${s === example ? "border-black bg-cream" : "border-khaki bg-white hover:border-black"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-4">
          <button className="btn btn-sm">Save word</button>
          <button type="button" className="tag" onClick={() => setEditing(false)}>Cancel</button>
          <button className="tag ml-auto" formAction={deleteVocab}>Delete word</button>
        </div>
      </form>
    </li>
  );
}
