-- Apuração de KM por veículo: leituras diárias de odômetro (base) importadas
-- do relatório de ociosidade do Ituran, e view que calcula o KM rodado por dia.
create table if not exists public.km_diario (
  id          uuid primary key default gen_random_uuid(),
  vehicle_id  uuid references public.vehicles(id) on delete cascade,
  placa       text not null,
  dia         date not null,
  odom_inicio numeric(12,1),
  odom_fim    numeric(12,1),
  registros   integer not null default 0,
  updated_at  timestamptz not null default now(),
  unique (vehicle_id, dia)
);
create index if not exists idx_km_diario_vehicle_dia on public.km_diario(vehicle_id, dia);

alter table public.km_diario enable row level security;
drop policy if exists km_diario_select on public.km_diario;
create policy km_diario_select on public.km_diario for select to authenticated using (true);
drop policy if exists km_diario_write on public.km_diario;
create policy km_diario_write on public.km_diario for all to authenticated
  using (public.can_manage(array['admin','financeiro','operador']::app_role[]))
  with check (public.can_manage(array['admin','financeiro','operador']::app_role[]));

-- KM rodado por dia = variação do odômetro em relação ao dia anterior com leitura.
create or replace view public.km_diario_calc as
select k.vehicle_id, k.placa, k.dia, k.odom_inicio, k.odom_fim, k.registros,
  greatest(0, coalesce(
    k.odom_fim - lag(k.odom_fim) over (partition by k.vehicle_id order by k.dia),
    k.odom_fim - k.odom_inicio
  )) as km
from public.km_diario k;

grant select on public.km_diario_calc to authenticated;
