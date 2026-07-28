-- =====================================================================
-- 0008_project_team_link.sql
--
-- Connect the standalone "Teams showcase" to REAL projects so the whole
-- tracker shares ONE source of truth (Option A — derived groups).
--
--   * Adds projects.team_id  -> a real link from a project to its group.
--   * Best-effort migrates the old free-text team_projects labels and the
--     team_members roster into real links / assignments (NON-destructive).
--   * Adds public.delete_project(uuid): a clean, atomic, admin-only project
--     delete that removes phases, tasks, comments, assignments, sessions,
--     attendance and reports, then the project itself.
--   * Leaves the legacy team_projects / team_members tables IN PLACE (the
--     app stops using them) so nothing is lost. An optional cleanup script
--     at the bottom (commented out) drops them once you've verified.
--
-- SAFETY: additive + idempotent. Existing RLS on projects already allows
-- admin insert/update/delete (0002), so NO new project policies are needed.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. The link. A project belongs to at most one group; deleting a group
--    just unassigns its projects (they are never deleted or orphaned).
-- ---------------------------------------------------------------------
alter table public.projects
  add column if not exists team_id uuid
  references public.teams(id) on delete set null;

create index if not exists projects_team_idx on public.projects (team_id);

-- ---------------------------------------------------------------------
-- 2. Best-effort: adopt the old team_projects labels as real links,
--    matching a real project to the group it was labelled under by name
--    (case-insensitive, trimmed). Only fills blanks — never overwrites.
-- ---------------------------------------------------------------------
update public.projects p
set team_id = tp.team_id
from public.team_projects tp
where p.team_id is null
  and lower(btrim(p.name)) = lower(btrim(tp.name));

-- ---------------------------------------------------------------------
-- 3. Best-effort: preserve your group rosters by turning existing team
--    memberships into real project assignments, for the projects that
--    were just linked to each group. Idempotent.
--    (Omit this block if you would rather assign devs from scratch.)
-- ---------------------------------------------------------------------
insert into public.project_interns (project_id, intern_id)
select distinct p.id, tm.intern_id
from public.team_members tm
join public.projects p on p.team_id = tm.team_id
where tm.intern_id is not null
  and not exists (
    select 1 from public.project_interns pi
    where pi.project_id = p.id and pi.intern_id = tm.intern_id
  );

-- ---------------------------------------------------------------------
-- 4. Clean, atomic, admin-only project delete. Called from the app via
--    supabase.rpc('delete_project', { p_id }). Guards on is_admin() and
--    removes every child before the project so no FK can block it.
-- ---------------------------------------------------------------------
create or replace function public.delete_project(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  delete from public.comments c
    using public.tasks t
    where c.task_id = t.id and t.project_id = p_id;
  delete from public.tasks            where project_id = p_id;
  delete from public.phase_reports    where project_id = p_id;
  delete from public.project_interns  where project_id = p_id;
  delete from public.standup_sessions where project_id = p_id; -- attendance cascades
  delete from public.phases           where project_id = p_id;
  delete from public.projects         where id = p_id;
end;
$$;

revoke all on function public.delete_project(uuid) from public;
grant execute on function public.delete_project(uuid) to authenticated;

-- Refresh PostgREST so the new column + function are usable immediately.
notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------
-- 5. OPTIONAL cleanup — run only AFTER you've verified the new flow.
--    Drops the now-unused legacy showcase tables.
-- ---------------------------------------------------------------------
-- drop table if exists public.team_members;
-- drop table if exists public.team_projects;
