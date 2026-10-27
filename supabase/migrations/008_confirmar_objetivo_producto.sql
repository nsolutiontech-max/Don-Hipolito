-- The day the owner fixes a product's ideal target, suggestions become enabled for it.
create function public.confirmar_objetivo_producto() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.stock_ideal is not null and old.stock_ideal is distinct from new.stock_ideal then
    new.objetivo_confirmado := true;
  end if;
  return new;
end $$;
create trigger confirmar_objetivo_producto before update on public.productos
  for each row execute function public.confirmar_objetivo_producto();
