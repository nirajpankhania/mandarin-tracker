import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { addVocab } from "@/app/actions";
import { Hero } from "@/components/Hero";
import { VocabItem, type VocabRow } from "@/components/VocabItem";

type Row = VocabRow & { lesson_id: number | null; title: string | null };

export default async function VocabPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireUser();
  const term = ((await searchParams).q ?? "").trim();
  const rows = await q<Row>(
    `select v.id, v.hanzi, v.pinyin, v.meaning, v.example, v.lesson_id, l.title
     from vocab v left join lessons l on l.id = v.lesson_id
     where $1 = '' or v.hanzi like '%' || $1 || '%' or v.meaning ilike '%' || $1 || '%' or v.pinyin ilike '%' || $1 || '%'
     order by v.id desc`,
    [term]
  );
  const exportable = rows.filter((v) => v.meaning).length;
  return (
    <>
    <Hero overline={`${rows.length} ${rows.length === 1 ? "word" : "words"}`} title="Vocabulary">
      {!term && exportable > 0 && <div className="mt-7"><a className="btn" href="/api/anki" download>Download Anki deck</a></div>}
    </Hero>
    <section className="band"><div className="wrap space-y-8">
      <form className="flex gap-3 max-w-md" role="search">
        <input className="inp" name="q" defaultValue={term} placeholder="Search words, pinyin or meanings" aria-label="Search vocabulary" />
        <button className="btn btn-sm btn-plain">Search</button>
      </form>
      <div className="card px-5">
        {rows.length === 0 ? (
          <p className="py-4 text-sm">{term ? `Nothing matches "${term}".` : "No words yet. They appear here when you add a lesson's slides."}</p>
        ) : (
          <ul className="rule">
            {rows.map((v) => (
              <VocabItem key={v.id} v={v}
                lesson={v.lesson_id ? <Link className="meta" href={`/lessons/${v.lesson_id}`}>{v.title}</Link> : undefined} />
            ))}
          </ul>
        )}
      </div>
      <form action={addVocab} className="grid gap-3 sm:grid-cols-[8rem_10rem_1fr_auto] sm:items-end">
        <label className="field"><span className="eyebrow">Word</span><input className="inp hanzi text-xl" name="hanzi" lang="zh" required /></label>
        <label className="field"><span className="eyebrow">Pinyin (optional)</span><input className="inp" name="pinyin" /></label>
        <label className="field"><span className="eyebrow">Meaning</span><input className="inp" name="meaning" /></label>
        <button className="btn btn-sm">Add word</button>
      </form>
    </div></section>
    </>
  );
}
