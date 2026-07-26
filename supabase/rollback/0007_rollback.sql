-- Rollback for 0007_attendance_rls.sql
drop policy if exists sessions_select      on public.standup_sessions;
drop policy if exists attn_select          on public.attendance_records;
drop policy if exists attn_member_insert   on public.attendance_records;
drop policy if exists amend_admin_select   on public.attendance_amendments;
alter table public.standup_sessions      disable row level security;
alter table public.attendance_records    disable row level security;
alter table public.attendance_amendments disable row level security;
notify pgrst, 'reload schema';
