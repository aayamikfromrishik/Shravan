-- SHRAVAN database schema
-- Run once in Supabase: SQL Editor > New query > paste > Run.
-- Safe to run again: everything uses "if not exists".
-- All reads and writes go through the app's server (service role),
-- so row-level security is switched on with no public policies.

create extension if not exists pgcrypto;

-- ---------- learners ----------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  view text not null default 'basic' check (view in ('basic','peacock')),
  default_language text not null default 'mix' check (default_language in ('english','hindi','mix')),
  default_level text not null default 'normal' check (default_level in ('basic','normal','advanced')),
  default_mode text not null default 'examples' check (default_mode in ('key','examples','complete')),
  plan text not null default 'free' check (plan in ('free','subscriber')),
  subscribed_until timestamptz,
  notifications_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- ---------- books ----------
create table if not exists books (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  title text not null,
  author text,
  edition text,                       -- translation / edition taught
  language text not null default 'English',
  subject text check (subject in ('habits','mind','work','communication','business','spiritual','classics','lives','indian','history')),
  kind text not null default 'text' check (kind in ('text','readalong')),
  is_library boolean not null default false,   -- shown to everyone in the library
  published boolean not null default false,    -- library books: visible only when published
  needs_own_copy boolean not null default false, -- modern books: learner must upload or use Read-along
  buy_url text,
  rights text check (rights in ('public_domain','own_work','permission')),
  source_url text,
  source_type text check (source_type in ('pdf','epub','text','none')),
  fingerprint text unique,            -- hash of the normalised text; same edition = same book
  page_count int,
  word_count int,
  status text not null default 'ready' check (status in ('processing','ready','scanned','locked','failed','no_text')),
  status_note text,
  free_until timestamptz,             -- admin made the whole book free until this time
  free_reminder_sent boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists chapters (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references books(id) on delete cascade,
  idx int not null,                   -- 1-based order
  title text not null,
  body text not null default '',      -- the chapter's real text (never shown in full to learners)
  free_text text,                     -- chapter 1 only: the free part (max 7 pages)
  start_page int,
  end_page int,
  word_count int not null default 0,
  unique (book_id, idx)
);

-- One saved lesson per chapter x part x mode x level x language. Written once, reused by every owner.
create table if not exists chapter_versions (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references chapters(id) on delete cascade,
  part text not null default 'full' check (part in ('free','full')),
  mode text not null check (mode in ('key','examples','complete')),
  level text not null check (level in ('basic','normal','advanced')),
  lang text not null check (lang in ('english','hindi','mix')),
  status text not null default 'generating' check (status in ('generating','ready','failed')),
  content jsonb,
  removed_quotes int not null default 0,     -- quotes dropped by the word-for-word check
  input_tokens int, output_tokens int,
  flagged boolean not null default false,
  flag_note text,
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  unique (chapter_id, part, mode, level, lang)
);

-- Which learner owns which uploaded / read-along book (library books need no row).
create table if not exists user_books (
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references books(id) on delete cascade,
  mode text not null default 'examples',
  level text not null default 'normal',
  lang text not null default 'mix',
  current_chapter int not null default 1,
  current_step text not null default 'listen',
  last_opened_at timestamptz not null default now(),
  added_at timestamptz not null default now(),
  primary key (user_id, book_id)
);

-- Lifetime free previews: max 5 books per learner.
create table if not exists free_previews (
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references books(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, book_id)
);

create table if not exists progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  chapter_id uuid not null references chapters(id) on delete cascade,
  listened boolean not null default false,
  speech_position int not null default 0,     -- sentence index for the phone voice
  quick_check text check (quick_check in ('right','missed','skipped')),
  completed boolean not null default false,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, chapter_id)
);

-- Private journal. Never shown to anyone else, admin included.
create table if not exists reflections (
  user_id uuid not null references auth.users(id) on delete cascade,
  chapter_id uuid not null references chapters(id) on delete cascade,
  q_index int not null,
  question text not null,
  answer text,
  skipped boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, chapter_id, q_index)
);

