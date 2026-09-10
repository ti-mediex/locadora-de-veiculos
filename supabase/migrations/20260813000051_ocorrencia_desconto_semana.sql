-- Permite escolher manualmente em qual boleto (semana/sexta de vencimento) o
-- desconto por paralisação da ocorrência será abatido. Quando nulo, usa o
-- cálculo automático (boleto do período seguinte ao início da paralisação).
alter table public.ocorrencias
  add column if not exists desconto_semana_venc date;
