-- VIP CARS — Infrações/NIC + Faturamento
alter table public.fines add column if not exists condutor_indicado text;
alter table public.fines add column if not exists data_indicacao date;
alter table public.fines add column if not exists nic_prazo date;
alter table public.fines add column if not exists nic_status text default 'pendente';
alter table public.fines add column if not exists tipo_infracao text;

create table if not exists public.billings (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid references public.contracts(id) on delete set null,
  renter_id uuid references public.renters(id) on delete set null,
  descricao text, periodo_inicio date, periodo_fim date,
  data_emissao date not null default current_date, valor_total numeric(12,2) not null default 0,
  status text not null default 'aberta', observacoes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create trigger trg_billings_updated before update on public.billings for each row execute function public.set_updated_at();

create table if not exists public.billing_items (
  id uuid primary key default gen_random_uuid(),
  billing_id uuid not null references public.billings(id) on delete cascade,
  tipo text not null default 'avulso', descricao text not null, valor numeric(12,2) not null default 0,
  ref_id uuid, created_at timestamptz not null default now()
);
create index if not exists idx_billing_items on public.billing_items(billing_id);

do $$
declare t text; tables text[] := array['billings','billing_items'];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "%s_select" on public.%I;', t, t);
    execute format('create policy "%s_select" on public.%I for select to authenticated using (true);', t, t);
    execute format('drop policy if exists "%s_write" on public.%I;', t, t);
    execute format('create policy "%s_write" on public.%I for all to authenticated using (public.can_manage(array[''admin'',''financeiro'']::app_role[])) with check (public.can_manage(array[''admin'',''financeiro'']::app_role[]));', t, t);
  end loop;
end $$;
