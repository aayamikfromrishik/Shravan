-- SHRAVAN update 4: four more library sections. Run once in Supabase → SQL Editor. Safe to run again.
alter table books drop constraint if exists books_subject_check;
alter table books add constraint books_subject_check
  check (subject in ('habits','mind','work','communication','business','spiritual','classics','lives','indian','history'));
