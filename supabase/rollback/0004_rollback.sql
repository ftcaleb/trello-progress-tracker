-- Rollback for 0004_attendance_schema.sql (reverse dependency order).
drop table if exists public.attendance_amendments;
drop table if exists public.attendance_records;
drop table if exists public.standup_sessions;
alter table public.project_interns drop column if exists assigned_at;
alter table public.projects drop column if exists initial_meet_date;
notify pgrst, 'reload schema';
