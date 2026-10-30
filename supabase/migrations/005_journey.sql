-- SHRAVAN update 5: a learner's reading journey (their own order of books). Run once in Supabase → SQL Editor.
create table if not exists journeys (
  user_id uuid primary key references auth.users(id) on delete cascade,
  title text,
  keywords text,
  items jsonb not null default '[]',   -- [{ "bookId": "...", "why": "..." }] in reading order
  ai_day date,                          -- AI suggestions used today (fair-use limit)
  ai_count int not null default 0,
  updated_at timestamptz not null default now()
);
alter table journeys enable row level security;
