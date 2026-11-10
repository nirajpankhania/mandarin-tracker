import { requireUser } from "@/lib/auth";
import { Hero } from "@/components/Hero";
import { changePassword } from "@/app/actions";

export default async function Account({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const user = await requireUser();
  const { msg } = await searchParams;
  return (
    <>
    <Hero overline={user.role} title={user.name} />
    <section className="band"><div className="wrap"><div className="max-w-md">
      <form action={changePassword} className="card p-5 space-y-4">
        <h3>Change password</h3>
        <label className="field"><span className="eyebrow">Current password</span><input className="inp" type="password" name="current" required /></label>
        <label className="field"><span className="eyebrow">New password</span><input className="inp" type="password" name="next" minLength={8} required /></label>
        {msg && <p className="text-sm">{msg}</p>}
        <button className="btn">Change password</button>
      </form>
    </div></div></section>
    </>
  );
}
