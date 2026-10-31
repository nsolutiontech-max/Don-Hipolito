-- Interviews finish explicitly: FINALIZADA freezes the evaluation; reopening is
-- the owner-only unlock with a mandatory reason (mirrors the audit pattern).

-- 1. REGISTRADA was never written by any flow; anything already marked moves to
-- FINALIZADA before the value disappears from the check.
alter table public.entrevistas drop constraint entrevistas_estado_check;
update public.entrevistas set estado='FINALIZADA' where estado='REGISTRADA';
alter table public.entrevistas add constraint entrevistas_estado_check
  check (estado in ('BORRADOR','FINALIZADA'));
alter table public.entrevistas
  add column if not exists finalizada_en timestamptz,
  add column if not exists motivo_reapertura text not null default '';

-- 2. Row lock: from FINALIZADA the only permitted update is the unlock itself,
-- and it must carry a 5-500 reason without touching the evaluation content.
create function public.entrevista_cierre_guard() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and old.estado = 'FINALIZADA' then
    if new.estado <> 'BORRADOR'
       or new.fecha is distinct from old.fecha
       or new.candidato is distinct from old.candidato
       or new.puesto_aspira is distinct from old.puesto_aspira
       or new.tecnica_actual is distinct from old.tecnica_actual
       or new.velocidad is distinct from old.velocidad
       or new.prolijidad is distinct from old.prolijidad
       or new.capacidad_aprendizaje is distinct from old.capacidad_aprendizaje
       or new.actitud is distinct from old.actitud
       or new.decision is distinct from old.decision
       or new.puesto_sugerido is distinct from old.puesto_sugerido
       or new.observaciones_finales is distinct from old.observaciones_finales
       or length(trim(new.motivo_reapertura)) < 5
       or length(trim(new.motivo_reapertura)) > 500 then
      raise exception 'Finalized interviews are immutable; reopen first with a 5-500 character reason';
    end if;
    return new;
  end if;
  if tg_op = 'UPDATE' and new.estado = 'FINALIZADA' and old.estado <> 'FINALIZADA' then
    if new.decision is null then raise exception 'A decision is required before finalize'; end if;
    new.finalizada_en := now();
    new.motivo_reapertura := '';
  end if;
  return new;
end $$;
create trigger entrevista_cierre_guard before update on public.entrevistas
  for each row execute function public.entrevista_cierre_guard();

-- 3. Response tables reject writes on a finalized interview.
create or replace function public.entrevista_criterio_guard() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare v_plantilla uuid; v_estado text;
begin
  select plantilla_id, estado into v_plantilla, v_estado
    from public.entrevistas where id=new.entrevista_id;
  if v_plantilla is null then raise exception 'Interview not found'; end if;
  if v_estado = 'FINALIZADA' then raise exception 'Finalized interviews are immutable'; end if;
  if not exists (
    select 1 from public.entrevista_criterios c
    where c.id=new.criterio_id and c.plantilla_id=v_plantilla
  ) then raise exception 'Criterion does not belong to this interview template'; end if;
  return new;
end $$;

create or replace function public.entrevista_seccion_guard() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare v_plantilla uuid; v_estado text;
begin
  select plantilla_id, estado into v_plantilla, v_estado
    from public.entrevistas where id=new.entrevista_id;
  if v_plantilla is null then raise exception 'Interview not found'; end if;
  if v_estado = 'FINALIZADA' then raise exception 'Finalized interviews are immutable'; end if;
  if not exists (
    select 1 from public.entrevista_secciones s
    where s.id=new.seccion_id and s.plantilla_id=v_plantilla
  ) then raise exception 'Section does not belong to this interview template'; end if;
  return new;
end $$;

-- 4. Finalize RPC: owner-only, one-way through the guard above.
create or replace function public.finalizar_entrevista(p_id uuid)
returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if not public.es_dueno() then raise exception 'Access denied' using errcode='42501'; end if;
  update public.entrevistas set estado='FINALIZADA' where id=p_id and estado='BORRADOR';
  if not found then raise exception 'Interview not found or already finalized'; end if;
end $$;

revoke all on function public.finalizar_entrevista(uuid) from public, anon;
grant execute on function public.finalizar_entrevista(uuid) to authenticated;

notify pgrst, 'reload schema';
