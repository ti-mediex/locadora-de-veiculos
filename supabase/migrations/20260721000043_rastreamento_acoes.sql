-- Ação a realizar por veículo no rastreamento, com tipos configuráveis (permite
-- cadastrar novos tipos de ação pela tela).
alter table public.rastreamento_ituran add column if not exists acao text;

create table if not exists public.rastreamento_acoes (
  id uuid primary key default gen_random_uuid(),
  value text not null unique,
  label text not null,
  ordem int not null default 100,
  ativo boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
alter table public.rastreamento_acoes enable row level security;
drop policy if exists racoes_select on public.rastreamento_acoes;
create policy racoes_select on public.rastreamento_acoes for select to authenticated using (true);
drop policy if exists racoes_write on public.rastreamento_acoes;
create policy racoes_write on public.rastreamento_acoes for all to authenticated
  using (public.can_manage(array['admin','financeiro','operador']::app_role[]))
  with check (public.can_manage(array['admin','financeiro','operador']::app_role[]));

insert into public.rastreamento_acoes (value,label,ordem) values
  ('convocar_ajuste','Convocar para ajuste',10),
  ('convocar_retirada','Convocar retirada',20),
  ('contatar_ituran','Contatar Ituran',30),
  ('visita_tecnica','Agendar visita técnica',40),
  ('substituir','Substituir rastreador',50),
  ('bloquear','Solicitar bloqueio',60),
  ('sem_acao','Sem ação',99)
on conflict (value) do nothing;
