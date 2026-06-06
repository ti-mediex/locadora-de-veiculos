-- =============================================================================
-- FrotaGest — Controle de acesso por papel (RLS granular)
-- Leitura liberada a qualquer autenticado (necessário para joins e dashboard).
-- Escrita restrita por papel: operador (frota/cadastros), financeiro (financeiro),
-- admin (tudo).
-- =============================================================================

create or replace function public.can_manage(p_roles app_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = any(p_roles) from public.profiles where id = auth.uid()), false);
$$;
grant execute on function public.can_manage(app_role[]) to authenticated;

do $$
declare
  cfg jsonb := jsonb_build_object(
    'vehicles',     'operador',
    'renters',      'operador',
    'maintenances', 'operador',
    'contracts',    'financeiro',
    'receivables',  'financeiro',
    'expenses',     'financeiro',
    'fines',        'financeiro'
  );
  t text;
  extra_role text;
begin
  for t, extra_role in select key, value::text from jsonb_each_text(cfg) loop
    execute format('drop policy if exists "%s_all" on public.%s;', t, t);
    execute format('drop policy if exists "%s_select" on public.%s;', t, t);
    execute format('drop policy if exists "%s_write" on public.%s;', t, t);

    -- leitura: todos autenticados
    execute format(
      'create policy "%s_select" on public.%s for select to authenticated using (true);',
      t, t
    );
    -- escrita (insert/update/delete): admin + papel do módulo
    execute format(
      'create policy "%s_write" on public.%s for all to authenticated '
      || 'using (public.can_manage(array[''admin'',''%s'']::app_role[])) '
      || 'with check (public.can_manage(array[''admin'',''%s'']::app_role[]));',
      t, t, extra_role, extra_role
    );
  end loop;
end $$;
