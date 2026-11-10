"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { pinyin } from "pinyin-pro";
import { q, ensureSchema, userCount } from "@/lib/db";
import { requireUser, startSession, endSession } from "@/lib/auth";
import { cleanTranscript, sentences, examplesFor } from "@/lib/transcript";
import { parseLesson, type ParseInput, type ParseResult } from "@/lib/parse";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const refresh = () => revalidatePath("/", "layout");
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

function autoPinyin(hanzi: string) {
  return pinyin(hanzi, { toneType: "symbol", type: "array", nonZh: "removed" }).join(" ");
}

// ---------- accounts ----------

export async function setup(f: FormData) {
  if ((await userCount()) > 0) redirect("/login");
  const people = (["student", "teacher"] as const).map((role) => ({
    role,
    name: str(f, `${role}_name`),
    email: str(f, `${role}_email`).toLowerCase(),
    password: String(f.get(`${role}_password`) ?? ""),
  }));
  if (people.some((p) => !p.name || !p.email || p.password.length < 8)) {
    redirect("/setup?error=" + encodeURIComponent("Fill in every field. Passwords need at least 8 characters."));
  }
  if (people[0].email === people[1].email) {
    redirect("/setup?error=" + encodeURIComponent("The two accounts need different email addresses."));
  }
  await ensureSchema();
  if ((await userCount()) > 0) redirect("/login");
  let me: { id: number } | undefined;
  for (const p of people) {
    const rows = await q<{ id: number }>(
      "insert into users (name, email, password_hash, role) values ($1,$2,$3,$4) returning id",
      [p.name, p.email, await bcrypt.hash(p.password, 10), p.role]
    );
    if (p.role === "student") me = rows[0];
  }
  await startSession({ id: me!.id, name: people[0].name, role: "student" });
  redirect("/");
}

export async function login(f: FormData) {
  const email = str(f, "email").toLowerCase();
  const rows = await q<{ id: number; name: string; role: "student" | "teacher"; password_hash: string }>(
    "select id, name, role, password_hash from users where email = $1",
    [email]
  );
  const u = rows[0];
  if (!u || !(await bcrypt.compare(String(f.get("password") ?? ""), u.password_hash))) {
    redirect("/login?error=1");
  }
  await startSession({ id: u.id, name: u.name, role: u.role });
  redirect("/");
}

export async function logout() {
  await endSession();
  redirect("/login");
}

export async function changePassword(f: FormData) {
  const user = await requireUser();
  const next = String(f.get("next") ?? "");
  const rows = await q<{ password_hash: string }>("select password_hash from users where id = $1", [user.id]);
  if (!rows[0] || !(await bcrypt.compare(String(f.get("current") ?? ""), rows[0].password_hash))) {
    redirect("/account?msg=" + encodeURIComponent("Current password is wrong. Password not changed."));
  }
  if (next.length < 8) redirect("/account?msg=" + encodeURIComponent("New password needs at least 8 characters."));
  await q("update users set password_hash = $1 where id = $2", [await bcrypt.hash(next, 10), user.id]);
  redirect("/account?msg=" + encodeURIComponent("Password changed."));
}

// ---------- slide parsing ----------

/** Send the slide text (and pictures of image-only pages) to the model and get the lesson's study items back. */
export async function parseSlides(slides: ParseInput): Promise<ParseResult> {
  await requireUser();
  const clean = (Array.isArray(slides) ? slides : []).slice(0, 80).map((s, i) => ({
    n: i + 1,
    text: String(s.text ?? "").slice(0, 6000),
    image: typeof s.image === "string" && s.image.length < 1_500_000 ? s.image : undefined,
  }));
  if (!clean.some((s) => s.text.trim() || s.image)) return { ok: false, error: "There is no text on these slides to read." };
  return parseLesson(clean);
}

// ---------- lessons ----------

export type SlideIn = { n: number; text: string };
export type VocabIn = { hanzi: string; pinyin: string; meaning: string };
export type LessonIn = { date: string; title: string; notes: string; slides: SlideIn[]; filename: string | null; vocab: VocabIn[] };

async function insertVocab(lessonId: number, vocab: VocabIn[]) {
  for (const v of vocab.slice(0, 500)) {
    const hanzi = String(v.hanzi ?? "").trim();
    if (!hanzi) continue;
    await q(
      "insert into vocab (lesson_id, hanzi, pinyin, meaning) values ($1,$2,$3,$4) on conflict (hanzi) do nothing",
      [lessonId, hanzi, String(v.pinyin ?? "").trim() || autoPinyin(hanzi), String(v.meaning ?? "").trim()]
    );
  }
}

const cleanSlides = (slides: SlideIn[]) =>
  (Array.isArray(slides) ? slides : []).slice(0, 300).map((s, i) => ({ n: i + 1, text: String(s.text ?? "").slice(0, 20000) }));

