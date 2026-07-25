-- =====================================================================
-- Step 1: Helper function for checking task membership (prevents recursion)
-- =====================================================================
create or replace function public.is_member_of_task(p_task_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.tasks t
    where t.id = p_task_id and public.is_member_of(t.project_id)
  );
$$;

-- =====================================================================
-- Step 2: Author default values
-- =====================================================================
alter table public.tasks    alter column created_by set default auth.uid();
alter table public.comments alter column created_by set default auth.uid();

-- =====================================================================
-- Step 3: public_profiles view (safe display of username/fullname)
-- =====================================================================
create or replace view public.public_profiles as
  select id, full_name, moodle_username
  from public.profiles;

grant select on public.public_profiles to authenticated;
revoke all on public.public_profiles from anon;

-- =====================================================================
-- Step 4: Tasks business rules trigger (INSERT + UPDATE + DELETE)
-- =====================================================================
create or replace function public.enforce_task_rules()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  changed_other_cols boolean;
begin
  -- Bypassed for administrative operations (CLI/SQL Editor/Edge Functions)
  if auth.uid() is null then
    return coalesce(new, old);
  end if;

  if public.is_admin() then
    return coalesce(new, old);
  end if;

  -- ===== member (intern) rules from here down =====

  if tg_op = 'INSERT' then
    -- D1: Force safe status + auth user as creator
    if new.status is null or new.status not in ('in_progress', 'blocked') then
      new.status := 'in_progress';
    end if;
    new.created_by := auth.uid();
    
    -- Ensure the phase belongs to the project
    if not exists (
      select 1 from public.phases p
      where p.id = new.phase_id and p.project_id = new.project_id
    ) then
      raise exception 'phase does not belong to the target project';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    -- D2: Approved tasks are fully locked
    if old.status = 'approved' then
      raise exception 'approved tasks are locked; ask an admin';
    end if;
    
    -- D3: Changing phase/project is admin-only
    if new.phase_id is distinct from old.phase_id or new.project_id is distinct from old.project_id then
      raise exception 'only admins can move tasks between phases';
    end if;
    
    -- D2: Interns can only set status to in_progress or blocked
    if new.status not in ('in_progress', 'blocked') then
      raise exception 'members can only set in_progress or blocked';
    end if;
    
    -- Cannot spoof or change author
    if new.created_by is distinct from old.created_by then
      raise exception 'cannot change task author';
    end if;
    
    -- D4: Interns can only edit other columns (title/description/position) if they created the task
    changed_other_cols :=
      (to_jsonb(new) - 'status' - 'updated_at' - 'created_at')
      is distinct from
      (to_jsonb(old) - 'status' - 'updated_at' - 'created_at');
      
    if changed_other_cols and (old.created_by is distinct from auth.uid()) then
      raise exception 'members can only edit tasks they created';
    end if;
    
    return new;
  end if;

  if tg_op = 'DELETE' then
    -- D2: Approved tasks cannot be deleted by members
    if old.status = 'approved' then
      raise exception 'approved tasks cannot be deleted by members';
    end if;
    
    -- D4: Members can only delete tasks they created
    if old.created_by is distinct from auth.uid() then
      raise exception 'members can only delete tasks they created';
    end if;
    
    return old;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_task_rules_ins on public.tasks;
drop trigger if exists trg_task_rules_upd on public.tasks;
drop trigger if exists trg_task_rules_del on public.tasks;

create trigger trg_task_rules_ins before insert on public.tasks
  for each row execute function public.enforce_task_rules();
create trigger trg_task_rules_upd before update on public.tasks
  for each row execute function public.enforce_task_rules();
create trigger trg_task_rules_del before delete on public.tasks
  for each row execute function public.enforce_task_rules();

-- =====================================================================
-- Step 5: Enable Row Level Security (RLS)
-- =====================================================================
alter table public.projects enable row level security;
alter table public.phases enable row level security;
alter table public.tasks enable row level security;
alter table public.comments enable row level security;
alter table public.interns enable row level security;
alter table public.project_interns enable row level security;
alter table public.phase_reports enable row level security;

