-- Papel "vistoriador": adicionado ao enum app_role (feito em migração de dados)
-- e habilitado a escrever apenas nas vistorias.
do $$ begin
  if not exists (select 1 from pg_enum e join pg_type t on t.oid=e.enumtypid
                 where t.typname='app_role' and e.enumlabel='vistoriador') then
    alter type public.app_role add value 'vistoriador';
  end if;
end $$;

drop policy if exists vistorias_write on public.vistorias;
create policy vistorias_write on public.vistorias for all to authenticated
  using (public.can_manage(array['admin','financeiro','operador','vistoriador']::app_role[]))
  with check (public.can_manage(array['admin','financeiro','operador','vistoriador']::app_role[]));

drop policy if exists vistoria_fotos_write on public.vistoria_fotos;
create policy vistoria_fotos_write on public.vistoria_fotos for all to authenticated
  using (public.can_manage(array['admin','financeiro','operador','vistoriador']::app_role[]))
  with check (public.can_manage(array['admin','financeiro','operador','vistoriador']::app_role[]));
