-- Rastreamento Ituran: última comunicação de cada veículo com a central (via
-- importação do relatório "Grade de veículos"/MyGridData). Veículos sem
-- comunicação há mais que o limiar (padrão 24h) devem ser convocados para ajuste.
create table if not exists public.rastreamento_ituran (
  id                 uuid primary key default gen_random_uuid(),
  vehicle_id         uuid references public.vehicles(id) on delete set null,
  placa              text not null unique,
  grupo              text,
  ultima_comunicacao timestamptz,
  endereco           text,
  estados            text,
  km                 numeric(14,1),
  referencia         timestamptz,          -- data/hora de geração do relatório
  convocado          boolean not null default false,
  convocado_em       timestamptz,
  updated_at         timestamptz not null default now(),
  created_at         timestamptz not null default now()
);
create index if not exists idx_rastreamento_vehicle on public.rastreamento_ituran(vehicle_id);
create index if not exists idx_rastreamento_ultima on public.rastreamento_ituran(ultima_comunicacao);

drop trigger if exists set_updated_at on public.rastreamento_ituran;
create trigger set_updated_at before update on public.rastreamento_ituran
  for each row execute function public.set_updated_at();

alter table public.rastreamento_ituran enable row level security;
drop policy if exists rastreamento_select on public.rastreamento_ituran;
create policy rastreamento_select on public.rastreamento_ituran for select to authenticated using (true);
drop policy if exists rastreamento_write on public.rastreamento_ituran;
create policy rastreamento_write on public.rastreamento_ituran for all to authenticated
  using (public.can_manage(array['admin','financeiro','operador']::app_role[]))
  with check (public.can_manage(array['admin','financeiro','operador']::app_role[]));

-- Guarda o relatório de rastreamento no histórico de importações.
alter table public.import_history drop constraint if exists import_history_tipo_check;
alter table public.import_history add constraint import_history_tipo_check
  check (tipo in ('detran','consulta_placa','ituran','ituran_grid'));

insert into public.app_config (chave, valor) values ('rastreamento_limiar_horas', '24')
on conflict (chave) do nothing;
