-- =====================================================================
-- ROLLBACK SCRIPT FOR 0002_RLS_LOCKDOWN
-- To execute: Apply this SQL in the Supabase Dashboard SQL Editor
-- =====================================================================

-- 1. Drop new RLS Policies
drop policy if exists projects_select on public.projects;
drop policy if exists projects_insert on public.projects;
drop policy if exists projects_update on public.projects;
drop policy if exists projects_delete on public.projects;

drop policy if exists phases_select on public.phases;
drop policy if exists phases_insert on public.phases;
drop policy if exists phases_update on public.phases;
drop policy if exists phases_delete on public.phases;

drop policy if exists tasks_select on public.tasks;
drop policy if exists tasks_insert on public.tasks;
drop policy if exists tasks_update on public.tasks;
drop policy if exists tasks_delete on public.tasks;

drop policy if exists comments_select on public.comments;
drop policy if exists comments_insert on public.comments;
drop policy if exists comments_update on public.comments;
drop policy if exists comments_delete on public.comments;

drop policy if exists pi_select on public.project_interns;
drop policy if exists pi_insert on public.project_interns;
drop policy if exists pi_delete on public.project_interns;

drop policy if exists interns_select on public.interns;
drop policy if exists interns_insert on public.interns;
drop policy if exists interns_update on public.interns;
drop policy if exists interns_delete on public.interns;

drop policy if exists reports_select on public.phase_reports;
drop policy if exists reports_insert on public.phase_reports;
drop policy if exists reports_update on public.phase_reports;
drop policy if exists reports_delete on public.phase_reports;


-- 3. Drop triggers
drop trigger if exists trg_task_rules_ins on public.tasks;
drop trigger if exists trg_task_rules_upd on public.tasks;
drop trigger if exists trg_task_rules_del on public.tasks;

-- 4. Drop trigger and helper functions
drop function if exists public.enforce_task_rules();
drop function if exists public.is_member_of_task(p_task_id uuid);

-- 5. Drop view
drop view if exists public.public_profiles;

-- 6. Drop column default values (optional but clean)
alter table public.tasks    alter column created_by drop default;
alter table public.comments alter column created_by drop default;

-- 7. Restore original blanket auth_all policies
drop policy if exists auth_all on public.projects;
create policy auth_all on public.projects for all to authenticated using (true) with check (true);

drop policy if exists auth_all on public.phases;
create policy auth_all on public.phases for all to authenticated using (true) with check (true);

drop policy if exists auth_all on public.tasks;
create policy auth_all on public.tasks for all to authenticated using (true) with check (true);

drop policy if exists auth_all on public.comments;
create policy auth_all on public.comments for all to authenticated using (true) with check (true);

drop policy if exists auth_all on public.interns;
create policy auth_all on public.interns for all to authenticated using (true) with check (true);

drop policy if exists auth_all on public.project_interns;
create policy auth_all on public.project_interns for all to authenticated using (true) with check (true);

drop policy if exists auth_all on public.phase_reports;
create policy auth_all on public.phase_reports for all to authenticated using (true) with check (true);

