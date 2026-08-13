-- Trocas de veículo por locatário: quando o veículo do contrato entra em
-- manutenção, o locatário recebe um veículo reserva. Registra o histórico das
-- trocas e sustenta o aviso do reserva/contrato enquanto a troca está ativa.
create table if not exists public.trocas_veiculo (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid references public.contratos(id) on delete set null,
  locatario_id uuid references public.locatarios(id) on delete set null,
  locatario_nome text,
  veiculo_origem_id uuid references public.vehicles(id) on delete set null,   -- veículo do contrato (foi p/ manutenção)
  placa_origem text,
  veiculo_reserva_id uuid references public.vehicles(id) on delete set null,  -- veículo reserva entregue
  placa_reserva text,
  motivo text not null default 'manutencao',   -- manutencao | sinistro | revisao | outro
  ocorrencia_id uuid references public.ocorrencias(id) on delete set null,
  data_troca date not null default current_date,
  hora_troca text,
  km_origem integer,
  km_reserva integer,
  data_retorno date,
  km_retorno integer,
  status text not null default 'ativa',         -- ativa | encerrada
  observacoes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_trocas_contrato on public.trocas_veiculo (contrato_id);
create index if not exists idx_trocas_origem on public.trocas_veiculo (veiculo_origem_id);
create index if not exists idx_trocas_reserva on public.trocas_veiculo (veiculo_reserva_id);
create index if not exists idx_trocas_status on public.trocas_veiculo (status);

create trigger trg_trocas_veiculo_updated before update on public.trocas_veiculo
  for each row execute function public.set_updated_at();

alter table public.trocas_veiculo enable row level security;
drop policy if exists trocas_select on public.trocas_veiculo;
create policy trocas_select on public.trocas_veiculo for select using (true);
drop policy if exists trocas_write on public.trocas_veiculo;
create policy trocas_write on public.trocas_veiculo for all
  using (public.can_manage(array['admin','financeiro','operador']::app_role[]))
  with check (public.can_manage(array['admin','financeiro','operador']::app_role[]));
