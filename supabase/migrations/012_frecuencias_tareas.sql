-- Task frequency scheduler: daily, weekly (once per ISO week) and on-demand activities.
alter table public.actividad_programaciones
  add column frecuencia text not null default 'DIARIA'
    check (frecuencia in ('DIARIA','SEMANAL','SEGUN_NECESIDAD'));

-- Only unmistakable references from the printed sheet are promoted; the owner can
-- adjust every task in /admin/tareas without inventing equivalences here.
update public.actividad_programaciones p set frecuencia = 'SEMANAL'
  from public.actividades a
  where a.id = p.actividad_id and a.area = 'SALON'
    and a.nombre = 'Limpieza Vidrios Internos/Externos';

update public.actividad_programaciones p set frecuencia = 'SEGUN_NECESIDAD'
  from public.actividades a
  where a.id = p.actividad_id
    and (a.nombre in ('Armado de Cajas Pizza','Armado de Cajas Empanadas')
      or a.nombre ilike '%necesario%');

-- A weekly task counts once per ISO week: later marks update the same record and
-- keep the day it was actually completed.
create or replace function public.completar_tarea(p_programacion uuid,p_fecha date,p_hora time,p_nota text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_actividad uuid; v_responsable uuid; v_id uuid; v_frecuencia text; v_semana date; begin
  select p.actividad_id, p.frecuencia into v_actividad, v_frecuencia
    from public.actividad_programaciones p
    join public.actividades a on a.id=p.actividad_id
    where p.id=p_programacion and p.activo and public.puede_ver_area(a.area);
  if v_actividad is null then raise exception 'Access denied' using errcode='42501'; end if;
  select responsable_id into v_responsable from public.usuarios where id=auth.uid() and activo;
  if p_fecha is null or p_hora is null or p_nota is null or length(p_nota)>2000 then raise exception 'Invalid task payload'; end if;
  if v_frecuencia = 'SEMANAL' then
    v_semana := date_trunc('week', p_fecha)::date;
    select r.id into v_id from public.actividad_registros r
      where r.programacion_id = p_programacion
        and r.fecha >= v_semana and r.fecha < v_semana + 7
      order by r.fecha limit 1;
    if v_id is not null then
      update public.actividad_registros set hora=p_hora, nota=p_nota,
        responsable_id=v_responsable, actualizado_por=auth.uid()
        where id=v_id;
      return v_id;
    end if;
  end if;
  insert into public.actividad_registros(actividad_id,programacion_id,fecha,hora,responsable_id,nota,actualizado_por)
    values (v_actividad,p_programacion,p_fecha,p_hora,v_responsable,p_nota,auth.uid())
    on conflict (programacion_id,fecha) do update set hora=excluded.hora,nota=excluded.nota,
      responsable_id=excluded.responsable_id,actualizado_por=auth.uid()
    returning id into v_id;
  return v_id;
end $$;
revoke all on function public.completar_tarea(uuid,date,time,text) from public,anon;
grant execute on function public.completar_tarea(uuid,date,time,text) to authenticated;

-- Direct writes cannot create a second weekly record outside the RPC.
create function public.validar_registro_semanal() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare v_frecuencia text; v_semana date; begin
  select frecuencia into v_frecuencia from public.actividad_programaciones where id=new.programacion_id;
  if v_frecuencia = 'SEMANAL' then
    v_semana := date_trunc('week', new.fecha)::date;
    if exists (select 1 from public.actividad_registros r
      where r.programacion_id = new.programacion_id
        and r.fecha >= v_semana and r.fecha < v_semana + 7) then
      raise exception 'La tarea semanal ya tiene un registro en esa semana';
    end if;
  end if;
  return new;
end $$;

create trigger registro_semanal_unico before insert on public.actividad_registros
  for each row execute function public.validar_registro_semanal();
