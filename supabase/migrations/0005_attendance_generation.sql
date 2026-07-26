-- =====================================================================
-- 0005_attendance_generation.sql
--
-- Session generation (idempotent, forward-only) + projects trigger that
-- backfills assigned_at on first initial-meet set and (re)generates sessions.
--
-- SAFETY: new functions + one new trigger on public.projects. No existing
-- object altered. Reversible: supabase/rollback/0005_rollback.sql.
-- =====================================================================

-- --------------------------------------------------------------------
-- generate_standup_sessions(project): builds the project's own 3-month
-- window from initial_meet_date. Past sessions are generated too (as
-- already-closed). Only FUTURE sessions are ever deleted/regenerated.
-- --------------------------------------------------------------------
create or replace function public.generate_standup_sessions(p_project uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meet date;
  v_day  text;
  v_time time;
  v_end  date;
  v_ts   timestamptz;
  v_past_initial boolean;
begin
  select initial_meet_date,
         standup_day,
         case when standup_time ~ '^[0-9]{1,2}:[0-9]{2}(:[0-9]{2})?$'
              then standup_time::time end
    into v_meet, v_day, v_time
  from public.projects
  where id = p_project;

  -- Not enough config yet → nothing to generate.
  if v_meet is null or v_day is null or v_time is null then
    return;
  end if;

  v_end := v_meet + interval '3 months';

  -- Immutability: only future sessions are removed and rebuilt.
  delete from public.standup_sessions
   where project_id = p_project
     and starts_at > now();

  -- Has the initial meet already occurred? If so it is fixed — never move it.
  select exists (
    select 1 from public.standup_sessions
     where project_id = p_project and is_initial_meet and starts_at <= now()
  ) into v_past_initial;

  -- (1) The initial meet, on the meet date itself, at the standup time.
  if not v_past_initial then
    v_ts := ((v_meet + v_time) at time zone 'Africa/Johannesburg');
    insert into public.standup_sessions
        (project_id, session_date, starts_at, ends_at, is_initial_meet)
    values
        (p_project, v_meet, v_ts, v_ts + interval '1 hour', true)
    on conflict (project_id, session_date) do update
        set starts_at = excluded.starts_at,
            ends_at   = excluded.ends_at,
            is_initial_meet = true
      where public.standup_sessions.starts_at > now();  -- never touch a started row
  end if;

  -- (2) Weekly standups strictly after the meet, through meet + 3 months.
  --     Case-insensitive + whitespace-tolerant weekday match (amendment #3).
  insert into public.standup_sessions
      (project_id, session_date, starts_at, ends_at, is_initial_meet)
  select p_project,
         d::date,
         ((d::date + v_time) at time zone 'Africa/Johannesburg'),
         ((d::date + v_time) at time zone 'Africa/Johannesburg') + interval '1 hour',
         false
  from generate_series(v_meet + 1, v_end, interval '1 day') g(d)
  where lower(trim(to_char(d, 'FMDay'))) = lower(trim(v_day))
  on conflict (project_id, session_date) do nothing;
end;
$$;

revoke all on function public.generate_standup_sessions(uuid) from public;

-- --------------------------------------------------------------------
-- projects trigger: backfill assigned_at on first set, guard against
-- moving a past initial meet, and (re)generate on relevant changes.
-- --------------------------------------------------------------------
create or replace function public.on_project_standup_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ts timestamptz;
begin
  if tg_op = 'UPDATE' then
    -- Guard: an initial meet that has already occurred cannot be moved.
    if new.initial_meet_date is distinct from old.initial_meet_date
       and exists (
         select 1 from public.standup_sessions
          where project_id = new.id and is_initial_meet and starts_at <= now()
       )
    then
      raise exception 'Cannot change the initial meet date after it has occurred.';
    end if;

    -- First time initial_meet_date is set → backfill assigned_at for the
    -- interns already on this project so they count from the project's day one.
    if old.initial_meet_date is null
       and new.initial_meet_date is not null
       and new.standup_time ~ '^[0-9]{1,2}:[0-9]{2}(:[0-9]{2})?$'
    then
      v_ts := ((new.initial_meet_date + new.standup_time::time) at time zone 'Africa/Johannesburg');
      update public.project_interns
         set assigned_at = v_ts
       where project_id = new.id;
    end if;

    if new.initial_meet_date is distinct from old.initial_meet_date
       or new.standup_day    is distinct from old.standup_day
       or new.standup_time   is distinct from old.standup_time
    then
      perform public.generate_standup_sessions(new.id);
    end if;

  elsif tg_op = 'INSERT' then
    if new.initial_meet_date is not null then
      perform public.generate_standup_sessions(new.id);
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_project_standup on public.projects;
create trigger trg_project_standup
  after insert or update on public.projects
  for each row execute function public.on_project_standup_change();
