-- Campos cadastrais adicionais do veículo, vindos da "Consulta Placa" do Detran.
alter table public.vehicles
  add column if not exists especie_tipo            text,   -- PAS / AUTOMOVEL
  add column if not exists combustivel             text,   -- GAS/ALC/GNV
  add column if not exists capacidade_passageiros  integer,
  add column if not exists potencia                text,   -- cv
  add column if not exists cilindrada              integer,
  add column if not exists parcelamento_cotas      text;   -- ex.: 3 X 0,00

comment on column public.vehicles.especie_tipo is 'Espécie/Tipo (Consulta Placa)';
comment on column public.vehicles.combustivel is 'Combustível (Consulta Placa)';
comment on column public.vehicles.parcelamento_cotas is 'Parcelamento/Cotas do IPVA (Consulta Placa)';
