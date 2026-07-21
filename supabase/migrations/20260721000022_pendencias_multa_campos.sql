-- Campos estruturados para multas (usados no cadastro em lote de multas).
alter table public.vehicle_pendencias
  add column if not exists documento       text,   -- nº do auto de infração
  add column if not exists data_ocorrencia date,    -- data da infração
  add column if not exists local           text;    -- local da infração

comment on column public.vehicle_pendencias.documento is 'Nº do auto de infração (multas)';
comment on column public.vehicle_pendencias.data_ocorrencia is 'Data da infração (multas)';
comment on column public.vehicle_pendencias.local is 'Local da infração (multas)';
