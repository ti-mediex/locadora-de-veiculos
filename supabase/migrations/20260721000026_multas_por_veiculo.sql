-- Ranking de multas por veículo (valor e quantidade), considerando tanto as
-- multas agrupadas (itens em pendencia_multas) quanto multas avulsas.
create or replace function public.multas_por_veiculo()
returns table(vehicle_id uuid, placa text, modelo text, qtd bigint, valor numeric)
language sql
security definer
set search_path to 'public'
as $$
  select v.id, v.placa, v.modelo,
    coalesce(sum(greatest(1, (select count(*) from public.pendencia_multas m where m.pendencia_id = p.id))), 0)::bigint as qtd,
    coalesce(sum(p.valor), 0) as valor
  from public.vehicles v
  join public.vehicle_pendencias p
    on p.vehicle_id = v.id and p.categoria ilike '%multa%' and p.status <> 'cancelada'
  group by v.id, v.placa, v.modelo
  having count(p.id) > 0
  order by valor desc, qtd desc;
$$;

revoke all on function public.multas_por_veiculo() from public, anon;
grant execute on function public.multas_por_veiculo() to authenticated;
