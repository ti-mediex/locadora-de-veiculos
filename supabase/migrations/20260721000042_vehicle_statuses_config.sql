-- Status de veículo configurável: permite criar novos status pela tela de
-- cadastro (ex.: "Disponível Venda"). A coluna vehicles.status passa a ser texto.
create table if not exists public.vehicle_statuses (
  id         uuid primary key default gen_random_uuid(),
  value      text not null unique,
  label      text not null,
  cor        text,
  ordem      int not null default 100,
  ativo      boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
alter table public.vehicle_statuses enable row level security;
drop policy if exists vstatus_select on public.vehicle_statuses;
create policy vstatus_select on public.vehicle_statuses for select to authenticated using (true);
drop policy if exists vstatus_write on public.vehicle_statuses;
create policy vstatus_write on public.vehicle_statuses for all to authenticated
  using (public.can_manage(array['admin','operador','financeiro']::app_role[]))
  with check (public.can_manage(array['admin','operador','financeiro']::app_role[]));

insert into public.vehicle_statuses (value,label,cor,ordem) values
  ('disponivel','Disponível','hsl(340 82% 66%)',10),
  ('disponivel_venda','Disponível Venda','hsl(160 65% 45%)',20),
  ('locado','Locado','hsl(211 90% 64%)',30),
  ('manutencao','Em manutenção','hsl(38 92% 60%)',40),
  ('vendido','Vendido','hsl(0 72% 60%)',50),
  ('inativo','Inativo','hsl(215 16% 70%)',60)
on conflict (value) do nothing;

alter table public.vehicles alter column status drop default;
alter table public.vehicles alter column status type text using status::text;
alter table public.vehicles alter column status set default 'disponivel';
