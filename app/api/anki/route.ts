import { NextRequest } from "next/server";
import { getUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { buildApkg, type AnkiCard } from "@/lib/anki";

export async function GET(req: NextRequest) {
  if (!(await getUser())) return new Response("Log in first.", { status: 401 });
  const lesson = Number(req.nextUrl.searchParams.get("lesson")) || null;
  const rows = await q<{ id: number; hanzi: string; pinyin: string; meaning: string; example: string; lesson_id: number | null; d: string | null; title: string | null }>(
    `select v.id, v.hanzi, v.pinyin, v.meaning, v.example, v.lesson_id, to_char(l.lesson_date, 'YYYY-MM-DD') as d, l.title
     from vocab v left join lessons l on l.id = v.lesson_id
     where v.meaning <> '' and ($1::int is null or v.lesson_id = $1)
     order by l.lesson_date nulls last, v.id`,
    [lesson]
  );
  if (rows.length === 0) return new Response("No words with a meaning to export yet.", { status: 404 });
  const cards: AnkiCard[] = rows.map((r) => ({
    id: r.id, hanzi: r.hanzi, pinyin: r.pinyin, meaning: r.meaning, example: r.example,
    lessonId: r.lesson_id, lessonLabel: r.lesson_id ? `${r.d} ${r.title}` : "",
  }));
  const bytes = await buildApkg(cards);
  const name = lesson ? `mandarin-lesson-${rows[0].d}.apkg` : "mandarin-all-lessons.apkg";
  return new Response(Buffer.from(bytes), {
    headers: { "Content-Type": "application/octet-stream", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" },
  });
}
