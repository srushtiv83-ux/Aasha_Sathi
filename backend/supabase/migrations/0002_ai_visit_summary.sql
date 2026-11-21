alter table public.visits
  add column if not exists visit_summary text,
  add column if not exists ai_extraction jsonb not null default '{}'::jsonb;

create or replace function public.confirm_visit_with_ai(
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
  p_visit_summary   text,
  p_ai_extraction   jsonb,
  p_follow_ups      jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_visit_id uuid;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  if p_ai_extraction is not null and jsonb_typeof(p_ai_extraction) <> 'object' then
    raise exception 'p_ai_extraction must be a JSON object' using errcode = '22023';
  end if;

  v_visit_id := public.confirm_visit(
    p_patient_name,
    p_patient_age,
    p_location,
    p_temperature_f,
    p_bp_systolic,
    p_bp_diastolic,
    p_symptoms,
    p_danger_signs,
    p_care_given,
    p_correction_note,
    p_transcript,
    p_follow_ups
  );

  update public.visits
  set visit_summary = nullif(trim(p_visit_summary), ''),
      ai_extraction = coalesce(p_ai_extraction, '{}'::jsonb)
  where id = v_visit_id and worker_id = v_uid;

  if not found then
    raise exception 'Could not attach the AI visit summary' using errcode = 'P0002';
  end if;

  return v_visit_id;
end;
$$;

revoke all on function public.confirm_visit_with_ai(
  text, smallint, text, numeric, smallint, smallint, text, text[], text, text, text, text, jsonb, jsonb
) from public, anon;
grant execute on function public.confirm_visit_with_ai(
  text, smallint, text, numeric, smallint, smallint, text, text[], text, text, text, text, jsonb, jsonb
) to authenticated;
