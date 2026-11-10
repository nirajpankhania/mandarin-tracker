export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { setup } from "@/app/actions";
import { userCount } from "@/lib/db";

export default async function Setup({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if ((await userCount()) > 0) redirect("/login");
  const { error } = await searchParams;
  const person = (role: "student" | "teacher", title: string) => (
    <fieldset className="card p-5 space-y-4">
      <legend className="sr-only">{title}</legend>
      <h3>{title}</h3>
      <label className="field">
        <span className="eyebrow">Name</span>
        <input className="inp" name={`${role}_name`} required />
      </label>
      <label className="field">
        <span className="eyebrow">Email</span>
        <input className="inp" type="email" name={`${role}_email`} required />
      </label>
      <label className="field">
        <span className="eyebrow">Password</span>
        <input className="inp" type="password" name={`${role}_password`} minLength={8} required />
      </label>
    </fieldset>
  );
  return (
    <main className="min-h-screen bg-gold">
      <div className="mx-auto max-w-2xl px-5 pt-14 pb-24 rise">
        <p className="eyebrow eyebrow-accent">First-time setup</p>
        <h1 className="mt-3">Create the two accounts</h1>
        <p className="mt-4 max-w-prose">
          This page works once. It sets up the database and one login each for you and your teacher. Give your
          teacher a starter password; they can change it after logging in.
        </p>
        <form action={setup} className="frame mt-10 space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            {person("student", "You, the student")}
            {person("teacher", "Your teacher")}
          </div>
          {error && <p className="card p-3 text-rust text-sm">{error}</p>}
          <button className="btn">Create accounts</button>
        </form>
      </div>
    </main>
  );
}
