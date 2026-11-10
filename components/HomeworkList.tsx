import Link from "next/link";
import { toggleHomework, saveHomeworkNote, deleteHomework } from "@/app/actions";
import { fmtDate, today } from "@/lib/format";
import type { User } from "@/lib/auth";

export type HomeworkRow = {
  id: number; task: string; due: string | null; done: boolean; student_note: string; teacher_feedback: string;
  lesson_id: number | null; lesson_title: string | null;
};

export const HOMEWORK_SQL = `select h.id, h.task, to_char(h.due_date, 'YYYY-MM-DD') as due, h.done, h.student_note, h.teacher_feedback,
  h.lesson_id, l.title as lesson_title from homework h left join lessons l on l.id = h.lesson_id`;

export function HomeworkList({ items, user, showLesson = false }: { items: HomeworkRow[]; user: User; showLesson?: boolean }) {
  if (items.length === 0) return <p className="py-3 text-sm">No homework here yet.</p>;
  const mine = user.role === "teacher" ? "teacher_feedback" : "student_note";
  return (
    <ul>
      {items.map((h) => {
        const late = !h.done && h.due !== null && h.due < today();
        return (
          <li key={h.id} className="todo">
            <form action={toggleHomework}>
              <input type="hidden" name="id" value={h.id} />
              <button className={`check ${h.done ? "is-done" : ""}`} aria-label={h.done ? `Mark "${h.task}" as not done` : `Mark "${h.task}" as done`}>
                <span>{h.done ? "✓" : ""}</span>
              </button>
            </form>
            <div className="min-w-0 flex-1">
              <p className={h.done ? "opacity-60" : ""}>{h.task}</p>
              <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 meta">
                {h.due && <span className={late ? "text-rust font-semibold" : ""}>{late ? "Was due" : "Due"} {fmtDate(h.due)}</span>}
                {showLesson && h.lesson_id && <Link href={`/lessons/${h.lesson_id}`}>{h.lesson_title}</Link>}
              </p>
              {h.student_note && user.role === "teacher" && <p className="mt-2 text-sm">Student: {h.student_note}</p>}
              {h.teacher_feedback && user.role === "student" && <p className="mt-2 text-sm teacher-ink">Teacher: {h.teacher_feedback}</p>}
              <details className="mt-2">
                <summary className="tag">{user.role === "teacher" ? "Feedback" : "My note"}{h[mine] ? " (1)" : ""}</summary>
                <form action={saveHomeworkNote} className="mt-2 space-y-2">
                  <input type="hidden" name="id" value={h.id} />
                  <textarea className="inp" name="note" defaultValue={h[mine]} style={{ minHeight: 70 }}
                    aria-label={user.role === "teacher" ? "Feedback for the student" : "Note for your teacher"} />
                  <div className="flex items-center gap-4">
                    <button className="btn btn-sm">Save note</button>
                    <button className="tag" formAction={deleteHomework}>Delete homework</button>
                  </div>
                </form>
              </details>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
