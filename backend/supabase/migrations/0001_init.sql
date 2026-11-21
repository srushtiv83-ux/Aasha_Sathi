-- ASHA Sathi: initial schema.
-- Every table is owned by one ASHA worker (auth.users.id) and protected by
-- Row Level Security, so a worker can only ever see their own rows.

-- ---------------------------------------------------------------- profiles
create sequence if not exists public.asha_id_seq start 4819;

create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  asha_id       text not null unique,
  full_name     text not null check (char_length(trim(full_name)) between 2 and 100),
  phone         text not null unique,
  date_of_birth date not null check (date_of_birth < current_date),
  place         text not null check (char_length(trim(place)) between 2 and 120),
  languages     text[] not null default '{English}'
                check (languages <@ array['English', 'Hindi', 'Kannada'] and cardinality(languages) >= 1),
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------- patients
create table public.patients (
  id         uuid primary key default gen_random_uuid(),
  worker_id  uuid not null references public.profiles (id) on delete cascade,
  name       text not null check (char_length(trim(name)) >= 1),
  age_years  smallint check (age_years between 0 and 120),
  location   text,
  created_at timestamptz not null default now()
);
create index patients_worker_idx on public.patients (worker_id);

-- ------------------------------------------------------------------ visits
create table public.visits (
  id              uuid primary key default gen_random_uuid(),
  worker_id       uuid not null references public.profiles (id) on delete cascade,
  patient_id      uuid not null references public.patients (id) on delete cascade,
  visited_at      timestamptz not null default now(),
  temperature_f   numeric(4, 1) check (temperature_f between 85 and 115),
  bp_systolic     smallint check (bp_systolic between 50 and 260),
  bp_diastolic    smallint check (bp_diastolic between 30 and 160),
  symptoms        text,
  danger_signs    text[] not null default '{}',
  care_given      text,
  correction_note text,
  transcript      text,
  status          text not null default 'draft' check (status in ('draft', 'confirmed')),
  confirmed_at    timestamptz,
  created_at      timestamptz not null default now()
);
create index visits_worker_idx on public.visits (worker_id, visited_at desc);

-- -------------------------------------------------------------- follow_ups
create table public.follow_ups (
  id         uuid primary key default gen_random_uuid(),
  worker_id  uuid not null references public.profiles (id) on delete cascade,
  visit_id   uuid not null references public.visits (id) on delete cascade,
  title      text not null,
  detail     text,
  due_at     timestamptz,
  done       boolean not null default false,
  done_at    timestamptz,
  created_at timestamptz not null default now()
);
create index follow_ups_visit_idx on public.follow_ups (visit_id);
create index follow_ups_worker_idx on public.follow_ups (worker_id, done, due_at);

-- ------------------------------------------------------------------ alerts
create table public.alerts (
  id              uuid primary key default gen_random_uuid(),
  worker_id       uuid not null references public.profiles (id) on delete cascade,
  patient_id      uuid references public.patients (id) on delete set null,
  visit_id        uuid references public.visits (id) on delete set null,
  title           text not null,
  details         text[] not null default '{}',
  severity        text not null default 'urgent' check (severity in ('watch', 'urgent')),
  acknowledged_at timestamptz,
  created_at      timestamptz not null default now()
);
create index alerts_worker_idx on public.alerts (worker_id, created_at desc);

-- ------------------------------------------------------ Row Level Security
alter table public.profiles   enable row level security;
alter table public.patients   enable row level security;
alter table public.visits     enable row level security;
alter table public.follow_ups enable row level security;
alter table public.alerts     enable row level security;

-- profiles: read/update own row. Inserts go through create_profile() only.
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- patients
create policy patients_all_own on public.patients
  for all to authenticated
  using (worker_id = auth.uid()) with check (worker_id = auth.uid());

-- visits: the patient must also belong to the same worker.
create policy visits_all_own on public.visits
  for all to authenticated
  using (worker_id = auth.uid())
  with check (
    worker_id = auth.uid()
    and exists (select 1 from public.patients p where p.id = patient_id and p.worker_id = auth.uid())
  );

-- follow-ups: the visit must also belong to the same worker.
create policy follow_ups_all_own on public.follow_ups
  for all to authenticated
  using (worker_id = auth.uid())
  with check (
    worker_id = auth.uid()
    and exists (select 1 from public.visits v where v.id = visit_id and v.worker_id = auth.uid())
  );

