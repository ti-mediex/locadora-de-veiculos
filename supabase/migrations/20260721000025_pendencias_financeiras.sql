-- Agregação das pendências FINANCEIRAS (com valor) em aberto, por veículo,
-- para o painel de gestão do dashboard.
create or replace function public.pendencias_financeiras_por_veiculo()
returns table(vehicle_id uuid, placa text, modelo text, total numeric, vencido numeric, qtd bigint)
language sql
security definer
set search_path to 'public'
as $$
  select p.vehicle_id, v.placa, v.modelo,
    coalesce(sum(p.valor), 0) as total,
    coalesce(sum(p.valor) filter (where p.vencimento is not null and p.vencimento < current_date), 0) as vencido,
    count(*) as qtd
  from public.vehicle_pendencias p
  join public.vehicles v on v.id = p.vehicle_id
  where p.status in ('aberta','em_andamento') and p.valor is not null and p.valor > 0
  group by p.vehicle_id, v.placa, v.modelo
  having coalesce(sum(p.valor), 0) > 0
  order by total desc;
$$;

-- Resumo financeiro geral das pendências (por categoria) em aberto.
create or replace function public.pendencias_financeiras_resumo()
returns jsonb
language sql
security definer
set search_path to 'public'
as $$
  select jsonb_build_object(
    'total', coalesce(sum(valor), 0),
    'vencido', coalesce(sum(valor) filter (where vencimento is not null and vencimento < current_date), 0),
    'por_categoria', coalesce((
      select jsonb_object_agg(categoria, soma)
      from (
        select categoria, sum(valor) as soma
        from public.vehicle_pendencias
        where status in ('aberta','em_andamento') and valor is not null and valor > 0
        group by categoria
      ) t
    ), '{}'::jsonb)
  )
  from public.vehicle_pendencias
  where status in ('aberta','em_andamento') and valor is not null and valor > 0;
$$;

revoke all on function public.pendencias_financeiras_por_veiculo() from public, anon;
revoke all on function public.pendencias_financeiras_resumo() from public, anon;
grant execute on function public.pendencias_financeiras_por_veiculo() to authenticated;
grant execute on function public.pendencias_financeiras_resumo() to authenticated;
