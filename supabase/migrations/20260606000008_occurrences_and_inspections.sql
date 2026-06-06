-- =============================================================================
-- FrotaGest — Ocorrências (inspirado no Blue Fleet) + Checklist/Vistoria
-- =============================================================================

do $$ begin
  create type occurrence_type as enum
    ('manutencao','sinistro','infracao','veiculo_reserva','devolucao','preparacao','translado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type occurrence_status as enum ('aberta','em_andamento','resolvida','cancelada');
exception when duplicate_object then null; end $$;

do $$ begin
  create type inspection_type as enum ('entrega','devolucao');
exception when duplicate_object then null; end $$;

-- Ocorrências ------------------------------------------------------------------
create table if not exists public.occurrences (
  id uuid primary key default gen_random_uuid(),
  tipo occurrence_type not null,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  renter_id uuid references public.renters(id) on delete set null,
  contract_id uuid references public.contracts(id) on delete set null,
  data date not null default current_date,
  descricao text not null,
  valor numeric(12,2),
  status occurrence_status not null default 'aberta',
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_occurrences_updated before update on public.occurrences
  for each row execute function public.set_updated_at();
create index if not exists idx_occurrences_vehicle on public.occurrences(vehicle_id);
create index if not exists idx_occurrences_data on public.occurrences(data);
create index if not exists idx_occurrences_tipo on public.occurrences(tipo);

-- Vistorias / Checklist --------------------------------------------------------
create table if not exists public.inspections (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  contract_id uuid references public.contracts(id) on delete set null,
  tipo inspection_type not null default 'entrega',
  data date not null default current_date,
  km int,
  nivel_combustivel int,                 -- 0 a 100 (%)
  itens jsonb not null default '{}',
  avarias text,
  observacoes text,
  responsavel text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_inspections_updated before update on public.inspections
  for each row execute function public.set_updated_at();
create index if not exists idx_inspections_vehicle on public.inspections(vehicle_id);

-- RLS --------------------------------------------------------------------------
alter table public.occurrences enable row level security;
alter table public.inspections enable row level security;

drop policy if exists "occurrences_select" on public.occurrences;
create policy "occurrences_select" on public.occurrences for select to authenticated using (true);
drop policy if exists "occurrences_write" on public.occurrences;
create policy "occurrences_write" on public.occurrences for all to authenticated
  using (public.can_manage(array['admin','operador','financeiro']::app_role[]))
  with check (public.can_manage(array['admin','operador','financeiro']::app_role[]));

drop policy if exists "inspections_select" on public.inspections;
create policy "inspections_select" on public.inspections for select to authenticated using (true);
drop policy if exists "inspections_write" on public.inspections;
create policy "inspections_write" on public.inspections for all to authenticated
  using (public.can_manage(array['admin','operador']::app_role[]))
  with check (public.can_manage(array['admin','operador']::app_role[]));

-- Funções de dashboard ---------------------------------------------------------
create or replace function public.occurrences_by_day(p_dias int default 30)
returns table (dia date, tipo text, total bigint)
language sql security definer set search_path = public as $$
  select data::date, tipo::text, count(*)::bigint
  from public.occurrences
  where data >= (current_date - p_dias)
  group by 1, 2
  order by 1;
$$;
revoke execute on function public.occurrences_by_day(int) from public, anon;
grant execute on function public.occurrences_by_day(int) to authenticated;

create or replace function public.occurrences_by_type(p_dias int default 30)
returns table (tipo text, total bigint)
language sql security definer set search_path = public as $$
  select tipo::text, count(*)::bigint
  from public.occurrences
  where data >= (current_date - p_dias)
  group by 1
  order by 2 desc;
$$;
revoke execute on function public.occurrences_by_type(int) from public, anon;
grant execute on function public.occurrences_by_type(int) to authenticated;