-- =====================================================================
-- Step 6: Drop existing blanket auth_all policies
-- =====================================================================
drop policy if exists auth_all on public.projects;
drop policy if exists auth_all on public.phases;
drop policy if exists auth_all on public.tasks;
drop policy if exists auth_all on public.comments;
drop policy if exists auth_all on public.interns;
drop policy if exists auth_all on public.project_interns;
drop policy if exists auth_all on public.phase_reports;

-- =====================================================================
-- Step 7: Define new RLS policies
-- =====================================================================

-- 7.1 PROJECTS
create policy projects_select on public.projects for select to authenticated
  using (public.is_admin() or public.is_member_of(id));
create policy projects_insert on public.projects for insert to authenticated
  with check (public.is_admin());
create policy projects_update on public.projects for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());
create policy projects_delete on public.projects for delete to authenticated
  using (public.is_admin());

-- 7.2 PHASES
create policy phases_select on public.phases for select to authenticated
  using (public.is_admin() or public.is_member_of(project_id));
create policy phases_insert on public.phases for insert to authenticated
  with check (public.is_admin());
create policy phases_update on public.phases for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());
create policy phases_delete on public.phases for delete to authenticated
  using (public.is_admin());

-- 7.3 TASKS
create policy tasks_select on public.tasks for select to authenticated
  using (public.is_admin() or public.is_member_of(project_id));
create policy tasks_insert on public.tasks for insert to authenticated
  with check (public.is_admin() or public.is_member_of(project_id));
create policy tasks_update on public.tasks for update to authenticated
  using (public.is_admin() or public.is_member_of(project_id))
  with check (public.is_admin() or public.is_member_of(project_id));
create policy tasks_delete on public.tasks for delete to authenticated
  using (public.is_admin() or public.is_member_of(project_id));

-- 7.4 COMMENTS
create policy comments_select on public.comments for select to authenticated
  using (public.is_admin() or public.is_member_of_task(task_id));
create policy comments_insert on public.comments for insert to authenticated
  with check (
    public.is_admin() or 
    (public.is_member_of_task(task_id) and created_by = auth.uid())
  );
create policy comments_update on public.comments for update to authenticated
  using (public.is_admin() or (created_by = auth.uid() and public.is_member_of_task(task_id)))
  with check (public.is_admin() or (created_by = auth.uid() and public.is_member_of_task(task_id)));
create policy comments_delete on public.comments for delete to authenticated
  using (public.is_admin() or (created_by = auth.uid() and public.is_member_of_task(task_id)));

-- 7.5 PROJECT_INTERNS
create policy pi_select on public.project_interns for select to authenticated
  using (public.is_admin() or public.is_member_of(project_id));
create policy pi_insert on public.project_interns for insert to authenticated
  with check (public.is_admin());
create policy pi_delete on public.project_interns for delete to authenticated
  using (public.is_admin());

-- 7.6 INTERNS
create policy interns_select on public.interns for select to authenticated
  using (
    public.is_admin() or 
    exists (
      select 1 from public.project_interns pi
      where pi.intern_id = interns.id and public.is_member_of(pi.project_id)
    )
  );
create policy interns_insert on public.interns for insert to authenticated
  with check (public.is_admin());
create policy interns_update on public.interns for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());
create policy interns_delete on public.interns for delete to authenticated
  using (public.is_admin());

-- 7.7 PHASE_REPORTS
create policy reports_select on public.phase_reports for select to authenticated
  using (public.is_admin() or public.is_member_of(project_id));
create policy reports_insert on public.phase_reports for insert to authenticated
  with check (public.is_admin());
create policy reports_update on public.phase_reports for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());
create policy reports_delete on public.phase_reports for delete to authenticated
  using (public.is_admin());

