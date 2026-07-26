-- =====================================================================
-- 0003_teams_showcase.sql
--
-- A public-to-all-members "Teams" showcase, editable by admins only.
--
-- SAFETY CONTRACT:
--   * Fully ADDITIVE and IDEMPOTENT. Creates NEW objects only.
--   * Does NOT alter, drop, or change RLS on any existing table.
--   * Existing interns / projects / RLS lockdown are untouched.
--
-- Design notes:
--   * team_members carries its own display fields (name/initials/role)
--     so the showcase is readable by EVERY signed-in user without
--     depending on the (deliberately restrictive) interns RLS. intern_id
--     is a nullable link kept for provenance / future roster merges.
--   * SELECT is open to all authenticated users; writes are admin-only
--     via the existing public.is_admin() helper.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------
create table if not exists public.teams (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  position   int  not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.team_projects (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams(id) on delete cascade,
  name       text not null,
  position   int  not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.team_members (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams(id) on delete cascade,
  intern_id  uuid references public.interns(id) on delete set null,
  name       text not null,
  initials   text not null,
  role       text not null check (role in ('developer', 'designer', 'cybersecurity')),
  is_active  boolean not null default true,
  position   int  not null default 0,
  created_at timestamptz not null default now(),
  unique (team_id, intern_id)
);

create index if not exists team_projects_team_idx on public.team_projects (team_id);
create index if not exists team_members_team_idx  on public.team_members (team_id);

-- ---------------------------------------------------------------------
-- 2. RLS: readable by every signed-in user; writable by admins only.
-- ---------------------------------------------------------------------
alter table public.teams         enable row level security;
alter table public.team_projects enable row level security;
alter table public.team_members  enable row level security;

drop policy if exists teams_select on public.teams;
create policy teams_select on public.teams
  for select to authenticated using (true);
drop policy if exists teams_write on public.teams;
create policy teams_write on public.teams
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists team_projects_select on public.team_projects;
create policy team_projects_select on public.team_projects
  for select to authenticated using (true);
drop policy if exists team_projects_write on public.team_projects;
create policy team_projects_write on public.team_projects
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists team_members_select on public.team_members;
create policy team_members_select on public.team_members
  for select to authenticated using (true);
drop policy if exists team_members_write on public.team_members;
create policy team_members_write on public.team_members
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 3. Roster merge: add people who are new to the roster (idempotent).
--    Existing names (incl. spelling variants already present) are left
--    untouched — this is a MERGE, not a replace.
-- ---------------------------------------------------------------------
with new_people(name, role) as (
  values
    ('Lindokuhle Jiyane',    'developer'),
    ('Khayalethu Dube',      'developer'),
    ('Zukhanye Madlala',     'cybersecurity'),
    ('Karel Nkuna',          'designer'),
    ('Phenyo Moeti',         'developer'),
    ('Katleho Motloung',     'developer'),
    ('Thami Jasop',          'developer'),
    ('Lisakhanya Dingiswayo','cybersecurity')
)
insert into public.interns (name, initials, role)
select p.name,
       upper(left(split_part(p.name, ' ', 1), 1) ||
             left(reverse(split_part(reverse(p.name), ' ', 1)), 1)),
       p.role
from new_people p
where not exists (
  select 1 from public.interns i where lower(i.name) = lower(p.name)
);

-- ---------------------------------------------------------------------
-- 4. Seed teams (idempotent by name).
-- ---------------------------------------------------------------------
insert into public.teams (name, position)
select v.name, v.pos
from (values
  ('Group 1', 1), ('Group 2', 2), ('Group 3', 3), ('Group 4', 4),
  ('Group 5', 5), ('Group 6', 6), ('Group 7', 7),
  ('Caleb', 8), ('Felicity', 9), ('Nigel', 10)
) as v(name, pos)
where not exists (select 1 from public.teams t where t.name = v.name);

-- ---------------------------------------------------------------------
-- 5. Seed the projects each team is building (idempotent).
-- ---------------------------------------------------------------------
insert into public.team_projects (team_id, name, position)
select t.id, v.pname, v.pos
from (values
  ('Group 1', 'Talanton', 1),
  ('Group 1', 'Institute of Building Design', 2),
  ('Group 2', 'ImaniAI', 1),
  ('Group 3', 'Shalom-Home Services', 1),
  ('Group 4', 'Qhakaza Art Collective', 1),
  ('Group 5', 'AGROSENSE AI', 1),
  ('Group 5', 'QUARTIGO LLC', 2),
  ('Group 6', 'LoopedTech', 1),
  ('Group 7', 'CelebrateIT', 1),
  ('Caleb', 'Enerthon LTD', 1),
  ('Felicity', 'A.Tips', 1),
  ('Nigel', 'Payday Envelope', 1)
) as v(team, pname, pos)
join public.teams t on t.name = v.team
where not exists (
  select 1 from public.team_projects tp
  where tp.team_id = t.id and tp.name = v.pname
);

-- ---------------------------------------------------------------------
-- 6. Seed team members (idempotent by team + name). intern_id is a
--    best-effort link to the roster; display uses the denormalized name.
-- ---------------------------------------------------------------------
insert into public.team_members (team_id, intern_id, name, initials, role, is_active, position)
select t.id,
       (select i.id from public.interns i
         where lower(i.name) = lower(v.mname)
         order by i.created_at nulls last
         limit 1),
       v.mname,
       upper(left(split_part(v.mname, ' ', 1), 1) ||
             left(reverse(split_part(reverse(v.mname), ' ', 1)), 1)),
       v.mrole,
       v.active,
       v.pos
from (values
  ('Group 1', 'Amkelwe Lubavu',      'developer',     true,  1),
  ('Group 1', 'Bongiwe Dube',        'developer',     true,  2),
  ('Group 1', 'Teboho Motloung',     'designer',      true,  3),
  ('Group 1', 'Tumelo Selemela',     'cybersecurity', true,  4),
  ('Group 1', 'Lungile Malunga',     'cybersecurity', true,  5),
  ('Group 1', 'Lindokuhle Jiyane',   'developer',     true,  6),
  ('Group 2', 'Delight Ndlovu',      'developer',     true,  1),
  ('Group 2', 'Khayalethu Dube',     'developer',     true,  2),
  ('Group 2', 'Themba Msimang',      'cybersecurity', true,  3),
  ('Group 2', 'Zukhanye Madlala',    'cybersecurity', true,  4),
  ('Group 2', 'Karel Nkuna',         'designer',      true,  5),
  ('Group 3', 'Lehlohonolo Xaba',    'developer',     true,  1),
  ('Group 3', 'Natalie Vinyu',       'developer',     true,  2),
  ('Group 3', 'Lethuxolo Ntshanga',  'designer',      true,  3),
  ('Group 3', 'Moleboheng Mofokeng', 'developer',     true,  4),
  ('Group 3', 'Bongeka Ndlakuse',    'developer',     true,  5),
  ('Group 4', 'Palesa Magolego',     'developer',     true,  1),
  ('Group 4', 'Taylin Damonze',      'developer',     true,  2),
  ('Group 4', 'Nokuzola Dimba',      'designer',      true,  3),
  ('Group 4', 'Nontokozo Mbatha',    'developer',     true,  4),
  ('Group 4', 'Phenyo Moeti',        'developer',     true,  5),
  ('Group 5', 'Sphesihle Mudau',     'developer',     true,  1),
  ('Group 5', 'Thokozani Mazibuko',  'developer',     true,  2),
  ('Group 5', 'Maropeng Matlala',    'cybersecurity', true,  3),
  ('Group 5', 'Johannah Ngxande',    'cybersecurity', true,  4),
  ('Group 5', 'Kaegen Govendor',     'developer',     true,  5),
  ('Group 5', 'Brandon Banda',       'developer',     true,  6),
  ('Group 5', 'Karel Nkuna',         'designer',      true,  7),
  ('Group 5', 'Nokuzola Dimba',      'designer',      true,  8),
  ('Group 6', 'Katleho Motloung',    'developer',     true,  1),
  ('Group 6', 'Thami Jasop',         'developer',     true,  2),
  ('Group 6', 'Lethuxolo Ntshanga',  'designer',      true,  3),
  ('Group 6', 'Maropeng Matlala',    'cybersecurity', true,  4),
  ('Group 6', 'Themba Msimang',      'cybersecurity', false, 5),
  ('Group 6', 'Zethembe Nxumalo',    'developer',     true,  6),
  ('Group 6', 'Lisakhanya Dingiswayo','cybersecurity',true,  7),
  ('Group 7', 'Palesa Magolego',     'developer',     true,  1),
  ('Group 7', 'Brandon Banda',       'developer',     true,  2),
  ('Group 7', 'Bongiwe Dube',        'developer',     true,  3),
  ('Group 7', 'Lethuxolo Ntshanga',  'designer',      true,  4)
) as v(team, mname, mrole, active, pos)
join public.teams t on t.name = v.team
where not exists (
  select 1 from public.team_members tm
  where tm.team_id = t.id and lower(tm.name) = lower(v.mname)
);

-- Refresh PostgREST so the new tables are queryable immediately.
notify pgrst, 'reload schema';
