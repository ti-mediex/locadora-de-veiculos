-- =============================================================================
-- FrotaGest — Schema inicial
-- Gestão financeira de frota para locação de veículos a motoristas de aplicativo
-- =============================================================================

-- Extensões -------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- =============================================================================
-- ENUMS
-- =============================================================================
do $$ begin
  create type vehicle_status as enum ('disponivel', 'locado', 'manutencao', 'inativo');
exception when duplicate_object then null; end $$;

do $$ begin
  create type renter_status as enum ('ativo', 'inativo', 'bloqueado', 'prospect');
exception when duplicate_object then null; end $$;

do $$ begin
  create type billing_cycle as enum ('diario', 'semanal', 'quinzenal', 'mensal');
exception when duplicate_object then null; end $$;

do $$ begin
  create type contract_status as enum ('ativo', 'encerrado', 'suspenso', 'inadimplente', 'rascunho');
exception when duplicate_object then null; end $$;

do $$ begin
  create type receivable_status as enum ('pendente', 'pago', 'parcial', 'atrasado', 'cancelado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type maintenance_type as enum ('preventiva', 'corretiva', 'sinistro', 'revisao');
exception when duplicate_object then null; end $$;

do $$ begin
  create type maintenance_status as enum ('agendada', 'em_andamento', 'concluida', 'cancelada');
exception when duplicate_object then null; end $$;

do $$ begin
  create type fine_status as enum ('lancada', 'repassada', 'paga', 'recorrida', 'cancelada');
exception when duplicate_object then null; end $$;

do $$ begin
  create type expense_status as enum ('pendente', 'pago', 'cancelado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type app_role as enum ('admin', 'financeiro', 'operador');
exception when duplicate_object then null; end $$;

-- =============================================================================
-- FUNÇÃO updated_at
-- =============================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================================
-- PROFILES (usuários do sistema)
-- =============================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  role app_role not null default 'operador',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- Cria profile automaticamente ao registrar usuário no Auth
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.email,
    -- primeiro usuário do sistema vira admin
    case when (select count(*) from public.profiles) = 0 then 'admin'::app_role
         else 'operador'::app_role end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- VEÍCULOS
-- =============================================================================
create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  placa text not null unique,
  renavam text,
  chassi text,
  marca text not null,
  modelo text not null,
  ano_fabricacao int,
  ano_modelo int,
  cor text,
  categoria text,                      -- hatch, sedan, suv...
  km_atual int not null default 0,
  status vehicle_status not null default 'disponivel',
  data_aquisicao date,
  valor_aquisicao numeric(12,2),
  valor_fipe numeric(12,2),
  financiado boolean not null default false,
  valor_parcela_financiamento numeric(12,2),
  qtd_parcelas_financiamento int,
  parcelas_pagas int default 0,
  fornecedor text,
  observacoes text,
  foto_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_vehicles_updated before update on public.vehicles
  for each row execute function public.set_updated_at();
create index if not exists idx_vehicles_status on public.vehicles(status);

-- =============================================================================
-- LOCATÁRIOS
-- =============================================================================
create table if not exists public.renters (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cpf text not null unique,
  rg text,
  cnh text,
  categoria_cnh text,
  validade_cnh date,
  data_nascimento date,
  telefone text,
  email text,
  cep text,
  endereco text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  estado text,
  chave_pix text,
  contato_emergencia_nome text,
  contato_emergencia_telefone text,
  status renter_status not null default 'ativo',
  observacoes text,
  foto_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_renters_updated before update on public.renters
  for each row execute function public.set_updated_at();
create index if not exists idx_renters_status on public.renters(status);

-- =============================================================================
-- CONTRATOS
-- =============================================================================
create sequence if not exists public.contract_number_seq start 1000;

create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique default ('CT-' || nextval('public.contract_number_seq')::text),
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  renter_id uuid not null references public.renters(id) on delete restrict,
  data_inicio date not null,
  data_fim date,
  ciclo_cobranca billing_cycle not null default 'semanal',
  valor_aluguel numeric(12,2) not null,
  dia_vencimento int,                  -- 0-6 (dia da semana) ou 1-31 (dia do mês)
  valor_caucao numeric(12,2) default 0,
  caucao_devolvida boolean not null default false,
  km_inicial int,
  km_final int,
  status contract_status not null default 'ativo',
  observacoes text,
  contrato_pdf_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_contracts_updated before update on public.contracts
  for each row execute function public.set_updated_at();
create index if not exists idx_contracts_status on public.contracts(status);
create index if not exists idx_contracts_vehicle on public.contracts(vehicle_id);
create index if not exists idx_contracts_renter on public.contracts(renter_id);

-- =============================================================================
-- RECEBÍVEIS (cobranças / parcelas de aluguel)
-- =============================================================================
create table if not exists public.receivables (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  competencia text,                    -- ex: "2026-W23" ou "2026-06"
  periodo_inicio date,
  periodo_fim date,
  vencimento date not null,
  valor numeric(12,2) not null,
  valor_pago numeric(12,2) not null default 0,
  juros numeric(12,2) not null default 0,
  multa numeric(12,2) not null default 0,
  data_pagamento date,
  forma_pagamento text,
  status receivable_status not null default 'pendente',
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_receivables_updated before update on public.receivables
  for each row execute function public.set_updated_at();
create index if not exists idx_receivables_contract on public.receivables(contract_id);
create index if not exists idx_receivables_status on public.receivables(status);
create index if not exists idx_receivables_vencimento on public.receivables(vencimento);

-- =============================================================================
-- MANUTENÇÕES
-- =============================================================================
create table if not exists public.maintenances (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  tipo maintenance_type not null default 'preventiva',
  descricao text not null,
  data date not null default current_date,
  km int,
  valor numeric(12,2) not null default 0,
  oficina text,
  status maintenance_status not null default 'concluida',
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_maintenances_updated before update on public.maintenances
  for each row execute function public.set_updated_at();
create index if not exists idx_maintenances_vehicle on public.maintenances(vehicle_id);

-- =============================================================================
-- MULTAS / INFRAÇÕES
-- =============================================================================
create table if not exists public.fines (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  renter_id uuid references public.renters(id) on delete set null,
  contract_id uuid references public.contracts(id) on delete set null,
  data_infracao date not null,
  codigo_infracao text,
  descricao text not null,
  local_infracao text,
  orgao_autuador text,
  valor numeric(12,2) not null,
  pontos int default 0,
  vencimento date,
  repassar_locatario boolean not null default true,
  repassado boolean not null default false,
  status fine_status not null default 'lancada',
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_fines_updated before update on public.fines
  for each row execute function public.set_updated_at();
create index if not exists idx_fines_vehicle on public.fines(vehicle_id);
create index if not exists idx_fines_renter on public.fines(renter_id);

-- =============================================================================
-- DESPESAS
-- =============================================================================
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  categoria text not null,             -- IPVA, seguro, licenciamento, financiamento, administrativo...
  descricao text not null,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  data date not null default current_date,
  valor numeric(12,2) not null,
  recorrente boolean not null default false,
  fornecedor text,
  status expense_status not null default 'pago',
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_expenses_updated before update on public.expenses
  for each row execute function public.set_updated_at();
create index if not exists idx_expenses_vehicle on public.expenses(vehicle_id);
create index if not exists idx_expenses_data on public.expenses(data);
