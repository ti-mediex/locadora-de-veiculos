-- =============================================================================
-- FrotaGest — Lote 4/5: Manutenção como Ordem de Serviço (pipeline/Kanban) + itens
-- =============================================================================
do $$ begin
  create type maintenance_stage as enum (
    'programada','pre_agendamento','confirmacao_agenda','aguardando_chegada',
    'aguardando_orcamento','orcamento_analise','aguardando_saida','aguardando_nf',
    'finalizada','cancelada');
exception when duplicate_object then null; end $$;

alter table public.maintenances add column if not exists etapa maintenance_stage not null default 'pre_agendamento';
alter table public.maintenances add column if not exists motivo text;
alter table public.maintenances add column if not exists solicitante text;
alter table public.maintenances add column if not exists renter_id uuid references public.renters(id) on delete set null;
alter table public.maintenances add column if not exists contract_id uuid references public.contracts(id) on delete set null;
alter table public.maintenances add column if not exists supplier_id uuid references public.suppliers(id) on delete set null;
alter table public.maintenances add column if not exists agendamento date;
alter table public.maintenances add column if not exists leva_traz boolean not null default false;
alter table public.maintenances add column if not exists reembolsavel boolean not null default true;
create index if not exists idx_maintenances_etapa on public.maintenances(etapa);

create table if not exists public.maintenance_items (
  id uuid primary key default gen_random_uuid(),
  maintenance_id uuid not null references public.maintenances(id) on delete cascade,
  grupo_despesa text, categoria text, descricao text not null,
  desconto numeric(12,2) not null default 0, valor numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_maint_items on public.maintenance_items(maintenance_id);
alter table public.maintenance_items enable row level security;
drop policy if exists "maintenance_items_select" on public.maintenance_items;
create policy "maintenance_items_select" on public.maintenance_items for select to authenticated using (true);
drop policy if exists "maintenance_items_write" on public.maintenance_items;
create policy "maintenance_items_write" on public.maintenance_items for all to authenticated
  using (public.can_manage(array['admin','operador']::app_role[]))
  with check (public.can_manage(array['admin','operador']::app_role[]));

update public.maintenances set etapa = 'finalizada' where status = 'concluida';
update public.maintenances set etapa = 'aguardando_orcamento' where status = 'em_andamento';
