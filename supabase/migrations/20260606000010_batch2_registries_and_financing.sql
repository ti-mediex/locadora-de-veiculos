-- =============================================================================
-- FrotaGest — Lote 2: Grupos, Pátios, Compradores, Peças/Serviços, Financiamento
-- (espelha telas Cadastros e Financeiro > Contratos de Alienação do Blue Fleet)
-- =============================================================================

create table if not exists public.vehicle_groups (
  id uuid primary key default gen_random_uuid(),
  nome text not null, sigla text,
  taxa_depreciacao_anual numeric(6,2), preco_diaria_rac numeric(12,2),
  veiculos_disponiveis_rac int, status text not null default 'ativo', observacoes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create trigger trg_vehicle_groups_updated before update on public.vehicle_groups for each row execute function public.set_updated_at();

create table if not exists public.yards (
  id uuid primary key default gen_random_uuid(),
  nome text not null, capacidade int, cep text, endereco text, cidade text, estado text,
  status text not null default 'ativo', observacoes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create trigger trg_yards_updated before update on public.yards for each row execute function public.set_updated_at();

create table if not exists public.buyers (
  id uuid primary key default gen_random_uuid(),
  nome text not null, tipo text not null default 'fisica', cpf_cnpj text, rg text,
  endereco text, cidade text, estado text, telefone text, email text, informacoes text,
  status text not null default 'ativo',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create trigger trg_buyers_updated before update on public.buyers for each row execute function public.set_updated_at();

create table if not exists public.parts_services (
  id uuid primary key default gen_random_uuid(),
  nome text not null, codigo_externo text, tipo text not null default 'produto', grupo text,
  ncm text, fabricante text, especificacao text, preco numeric(12,2),
  status text not null default 'ativo', observacoes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create trigger trg_parts_services_updated before update on public.parts_services for each row execute function public.set_updated_at();

create table if not exists public.financing_contracts (
  id uuid primary key default gen_random_uuid(),
  numero text, instituicao text, vehicle_id uuid references public.vehicles(id) on delete set null,
  tipo text default 'CDC', tabela text default 'PRICE', forma_pagamento text,
  valor_principal numeric(12,2) not null, valor_entrada numeric(12,2) default 0,
  valor_parcela numeric(12,2), qtd_parcelas int not null, taxa_juros_mensal numeric(8,4) not null default 0,
  iof numeric(12,2) default 0, tarifa numeric(12,2) default 0,
  data_inicio date not null default current_date, primeiro_vencimento date,
  status text not null default 'ativo', observacoes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create trigger trg_financing_contracts_updated before update on public.financing_contracts for each row execute function public.set_updated_at();

create table if not exists public.financing_installments (
  id uuid primary key default gen_random_uuid(),
  financing_id uuid not null references public.financing_contracts(id) on delete cascade,
  numero int not null, vencimento date, saldo_inicial numeric(12,2), juros numeric(12,2),
  amortizacao numeric(12,2), parcela numeric(12,2), saldo_final numeric(12,2),
  pago boolean not null default false, data_pagamento date, created_at timestamptz not null default now()
);
create index if not exists idx_fin_inst_contract on public.financing_installments(financing_id);

-- RLS
do $$
declare t text;
  oper text[] := array['vehicle_groups','yards','buyers','parts_services'];
  fin  text[] := array['financing_contracts','financing_installments'];
begin
  foreach t in array oper loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "%s_select" on public.%I;', t, t);
    execute format('create policy "%s_select" on public.%I for select to authenticated using (true);', t, t);
    execute format('drop policy if exists "%s_write" on public.%I;', t, t);
    execute format('create policy "%s_write" on public.%I for all to authenticated using (public.can_manage(array[''admin'',''operador'']::app_role[])) with check (public.can_manage(array[''admin'',''operador'']::app_role[]));', t, t);
  end loop;
  foreach t in array fin loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "%s_select" on public.%I;', t, t);
    execute format('create policy "%s_select" on public.%I for select to authenticated using (true);', t, t);
    execute format('drop policy if exists "%s_write" on public.%I;', t, t);
    execute format('create policy "%s_write" on public.%I for all to authenticated using (public.can_manage(array[''admin'',''financeiro'']::app_role[])) with check (public.can_manage(array[''admin'',''financeiro'']::app_role[]));', t, t);
  end loop;
end $$;
