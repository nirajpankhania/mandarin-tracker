import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { HomeworkList, HOMEWORK_SQL, type HomeworkRow } from "@/components/HomeworkList";
import { Hero } from "@/components/Hero";
import { Desk } from "@/components/Desk";

export default async function Home() {
  const user = await requireUser();
  const lessons = await q<{ id: number; d: string; title: string; words: string; open: string }>(
    `select l.id, to_char(l.lesson_date, 'YYYY-MM-DD') as d, l.title,
       (select count(*) from vocab v where v.lesson_id = l.id) as words,
       (select count(*) from homework h where h.lesson_id = l.id and not h.done) as open
     from lessons l order by l.lesson_date desc, l.id desc`
  );
  const open = await q<HomeworkRow>(`${HOMEWORK_SQL} where not h.done order by h.due_date nulls last, h.id`);
  const counts = await q<{ done: string; total: string }>("select count(*) filter (where done) as done, count(*) as total from homework");
  const { done, total } = counts[0];

  return (
    <>
      <Hero
        overline={user.role === "teacher" ? "Teacher" : "Student"}
        title={<><span className="hanzi">你好</span>, {user.name}</>}
        aside={
          <Desk className="slide-in mt-4 md:mt-0">
            <span className="tape desk-item" style={{ top: -10, left: -18, ["--r" as string]: "-14deg", ["--d" as string]: 5 }} />
            <span className="sticker-zi desk-item" style={{ top: -34, right: 10, ["--r" as string]: "11deg", ["--d" as string]: 18 }} aria-hidden>
              <span>学</span>
            </span>
            <div className="frame desk-item" style={{ ["--r" as string]: "-1.2deg", ["--d" as string]: 6 }}>
              <div className="card px-5 py-4">
                <h3>Homework to do</h3>
                <p className="meta">{done} of {total} done</p>
                {open.length === 0 ? <p className="py-3 text-sm">Nothing outstanding.</p> : <HomeworkList items={open.slice(0, 4)} user={user} showLesson />}
                {open.length > 4 && <Link href="/homework" className="tag">All {open.length} open tasks</Link>}
              </div>
            </div>
          </Desk>
        }
      >
        <p className="mt-5 max-w-sm">
          {lessons.length === 0
            ? "Add your first lesson to start collecting notes, homework and vocabulary."
            : `${lessons.length} ${lessons.length === 1 ? "lesson" : "lessons"} so far.`}
        </p>
        <div className="mt-7"><Link href="/lessons/new" className="btn">Add a lesson</Link></div>
      </Hero>

      <section className="band">
        <div className="wrap">
          <p className="eyebrow eyebrow-accent">Notes, words and homework</p>
          <h2 className="mt-2">Lessons</h2>
          {lessons.length === 0 ? (
            <p className="mt-6">No lessons yet.</p>
          ) : (
            <ul className="mt-8 grid gap-3">
              {lessons.map((l) => (
                <li key={l.id}>
                  <Link href={`/lessons/${l.id}`} className="card lift grid gap-x-8 gap-y-1 px-6 py-5 sm:grid-cols-[9rem_1fr_auto] sm:items-baseline">
                    <span className="meta">{fmtDate(l.d)}</span>
                    <span className="font-serif text-2xl leading-tight">{l.title}</span>
                    <span className="flex items-baseline gap-3">
                      <span className="meta">{l.words} words</span>
                      {Number(l.open) > 0 && <span className="tag tag-note">{l.open} to do</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
