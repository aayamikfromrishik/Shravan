-- SHRAVAN update 3: AI narrator voice (Sarvam). Run once in Supabase → SQL Editor. Safe to run again.

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
