-- Keep legacy activities and records; add source-backed daily task occurrences.
alter table public.actividades add column area text not null default 'COCINA' check (area in ('COCINA','SALON'));
alter table public.actividades drop constraint actividades_nombre_key;
alter table public.actividades add unique (area,nombre);
create table public.actividad_programaciones (
  id uuid primary key default gen_random_uuid(),
  actividad_id uuid not null references public.actividades(id),
  codigo text not null unique,
  hora_objetivo text,
  orden int not null,
  instrucciones text not null default '',
  activo boolean not null default true
);
create table public.salon_frecuencias (
  id uuid primary key default gen_random_uuid(),
  orden int not null unique,
  fase text not null check (fase in ('APERTURA','CIERRE')),
  nombre text not null,
  frecuencia text not null
);
alter table public.actividad_registros drop constraint actividad_registros_actividad_id_fecha_key;
alter table public.actividad_registros add column programacion_id uuid references public.actividad_programaciones(id);
alter table public.actividad_registros add column actualizado_por uuid references public.usuarios(id);
alter table public.actividad_registros add unique (programacion_id,fecha);
create index on public.actividad_programaciones(actividad_id);

create function public.puede_ver_area(p_area text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.es_dueno_o_encargado() or (public.rol_actual()='CAMARERO' and p_area='SALON')
$$;
drop policy "lectura operativa" on public.actividades;
drop policy "registros operativa" on public.actividad_registros;
create policy "actividades por area" on public.actividades for select to authenticated
  using (public.puede_ver_area(area));
alter table public.actividad_programaciones enable row level security;
alter table public.salon_frecuencias enable row level security;
create policy "programaciones por area" on public.actividad_programaciones for select to authenticated
  using (exists (select 1 from public.actividades a where a.id=actividad_id and public.puede_ver_area(a.area)));
create policy "frecuencias lectura" on public.salon_frecuencias for select to authenticated
  using (public.puede_ver_area('SALON'));
create policy "programaciones dueno" on public.actividad_programaciones for all to authenticated
  using (public.es_dueno()) with check (public.es_dueno());
create policy "frecuencias dueno" on public.salon_frecuencias for all to authenticated
  using (public.es_dueno()) with check (public.es_dueno());
create policy "registros lectura area" on public.actividad_registros for select to authenticated
  using (exists (select 1 from public.actividades a where a.id=actividad_id and public.puede_ver_area(a.area)));
create policy "registros crear area" on public.actividad_registros for insert to authenticated with check (
  actualizado_por=auth.uid() and exists (
    select 1 from public.actividad_programaciones p join public.actividades a on a.id=p.actividad_id
    where p.id=programacion_id and p.activo and p.actividad_id=actividad_registros.actividad_id and public.puede_ver_area(a.area)));
create policy "registros actualizar area" on public.actividad_registros for update to authenticated using (
  exists (select 1 from public.actividades a where a.id=actividad_id and public.puede_ver_area(a.area))) with check (
  actualizado_por=auth.uid() and exists (
    select 1 from public.actividad_programaciones p join public.actividades a on a.id=p.actividad_id
    where p.id=programacion_id and p.activo and p.actividad_id=actividad_registros.actividad_id and public.puede_ver_area(a.area)));
create trigger autoria_registro before insert or update on public.actividad_registros
  for each row execute function public.autoria_detalle();
-- autoria_detalle also stamps actualizado_en.
alter table public.actividad_registros add column actualizado_en timestamptz not null default now();

create function public.completar_tarea(p_programacion uuid,p_fecha date,p_hora time,p_nota text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_actividad uuid; v_responsable uuid; v_id uuid; begin
  select p.actividad_id into v_actividad from public.actividad_programaciones p
    join public.actividades a on a.id=p.actividad_id where p.id=p_programacion and p.activo and public.puede_ver_area(a.area);
  if v_actividad is null then raise exception 'Access denied' using errcode='42501'; end if;
  select responsable_id into v_responsable from public.usuarios where id=auth.uid() and activo;
  if p_fecha is null or p_hora is null or p_nota is null or length(p_nota)>2000 then raise exception 'Invalid task payload'; end if;
  insert into public.actividad_registros(actividad_id,programacion_id,fecha,hora,responsable_id,nota,actualizado_por)
    values (v_actividad,p_programacion,p_fecha,p_hora,v_responsable,p_nota,auth.uid())
    on conflict (programacion_id,fecha) do update set hora=excluded.hora,nota=excluded.nota,
      responsable_id=excluded.responsable_id,actualizado_por=auth.uid()
    returning id into v_id;
  return v_id;
end $$;
revoke all on function public.puede_ver_area(text),public.completar_tarea(uuid,date,time,text) from public,anon;
grant execute on function public.puede_ver_area(text),public.completar_tarea(uuid,date,time,text) to authenticated;
grant select,insert,update,delete on public.actividad_programaciones,public.salon_frecuencias to authenticated;
grant all on public.actividad_programaciones,public.salon_frecuencias to service_role;
notify pgrst, 'reload schema';
