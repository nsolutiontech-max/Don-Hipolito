-- Audits are now performed by owners AND managers. The owner keeps the
-- administrative overview; managers can complete and close the audit too.
drop policy if exists "plantillas auditoria dueno" on public.auditoria_plantillas;
drop policy if exists "items auditoria dueno" on public.auditoria_items;
drop policy if exists "auditorias dueno" on public.auditorias;
drop policy if exists "partes auditoria dueno" on public.auditoria_partes;
drop policy if exists "respuestas auditoria dueno" on public.auditoria_respuestas;

create policy "plantillas auditoria control" on public.auditoria_plantillas for select to authenticated
  using (public.es_dueno_o_encargado());
create policy "items auditoria control" on public.auditoria_items for select to authenticated
  using (public.es_dueno_o_encargado());
create policy "auditorias control" on public.auditorias for all to authenticated
  using (public.es_dueno_o_encargado()) with check (public.es_dueno_o_encargado());
create policy "partes auditoria control" on public.auditoria_partes for all to authenticated
  using (public.es_dueno_o_encargado()) with check (public.es_dueno_o_encargado());
create policy "respuestas auditoria control" on public.auditoria_respuestas for all to authenticated
  using (public.es_dueno_o_encargado()) with check (public.es_dueno_o_encargado());

create or replace function public.guardar_auditoria(
  p_fecha date,
  p_fecha_cocina date,
  p_fecha_salon date,
  p_observaciones text,
  p_firma text,
  p_respuestas jsonb
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_id uuid;
  v_plantilla uuid;
  v_count int;
  v_distinct int;
begin
  if not public.es_dueno_o_encargado() then raise exception 'Access denied' using errcode='42501'; end if;
  if p_fecha is null or p_fecha_cocina is null or p_fecha_salon is null then raise exception 'Audit dates are required'; end if;
  if p_respuestas is null or jsonb_typeof(p_respuestas) <> 'array'
     or jsonb_array_length(p_respuestas) > 84
     or p_observaciones is null or length(p_observaciones) > 8000
     or p_firma is null or length(p_firma) > 500 then
    raise exception 'Invalid audit payload';
  end if;
  select id into v_plantilla from public.auditoria_plantillas
    where codigo='AUDITORIA_2026' and activa;
  if v_plantilla is null then raise exception 'Audit template unavailable'; end if;
  select count(*), count(distinct d.item_id)
    into v_count, v_distinct
    from jsonb_to_recordset(p_respuestas) as d(item_id uuid, resultado text,
      observaciones text, mejora text, necesidad text);
  if v_count <> v_distinct then raise exception 'Duplicate audit criteria'; end if;
  if exists (
    select 1 from jsonb_to_recordset(p_respuestas) as d(item_id uuid, resultado text)
    left join public.auditoria_items i on i.id=d.item_id and i.plantilla_id=v_plantilla
    where i.id is null or (d.resultado is not null and d.resultado not in ('OK','NO_OK'))
  ) then
    raise exception 'Invalid audit criterion or result';
  end if;
  if exists (select 1 from public.auditorias where fecha=p_fecha) then
    if (select estado from public.auditorias where fecha=p_fecha) = 'CERRADO' then
      raise exception 'Closed audits are immutable';
    end if;
  end if;
  insert into public.auditorias(plantilla_id,fecha,observaciones_generales,firma,creado_por,actualizado_por)
    values (v_plantilla,p_fecha,coalesce(p_observaciones,''),coalesce(p_firma,''),auth.uid(),auth.uid())
  on conflict (fecha) do update set observaciones_generales=excluded.observaciones_generales,
    firma=excluded.firma
  returning id into v_id;
  insert into public.auditoria_partes(auditoria_id,bloque,auditor_id,fecha)
    values (v_id,'COCINA',auth.uid(),p_fecha_cocina),
           (v_id,'SALON_GENERAL',auth.uid(),p_fecha_salon)
  on conflict (auditoria_id,bloque) do update set fecha=excluded.fecha;
  insert into public.auditoria_respuestas(auditoria_id,item_id,resultado,observaciones,mejora,necesidad,actualizado_por)
  select v_id,d.item_id,nullif(d.resultado,''),coalesce(d.observaciones,''),
    coalesce(d.mejora,''),coalesce(d.necesidad,''),auth.uid()
  from jsonb_to_recordset(p_respuestas) as d(item_id uuid,resultado text,observaciones text,mejora text,necesidad text)
  on conflict (auditoria_id,item_id) do update set resultado=excluded.resultado,
    observaciones=excluded.observaciones,mejora=excluded.mejora,necesidad=excluded.necesidad,
    actualizado_por=auth.uid(),actualizado_en=now();
  return v_id;
end $$;

create or replace function public.cerrar_auditoria(p_id uuid, p_firma text)
returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if not public.es_dueno_o_encargado() then raise exception 'Access denied' using errcode='42501'; end if;
  if p_firma is null or length(trim(p_firma)) = 0 then raise exception 'Signature is required to close'; end if;
  update public.auditorias set estado='CERRADO', firma=trim(p_firma), actualizado_por=auth.uid()
    where id=p_id and estado='BORRADOR';
  if not found then raise exception 'Audit not found or already closed'; end if;
end $$;

revoke all on function public.guardar_auditoria(date,date,date,text,text,jsonb),
  public.cerrar_auditoria(uuid,text) from public,anon;
grant execute on function public.guardar_auditoria(date,date,date,text,text,jsonb),
  public.cerrar_auditoria(uuid,text) to authenticated;

notify pgrst, 'reload schema';
