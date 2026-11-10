export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { login } from "@/app/actions";
import { userCount } from "@/lib/db";
import { getUser } from "@/lib/auth";

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if ((await userCount()) === 0) redirect("/setup");
  if (await getUser()) redirect("/");
  const { error } = await searchParams;
  return (
    <main className="min-h-screen bg-gold">
      <div className="mx-auto max-w-md px-5 pt-16 pb-24 rise">
        <p className="eyebrow eyebrow-accent">Mandarin lessons</p>
        <h1 className="mt-3">
          <span className="hanzi">你好</span>, welcome back
        </h1>
        <div className="frame mt-10">
          <form action={login} className="card p-5 space-y-4">
            <label className="field">
              <span className="eyebrow">Email</span>
              <input className="inp" type="email" name="email" autoComplete="email" required />
            </label>
            <label className="field">
              <span className="eyebrow">Password</span>
              <input className="inp" type="password" name="password" autoComplete="current-password" required />
            </label>
            {error && <p className="text-rust text-sm">That email and password don&apos;t match. Try again.</p>}
            <button className="btn">Log in</button>
          </form>
        </div>
      </div>
    </main>
  );
}
