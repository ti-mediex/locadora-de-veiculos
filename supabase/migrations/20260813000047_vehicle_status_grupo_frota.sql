-- Parametrização do "grupo de frota" por status de veículo.
-- Permite que status personalizados (ex.: "Locado - Mediex Segurança", "Preparando
-- para Locação") passem a compor a Frota Ativa, mapeando cada status a um dos
-- grupos operacionais: locado | carro_reserva | disponivel | manutencao.
-- grupo_frota NULL = status não faz parte da frota ativa.

alter table public.vehicle_statuses
  add column if not exists grupo_frota text
  check (grupo_frota in ('locado','carro_reserva','disponivel','manutencao'));

-- Seed dos status internos (mantém o comportamento atual da função grupoFrota).
update public.vehicle_statuses set grupo_frota = 'locado'
  where value in ('locado','locado_mediex_seguranca','locado_mediex_medicina');
update public.vehicle_statuses set grupo_frota = 'carro_reserva'
  where value in ('carro_reserva');
update public.vehicle_statuses set grupo_frota = 'disponivel'
  where value in ('disponivel','disponivel_para_locar','preparando_para_locacao','preparado_para_locacao');
update public.vehicle_statuses set grupo_frota = 'manutencao'
  where value in ('manutencao','em_manutencao_rapida','em_manutencao_demorada');
