-- Tempo parado na oficina (rua de manutenção) para desconto por paralisação,
-- histórico de planilhas do Ituran e configurações relacionadas.
alter table public.km_diario add column if not exists min_ocioso_manut integer not null default 0;

-- KM rodado por dia = variação do odômetro (leitura máxima do dia) em relação ao
-- dia anterior com leitura. O odômetro do rastreador Ituran sofre falhas de leitura
-- (quedas bruscas): o veículo continuou rodando, então NÃO zeramos esses dias — no
-- dia da falha usamos a rodagem do próprio dia (odômetro fim − início) e o incremento
-- posterior segue contado como rodagem real. Um teto por dia (km_teto_dia, padrão
-- 1000 km) limita picos/recuperações espúrias do sensor.
drop view if exists public.km_diario_calc;
create view public.km_diario_calc as
select k.vehicle_id, k.placa, k.dia, k.odom_inicio, k.odom_fim, k.registros, k.min_ocioso_manut,
  least(
    coalesce((select nullif(valor,'')::numeric from public.app_config where chave = 'km_teto_dia'), 1000),
    greatest(0,
      case
        when lag(k.odom_fim) over w is null then k.odom_fim - k.odom_inicio
        when k.odom_fim < lag(k.odom_fim) over w then k.odom_fim - k.odom_inicio -- falha de leitura: conta a rodagem do próprio dia
        else k.odom_fim - lag(k.odom_fim) over w
      end
    )
  ) as km
from public.km_diario k
window w as (partition by k.vehicle_id order by k.dia);
grant select on public.km_diario_calc to authenticated;

-- Guarda também as planilhas do Ituran no histórico de importações.
alter table public.import_history drop constraint if exists import_history_tipo_check;
alter table public.import_history add constraint import_history_tipo_check
  check (tipo in ('detran','consulta_placa','ituran'));

insert into public.app_config (chave, valor) values
  ('franquia_km_mensal', '6000'),
  ('endereco_manutencao', 'General Góes Monteiro'),
  ('km_teto_dia', '1000')
on conflict (chave) do nothing;
