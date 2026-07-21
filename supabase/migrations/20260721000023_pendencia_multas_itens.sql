-- Itens de multa dentro de uma mesma pendência (categoria "Multa"):
-- uma pendência pode agrupar várias multas, com valor total somado.
create table if not exists public.pendencia_multas (
  id              uuid primary key default gen_random_uuid(),
  pendencia_id    uuid not null references public.vehicle_pendencias(id) on delete cascade,
  documento       text,            -- nº do auto de infração
  infracao        text,            -- descrição da infração
  data_ocorrencia date,            -- data da infração
  vencimento      date,
  valor           numeric(14,2),
  local           text,
  pago            boolean not null default false,
  created_at      timestamptz not null default now()
);

create index if not exists idx_pendencia_multas_pendencia on public.pendencia_multas(pendencia_id);

alter table public.pendencia_multas enable row level security;

drop policy if exists pendencia_multas_select on public.pendencia_multas;
create policy pendencia_multas_select on public.pendencia_multas
  for select to authenticated using (true);

drop policy if exists pendencia_multas_write on public.pendencia_multas;
create policy pendencia_multas_write on public.pendencia_multas
  for all to authenticated
  using (public.can_manage(array['admin','financeiro','operador']::app_role[]))
  with check (public.can_manage(array['admin','financeiro','operador']::app_role[]));
