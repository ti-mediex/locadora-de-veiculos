-- FrotaGest — Lote 6: campos de Sinistro nas ocorrências + Notas Fiscais
alter type maintenance_stage add value if not exists 'em_execucao' before 'aguardando_saida';

alter table public.occurrences add column if not exists supplier_id uuid references public.suppliers(id) on delete set null;
alter table public.occurrences add column if not exists data_evento date;
alter table public.occurrences add column if not exists local_evento text;
alter table public.occurrences add column if not exists boletim_ocorrencia text;
alter table public.occurrences add column if not exists parecer_motorista text;
alter table public.occurrences add column if not exists parecer_responsavel text;
alter table public.occurrences add column if not exists considera_culpado boolean;
alter table public.occurrences add column if not exists valor_orcamento numeric(12,2);
alter table public.occurrences add column if not exists reembolso_terceiro numeric(12,2);
alter table public.occurrences add column if not exists indenizacao_seguradora numeric(12,2);
alter table public.occurrences add column if not exists danos text;

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  unidade text, supplier_id uuid references public.suppliers(id) on delete set null, fornecedor text,
  documento text default 'NF', numero text, serie text, tipo text,
  data_emissao date, data_entrada date, valor_total numeric(12,2) not null default 0,
  desconto numeric(12,2) default 0, origem text, cfop text,
  maintenance_id uuid references public.maintenances(id) on delete set null,
  status text not null default 'em_cadastro', observacoes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create trigger trg_invoices_updated before update on public.invoices for each row execute function public.set_updated_at();
alter table public.invoices enable row level security;
drop policy if exists "invoices_select" on public.invoices;
create policy "invoices_select" on public.invoices for select to authenticated using (true);
drop policy if exists "invoices_write" on public.invoices;
create policy "invoices_write" on public.invoices for all to authenticated
  using (public.can_manage(array['admin','financeiro']::app_role[]))
  with check (public.can_manage(array['admin','financeiro']::app_role[]));
