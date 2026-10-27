-- Daily 84-item operational audit. Owner-only data and validated closure.
-- Requires 003–005 applied.

create table public.auditoria_plantillas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  version int not null check (version > 0),
  activa boolean not null default true,
  creado_en timestamptz not null default now()
);

create table public.auditoria_items (
  id uuid primary key default gen_random_uuid(),
  plantilla_id uuid not null references public.auditoria_plantillas(id),
  codigo text not null unique,
  bloque text not null check (bloque in ('COCINA','SALON_GENERAL')),
  grupo text not null,
  texto text not null,
  orden int not null,
  orden_bloque int not null,
  unique (plantilla_id, orden),
  unique (plantilla_id, orden_bloque, bloque)
);

create table public.auditorias (
  id uuid primary key default gen_random_uuid(),
  plantilla_id uuid not null references public.auditoria_plantillas(id),
  fecha date not null unique,
  estado text not null default 'BORRADOR' check (estado in ('BORRADOR','CERRADO')),
  observaciones_generales text not null default '',
  firma text not null default '',
  creado_por uuid not null references public.usuarios(id),
  actualizado_por uuid not null references public.usuarios(id),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  cerrado_en timestamptz
);

create table public.auditoria_partes (
  auditoria_id uuid not null references public.auditorias(id) on delete cascade,
  bloque text not null check (bloque in ('COCINA','SALON_GENERAL')),
  auditor_id uuid not null references public.usuarios(id),
  fecha date not null,
  primary key (auditoria_id, bloque)
);

create table public.auditoria_respuestas (
  auditoria_id uuid not null references public.auditorias(id) on delete cascade,
  item_id uuid not null references public.auditoria_items(id),
  resultado text check (resultado in ('OK','NO_OK')),
  observaciones text not null default '',
  mejora text not null default '',
  necesidad text not null default '',
  actualizado_por uuid not null references public.usuarios(id),
  actualizado_en timestamptz not null default now(),
  primary key (auditoria_id, item_id)
);

create index idx_auditorias_fecha on public.auditorias(fecha desc);
create index idx_auditoria_respuestas_pendientes
  on public.auditoria_respuestas(auditoria_id) where resultado is null;

create function public.auditoria_autoria() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare v_esperados int; v_respondidos int;
begin
  if tg_op = 'UPDATE' and old.estado = 'CERRADO' then
    raise exception 'Closed audits are immutable';
  end if;
  if tg_op = 'UPDATE' then
    new.creado_por := old.creado_por;
    new.creado_en := old.creado_en;
  else
    new.creado_por := auth.uid();
  end if;
  if auth.uid() is null then raise exception 'Authenticated user required' using errcode='42501'; end if;
  new.actualizado_por := auth.uid();
  new.actualizado_en := now();
  if new.estado = 'CERRADO' then
    if length(trim(new.firma)) = 0 then raise exception 'Signature is required to close'; end if;
    select count(*) into v_esperados from public.auditoria_items i
      join public.auditoria_plantillas p on p.id=i.plantilla_id
      where i.plantilla_id=new.plantilla_id and p.activa;
    select count(*) into v_respondidos from public.auditoria_respuestas r
      join public.auditoria_items i on i.id=r.item_id
      where r.auditoria_id=new.id and i.plantilla_id=new.plantilla_id and r.resultado is not null;
    if v_respondidos <> v_esperados then
      raise exception 'All % audit criteria must be answered before closure', v_esperados;
    end if;
    new.cerrado_en := case when tg_op = 'UPDATE' then coalesce(old.cerrado_en, now()) else now() end;
  end if;
  return new;
end $$;
create trigger auditoria_autoria before insert or update on public.auditorias
  for each row execute function public.auditoria_autoria();

create function public.auditoria_respuesta_guard() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare v_plantilla uuid; v_estado text;
begin
  select a.plantilla_id, a.estado into v_plantilla, v_estado
  from public.auditorias a where a.id=new.auditoria_id;
  if v_estado is null then raise exception 'Audit not found'; end if;
  if v_estado = 'CERRADO' then raise exception 'Closed audits are immutable'; end if;
  if not exists (select 1 from public.auditoria_items i where i.id=new.item_id and i.plantilla_id=v_plantilla) then
    raise exception 'Criterion does not belong to this audit template';
  end if;
  new.actualizado_por := auth.uid();
  new.actualizado_en := now();
  return new;
end $$;
create trigger auditoria_respuesta_guard before insert or update on public.auditoria_respuestas
  for each row execute function public.auditoria_respuesta_guard();

create function public.auditoria_parte_guard() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare v_estado text;
begin
  select estado into v_estado from public.auditorias where id=new.auditoria_id;
  if v_estado = 'CERRADO' then raise exception 'Closed audits are immutable'; end if;
  new.auditor_id := auth.uid();
  return new;
end $$;
create trigger auditoria_parte_guard before insert or update on public.auditoria_partes
  for each row execute function public.auditoria_parte_guard();

create function public.guardar_auditoria(
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
  if not public.es_dueno() then raise exception 'Access denied' using errcode='42501'; end if;
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

create function public.cerrar_auditoria(p_id uuid, p_firma text)
returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if not public.es_dueno() then raise exception 'Access denied' using errcode='42501'; end if;
  if p_firma is null or length(trim(p_firma)) = 0 then raise exception 'Signature is required to close'; end if;
  update public.auditorias set estado='CERRADO', firma=trim(p_firma), actualizado_por=auth.uid()
    where id=p_id and estado='BORRADOR';
  if not found then raise exception 'Audit not found or already closed'; end if;
end $$;

alter table public.auditoria_plantillas enable row level security;
alter table public.auditoria_items enable row level security;
alter table public.auditorias enable row level security;
alter table public.auditoria_partes enable row level security;
alter table public.auditoria_respuestas enable row level security;

create policy "plantillas auditoria dueno" on public.auditoria_plantillas for select to authenticated
  using (public.es_dueno());
create policy "items auditoria dueno" on public.auditoria_items for select to authenticated
  using (public.es_dueno());
create policy "auditorias dueno" on public.auditorias for all to authenticated
  using (public.es_dueno()) with check (public.es_dueno());
create policy "partes auditoria dueno" on public.auditoria_partes for all to authenticated
  using (public.es_dueno()) with check (public.es_dueno());
create policy "respuestas auditoria dueno" on public.auditoria_respuestas for all to authenticated
  using (public.es_dueno()) with check (public.es_dueno());

grant select on public.auditoria_plantillas, public.auditoria_items to authenticated;
grant select, insert, update, delete on public.auditorias, public.auditoria_partes,
  public.auditoria_respuestas to authenticated;
grant all on public.auditoria_plantillas, public.auditoria_items, public.auditorias,
  public.auditoria_partes, public.auditoria_respuestas to service_role;
revoke all on function public.guardar_auditoria(date,date,date,text,text,jsonb),
  public.cerrar_auditoria(uuid,text) from public,anon;
grant execute on function public.guardar_auditoria(date,date,date,text,text,jsonb),
  public.cerrar_auditoria(uuid,text) to authenticated;

notify pgrst, 'reload schema';
