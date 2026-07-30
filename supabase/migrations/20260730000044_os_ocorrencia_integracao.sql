-- Integração OS ↔ Ocorrência ↔ Despesa: numeração da ocorrência, campos de
-- paralisação/evidência na OS, itens detalhados e novo vocabulário de "tipo".

-- 1) Número identificador da ocorrência (OC-####).
create sequence if not exists public.ocorrencia_seq start 1000;
alter table public.ocorrencias add column if not exists numero text;
update public.ocorrencias set numero = 'OC-' || nextval('public.ocorrencia_seq') where numero is null;
alter table public.ocorrencias alter column numero set default ('OC-' || nextval('public.ocorrencia_seq'));
create unique index if not exists ocorrencias_numero_key on public.ocorrencias (numero);

-- 2) Campos de integração/paralisação na OS + evidência Ituran + observação.
alter table public.ordens_servico
  add column if not exists tipo text,
  add column if not exists inicio timestamptz,
  add column if not exists fim timestamptz,
  add column if not exists km integer,
  add column if not exists status_veiculo_anterior text,
  add column if not exists ituran_path text,
  add column if not exists observacao text;

-- 3) Itens detalhados da OS (peças substituídas e serviços realizados).
create table if not exists public.os_itens (
  id uuid primary key default gen_random_uuid(),
  ordem_servico_id uuid not null references public.ordens_servico(id) on delete cascade,
  tipo_item text not null default 'peca' check (tipo_item in ('peca','servico')),
  descricao text,
  quantidade numeric not null default 1,
  custo_unitario numeric not null default 0,
  custo_total numeric not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_os_itens_os on public.os_itens (ordem_servico_id);
alter table public.os_itens enable row level security;
drop policy if exists os_itens_select on public.os_itens;
create policy os_itens_select on public.os_itens for select using (true);
drop policy if exists os_itens_write on public.os_itens;
create policy os_itens_write on public.os_itens for all
  using (public.can_manage(array['admin','financeiro','operador']::app_role[]))
  with check (public.can_manage(array['admin','financeiro','operador']::app_role[]));

-- 4) Novo vocabulário de tipo de ocorrência (remove manutencao/pane/avaria;
--    inclui manutencao_preventiva e manutencao_corretiva).
alter table public.ocorrencias drop constraint if exists ocorrencias_tipo_check;
update public.ocorrencias set tipo = 'manutencao_corretiva' where tipo in ('manutencao','pane','avaria');
alter table public.ocorrencias add constraint ocorrencias_tipo_check
  check (tipo = any (array[
    'manutencao_preventiva','manutencao_corretiva','sinistro',
    'carro_reserva','infracao','translado','outros'
  ]::text[]));

-- 5) Backfill dos novos campos da OS a partir da ocorrência vinculada.
update public.ordens_servico os set
  tipo   = coalesce(os.tipo, oc.tipo),
  inicio = coalesce(os.inicio, oc.inicio),
  fim    = coalesce(os.fim, oc.fim),
  km     = coalesce(os.km, oc.km)
from public.ocorrencias oc
where os.ocorrencia_id = oc.id;
