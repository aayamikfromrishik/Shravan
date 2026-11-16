-- SHRAVAN update 6: Drive mode. Run once in Supabase → SQL Editor. Safe to run again.
-- A learner can listen chapter after chapter and answer the questions later (up to 10 chapters waiting).
alter table profiles add column if not exists drive_mode boolean not null default false;
alter table progress add column if not exists questions_pending boolean not null default false;
create index if not exists progress_pending_idx on progress(user_id) where questions_pending;