create table if not exists actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references books(id) on delete cascade,
  chapter_id uuid references chapters(id) on delete cascade,
  text text not null,
  source text not null check (source in ('book','shravan')),
  because text,
  is_first boolean not null default false,
  done boolean not null default false,
  done_at timestamptz,
  remind_at text,                     -- e.g. "20:00"
  created_at timestamptz not null default now()
);

create table if not exists book_plans (
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references books(id) on delete cascade,
  content jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, book_id)
);

-- "Ask about this chapter": answers are reused when the same question comes again.
create table if not exists ask_answers (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references chapters(id) on delete cascade,
  part text not null,
  level text not null,
  lang text not null,
  question_key text not null,
  question text not null,
  answer text not null,
  found_in_chapter boolean not null default true,
  created_at timestamptz not null default now(),
  unique (chapter_id, part, level, lang, question_key)
);

create table if not exists ask_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  chapter_id uuid not null references chapters(id) on delete cascade,
  count int not null default 0,
  primary key (user_id, chapter_id)
);

-- Read-along conversations (built from the learner's own notes).
create table if not exists readalong_turns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  chapter_id uuid not null references chapters(id) on delete cascade,
  role text not null check (role in ('learner','shravan')),
  text text not null,
  created_at timestamptz not null default now()
);

-- Notices to learners (book made free, reminders). user_id null = everyone.
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  link text,
  book_id uuid references books(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);

-- AI usage log for the admin's "Usage & costs" view.
create table if not exists usage_log (
  id bigint generated always as identity primary key,
  kind text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  cache_read_tokens int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists chapters_book_idx on chapters(book_id, idx);
create index if not exists versions_chapter_idx on chapter_versions(chapter_id);
create index if not exists actions_user_idx on actions(user_id, created_at desc);
create index if not exists notifications_created_idx on notifications(created_at desc);
create index if not exists readalong_idx on readalong_turns(user_id, chapter_id, created_at);
create index if not exists books_library_idx on books(is_library, subject);

alter table profiles enable row level security;
alter table books enable row level security;
alter table chapters enable row level security;
alter table chapter_versions enable row level security;
alter table user_books enable row level security;
alter table free_previews enable row level security;
alter table progress enable row level security;
alter table reflections enable row level security;
alter table actions enable row level security;
alter table book_plans enable row level security;
alter table ask_answers enable row level security;
alter table ask_usage enable row level security;
alter table readalong_turns enable row level security;
alter table notifications enable row level security;
alter table push_subscriptions enable row level security;
alter table usage_log enable row level security;

-- Private storage bucket for uploads (files are deleted once their text is extracted).
insert into storage.buckets (id, name, public, file_size_limit)
values ('uploads', 'uploads', false, 31457280)
on conflict (id) do nothing;

-- ---------- Update 2: kept book files (also in supabase/migrations/002_keep_files.sql) ----------
create table if not exists book_files (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references books(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  store text not null check (store in ('r2','supabase')),
  key text not null,
  file_name text not null,
  content_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);
create index if not exists book_files_book_idx on book_files(book_id);
alter table book_files enable row level security;
insert into storage.buckets (id, name, public, file_size_limit)
values ('files', 'files', false, 52428800)
on conflict (id) do nothing;

-- ---------- Update 3: AI narrator voice (also in supabase/migrations/003_voice.sql) ----------

-- App-wide settings the admin can change (e.g. the narrator voices and the monthly voice budget).
create table if not exists app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table app_settings enable row level security;

-- Narrated audio for a lesson version: made once, saved (Cloudflare R2), reused for every learner.
create table if not exists lesson_audio (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references chapter_versions(id) on delete cascade,
  voice text not null,                         -- speaker + pace, e.g. "roopa_hi_narration@1"
  status text not null default 'generating' check (status in ('generating','ready','failed')),
  parts jsonb,                                 -- [{store, key, start, end, chars}] in playing order
  chars int not null default 0,
  error text,
  created_at timestamptz not null default now(),
  unique (version_id, voice)
);
create index if not exists lesson_audio_version_idx on lesson_audio(version_id);
alter table lesson_audio enable row level security;

-- Voice usage is counted in characters.
alter table usage_log add column if not exists chars int not null default 0;

-- ---------- Update 5: reading journey (also in supabase/migrations/005_journey.sql) ----------
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
