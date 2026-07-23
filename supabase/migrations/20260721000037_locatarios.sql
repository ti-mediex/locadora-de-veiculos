-- Reestabelece o cadastro de Locatários (antiga tabela "renters"), agora
-- integrado aos Contratos (preenchimento automático dos dados do locatário) e
-- ao veículo do contrato (associação veículo ↔ locatário via contrato).
create table if not exists public.locatarios (
  id                          uuid primary key default gen_random_uuid(),
  nome                        text not null,
  cpf                         text,
  rg                          text,
  cnh                         text,
  categoria_cnh               text,
  validade_cnh                date,
  data_nascimento             date,
  telefone                    text,
  email                       text,
  cep                         text,
  endereco                    text,
  numero                      text,
  complemento                 text,
  bairro                      text,
  cidade                      text,
  estado                      text,
  chave_pix                   text,
  contato_emergencia_nome     text,
  contato_emergencia_telefone text,
  status                      text not null default 'ativo' check (status in ('ativo','inativo')),
  observacoes                 text,
  created_by                  uuid references public.profiles(id),
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);
create unique index if not exists idx_locatarios_cpf on public.locatarios(cpf) where cpf is not null and cpf <> '';
create index if not exists idx_locatarios_nome on public.locatarios(nome);

drop trigger if exists set_updated_at on public.locatarios;
create trigger set_updated_at before update on public.locatarios
  for each row execute function public.set_updated_at();

alter table public.locatarios enable row level security;
drop policy if exists locatarios_select on public.locatarios;
create policy locatarios_select on public.locatarios for select to authenticated using (true);
drop policy if exists locatarios_write on public.locatarios;
create policy locatarios_write on public.locatarios for all to authenticated
  using (public.can_manage(array['admin','financeiro','operador']::app_role[]))
  with check (public.can_manage(array['admin','financeiro','operador']::app_role[]));

-- Associa o contrato (e, por ele, o veículo) a um locatário do cadastro.
alter table public.contratos add column if not exists locatario_id uuid references public.locatarios(id) on delete set null;
create index if not exists idx_contratos_locatario on public.contratos(locatario_id);
