-- Situação jurídica/patrimonial do veículo: alienação fiduciária, proprietário,
-- quitação, busca e apreensão e bloqueio judicial.

-- Alienantes cadastráveis (consórcios/bancos), para reuso no cadastro.
create table if not exists public.alienantes (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null unique,
  created_at timestamptz not null default now()
);

alter table public.alienantes enable row level security;

drop policy if exists alienantes_select on public.alienantes;
create policy alienantes_select on public.alienantes
  for select to authenticated using (true);

drop policy if exists alienantes_write on public.alienantes;
create policy alienantes_write on public.alienantes
  for all to authenticated
  using (public.can_manage(array['admin','operador','financeiro']::app_role[]))
  with check (public.can_manage(array['admin','operador','financeiro']::app_role[]));

insert into public.alienantes (nome) values
  ('Consórcio BB'), ('Consórcio Itaú'), ('Consórcio GM')
on conflict (nome) do nothing;

-- Campos no cadastro de veículo.
alter table public.vehicles
  add column if not exists alienacao_fiduciaria          boolean not null default false,
  add column if not exists alienante                     text,
  add column if not exists proprietario_nome             text,
  add column if not exists proprietario_documento        text,
  add column if not exists quitado                       boolean not null default false,
  add column if not exists valor_quitacao                numeric(14,2),
  add column if not exists data_quitacao                 date,
  add column if not exists busca_apreensao               boolean not null default false,
  add column if not exists busca_apreensao_solicitante   text,
  add column if not exists bloqueio_judicial             boolean not null default false,
  add column if not exists bloqueio_judicial_solicitante text;