export async function createLesson(input: LessonIn) {
  const user = await requireUser();
  const title = String(input.title ?? "").trim();
  if (!title || !isDate(input.date)) throw new Error("A lesson needs a date and a title.");
  const rows = await q<{ id: number }>(
    "insert into lessons (lesson_date, title, notes, slides, slides_filename, created_by) values ($1,$2,$3,$4,$5,$6) returning id",
    [input.date, title, String(input.notes ?? ""), JSON.stringify(cleanSlides(input.slides)), input.filename, user.id]
  );
  await insertVocab(rows[0].id, input.vocab ?? []);
  refresh();
  redirect(`/lessons/${rows[0].id}`);
}

export async function attachSlides(lessonId: number, input: { slides: SlideIn[]; filename: string | null; vocab: VocabIn[] }) {
  await requireUser();
  await q("update lessons set slides = $1, slides_filename = $2 where id = $3", [JSON.stringify(cleanSlides(input.slides)), input.filename, lessonId]);
  await insertVocab(lessonId, input.vocab ?? []);
  await fillExamples(lessonId);
  refresh();
}

export async function updateLesson(f: FormData) {
  await requireUser();
  const id = Number(f.get("id"));
  const title = str(f, "title");
  const date = str(f, "date");
  if (title && isDate(date)) await q("update lessons set title = $1, lesson_date = $2 where id = $3", [title, date, id]);
  refresh();
}

export async function saveNotes(f: FormData) {
  await requireUser();
  await q("update lessons set notes = $1 where id = $2", [String(f.get("notes") ?? ""), Number(f.get("id"))]);
  refresh();
}

export async function deleteLesson(f: FormData) {
  await requireUser();
  await q("delete from lessons where id = $1", [Number(f.get("id"))]);
  refresh();
  redirect("/");
}

/** Give each word in the lesson that has no example the best matching sentence from the transcript. */
async function fillExamples(lessonId: number) {
  const l = await q<{ transcript: string }>("select transcript from lessons where id = $1", [lessonId]);
  if (!l[0]?.transcript) return;
  const sents = sentences(l[0].transcript);
  const words = await q<{ id: number; hanzi: string }>("select id, hanzi from vocab where lesson_id = $1 and example = ''", [lessonId]);
  for (const w of words) {
    const ex = examplesFor(w.hanzi, sents, 1)[0];
    if (ex) await q("update vocab set example = $1 where id = $2", [ex, w.id]);
  }
}

export async function saveTranscript(f: FormData) {
  await requireUser();
  const id = Number(f.get("id"));
  await q("update lessons set transcript = $1 where id = $2", [cleanTranscript(String(f.get("transcript") ?? "")), id]);
  await fillExamples(id);
  refresh();
}

// ---------- vocabulary ----------

export async function addVocab(f: FormData) {
  await requireUser();
  const hanzi = str(f, "hanzi");
  if (!hanzi) return;
  const lessonId = Number(f.get("lesson_id")) || null;
  await q(
    "insert into vocab (lesson_id, hanzi, pinyin, meaning) values ($1,$2,$3,$4) on conflict (hanzi) do nothing",
    [lessonId, hanzi, str(f, "pinyin") || autoPinyin(hanzi), str(f, "meaning")]
  );
  if (lessonId) await fillExamples(lessonId);
  refresh();
}

export async function updateVocab(f: FormData) {
  await requireUser();
  const hanzi = str(f, "hanzi");
  if (!hanzi) return;
  try {
    await q("update vocab set hanzi = $1, pinyin = $2, meaning = $3, example = $4 where id = $5", [
      hanzi, str(f, "pinyin") || autoPinyin(hanzi), str(f, "meaning"), str(f, "example"), Number(f.get("id")),
    ]);
  } catch (e) {
    if ((e as { code?: string }).code !== "23505") throw e; // another entry already has this word: leave unchanged
  }
  refresh();
}

export async function deleteVocab(f: FormData) {
  await requireUser();
  await q("delete from vocab where id = $1", [Number(f.get("id"))]);
  refresh();
}

// ---------- homework ----------

export async function addHomework(f: FormData) {
  const user = await requireUser();
  const task = str(f, "task");
  if (!task) return;
  const due = str(f, "due");
  await q("insert into homework (lesson_id, task, due_date, created_by) values ($1,$2,$3,$4)", [
    Number(f.get("lesson_id")) || null, task, isDate(due) ? due : null, user.id,
  ]);
  refresh();
}

export async function toggleHomework(f: FormData) {
  await requireUser();
  await q("update homework set done = not done, done_at = case when done then null else now() end where id = $1", [Number(f.get("id"))]);
  refresh();
}

export async function saveHomeworkNote(f: FormData) {
  const user = await requireUser();
  const col = user.role === "teacher" ? "teacher_feedback" : "student_note";
  await q(`update homework set ${col} = $1 where id = $2`, [str(f, "note"), Number(f.get("id"))]);
  refresh();
}

export async function deleteHomework(f: FormData) {
  await requireUser();
  await q("delete from homework where id = $1", [Number(f.get("id"))]);
  refresh();
}
