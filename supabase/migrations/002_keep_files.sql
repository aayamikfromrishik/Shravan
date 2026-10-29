-- SHRAVAN update 2: keep the original book files (PDF / EPUB / text) so they can be downloaded later.
-- Run once in Supabase → SQL Editor. Safe to run again.

create table if not exists book_files (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references books(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade, -- who uploaded it; empty for library copies
  store text not null check (store in ('r2','supabase')),   -- where the file lives
  key text not null,                                        -- its path in that store
  file_name text not null,
  content_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);
create index if not exists book_files_book_idx on book_files(book_id);
alter table book_files enable row level security;

-- Private Supabase storage for kept files, used until Cloudflare R2 is connected.
insert into storage.buckets (id, name, public, file_size_limit)
values ('files', 'files', false, 52428800)
on conflict (id) do nothing;
