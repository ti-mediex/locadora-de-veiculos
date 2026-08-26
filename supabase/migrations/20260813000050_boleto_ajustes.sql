-- Ajustes manuais por boleto semanal: permite incluir mais de um lançamento
-- (descrição + valor) marcado como desconto ou acréscimo dentro do boleto da
-- semana. Ex.: juros não pagos do boleto anterior (acréscimo), reembolso de
-- compra autorizada (desconto). Identificado por contrato + semana (sexta).
create table if not exists public.boleto_ajustes (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid references public.contratos(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  semana_venc date not null,                       -- sexta de vencimento do boleto
  descricao text not null,
  valor numeric not null default 0,
  tipo text not null default 'acrescimo' check (tipo in ('desconto','acrescimo')),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_boleto_ajustes_contrato_semana on public.boleto_ajustes (contrato_id, semana_venc);
create index if not exists idx_boleto_ajustes_semana on public.boleto_ajustes (semana_venc);

create trigger trg_boleto_ajustes_updated before update on public.boleto_ajustes
  for each row execute function public.set_updated_at();

alter table public.boleto_ajustes enable row level security;
drop policy if exists boleto_ajustes_select on public.boleto_ajustes;
create policy boleto_ajustes_select on public.boleto_ajustes for select using (true);
drop policy if exists boleto_ajustes_write on public.boleto_ajustes;
create policy boleto_ajustes_write on public.boleto_ajustes for all
  using (public.can_manage(array['admin','financeiro']::app_role[]))
  with check (public.can_manage(array['admin','financeiro']::app_role[]));
