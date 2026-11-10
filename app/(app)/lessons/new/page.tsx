import { requireUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { today } from "@/lib/format";
import { Hero } from "@/components/Hero";
import { NewLessonForm } from "@/components/NewLessonForm";

// reading slides calls the AI parser, which can take a while
export const maxDuration = 60;

export default async function NewLesson() {
  await requireUser();
  const known = (await q<{ hanzi: string }>("select hanzi from vocab")).map((r) => r.hanzi);
  return (
    <>
      <Hero title="Add a lesson" />
      <section className="band"><div className="wrap"><div className="max-w-3xl"><NewLessonForm known={known} today={today()} /></div></div></section>
    </>
  );
}