-- alerts
create policy alerts_all_own on public.alerts
  for all to authenticated
  using (worker_id = auth.uid()) with check (worker_id = auth.uid());

-- ------------------------------------------------------------ create_profile
-- Called once, right after the phone OTP is verified at registration.
-- The ASHA employee number is generated here so the client cannot choose it.
create or replace function public.create_profile(
  p_full_name     text,
  p_date_of_birth date,
  p_place         text,
  p_languages     text[]
) returns public.profiles
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid   uuid := auth.uid();
  v_phone text;
  v_row   public.profiles;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  select phone into v_phone from auth.users where id = v_uid;
  if v_phone is null then
    raise exception 'Account has no verified phone number' using errcode = '22023';
  end if;

  if exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'Profile already exists' using errcode = '23505';
  end if;

  insert into public.profiles (id, asha_id, full_name, phone, date_of_birth, place, languages)
  values (
    v_uid,
    'ASHA-' || extract(year from now())::int || '-' || nextval('public.asha_id_seq'),
    trim(p_full_name),
    -- stored as digits with country code, no "+", same as auth.users.phone
    regexp_replace(v_phone, '\D', '', 'g'),
    p_date_of_birth,
    trim(p_place),
    p_languages
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.create_profile(text, date, text, text[]) from public, anon;
grant execute on function public.create_profile(text, date, text, text[]) to authenticated;

-- Keep done_at in step with done.
create or replace function public.follow_up_set_done_at()
returns trigger language plpgsql as $$
begin
  if new.done and not coalesce(old.done, false) then
    new.done_at := now();
  elsif not new.done then
    new.done_at := null;
  end if;
  return new;
end;
$$;

create trigger follow_ups_done_at
  before update on public.follow_ups
  for each row execute function public.follow_up_set_done_at();

-- ----------------------------------------------------------- confirm_visit
-- Saves a visit and its follow-ups in one transaction so a half-saved visit
-- can never exist. Patient is created for this worker if no id is given.
create or replace function public.confirm_visit(
  p_patient_name    text,
  p_patient_age     smallint,
  p_location        text,
  p_temperature_f   numeric,
  p_bp_systolic     smallint,
  p_bp_diastolic    smallint,
  p_symptoms        text,
  p_danger_signs    text[],
  p_care_given      text,
  p_correction_note text,
  p_transcript      text,
  p_follow_ups      jsonb          -- [{"title": "...", "detail": "...", "due_at": "2026-11-21T18:00:00+05:30"}]
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_patient_id uuid;
  v_visit_id   uuid;
  v_item       jsonb;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  if not exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'Finish registration first' using errcode = '42501';
  end if;
  if p_follow_ups is not null and jsonb_typeof(p_follow_ups) <> 'array' then
    raise exception 'p_follow_ups must be a JSON array' using errcode = '22023';
  end if;

  insert into public.patients (worker_id, name, age_years, location)
  values (v_uid, trim(p_patient_name), p_patient_age, p_location)
  returning id into v_patient_id;

  insert into public.visits (
    worker_id, patient_id, temperature_f, bp_systolic, bp_diastolic, symptoms,
    danger_signs, care_given, correction_note, transcript, status, confirmed_at
  ) values (
    v_uid, v_patient_id, p_temperature_f, p_bp_systolic, p_bp_diastolic, p_symptoms,
    coalesce(p_danger_signs, '{}'), p_care_given, nullif(trim(p_correction_note), ''),
    p_transcript, 'confirmed', now()
  )
  returning id into v_visit_id;

  for v_item in select * from jsonb_array_elements(coalesce(p_follow_ups, '[]'::jsonb)) loop
    insert into public.follow_ups (worker_id, visit_id, title, detail, due_at)
    values (
      v_uid,
      v_visit_id,
      v_item ->> 'title',
      v_item ->> 'detail',
      nullif(v_item ->> 'due_at', '')::timestamptz
    );
  end loop;

  return v_visit_id;
end;
$$;

revoke all on function public.confirm_visit(text, smallint, text, numeric, smallint, smallint, text, text[], text, text, text, jsonb) from public, anon;
grant execute on function public.confirm_visit(text, smallint, text, numeric, smallint, smallint, text, text[], text, text, text, jsonb) to authenticated;
