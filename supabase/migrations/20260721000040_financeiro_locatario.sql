-- Apuração financeira por locatário: lançamentos de débito (por categoria),
-- cauções pagas e controle de devolução (60 dias após o encerramento).

-- Débitos do locatário por categoria.
create table if not exists public.locatario_debitos (
  id           uuid primary key default gen_random_uuid(),
  locatario_id uuid not null references public.locatarios(id) on delete cascade,
  contrato_id  uuid references public.contratos(id) on delete set null,
  vehicle_id   uuid references public.vehicles(id) on delete set null,
  placa        text,
  categoria    text not null check (categoria in ('locacao','multa','juros','avaria','km_excedente','outros')),
  descricao    text,
  valor        numeric(14,2) not null default 0,
  competencia  date,
  pago         boolean not null default false,
  pago_em      date,
  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_locdeb_locatario on public.locatario_debitos(locatario_id);
create index if not exists idx_locdeb_contrato on public.locatario_debitos(contrato_id);
create index if not exists idx_locdeb_categoria on public.locatario_debitos(categoria);

drop trigger if exists set_updated_at on public.locatario_debitos;
create trigger set_updated_at before update on public.locatario_debitos
  for each row execute function public.set_updated_at();

alter table public.locatario_debitos enable row level security;
drop policy if exists locdeb_select on public.locatario_debitos;
create policy locdeb_select on public.locatario_debitos for select to authenticated using (true);
drop policy if exists locdeb_write on public.locatario_debitos;
create policy locdeb_write on public.locatario_debitos for all to authenticated
  using (public.can_manage(array['admin','financeiro','operador']::app_role[]))
  with check (public.can_manage(array['admin','financeiro','operador']::app_role[]));

-- Cauções pagas pelo locatário (com controle de devolução).
create table if not exists public.locatario_caucoes (
  id              uuid primary key default gen_random_uuid(),
  locatario_id    uuid not null references public.locatarios(id) on delete cascade,
  contrato_id     uuid references public.contratos(id) on delete set null,
  placa           text,
  valor           numeric(14,2) not null default 0,
  data            date,
  metodo          text,
  observacao      text,
  devolvido       boolean not null default false,
  devolvido_em    date,
  valor_devolvido numeric(14,2),
  created_by      uuid references public.profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_loccau_locatario on public.locatario_caucoes(locatario_id);
create index if not exists idx_loccau_contrato on public.locatario_caucoes(contrato_id);

drop trigger if exists set_updated_at on public.locatario_caucoes;
create trigger set_updated_at before update on public.locatario_caucoes
  for each row execute function public.set_updated_at();

alter table public.locatario_caucoes enable row level security;
drop policy if exists loccau_select on public.locatario_caucoes;
create policy loccau_select on public.locatario_caucoes for select to authenticated using (true);
drop policy if exists loccau_write on public.locatario_caucoes;
create policy loccau_write on public.locatario_caucoes for all to authenticated
  using (public.can_manage(array['admin','financeiro','operador']::app_role[]))
  with check (public.can_manage(array['admin','financeiro','operador']::app_role[]));

-- Prazo (dias) para devolução do caução após o encerramento do contrato.
insert into public.app_config (chave, valor) values ('caucao_devolucao_dias', '60')
on conflict (chave) do nothing;
