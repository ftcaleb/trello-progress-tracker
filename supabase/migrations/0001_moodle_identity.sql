-- =====================================================================
-- Step 1: Moodle-backed identity + authorization foundation
--
-- SAFETY CONTRACT:
--   * Fully ADDITIVE and IDEMPOTENT. Creates new objects only.
--   * Does NOT alter or drop any existing table, column, or policy.
--   * Does NOT change RLS on existing tables (that is a later, separate
--     step, applied only after Moodle login is verified working).
--   * Existing email/password login keeps working throughout.
--
-- ORDER MATTERS: new columns are added BEFORE the functions that
-- reference them, because Postgres validates SQL function bodies at
-- creation time.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. profiles: one row per authenticated account (1:1 with auth.users)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  moodle_user_id  bigint unique,
  moodle_username text,
  email           text,
  full_name       text,
  app_role        text not null default 'member'
                    check (app_role in ('admin', 'member')),
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  last_login_at   timestamptz
);

comment on table public.profiles is
  'App identity. Linked to a Moodle account via moodle_user_id. app_role is managed in this app only and is never derived from Moodle.';

-- ---------------------------------------------------------------------
-- 2. Link existing interns to real Moodle users (nullable = unlinked).
--    Preserves all existing project_interns assignments.
-- ---------------------------------------------------------------------
alter table public.interns
  add column if not exists moodle_user_id bigint;

create unique index if not exists interns_moodle_user_id_uidx
  on public.interns (moodle_user_id)
  where moodle_user_id is not null;

-- ---------------------------------------------------------------------
-- 3. Attribution: capture WHO did what from here on (powers monitoring).
--    Nullable, so all existing rows remain valid.
-- ---------------------------------------------------------------------
alter table public.tasks
  add column if not exists created_by uuid references auth.users(id) on delete set null;

alter table public.comments
  add column if not exists created_by uuid references auth.users(id) on delete set null;

-- ---------------------------------------------------------------------
-- 4. Helper functions (SECURITY DEFINER so RLS policies can call them
--    without recursing into the policies they are evaluating).
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and app_role = 'admin'
      and is_active
  );
$$;

-- Membership flows through the EXISTING project_interns assignments:
-- a logged-in profile is a member of a project when it is linked (by
-- moodle_user_id) to an intern assigned to that project.
create or replace function public.is_member_of(p_project uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.project_interns pi
    join public.interns  i  on i.id = pi.intern_id
    join public.profiles pr on pr.moodle_user_id = i.moodle_user_id
    where pi.project_id = p_project
      and pr.id = auth.uid()
      and pr.is_active
      and i.moodle_user_id is not null
  );
$$;

-- ---------------------------------------------------------------------
-- 5. RLS on the NEW table only.
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

-- NOTE: deliberately no self-update policy. A subquery against profiles
-- inside a profiles policy causes infinite recursion, and members have no
-- need to edit their own profile in Step 1. Admin manages profiles; the
-- Edge Function writes login metadata using the service role (RLS-exempt).

drop policy if exists profiles_admin_write on public.profiles;
create policy profiles_admin_write on public.profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 6. Auto-create a profile whenever an auth user is created.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 7. Backfill profiles for existing accounts + bootstrap the admin.
--    Admin is set on the EXISTING account, so it survives the Moodle
--    link (adoption attaches moodle_user_id to this same row).
-- ---------------------------------------------------------------------
insert into public.profiles (id, email)
select u.id, u.email from auth.users u
on conflict (id) do nothing;

update public.profiles
   set app_role = 'admin',
       is_active = true
 where email = 'caleb19scott@gmail.com';
