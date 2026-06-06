-- =============================================================================
-- FrotaGest — Dados de demonstração (seed)
-- Idempotente: usa chaves naturais (placa / cpf) para evitar duplicação.
-- =============================================================================

-- Veículos --------------------------------------------------------------------
insert into public.vehicles (placa, renavam, marca, modelo, ano_fabricacao, ano_modelo, cor, categoria, km_atual, status, data_aquisicao, valor_aquisicao, valor_fipe, financiado, valor_parcela_financiamento, qtd_parcelas_financiamento, fornecedor)
values
  ('RST1A23', '00112233445', 'Chevrolet', 'Onix', 2022, 2023, 'Prata', 'hatch', 48200, 'locado', '2023-01-15', 78000, 72000, true, 1450, 48, 'Localiza Seminovos'),
  ('RST2B34', '00112233446', 'Hyundai', 'HB20', 2021, 2022, 'Branco', 'hatch', 71500, 'locado', '2022-08-10', 69000, 61000, true, 1320, 48, 'Movida'),
  ('RST3C45', '00112233447', 'Fiat', 'Cronos', 2023, 2023, 'Preto', 'sedan', 22300, 'disponivel', '2023-06-20', 84000, 80000, false, null, null, 'Concessionária Fiat'),
  ('RST4D56', '00112233448', 'Toyota', 'Yaris', 2022, 2023, 'Cinza', 'sedan', 39800, 'manutencao', '2023-02-01', 95000, 89000, true, 1780, 60, 'Toyota Sul'),
  ('RST5E67', '00112233449', 'Renault', 'Kwid', 2023, 2024, 'Vermelho', 'hatch', 15600, 'disponivel', '2024-01-10', 62000, 60000, false, null, null, 'Renault Center')
on conflict (placa) do nothing;

-- Locatários ------------------------------------------------------------------
insert into public.renters (nome, cpf, rg, cnh, categoria_cnh, validade_cnh, data_nascimento, telefone, email, cidade, estado, chave_pix, status)
values
  ('João Pereira Silva', '11122233344', 'MG1234567', '04567890123', 'B', '2028-05-12', '1990-03-22', '(31) 98888-1111', 'joao.silva@email.com', 'Belo Horizonte', 'MG', '11122233344', 'ativo'),
  ('Carlos Eduardo Souza', '22233344455', 'SP7654321', '05678901234', 'B', '2027-11-30', '1985-07-15', '(11) 97777-2222', 'carlos.souza@email.com', 'São Paulo', 'SP', '(11) 97777-2222', 'ativo'),
  ('Marcos Antônio Lima', '33344455566', 'RJ1112223', '06789012345', 'B', '2029-02-18', '1992-12-01', '(21) 96666-3333', 'marcos.lima@email.com', 'Rio de Janeiro', 'RJ', 'marcos.lima@email.com', 'ativo'),
  ('Fernando Alves Costa', '44455566677', 'MG9998887', '07890123456', 'B', '2026-09-05', '1988-06-25', '(31) 95555-4444', 'fernando.costa@email.com', 'Contagem', 'MG', '44455566677', 'prospect')
on conflict (cpf) do nothing;

-- Contratos + recebíveis ------------------------------------------------------
do $$
declare
  v1 uuid; v2 uuid;
  r1 uuid; r2 uuid;
  c1 uuid; c2 uuid;
begin
  select id into v1 from public.vehicles where placa = 'RST1A23';
  select id into v2 from public.vehicles where placa = 'RST2B34';
  select id into r1 from public.renters where cpf = '11122233344';
  select id into r2 from public.renters where cpf = '22233344455';

  if not exists (select 1 from public.contracts where vehicle_id = v1 and renter_id = r1) then
    insert into public.contracts (vehicle_id, renter_id, data_inicio, ciclo_cobranca, valor_aluguel, valor_caucao, km_inicial, status)
    values (v1, r1, (current_date - interval '40 days')::date, 'semanal', 650, 1300, 47000, 'ativo')
    returning id into c1;
    perform public.generate_receivables(c1, current_date);
  end if;

  if not exists (select 1 from public.contracts where vehicle_id = v2 and renter_id = r2) then
    insert into public.contracts (vehicle_id, renter_id, data_inicio, ciclo_cobranca, valor_aluguel, valor_caucao, km_inicial, status)
    values (v2, r2, (current_date - interval '21 days')::date, 'semanal', 600, 1200, 70000, 'ativo')
    returning id into c2;
    perform public.generate_receivables(c2, current_date);
  end if;
end $$;

-- Algumas baixas de pagamento (marca as 2 primeiras cobranças como pagas) -------
update public.receivables r
set valor_pago = valor, status = 'pago', data_pagamento = vencimento, forma_pagamento = 'pix'
where r.id in (
  select r2.id from public.receivables r2
  order by r2.vencimento asc
  limit 6
);

-- Atualiza atrasos
select public.mark_overdue_receivables();

-- Manutenções -----------------------------------------------------------------
insert into public.maintenances (vehicle_id, tipo, descricao, data, km, valor, oficina, status)
select id, 'revisao', 'Revisão dos 40.000 km — óleo, filtros e pastilhas', (current_date - interval '10 days')::date, 40000, 890, 'Auto Center Líder', 'concluida'
from public.vehicles where placa = 'RST1A23'
and not exists (select 1 from public.maintenances m where m.descricao like 'Revisão dos 40.000%');

insert into public.maintenances (vehicle_id, tipo, descricao, data, km, valor, oficina, status)
select id, 'corretiva', 'Troca de embreagem', current_date, 39800, 2200, 'Oficina do Zé', 'em_andamento'
from public.vehicles where placa = 'RST4D56'
and not exists (select 1 from public.maintenances m where m.descricao = 'Troca de embreagem');

-- Multas ----------------------------------------------------------------------
insert into public.fines (vehicle_id, renter_id, data_infracao, codigo_infracao, descricao, valor, pontos, vencimento, repassar_locatario, status)
select v.id, r.id, (current_date - interval '15 days')::date, '74550', 'Excesso de velocidade até 20%', 130.16, 4, (current_date + interval '20 days')::date, true, 'lancada'
from public.vehicles v, public.renters r
where v.placa = 'RST1A23' and r.cpf = '11122233344'
and not exists (select 1 from public.fines f where f.codigo_infracao = '74550' and f.vehicle_id = v.id);

-- Despesas --------------------------------------------------------------------
insert into public.expenses (categoria, descricao, vehicle_id, data, valor, recorrente, status)
select 'Seguro', 'Seguro mensal da frota', null, date_trunc('month', current_date)::date, 1850, true, 'pago'
where not exists (select 1 from public.expenses where descricao = 'Seguro mensal da frota' and data = date_trunc('month', current_date)::date);

insert into public.expenses (categoria, descricao, vehicle_id, data, valor, recorrente, status)
select 'IPVA', 'IPVA 2026 — parcela', v.id, (current_date - interval '5 days')::date, 1240, false, 'pago'
from public.vehicles v where v.placa = 'RST2B34'
and not exists (select 1 from public.expenses where descricao = 'IPVA 2026 — parcela' and vehicle_id = v.id);
