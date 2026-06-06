-- =============================================================================
-- FrotaGest — Funções financeiras
-- =============================================================================

-- Mantém o status do veículo sincronizado com o contrato ------------------------
create or replace function public.sync_vehicle_status_on_contract()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if (tg_op = 'INSERT' or tg_op = 'UPDATE') then
    if new.status = 'ativo' then
      update public.vehicles set status = 'locado' where id = new.vehicle_id and status <> 'manutencao';
    elsif new.status in ('encerrado') then
      update public.vehicles set status = 'disponivel' where id = new.vehicle_id and status = 'locado';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_contract_vehicle_status on public.contracts;
create trigger trg_contract_vehicle_status
  after insert or update of status on public.contracts
  for each row execute function public.sync_vehicle_status_on_contract();

-- -----------------------------------------------------------------------------
-- Gera recebíveis (cobranças) para um contrato dentro de uma janela de datas.
-- Idempotente: não duplica cobranças já existentes para a mesma competência.
-- -----------------------------------------------------------------------------
create or replace function public.generate_receivables(
  p_contract_id uuid,
  p_ate date default (current_date + interval '60 days')::date
)
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  v_contract       public.contracts%rowtype;
  v_cursor         date;
  v_periodo_fim    date;
  v_step           interval;
  v_competencia    text;
  v_count          int := 0;
begin
  select * into v_contract from public.contracts where id = p_contract_id;
  if not found then
    raise exception 'Contrato % não encontrado', p_contract_id;
  end if;

  v_step := case v_contract.ciclo_cobranca
    when 'diario'    then interval '1 day'
    when 'semanal'   then interval '7 days'
    when 'quinzenal' then interval '15 days'
    when 'mensal'    then interval '1 month'
  end;

  v_cursor := v_contract.data_inicio;

  while v_cursor <= least(p_ate, coalesce(v_contract.data_fim, p_ate)) loop
    v_periodo_fim := (v_cursor + v_step - interval '1 day')::date;
    v_competencia := to_char(v_cursor, 'YYYY-MM-DD');

    if not exists (
      select 1 from public.receivables
      where contract_id = p_contract_id and competencia = v_competencia
    ) then
      insert into public.receivables
        (contract_id, competencia, periodo_inicio, periodo_fim, vencimento, valor, status)
      values
        (p_contract_id, v_competencia, v_cursor, v_periodo_fim, v_cursor,
         v_contract.valor_aluguel, 'pendente');
      v_count := v_count + 1;
    end if;

    v_cursor := (v_cursor + v_step)::date;
  end loop;

  return v_count;
end;
$$;

-- -----------------------------------------------------------------------------
-- Atualiza status das cobranças vencidas para 'atrasado'.
-- Pensado para rodar em agendamento (pg_cron) ou via botão no painel.
-- -----------------------------------------------------------------------------
create or replace function public.mark_overdue_receivables()
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  v_count int;
begin
  with upd as (
    update public.receivables
    set status = 'atrasado'
    where status in ('pendente', 'parcial')
      and vencimento < current_date
    returning id
  )
  select count(*) into v_count from upd;

  -- Marca contratos com cobranças atrasadas como inadimplentes
  update public.contracts c
  set status = 'inadimplente'
  where c.status = 'ativo'
    and exists (
      select 1 from public.receivables r
      where r.contract_id = c.id and r.status = 'atrasado'
    );

  return v_count;
end;
$$;

-- -----------------------------------------------------------------------------
-- Registra baixa de pagamento de uma cobrança.
-- -----------------------------------------------------------------------------
create or replace function public.settle_receivable(
  p_receivable_id uuid,
  p_valor_pago numeric,
  p_data_pagamento date default current_date,
  p_forma_pagamento text default null,
  p_juros numeric default 0,
  p_multa numeric default 0
)
returns public.receivables
language plpgsql
security definer set search_path = public
as $$
declare
  v_rec    public.receivables%rowtype;
  v_total  numeric;
  v_status receivable_status;
begin
  select * into v_rec from public.receivables where id = p_receivable_id for update;
  if not found then
    raise exception 'Cobrança % não encontrada', p_receivable_id;
  end if;

  v_total := v_rec.valor_pago + p_valor_pago;

  if v_total >= (v_rec.valor + coalesce(p_juros,0) + coalesce(p_multa,0)) then
    v_status := 'pago';
  elsif v_total > 0 then
    v_status := 'parcial';
  else
    v_status := v_rec.status;
  end if;

  update public.receivables
  set valor_pago = v_total,
      juros = coalesce(p_juros, juros),
      multa = coalesce(p_multa, multa),
      data_pagamento = p_data_pagamento,
      forma_pagamento = coalesce(p_forma_pagamento, forma_pagamento),
      status = v_status
  where id = p_receivable_id
  returning * into v_rec;

  -- Se quitou tudo, e o contrato estava inadimplente sem outros atrasos, volta a ativo
  update public.contracts c
  set status = 'ativo'
  where c.id = v_rec.contract_id
    and c.status = 'inadimplente'
    and not exists (
      select 1 from public.receivables r
      where r.contract_id = c.id and r.status = 'atrasado'
    );

  return v_rec;
end;
$$;

