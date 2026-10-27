-- Practical interview evaluations. Owner-only private HR record.

create table public.entrevista_plantillas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  version int not null check (version > 0),
  activa boolean not null default true,
  creado_en timestamptz not null default now()
);

create table public.entrevista_secciones (
  id uuid primary key default gen_random_uuid(),
  plantilla_id uuid not null references public.entrevista_plantillas(id),
  codigo text not null,
  titulo text not null,
  instruccion text not null default '',
  orden int not null,
  unique (plantilla_id, codigo),
  unique (plantilla_id, orden),
  unique (id, plantilla_id)
);

create table public.entrevista_criterios (
  id uuid primary key default gen_random_uuid(),
  plantilla_id uuid not null references public.entrevista_plantillas(id),
  seccion_id uuid not null references public.entrevista_secciones(id),
  codigo text not null unique,
  texto text not null,
  orden int not null,
  unique (plantilla_id, orden)
);

create table public.entrevistas (
  id uuid primary key default gen_random_uuid(),
  plantilla_id uuid not null references public.entrevista_plantillas(id),
  fecha date not null,
  candidato text not null check (length(trim(candidato)) between 1 and 200),
  puesto_aspira text not null default '',
  estado text not null default 'BORRADOR' check (estado in ('BORRADOR','REGISTRADA')),
  tecnica_actual smallint check (tecnica_actual between 1 and 5),
  velocidad smallint check (velocidad between 1 and 5),
  prolijidad smallint check (prolijidad between 1 and 5),
  capacidad_aprendizaje smallint check (capacidad_aprendizaje between 1 and 5),
  actitud smallint check (actitud between 1 and 5),
  decision text check (decision in ('SI','SI_CAPACITACION','DUDAS','NO')),
  puesto_sugerido text not null default '',
  observaciones_finales text not null default '',
  evaluador_id uuid not null references public.usuarios(id),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table public.entrevista_seccion_respuestas (
  entrevista_id uuid not null references public.entrevistas(id) on delete cascade,
  seccion_id uuid not null references public.entrevista_secciones(id),
  resultado text check (resultado in ('MUY_BUENO','BUENO','REGULAR','MALO')),
  observaciones text not null default '',
  primary key (entrevista_id, seccion_id)
);

create table public.entrevista_criterio_respuestas (
  entrevista_id uuid not null references public.entrevistas(id) on delete cascade,
  criterio_id uuid not null references public.entrevista_criterios(id),
  valor boolean,
  observacion text not null default '',
  primary key (entrevista_id, criterio_id)
);

create index idx_entrevistas_fecha on public.entrevistas(fecha desc);

create function public.entrevista_autoria() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then new.creado_en := old.creado_en; end if;
  if auth.uid() is null then raise exception 'Authenticated user required' using errcode='42501'; end if;
  new.evaluador_id := auth.uid();
  new.actualizado_en := now();
  return new;
end $$;
create trigger entrevista_autoria before insert or update on public.entrevistas
  for each row execute function public.entrevista_autoria();

create function public.entrevista_criterio_guard() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare v_plantilla uuid;
begin
  select plantilla_id into v_plantilla from public.entrevistas where id=new.entrevista_id;
  if v_plantilla is null then raise exception 'Interview not found'; end if;
  if not exists (
    select 1 from public.entrevista_criterios c
    where c.id=new.criterio_id and c.plantilla_id=v_plantilla
  ) then raise exception 'Criterion does not belong to this interview template'; end if;
  return new;
end $$;
create trigger entrevista_criterio_guard before insert or update on public.entrevista_criterio_respuestas
  for each row execute function public.entrevista_criterio_guard();

create function public.entrevista_seccion_guard() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare v_plantilla uuid;
begin
  select plantilla_id into v_plantilla from public.entrevistas where id=new.entrevista_id;
  if v_plantilla is null then raise exception 'Interview not found'; end if;
  if not exists (
    select 1 from public.entrevista_secciones s
    where s.id=new.seccion_id and s.plantilla_id=v_plantilla
  ) then raise exception 'Section does not belong to this interview template'; end if;
  return new;
end $$;
create trigger entrevista_seccion_guard before insert or update on public.entrevista_seccion_respuestas
  for each row execute function public.entrevista_seccion_guard();

alter table public.entrevista_plantillas enable row level security;
alter table public.entrevista_secciones enable row level security;
alter table public.entrevista_criterios enable row level security;
alter table public.entrevistas enable row level security;
alter table public.entrevista_seccion_respuestas enable row level security;
alter table public.entrevista_criterio_respuestas enable row level security;

create policy "plantillas entrevista dueno" on public.entrevista_plantillas for select to authenticated
  using (public.es_dueno());
create policy "secciones plantilla dueno" on public.entrevista_secciones for select to authenticated
  using (public.es_dueno());
create policy "criterios plantilla dueno" on public.entrevista_criterios for select to authenticated
  using (public.es_dueno());
create policy "entrevistas dueno" on public.entrevistas for all to authenticated
  using (public.es_dueno()) with check (public.es_dueno());
create policy "resultados seccion dueno" on public.entrevista_seccion_respuestas for all to authenticated
  using (public.es_dueno()) with check (public.es_dueno());
create policy "respuestas criterio dueno" on public.entrevista_criterio_respuestas for all to authenticated
  using (public.es_dueno()) with check (public.es_dueno());

grant select on public.entrevista_plantillas, public.entrevista_secciones, public.entrevista_criterios to authenticated;
grant select, insert, update, delete on public.entrevistas, public.entrevista_seccion_respuestas,
  public.entrevista_criterio_respuestas to authenticated;
grant all on public.entrevista_plantillas, public.entrevista_secciones, public.entrevista_criterios to service_role;

notify pgrst, 'reload schema';
