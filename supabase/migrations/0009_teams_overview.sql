-- =====================================================================
-- 0009_teams_overview.sql
--
-- A read-only PUBLIC showcase of the derived Teams data, so every signed-in
-- user can view the full Teams page (groups -> their projects -> the people
-- on those projects) — exactly like the admin view — while the base-table
-- RLS lockdown (private boards, tasks, reports, attendance) stays intact.
--
--   * Exposes ONLY display fields: project name + each member's
--     name / initials / role. No task, board, report or attendance data.
--   * Sourced live from the real tables, so it stays a single source of
--     truth (no drift). Writes are unaffected — still admin-only on the
--     real tables. Members have no edit UI and admin-only write RLS.
--
-- SECURITY: the view runs as its owner (postgres, which bypasses RLS) — this
-- is INTENTIONAL and safe here because the view returns only the curated,
-- non-sensitive showcase columns and is granted read to authenticated only.
-- =====================================================================

create or replace view public.teams_overview
with (security_invoker = false)
as
select
  p.team_id,
  p.id       as project_id,
  p.name     as project_name,
  i.id       as intern_id,
  i.name     as intern_name,
  i.initials as intern_initials,
  i.role     as intern_role
from public.projects p
left join public.project_interns pi on pi.project_id = p.id
left join public.interns i on i.id = pi.intern_id
where p.team_id is not null;

revoke all on public.teams_overview from anon;
grant select on public.teams_overview to authenticated;

-- Refresh PostgREST so the view is queryable immediately.
notify pgrst, 'reload schema';
