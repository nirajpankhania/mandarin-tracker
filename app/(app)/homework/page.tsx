import { requireUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { addHomework } from "@/app/actions";
import { Hero } from "@/components/Hero";
import { HomeworkList, HOMEWORK_SQL, type HomeworkRow } from "@/components/HomeworkList";

export default async function HomeworkPage() {
  const user = await requireUser();
  const all = await q<HomeworkRow>(`${HOMEWORK_SQL} order by h.done, h.due_date nulls last, h.id desc`);
  const open = all.filter((h) => !h.done);
  const done = all.filter((h) => h.done);
  return (
    <>
    <Hero overline={`${done.length} of ${all.length} done`} title="Homework" />
    <section className="band"><div className="wrap space-y-10">
      <div className="frame frame-khaki">
        <div className="card px-5 py-4">
          <h3>To do</h3>
          <HomeworkList items={open} user={user} showLesson />
        </div>
      </div>
      <form action={addHomework} className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <label className="field"><span className="eyebrow">New task</span><input className="inp" name="task" required /></label>
        <label className="field"><span className="eyebrow">Due</span><input className="inp" type="date" name="due" /></label>
        <button className="btn btn-sm" style={{ minHeight: 44 }}>Add homework</button>
      </form>
      {done.length > 0 && (
        <section>
          <h2>Done</h2>
          <div className="card px-5 py-2 mt-4"><HomeworkList items={done} user={user} showLesson /></div>
        </section>
      )}
    </div></section>
    </>
  );
}
