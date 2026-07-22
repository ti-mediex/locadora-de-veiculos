-- Contratos de locação por locatário (emissão e renovação).
create sequence if not exists public.contrato_seq start 1000;

create table if not exists public.contratos (
  id                     uuid primary key default gen_random_uuid(),
  numero                 text unique not null default ('LOC-' || nextval('public.contrato_seq')),
  vehicle_id             uuid references public.vehicles(id) on delete set null,
  placa                  text,
  cliente_nome           text not null,
  cliente_cpf            text,
  cliente_cnh            text,
  cliente_cnh_cat        text,
  cliente_email          text,
  cliente_telefone       text,
  cliente_endereco       text,
  atendente              text,
  local_entrega          text,
  data_entrega           date,
  hora_entrega           text,
  local_devolucao        text,
  devolucao_prevista     date,
  grupo                  text,
  km_entrega             integer,
  valor_locacao          numeric(14,2),
  semanas                integer,
  valor_total            numeric(14,2),
  pre_autorizacao        numeric(14,2),
  informacoes_adicionais text,
  status                 text not null default 'ativo' check (status in ('ativo','encerrado','renovado','cancelado')),
  contrato_pai_id        uuid references public.contratos(id) on delete set null,
  created_by             uuid references public.profiles(id),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists idx_contratos_vehicle on public.contratos(vehicle_id);
create index if not exists idx_contratos_status on public.contratos(status);

drop trigger if exists set_updated_at on public.contratos;
create trigger set_updated_at before update on public.contratos
  for each row execute function public.set_updated_at();

alter table public.contratos enable row level security;
drop policy if exists contratos_select on public.contratos;
create policy contratos_select on public.contratos for select to authenticated using (true);
drop policy if exists contratos_write on public.contratos;
create policy contratos_write on public.contratos for all to authenticated
  using (public.can_manage(array['admin','financeiro','operador']::app_role[]))
  with check (public.can_manage(array['admin','financeiro','operador']::app_role[]));
