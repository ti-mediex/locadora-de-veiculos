-- FrotaGest — Financeiro: Contas Bancárias + Lançamentos (tesouraria)
create table if not exists public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  nome text not null, banco text, agencia text, conta text, tipo text default 'corrente',
  saldo_inicial numeric(12,2) not null default 0, status text not null default 'ativo', observacoes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create trigger trg_bank_accounts_updated before update on public.bank_accounts for each row execute function public.set_updated_at();

create table if not exists public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  data date not null default current_date, vencimento date, tipo text not null default 'saida',
  categoria text, descricao text not null, valor numeric(12,2) not null, valor_pago numeric(12,2) not null default 0,
  status text not null default 'previsto', conta_id uuid references public.bank_accounts(id) on delete set null,
  conta_destino_id uuid references public.bank_accounts(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  recorrente boolean not null default false, parcela_num int, parcela_total int, grupo text,
  forma_pagamento text, data_baixa date, observacoes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create trigger trg_ledger_entries_updated before update on public.ledger_entries for each row execute function public.set_updated_at();
create index if not exists idx_ledger_data on public.ledger_entries(data);

do $$
declare t text; tables text[] := array['bank_accounts','ledger_entries'];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "%s_select" on public.%I;', t, t);
    execute format('create policy "%s_select" on public.%I for select to authenticated using (true);', t, t);
    execute format('drop policy if exists "%s_write" on public.%I;', t, t);
    execute format('create policy "%s_write" on public.%I for all to authenticated using (public.can_manage(array[''admin'',''financeiro'']::app_role[])) with check (public.can_manage(array[''admin'',''financeiro'']::app_role[]));', t, t);
  end loop;
end $$;

create or replace function public.settle_ledger_entry(p_id uuid, p_valor numeric, p_data date default current_date, p_forma text default null)
returns public.ledger_entries language plpgsql security definer set search_path = public as $$
declare v public.ledger_entries%rowtype; v_total numeric;
begin
  select * into v from public.ledger_entries where id = p_id for update;
  if not found then raise exception 'Lançamento % não encontrado', p_id; end if;
  v_total := v.valor_pago + p_valor;
  update public.ledger_entries set valor_pago = v_total, forma_pagamento = coalesce(p_forma, forma_pagamento),
    data_baixa = p_data, status = case when v_total >= v.valor then 'baixado' when v_total > 0 then 'parcial' else status end
  where id = p_id returning * into v;
  return v;
end; $$;
revoke execute on function public.settle_ledger_entry(uuid, numeric, date, text) from public, anon;
grant execute on function public.settle_ledger_entry(uuid, numeric, date, text) to authenticated;

create or replace function public.undo_ledger_settlement(p_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.ledger_entries set valor_pago = 0, status = 'previsto', data_baixa = null where id = p_id;
$$;
revoke execute on function public.undo_ledger_settlement(uuid) from public, anon;
grant execute on function public.undo_ledger_settlement(uuid) to authenticated;
