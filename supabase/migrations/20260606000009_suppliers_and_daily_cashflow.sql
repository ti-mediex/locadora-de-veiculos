-- =============================================================================
-- FrotaGest — Fornecedores (inspirado no Blue Fleet) + Fluxo de caixa diário
-- =============================================================================

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  nome_fantasia text not null,
  razao_social text,
  tipo text,
  cnpj text,
  categoria text,
  classificacao text,
  codigo text,
  site text,
  telefone text,
  email text,
  cep text,
  endereco text,
  complemento text,
  bairro text,
  cidade text,
  estado text,
  inscricao_estadual text,
  inscricao_municipal text,
  prazo_pagamento int,
  banco text,
  agencia text,
  conta text,
  chave_pix text,
  status text not null default 'ativo',
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_suppliers_updated before update on public.suppliers
  for each row execute function public.set_updated_at();
create index if not exists idx_suppliers_tipo on public.suppliers(tipo);

alter table public.suppliers enable row level security;
drop policy if exists "suppliers_select" on public.suppliers;
create policy "suppliers_select" on public.suppliers for select to authenticated using (true);
drop policy if exists "suppliers_write" on public.suppliers;
create policy "suppliers_write" on public.suppliers for all to authenticated
  using (public.can_manage(array['admin','operador']::app_role[]))
  with check (public.can_manage(array['admin','operador']::app_role[]));

-- Fluxo de caixa diário (mês corrente por padrão)
create or replace function public.daily_cashflow(
  p_inicio date default date_trunc('month', current_date)::date,
  p_fim date default (date_trunc('month', current_date) + interval '1 month - 1 day')::date
)
returns table (dia date, entrada numeric, saida numeric)
language sql security definer set search_path = public as $$
  with dias as (
    select generate_series(p_inicio, p_fim, interval '1 day')::date as d
  )
  select
    dias.d as dia,
    coalesce((select sum(r.valor_pago) from public.receivables r where r.data_pagamento = dias.d), 0) as entrada,
    coalesce((select sum(e.valor) from public.expenses e where e.data = dias.d and e.status <> 'cancelado'), 0)
    + coalesce((select sum(m.valor) from public.maintenances m where m.data = dias.d and m.status <> 'cancelada'), 0) as saida
  from dias
  order by dias.d;
$$;
revoke execute on function public.daily_cashflow(date, date) from public, anon;
grant execute on function public.daily_cashflow(date, date) to authenticated;
