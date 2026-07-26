-- =====================================================================
-- 0004_attendance_schema.sql
--
-- Weekly Standup Attendance Register — schema (tables + additive columns).
--
-- SAFETY CONTRACT:
--   * ADDITIVE only. Two new nullable/defaulted columns on existing tables
--     (projects.initial_meet_date, project_interns.assigned_at) — explicitly
--     sanctioned — plus four new tables. No existing column/table is altered
--     or dropped. No existing RLS policy is touched.
--   * Reversible: see supabase/rollback/0004_rollback.sql.
-- =====================================================================

-- --- Additive columns on existing tables ------------------------------
alter table public.projects
  add column if not exists initial_meet_date date;
comment on column public.projects.initial_meet_date is
  'Date of this project''s first standup (Project Initial Meet). Its 3-month session window runs from here. NULL = no sessions generated yet.';

alter table public.project_interns
  add column if not exists assigned_at timestamptz not null default now();
comment on column public.project_interns.assigned_at is
  'When this intern was assigned. Governs attendance N/A (sessions before this are N/A). Existing rows default to now() at migration; backfilled to the project initial-meet start when initial_meet_date is first set (see 0005 trigger).';

-- --- standup_sessions --------------------------------------------------
create table if not exists public.standup_sessions (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects(id) on delete cascade,
  session_date    date not null,
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  is_initial_meet boolean not null default false,
  created_at      timestamptz not null default now(),
  unique (project_id, session_date)
);
create index if not exists standup_sessions_project_idx on public.standup_sessions (project_id);
create index if not exists standup_sessions_starts_idx  on public.standup_sessions (starts_at);
-- Exactly one initial meet per project (backstops "no moving a past meet").
create unique index if not exists standup_sessions_one_initial
  on public.standup_sessions (project_id) where is_initial_meet;

-- --- attendance_records (present-only; absent/na are derived) ----------
create table if not exists public.attendance_records (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.standup_sessions(id) on delete cascade,
  intern_id  uuid not null references public.interns(id) on delete cascade,
  status     text not null default 'present' check (status in ('present')),
  marked_at  timestamptz not null default now(),
  marked_by  uuid references auth.users(id) on delete set null,
  unique (session_id, intern_id)
);
create index if not exists attendance_records_session_idx on public.attendance_records (session_id);
create index if not exists attendance_records_intern_idx  on public.attendance_records (intern_id);

-- --- attendance_amendments (audit trail) ------------------------------
-- old_marked_at / old_marked_by snapshot the original self-tick metadata so a
-- delete never loses who ticked and when (amendment #1).
create table if not exists public.attendance_amendments (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.standup_sessions(id) on delete cascade,
  intern_id     uuid not null references public.interns(id) on delete cascade,
  old_status    text not null,   -- 'present' | 'absent' | 'na'
  new_status    text not null,   -- 'present' | 'absent'
  old_marked_at timestamptz,     -- snapshot of the pre-change record, if any
  old_marked_by uuid,            -- snapshot of the pre-change record author, if any
  changed_by    uuid references auth.users(id) on delete set null,
  reason        text,
  changed_at    timestamptz not null default now()
);
create index if not exists attendance_amendments_session_idx on public.attendance_amendments (session_id);

notify pgrst, 'reload schema';
