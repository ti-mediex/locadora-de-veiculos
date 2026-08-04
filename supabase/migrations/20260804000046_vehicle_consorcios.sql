-- Cotas de consórcio por veículo (um veículo pode ter várias cotas — somadas).
-- Todos os consórcios são do Banco do Brasil, com alienação fiduciária ao BB Consórcios.
create table if not exists public.vehicle_consorcios (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid references public.vehicles(id) on delete cascade,
  placa text,
  banco text not null default 'Banco do Brasil',
  grupo text,
  cota text,
  status text not null default 'ativa',
  ultimo_pagamento date,
  valor_parcela numeric not null default 0,
  valor_quitacao numeric not null default 0,
  valor_atrasadas numeric not null default 0,
  alienante text default 'Consórcio BB',
  observacoes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_vehicle_consorcios_vehicle on public.vehicle_consorcios (vehicle_id);

create trigger trg_vehicle_consorcios_updated before update on public.vehicle_consorcios
  for each row execute function public.set_updated_at();

alter table public.vehicle_consorcios enable row level security;
drop policy if exists vconsorcio_select on public.vehicle_consorcios;
create policy vconsorcio_select on public.vehicle_consorcios for select using (true);
drop policy if exists vconsorcio_write on public.vehicle_consorcios;
create policy vconsorcio_write on public.vehicle_consorcios for all
  using (public.can_manage(array['admin','financeiro','operador']::app_role[]))
  with check (public.can_manage(array['admin','financeiro','operador']::app_role[]));
