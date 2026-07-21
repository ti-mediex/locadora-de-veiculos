-- Atualização automática do valor da Tabela FIPE por veículo.
-- Colunas de rastreamento da referência FIPE resolvida (para acelerar as
-- atualizações mensais e permitir auditoria/ajuste manual).

alter table public.vehicles
  add column if not exists fipe_codigo          text,
  add column if not exists fipe_marca_ref       integer,
  add column if not exists fipe_modelo_ref      integer,
  add column if not exists fipe_ano_ref         text,
  add column if not exists fipe_combustivel     text,
  add column if not exists fipe_mes_referencia  text,
  add column if not exists fipe_atualizado_em   timestamptz;

comment on column public.vehicles.fipe_codigo is 'Código FIPE do modelo (ex.: 004321-5)';
comment on column public.vehicles.fipe_mes_referencia is 'Mês de referência da consulta FIPE (ex.: junho de 2026)';
comment on column public.vehicles.fipe_atualizado_em is 'Timestamp da última atualização automática do valor FIPE';
