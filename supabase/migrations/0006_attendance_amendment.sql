-- =====================================================================
-- 0006_attendance_amendment.sql
--
-- Admin correction path. SECURITY DEFINER + is_admin() gate. Writes an
-- audit row and adjusts the record in ONE transaction.
--
--   * old_status is derived truthfully, including 'na' (amendment #2):
--       record exists            -> 'present'
--       assigned on/before start -> 'absent'
--       otherwise (or no assign) -> 'na'
--   * The pre-change record's marked_at/marked_by are snapshotted into the
--     amendment BEFORE any delete, so the original self-tick is never lost
--     (amendment #1).
--
-- Reversible: supabase/rollback/0006_rollback.sql.
-- =====================================================================

create or replace function public.admin_amend_attendance(
  p_session_id uuid,
  p_intern_id  uuid,
  p_new_status text,
  p_reason     text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old           text;
  v_starts        timestamptz;
  v_project       uuid;
  v_assigned      timestamptz;
  v_old_marked_at timestamptz;
  v_old_marked_by uuid;
  v_has_record    boolean;
  v_has_assign    boolean;
begin
  if not public.is_admin() then
    raise exception 'admins only';
  end if;
  if p_new_status not in ('present', 'absent') then
    raise exception 'invalid status %', p_new_status;
  end if;

  select project_id, starts_at into v_project, v_starts
    from public.standup_sessions where id = p_session_id;
  if v_starts is null then
    raise exception 'session % not found', p_session_id;
  end if;

  -- Snapshot the existing record (if any) before we change anything.
  select marked_at, marked_by into v_old_marked_at, v_old_marked_by
    from public.attendance_records
   where session_id = p_session_id and intern_id = p_intern_id;
  v_has_record := found;

  if v_has_record then
    v_old := 'present';
  else
    select assigned_at into v_assigned
      from public.project_interns
     where project_id = v_project and intern_id = p_intern_id;
    v_has_assign := found;
    if v_has_assign and v_assigned <= v_starts then
      v_old := 'absent';
    else
      v_old := 'na';   -- not assigned yet at session time, or no assignment row
    end if;
  end if;

  if v_old = p_new_status then
    return;  -- no-op
  end if;

  insert into public.attendance_amendments
      (session_id, intern_id, old_status, new_status,
       old_marked_at, old_marked_by, changed_by, reason)
  values
      (p_session_id, p_intern_id, v_old, p_new_status,
       v_old_marked_at, v_old_marked_by, auth.uid(), p_reason);

  if p_new_status = 'present' then
    insert into public.attendance_records (session_id, intern_id, status, marked_by, marked_at)
    values (p_session_id, p_intern_id, 'present', auth.uid(), now())
    on conflict (session_id, intern_id) do nothing;
  else
    delete from public.attendance_records
     where session_id = p_session_id and intern_id = p_intern_id;
  end if;
end;
$$;

revoke all on function public.admin_amend_attendance(uuid, uuid, text, text) from public;
grant execute on function public.admin_amend_attendance(uuid, uuid, text, text) to authenticated;
