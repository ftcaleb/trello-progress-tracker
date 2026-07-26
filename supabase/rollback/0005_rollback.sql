-- Rollback for 0005_attendance_generation.sql
drop trigger if exists trg_project_standup on public.projects;
drop function if exists public.on_project_standup_change();
drop function if exists public.generate_standup_sessions(uuid);