-- -----------------------------------------------------------------------------
-- Resumo financeiro do dashboard (período opcional).
-- Retorna um JSON com os principais KPIs.
-- -----------------------------------------------------------------------------
create or replace function public.dashboard_summary(
  p_inicio date default date_trunc('month', current_date)::date,
  p_fim date default (date_trunc('month', current_date) + interval '1 month - 1 day')::date
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_result jsonb;
  v_total_veiculos int;
  v_veiculos_locados int;
  v_receita_prevista numeric;
  v_receita_recebida numeric;
  v_inadimplencia numeric;
  v_despesas numeric;
  v_manutencao numeric;
  v_multas_nao_repassadas numeric;
  v_contratos_ativos int;
  v_ticket_medio numeric;
begin
  select count(*) into v_total_veiculos from public.vehicles where status <> 'inativo';
  select count(*) into v_veiculos_locados from public.vehicles where status = 'locado';

  select coalesce(sum(valor),0) into v_receita_prevista
  from public.receivables
  where vencimento between p_inicio and p_fim and status <> 'cancelado';

  select coalesce(sum(valor_pago),0) into v_receita_recebida
  from public.receivables
  where data_pagamento between p_inicio and p_fim;

  select coalesce(sum(valor + juros + multa - valor_pago),0) into v_inadimplencia
  from public.receivables
  where status = 'atrasado';

  select coalesce(sum(valor),0) into v_despesas
  from public.expenses
  where data between p_inicio and p_fim and status <> 'cancelado';

  select coalesce(sum(valor),0) into v_manutencao
  from public.maintenances
  where data between p_inicio and p_fim and status <> 'cancelada';

  select coalesce(sum(valor),0) into v_multas_nao_repassadas
  from public.fines
  where data_infracao between p_inicio and p_fim
    and repassar_locatario = false
    and status <> 'cancelada';

  select count(*) into v_contratos_ativos
  from public.contracts where status in ('ativo','inadimplente');

  select coalesce(avg(valor_aluguel),0) into v_ticket_medio
  from public.contracts where status in ('ativo','inadimplente');

  v_result := jsonb_build_object(
    'periodo_inicio', p_inicio,
    'periodo_fim', p_fim,
    'total_veiculos', v_total_veiculos,
    'veiculos_locados', v_veiculos_locados,
    'taxa_ocupacao', case when v_total_veiculos > 0
        then round((v_veiculos_locados::numeric / v_total_veiculos) * 100, 1) else 0 end,
    'receita_prevista', v_receita_prevista,
    'receita_recebida', v_receita_recebida,
    'inadimplencia_valor', v_inadimplencia,
    'inadimplencia_pct', case when v_receita_prevista > 0
        then round((v_inadimplencia / v_receita_prevista) * 100, 1) else 0 end,
    'despesas', v_despesas,
    'manutencao', v_manutencao,
    'multas_empresa', v_multas_nao_repassadas,
    'lucro_liquido', v_receita_recebida - v_despesas - v_manutencao - v_multas_nao_repassadas,
    'contratos_ativos', v_contratos_ativos,
    'ticket_medio', round(v_ticket_medio, 2)
  );

  return v_result;
end;
$$;

-- -----------------------------------------------------------------------------
-- Série temporal receita x despesa dos últimos N meses.
-- -----------------------------------------------------------------------------
create or replace function public.monthly_cashflow(p_meses int default 12)
returns table (
  mes text,
  receita numeric,
  despesa numeric,
  resultado numeric
)
language sql
security definer set search_path = public
as $$
  with meses as (
    select to_char(d, 'YYYY-MM') as mes, d::date as inicio,
           (d + interval '1 month - 1 day')::date as fim
    from generate_series(
      date_trunc('month', current_date) - ((p_meses - 1) || ' months')::interval,
      date_trunc('month', current_date),
      interval '1 month'
    ) d
  )
  select
    m.mes,
    coalesce((select sum(r.valor_pago) from public.receivables r
              where r.data_pagamento between m.inicio and m.fim), 0) as receita,
    coalesce((select sum(e.valor) from public.expenses e
              where e.data between m.inicio and m.fim and e.status <> 'cancelado'), 0)
    + coalesce((select sum(mt.valor) from public.maintenances mt
              where mt.data between m.inicio and m.fim and mt.status <> 'cancelada'), 0) as despesa,
    0::numeric as resultado
  from meses m
  order by m.mes;
$$;

-- -----------------------------------------------------------------------------
-- Rentabilidade / ROI por veículo.
-- -----------------------------------------------------------------------------
create or replace function public.vehicle_profitability()
returns table (
  vehicle_id uuid,
  placa text,
  modelo text,
  receita numeric,
  manutencao numeric,
  multas numeric,
  resultado numeric
)
language sql
security definer set search_path = public
as $$
  select
    v.id,
    v.placa,
    v.marca || ' ' || v.modelo as modelo,
    coalesce((select sum(r.valor_pago) from public.receivables r
              join public.contracts c on c.id = r.contract_id
              where c.vehicle_id = v.id), 0) as receita,
    coalesce((select sum(mt.valor) from public.maintenances mt
              where mt.vehicle_id = v.id and mt.status <> 'cancelada'), 0) as manutencao,
    coalesce((select sum(f.valor) from public.fines f
              where f.vehicle_id = v.id and f.repassar_locatario = false
                and f.status <> 'cancelada'), 0) as multas,
    coalesce((select sum(r.valor_pago) from public.receivables r
              join public.contracts c on c.id = r.contract_id
              where c.vehicle_id = v.id), 0)
    - coalesce((select sum(mt.valor) from public.maintenances mt
              where mt.vehicle_id = v.id and mt.status <> 'cancelada'), 0)
    - coalesce((select sum(f.valor) from public.fines f
              where f.vehicle_id = v.id and f.repassar_locatario = false
                and f.status <> 'cancelada'), 0) as resultado
  from public.vehicles v
  where v.status <> 'inativo'
  order by resultado desc;
$$;
