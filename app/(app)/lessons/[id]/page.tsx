import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { sentences, examplesFor } from "@/lib/transcript";
import { addHomework, addVocab, deleteLesson, saveNotes, updateLesson } from "@/app/actions";
import { HomeworkList, HOMEWORK_SQL, type HomeworkRow } from "@/components/HomeworkList";
import { VocabItem, type VocabRow } from "@/components/VocabItem";
import { AddSlides } from "@/components/AddSlides";
import { Hero } from "@/components/Hero";
import { Desk } from "@/components/Desk";
import { TranscriptForm } from "@/components/TranscriptForm";

type Lesson = { id: number; d: string; title: string; notes: string; slides: { n: number; text: string }[]; slides_filename: string | null; transcript: string };

// reading slides calls the AI parser, which can take a while
export const maxDuration = 60;

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const rows = await q<Lesson>("select id, to_char(lesson_date, 'YYYY-MM-DD') as d, title, notes, slides, slides_filename, transcript from lessons where id = $1", [id]);
  const lesson = rows[0];
  if (!lesson) notFound();

  const vocab = await q<VocabRow>("select id, hanzi, pinyin, meaning, example from vocab where lesson_id = $1 order by id", [id]);
  const homework = await q<HomeworkRow>(`${HOMEWORK_SQL} where h.lesson_id = $1 order by h.done, h.due_date nulls last, h.id`, [id]);
  const known = (await q<{ hanzi: string }>("select hanzi from vocab")).map((r) => r.hanzi);
  const sents = sentences(lesson.transcript);
  const exportable = vocab.filter((v) => v.meaning).length;
  const doneCount = homework.filter((h) => h.done).length;

  return (
    <>
      <Hero
        overline={fmtDate(lesson.d)}
        title={lesson.title}
        aside={vocab[0] ? (
          <Desk className="hidden md:block h-28 slide-in">
            <span className="sticker-zi desk-item" style={{ top: 0, right: 60, ["--r" as string]: "-9deg", ["--d" as string]: 14 }} aria-hidden><span>{Array.from(vocab[0].hanzi)[0]}</span></span>
            {vocab[1] && <span className="sticker-zi desk-item" style={{ top: 30, right: 150, background: "var(--color-pink)", ["--r" as string]: "8deg", ["--d" as string]: 22 }} aria-hidden><span>{Array.from(vocab[1].hanzi)[0]}</span></span>}
          </Desk>
        ) : undefined}
      >
        <details className="mt-5">
          <summary className="tag">Edit lesson details</summary>
          <form action={updateLesson} className="mt-3 grid gap-3 sm:grid-cols-[11rem_1fr_auto] sm:items-end max-w-2xl">
            <input type="hidden" name="id" value={id} />
            <label className="field"><span className="eyebrow">Date</span><input className="inp" type="date" name="date" defaultValue={lesson.d} required /></label>
            <label className="field"><span className="eyebrow">Title</span><input className="inp" name="title" defaultValue={lesson.title} required /></label>
            <button className="btn btn-sm">Save details</button>
          </form>
          <form action={deleteLesson} className="mt-4">
            <input type="hidden" name="id" value={id} />
            <button className="tag">Delete this lesson and its homework</button>
          </form>
        </details>
      </Hero>

      <section className="band"><div className="wrap space-y-16">
      <div className="grid gap-10 md:grid-cols-2 md:items-start">
        <form action={saveNotes} className="space-y-3 min-w-0">
          <input type="hidden" name="id" value={id} />
          <h2>Notes</h2>
          <textarea className="inp" name="notes" defaultValue={lesson.notes} style={{ minHeight: 220 }} aria-label="Lesson notes" />
          <button className="btn btn-sm">Save notes</button>
        </form>

        <div className="frame frame-khaki min-w-0">
          <div className="card px-5 py-4">
            <div className="flex items-baseline justify-between gap-4"><h3>Homework</h3><span className="meta">{doneCount}/{homework.length} done</span></div>
            <HomeworkList items={homework} user={user} />
            <form action={addHomework} className="mt-3 pt-3 border-t border-khaki grid gap-2 sm:grid-cols-[1fr_auto]">
              <input type="hidden" name="lesson_id" value={id} />
              <input className="inp sm:col-span-2" name="task" placeholder="New task" aria-label="New homework task" required />
              <input className="inp" type="date" name="due" aria-label="Due date" />
              <button className="btn btn-sm">Add homework</button>
            </form>
          </div>
        </div>
      </div>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2>Vocabulary <span className="meta">{vocab.length}</span></h2>
          {exportable > 0 && <a className="btn btn-sm" href={`/api/anki?lesson=${id}`} download>Download Anki deck</a>}
        </div>
        {exportable < vocab.length && (
          <p className="mt-2 meta">{vocab.length - exportable} words still need a meaning and are left out of the Anki deck.</p>
        )}
        <div className="card px-5 mt-4">
          {vocab.length === 0 ? <p className="py-4 text-sm">No words yet. Upload slides below or add words by hand.</p> : (
            <ul className="rule">{vocab.map((v) => <VocabItem key={v.id} v={v} examples={examplesFor(v.hanzi, sents)} />)}</ul>
          )}
        </div>
        <form action={addVocab} className="mt-4 grid gap-3 sm:grid-cols-[8rem_10rem_1fr_auto] sm:items-end">
          <input type="hidden" name="lesson_id" value={id} />
          <label className="field"><span className="eyebrow">Word</span><input className="inp hanzi text-xl" name="hanzi" lang="zh" required /></label>
          <label className="field"><span className="eyebrow">Pinyin (optional)</span><input className="inp" name="pinyin" /></label>
          <label className="field"><span className="eyebrow">Meaning</span><input className="inp" name="meaning" /></label>
          <button className="btn btn-sm">Add word</button>
        </form>
      </section>

      <section>
        <h2>Slides</h2>
        {lesson.slides.length > 0 && (
          <div className="frame frame-khaki mt-4">
            <p className="meta text-center mb-3">{lesson.slides_filename ?? "Slides"}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {lesson.slides.map((s) => (
                <div key={s.n} className="card p-4">
                  <p className="eyebrow mb-2">Slide {s.n}</p>
                  <p className="whitespace-pre-wrap text-sm break-words" lang="zh">{s.text || "(no text on this slide)"}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        <details className="mt-4" open={lesson.slides.length === 0}>
          <summary className="tag">{lesson.slides.length ? "Replace slides" : "Upload slides"}</summary>
          <div className="mt-4"><AddSlides lessonId={id} known={known} /></div>
        </details>
      </section>

      <section>
        <h2>Call transcript</h2>
        <p className="mt-2 max-w-prose text-sm">
          {lesson.transcript
            ? `${sents.length} Chinese sentences found. Words without an example get the best matching sentence; edit a word to pick a different one.`
            : "Add the transcript from your lesson call. Sentences that use this lesson's words become example sentences on the flashcards."}
        </p>
        <details className="mt-4" open={!lesson.transcript}>
          <summary className="tag">{lesson.transcript ? "View or replace transcript" : "Add transcript"}</summary>
          <div className="mt-4 max-w-2xl"><TranscriptForm lessonId={id} initial={lesson.transcript} /></div>
        </details>
      </section>
      </div></section>
    </>
  );
}
