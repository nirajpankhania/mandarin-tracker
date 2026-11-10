import { Pool } from "pg";

const g = globalThis as unknown as { _pool?: Pool };

function pool(): Pool {
  if (!g._pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set. Add your Neon connection string.");
    g._pool = new Pool({ connectionString: url, max: Number(process.env.PG_POOL_MAX ?? 3) });
  }
  return g._pool;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function q<T = any>(text: string, params: unknown[] = []): Promise<T[]> {
  const r = await pool().query(text, params);
  return r.rows as T[];
}

const SCHEMA = `
create table if not exists users (
  id serial primary key,
  name text not null,
  email text not null unique,
  password_hash text not null,
  role text not null check (role in ('student','teacher')),
  created_at timestamptz not null default now()
);
create table if not exists lessons (
  id serial primary key,
  lesson_date date not null,
  title text not null,
  notes text not null default '',
  slides jsonb not null default '[]',
  slides_filename text,
  transcript text not null default '',
  created_by int references users(id),
  created_at timestamptz not null default now()
);
create table if not exists vocab (
  id serial primary key,
  lesson_id int references lessons(id) on delete set null,
  hanzi text not null unique,
  pinyin text not null default '',
  meaning text not null default '',
  example text not null default '',
  created_at timestamptz not null default now()
);
create table if not exists homework (
  id serial primary key,
  lesson_id int references lessons(id) on delete cascade,
  task text not null,
  due_date date,
  done boolean not null default false,
  done_at timestamptz,
  student_note text not null default '',
  teacher_feedback text not null default '',
  created_by int references users(id),
  created_at timestamptz not null default now()
);
`;

export async function ensureSchema() {
  for (const stmt of SCHEMA.split(";").map((s) => s.trim()).filter(Boolean)) {
    await q(stmt);
  }
}

export async function userCount(): Promise<number> {
  const t = await q<{ exists: boolean }>("select to_regclass('public.users') is not null as exists");
  if (!t[0].exists) return 0; // first run: tables not created yet
  const r = await q<{ n: string }>("select count(*) as n from users");
  return Number(r[0].n);
}
