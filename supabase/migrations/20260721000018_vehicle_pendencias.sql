-- Módulo "Pendências por Veículo": controle de rastreador, documentos,
-- vencimentos (IPVA, Licenciamento, CRLV, Seguro/CSV) e multas por veículo,
-- com ambiente de alertas (vencidas / a vencer).

create table if not exists public.vehicle_pendencias (
  id           uuid primary key default gen_random_uuid(),
  vehicle_id   uuid not null references public.vehicles(id) on delete cascade,
  categoria    text not null,
  titulo       text not null,
  descricao    text,
  status       text not null default 'aberta'
                 check (status in ('aberta','em_andamento','resolvida','cancelada')),
  prioridade   text not null default 'media'
                 check (prioridade in ('baixa','media','alta','critica')),
  vencimento   date,
  valor        numeric(14,2),
  pago         boolean not null default false,
  ativo        boolean,
  responsavel  text,
  observacoes  text,
  resolvido_em date,
  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_vehicle_pendencias_vehicle    on public.vehicle_pendencias(vehicle_id);
create index if not exists idx_vehicle_pendencias_status     on public.vehicle_pendencias(status);
create index if not exists idx_vehicle_pendencias_vencimento on public.vehicle_pendencias(vencimento);
create index if not exists idx_vehicle_pendencias_categoria  on public.vehicle_pendencias(categoria);

drop trigger if exists set_updated_at on public.vehicle_pendencias;
create trigger set_updated_at
  before update on public.vehicle_pendencias
  for each row execute function public.set_updated_at();

alter table public.vehicle_pendencias enable row level security;

drop policy if exists pendencias_select on public.vehicle_pendencias;
create policy pendencias_select on public.vehicle_pendencias
  for select to authenticated using (true);

drop policy if exists pendencias_write on public.vehicle_pendencias;
create policy pendencias_write on public.vehicle_pendencias
  for all to authenticated
  using (public.can_manage(array['admin','financeiro','operador']::app_role[]))
  with check (public.can_manage(array['admin','financeiro','operador']::app_role[]));

-- Resumo para o painel de alertas.
create or replace function public.pendencias_summary()
returns jsonb
language sql
security definer
set search_path to 'public'
as $$
  with a as (select * from public.vehicle_pendencias where status in ('aberta','em_andamento'))
  select jsonb_build_object(
    'abertas', (select count(*) from a),
    'vencidas', (select count(*) from a where vencimento is not null and vencimento < current_date),
    'a_vencer_7', (select count(*) from a where vencimento between current_date and current_date + 7),
    'a_vencer_30', (select count(*) from a where vencimento between current_date and current_date + 30),
    'criticas', (select count(*) from a where prioridade = 'critica'),
    'ituran_inativos', (select count(*) from a where categoria ilike '%ituran%' and ativo is false)
  );
$$;

-- Contagem por veículo (para badge na tela de Veículos).
create or replace function public.pendencias_por_veiculo()
returns table(vehicle_id uuid, abertas bigint, vencidas bigint)
language sql
security definer
set search_path to 'public'
as $$
  select vehicle_id,
    count(*) filter (where status in ('aberta','em_andamento')) as abertas,
    count(*) filter (where status in ('aberta','em_andamento') and vencimento is not null and vencimento < current_date) as vencidas
  from public.vehicle_pendencias
  group by vehicle_id;
$$;

revoke all on function public.pendencias_summary() from public, anon;
revoke all on function public.pendencias_por_veiculo() from public, anon;
grant execute on function public.pendencias_summary() to authenticated;
grant execute on function public.pendencias_por_veiculo() to authenticated;
