-- =============================================================================
-- VIP CARS — Simplificação: módulo único de Receitas e Despesas (por veículo)
-- =============================================================================
create table if not exists public.finance_entries (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('receita','despesa')),
  data date not null default current_date,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  categoria text, descricao text not null, valor numeric(12,2) not null,
  forma_pagamento text, observacoes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create trigger trg_finance_entries_updated before update on public.finance_entries
  for each row execute function public.set_updated_at();
create index if not exists idx_finance_data on public.finance_entries(data);
create index if not exists idx_finance_tipo on public.finance_entries(tipo);
create index if not exists idx_finance_vehicle on public.finance_entries(vehicle_id);

alter table public.finance_entries enable row level security;
drop policy if exists "finance_entries_select" on public.finance_entries;
create policy "finance_entries_select" on public.finance_entries for select to authenticated using (true);
drop policy if exists "finance_entries_write" on public.finance_entries;
create policy "finance_entries_write" on public.finance_entries for all to authenticated
  using (public.can_manage(array['admin','financeiro']::app_role[]))
  with check (public.can_manage(array['admin','financeiro']::app_role[]));

create or replace function public.finance_summary(
  p_inicio date default date_trunc('month', current_date)::date,
  p_fim date default (date_trunc('month', current_date) + interval '1 month - 1 day')::date)
returns jsonb language sql security definer set search_path = public as $$
  with base as (
    select coalesce(sum(valor) filter (where tipo='receita' and data between p_inicio and p_fim),0) as receita_mes,
           coalesce(sum(valor) filter (where tipo='despesa' and data between p_inicio and p_fim),0) as despesa_mes,
           coalesce(sum(valor) filter (where tipo='receita'),0) as receita_total,
           coalesce(sum(valor) filter (where tipo='despesa'),0) as despesa_total
    from public.finance_entries)
  select jsonb_build_object('periodo_inicio',p_inicio,'periodo_fim',p_fim,
    'receita_mes',receita_mes,'despesa_mes',despesa_mes,'lucro_mes',receita_mes-despesa_mes,
    'margem_mes',case when receita_mes>0 then round(((receita_mes-despesa_mes)/receita_mes)*100,1) else 0 end,
    'receita_total',receita_total,'despesa_total',despesa_total,'lucro_total',receita_total-despesa_total,
    'total_veiculos',(select count(*) from public.vehicles where status<>'inativo')) from base;
$$;
revoke execute on function public.finance_summary(date,date) from public, anon;
grant execute on function public.finance_summary(date,date) to authenticated;

create or replace function public.finance_monthly(p_meses int default 12)
returns table (mes text, receita numeric, despesa numeric)
language sql security definer set search_path = public as $$
  with meses as (select to_char(d,'YYYY-MM') as mes, d::date as ini, (d + interval '1 month - 1 day')::date as fim
    from generate_series(date_trunc('month',current_date)-((p_meses-1)||' months')::interval, date_trunc('month',current_date), interval '1 month') d)
  select m.mes,
    coalesce((select sum(valor) from public.finance_entries f where f.tipo='receita' and f.data between m.ini and m.fim),0),
    coalesce((select sum(valor) from public.finance_entries f where f.tipo='despesa' and f.data between m.ini and m.fim),0)
  from meses m order by m.mes;
$$;
revoke execute on function public.finance_monthly(int) from public, anon;
grant execute on function public.finance_monthly(int) to authenticated;

create or replace function public.finance_by_vehicle()
returns table (vehicle_id uuid, placa text, modelo text, receita numeric, despesa numeric, resultado numeric)
language sql security definer set search_path = public as $$
  select v.id, v.placa, v.marca||' '||v.modelo,
    coalesce(sum(f.valor) filter (where f.tipo='receita'),0),
    coalesce(sum(f.valor) filter (where f.tipo='despesa'),0),
    coalesce(sum(f.valor) filter (where f.tipo='receita'),0)-coalesce(sum(f.valor) filter (where f.tipo='despesa'),0)
  from public.vehicles v left join public.finance_entries f on f.vehicle_id=v.id
  where v.status<>'inativo' group by v.id,v.placa,v.marca,v.modelo order by 6 desc;
$$;
revoke execute on function public.finance_by_vehicle() from public, anon;
grant execute on function public.finance_by_vehicle() to authenticated;
