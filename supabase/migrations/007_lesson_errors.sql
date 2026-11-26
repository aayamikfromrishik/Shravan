-- 007: remember why a lesson could not be written, so the admin panel can explain it and retry sensibly.
alter table chapter_versions add column if not exists error text;
