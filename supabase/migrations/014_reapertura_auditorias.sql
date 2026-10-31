-- Reopening audits (DUEÑO/ENCARGADO) with a mandatory reason; every close keeps
-- a delivery record so corrected audits never lose their previous delivery.

-- 1. New lifecycle state: ABIERTO means a closed audit was reopened to edit.
alter table public.auditorias drop constraint auditorias_estado_check;
alter table public.auditorias add constraint auditorias_estado_check
  check (estado in ('BORRADOR','ABIERTO','CERRADO'));
alter table public.auditorias
  add column if not exists abierto_por uuid references public.usuarios(id),
  add column if not exists abierto_en timestamptz,
  add column if not exists motivo_apertura text not null default '';

-- 2. The authoring guard permits exactly one CERRADO→ABIERTO transition and it
-- must not carry any content change: reopening only unlocks the audit.
create or replace function public.auditoria_autoria() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare v_esperados int; v_respondidos int;
begin
  if auth.uid() is null then raise exception 'Authenticated user required' using errcode='42501'; end if;
  if tg_op = 'UPDATE' then
    new.creado_por := old.creado_por;
    new.creado_en := old.creado_en;
    if old.estado = 'CERRADO' then
      if new.estado = 'ABIERTO' then
        if new.fecha is distinct from old.fecha
           or new.plantilla_id is distinct from old.plantilla_id
           or new.observaciones_generales is distinct from old.observaciones_generales
           or new.firma is distinct from old.firma
           or new.cerrado_en is distinct from old.cerrado_en
           or length(trim(new.motivo_apertura)) = 0 then
          raise exception 'Reopen only unlocks the audit; a reason is required';
        end if;
        new.actualizado_por := auth.uid();
        new.actualizado_en := now();
        new.abierto_por := auth.uid();
        new.abierto_en := now();
        return new;
      end if;
      raise exception 'Closed audits are immutable';
    end if;
    if new.estado = 'ABIERTO' and old.estado <> 'ABIERTO' then
      raise exception 'Audits open only from CERRADO';
    end if;
  else
    -- tg_op='INSERT': ON CONFLICT DO UPDATE also lands here, with old set.
    if old.id is not null then
      new.creado_por := old.creado_por;
      new.creado_en := old.creado_en;
      if old.estado = 'CERRADO' then raise exception 'Closed audits are immutable'; end if;
      if new.estado = 'ABIERTO' and old.estado <> 'ABIERTO' then
        raise exception 'Audits open only from CERRADO';
      end if;
    else
      if new.estado = 'ABIERTO' then
        raise exception 'Audits open only from CERRADO';
      end if;
      new.creado_por := auth.uid();
    end if;
  end if;
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
    new.cerrado_en := now();
    new.abierto_por := null;
    new.abierto_en := null;
    new.motivo_apertura := '';
  end if;
  return new;
end $$;
create or replace trigger auditoria_autoria before insert or update on public.auditorias
  for each row execute function public.auditoria_autoria();

-- 3. Closure accepts a fresh draft again after a reopen.
create or replace function public.cerrar_auditoria(p_id uuid, p_firma text)
returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if not public.es_dueno_o_encargado() then raise exception 'Access denied' using errcode='42501'; end if;
  if p_firma is null or length(trim(p_firma)) = 0 then raise exception 'Signature is required to close'; end if;
  update public.auditorias set estado='CERRADO', firma=trim(p_firma), actualizado_por=auth.uid()
    where id=p_id and estado in ('BORRADOR','ABIERTO');
  if not found then raise exception 'Audit not found or already closed'; end if;
end $$;

-- 4. Reopen RPC: reason is mandatory with traceability fields derived from the
-- session (set by the authoring guard).
create or replace function public.reabrir_auditoria(p_id uuid, p_motivo text)
returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if not public.es_dueno_o_encargado() then raise exception 'Access denied' using errcode='42501'; end if;
  if p_motivo is null or length(trim(p_motivo)) < 5 or length(trim(p_motivo)) > 500 then
    raise exception 'The reopen reason requires 5-500 characters';
  end if;
  update public.auditorias set estado='ABIERTO', motivo_apertura=trim(p_motivo)
    where id=p_id and estado='CERRADO';
  if not found then raise exception 'Audit not found or already open'; end if;
end $$;

-- 5. Delivery log: each close snapshots firma/score/closer, and the reopen
-- stamps that same record with who/when/why. SECURITY DEFINER was reserved for
-- predicates, so this trigger is the one documented exception: it is not
-- callable and satisfies the rule that the log cannot be written by any caller.
create table public.auditoria_entregas (
  id uuid primary key default gen_random_uuid(),
  auditoria_id uuid not null references public.auditorias(id) on delete cascade,
  firma text not null default '',
  ok int not null,
  no_ok int not null,
  pendientes int not null,
  cerrado_por uuid not null references public.usuarios(id),
  cerrado_en timestamptz not null,
  abierto_por uuid references public.usuarios(id),
  abierto_en timestamptz,
  motivo_apertura text not null default ''
);
create index idx_auditoria_entregas_auditoria on public.auditoria_entregas(auditoria_id);
alter table public.auditoria_entregas enable row level security;
create policy "entregas lectura" on public.auditoria_entregas for select to authenticated
  using (public.es_dueno_o_encargado());

create function public.auditoria_entregas_bitacora() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_ok int; v_no_ok int; v_pendientes int;
begin
  if tg_op = 'UPDATE' and new.estado = 'CERRADO' and old.estado <> 'CERRADO' then
    select count(*) filter (where r.resultado = 'OK'),
           count(*) filter (where r.resultado = 'NO_OK'),
           count(*) filter (where r.resultado is null)
      into v_ok, v_no_ok, v_pendientes
      from public.auditoria_items i
      left join public.auditoria_respuestas r
        on r.auditoria_id = new.id and r.item_id = i.id
      where i.plantilla_id = new.plantilla_id;
    insert into public.auditoria_entregas
      (auditoria_id, firma, ok, no_ok, pendientes, cerrado_por, cerrado_en)
      values (new.id, new.firma, v_ok, v_no_ok, v_pendientes,
        new.actualizado_por, new.cerrado_en);
  end if;
  if tg_op = 'UPDATE' and old.estado = 'CERRADO' and new.estado = 'ABIERTO' then
    update public.auditoria_entregas
      set abierto_por = new.abierto_por, abierto_en = new.abierto_en, motivo_apertura = new.motivo_apertura
      where id = (select id from public.auditoria_entregas
        where auditoria_id = new.id and abierto_en is null
        order by cerrado_en desc limit 1);
  end if;
  return new;
end $$;
create trigger auditoria_entregas_bitacora after update on public.auditorias
  for each row execute function public.auditoria_entregas_bitacora();

revoke all on function public.reabrir_auditoria(uuid,text) from public, anon;
grant execute on function public.reabrir_auditoria(uuid,text) to authenticated;

notify pgrst, 'reload schema';
