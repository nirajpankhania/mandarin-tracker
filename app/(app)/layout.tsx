import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { logout } from "@/app/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-gold sticky top-0 z-10">
        <div className="wrap py-4 flex flex-wrap items-baseline gap-x-8 gap-y-1">
          <Link href="/" className="font-serif text-2xl hover:no-underline">
            <span className="hanzi">中文</span> lessons
          </Link>
          <nav className="flex gap-5 text-sm font-medium tracking-wide">
            <Link href="/">Lessons</Link>
            <Link href="/vocab">Vocabulary</Link>
            <Link href="/homework">Homework</Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="site">
        <div className="wrap py-8 flex flex-wrap items-baseline gap-x-8 gap-y-2 text-sm">
          <span className="eyebrow">Logged in as {user.name}</span>
          <Link href="/account">Change password</Link>
          <form action={logout}><button className="cursor-pointer hover:underline">Log out</button></form>
          <span className="ml-auto hanzi text-xl" lang="zh">加油</span>
        </div>
      </footer>
    </div>
  );
}
