-- =============================================================================
-- FrotaGest — Lote 3: contrato de app (campos extras), Cores e operações em lote
-- =============================================================================
alter table public.contracts add column if not exists franquia_km int;
alter table public.contracts add column if not exists odometro_entrega int;
alter table public.contracts add column if not exists nivel_combustivel_retirada text;
alter table public.contracts add column if not exists informacoes_adicionais text;
alter table public.contracts add column if not exists qtd_faturas int;
alter table public.contracts add column if not exists dia_faturamento text;

create table if not exists public.vehicle_colors (
  id uuid primary key default gen_random_uuid(),
  montadora text, cor text not null, identificador_externo text,
  status text not null default 'ativo',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create trigger trg_vehicle_colors_updated before update on public.vehicle_colors for each row execute function public.set_updated_at();
alter table public.vehicle_colors enable row level security;
drop policy if exists "vehicle_colors_select" on public.vehicle_colors;
create policy "vehicle_colors_select" on public.vehicle_colors for select to authenticated using (true);
drop policy if exists "vehicle_colors_write" on public.vehicle_colors;
create policy "vehicle_colors_write" on public.vehicle_colors for all to authenticated
  using (public.can_manage(array['admin','operador']::app_role[]))
  with check (public.can_manage(array['admin','operador']::app_role[]));

create or replace function public.generate_n_receivables(p_contract_id uuid, p_qtd int)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_contract public.contracts%rowtype; v_step interval; v_last date; v_cursor date;
  v_competencia text; v_count int := 0; i int;
begin
  select * into v_contract from public.contracts where id = p_contract_id;
  if not found then raise exception 'Contrato % não encontrado', p_contract_id; end if;
  v_step := case v_contract.ciclo_cobranca
    when 'diario' then interval '1 day' when 'semanal' then interval '7 days'
    when 'quinzenal' then interval '15 days' when 'mensal' then interval '1 month' end;
  select max(periodo_inicio) into v_last from public.receivables where contract_id = p_contract_id;
  if v_last is null then v_cursor := v_contract.data_inicio; else v_cursor := (v_last + v_step)::date; end if;
  for i in 1..greatest(p_qtd, 0) loop
    v_competencia := to_char(v_cursor, 'YYYY-MM-DD');
    if not exists (select 1 from public.receivables where contract_id = p_contract_id and competencia = v_competencia) then
      insert into public.receivables (contract_id, competencia, periodo_inicio, periodo_fim, vencimento, valor, status)
      values (p_contract_id, v_competencia, v_cursor, (v_cursor + v_step - interval '1 day')::date, v_cursor, v_contract.valor_aluguel, 'pendente');
      v_count := v_count + 1;
    end if;
    v_cursor := (v_cursor + v_step)::date;
  end loop;
  return v_count;
end; $$;
revoke execute on function public.generate_n_receivables(uuid, int) from public, anon;
grant execute on function public.generate_n_receivables(uuid, int) to authenticated;

create or replace function public.bulk_adjust_rent(p_ids uuid[], p_percentual numeric default null, p_novo_valor numeric default null)
returns int language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  if p_novo_valor is not null then
    update public.contracts set valor_aluguel = p_novo_valor where id = any(p_ids);
  elsif p_percentual is not null then
    update public.contracts set valor_aluguel = round(valor_aluguel * (1 + p_percentual/100.0), 2) where id = any(p_ids);
  end if;
  get diagnostics v_count = row_count; return v_count;
end; $$;
revoke execute on function public.bulk_adjust_rent(uuid[], numeric, numeric) from public, anon;
grant execute on function public.bulk_adjust_rent(uuid[], numeric, numeric) to authenticated;
