-- =====================================================================
-- 0007_attendance_rls.sql
--
-- RLS for the attendance tables. Mirrors the existing lockdown style
-- (is_admin() OR is_member_of(...)). Writes to sessions/amendments happen
-- only through SECURITY DEFINER functions, so those tables get NO write
-- policy (RLS-enabled with no policy = denied for authenticated).
--
-- The member self-mark INSERT policy on attendance_records is the core
-- time-window lock. No member UPDATE/DELETE policy exists — ticks are final.
--
-- Reversible: supabase/rollback/0007_rollback.sql.
-- =====================================================================

alter table public.standup_sessions      enable row level security;
alter table public.attendance_records    enable row level security;
alter table public.attendance_amendments enable row level security;

-- --- standup_sessions: read within your projects ----------------------
drop policy if exists sessions_select on public.standup_sessions;
create policy sessions_select on public.standup_sessions
  for select to authenticated
  using (public.is_admin() or public.is_member_of(project_id));

-- --- attendance_records: read within your projects --------------------
drop policy if exists attn_select on public.attendance_records;
create policy attn_select on public.attendance_records
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.standup_sessions s
      where s.id = attendance_records.session_id
        and public.is_member_of(s.project_id)
    )
  );

-- --- attendance_records: member self-mark (the time-window lock) -------
-- INSERT only. All of: window open; caller is a project member; the
-- intern_id is the caller's OWN linked intern; status='present';
-- marked_by = auth.uid(); intern was assigned on/before the session.
drop policy if exists attn_member_insert on public.attendance_records;
create policy attn_member_insert on public.attendance_records
  for insert to authenticated
  with check (
    status = 'present'
    and marked_by = auth.uid()
    and exists (
      select 1
        from public.standup_sessions s
        join public.interns  i  on i.id = attendance_records.intern_id
        join public.profiles pr on pr.moodle_user_id = i.moodle_user_id
       where s.id = attendance_records.session_id
         and pr.id = auth.uid()
         and pr.is_active
         and i.moodle_user_id is not null
         and now() >= s.starts_at
         and now() <= s.ends_at
         and public.is_member_of(s.project_id)
         and exists (
           select 1 from public.project_interns pi
            where pi.project_id = s.project_id
              and pi.intern_id  = i.id
              and pi.assigned_at <= s.starts_at
         )
    )
  );
-- Deliberately NO member update/delete policy: a tick is final for members.
-- Admin corrections flow through admin_amend_attendance() (SECURITY DEFINER).

-- --- attendance_amendments: admin read only ---------------------------
drop policy if exists amend_admin_select on public.attendance_amendments;
create policy amend_admin_select on public.attendance_amendments
  for select to authenticated
  using (public.is_admin());

notify pgrst, 'reload schema';
