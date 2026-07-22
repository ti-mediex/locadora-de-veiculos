-- Módulo de Vistoria de Veículos (checklist com fotos): liberação, devolução
-- e sinistro. Registro por celular das partes do veículo e assinatura do locatário.
create table if not exists public.vistorias (
  id                   uuid primary key default gen_random_uuid(),
  vehicle_id           uuid references public.vehicles(id) on delete set null,
  placa                text,
  tipo                 text not null check (tipo in ('liberacao','devolucao','sinistro')),
  locatario_nome       text,
  locatario_documento  text,
  vistoriador          text,
  km                   integer,
  combustivel          text,   -- reserva | 1/4 | 1/2 | 3/4 | cheio
  checklist            jsonb,  -- [{ item, situacao, observacao }]
  observacoes          text,
  avarias              text,
  assinatura_path      text,   -- caminho no Storage da imagem da assinatura
  gps_lat              numeric,
  gps_lng              numeric,
  status               text not null default 'concluida' check (status in ('rascunho','concluida')),
  created_by           uuid references public.profiles(id),
  created_at           timestamptz not null default now()
);

create table if not exists public.vistoria_fotos (
  id           uuid primary key default gen_random_uuid(),
  vistoria_id  uuid not null references public.vistorias(id) on delete cascade,
  parte        text not null,
  storage_path text not null,
  avaria       boolean not null default false,
  observacao   text,
  created_at   timestamptz not null default now()
);

create index if not exists idx_vistorias_vehicle on public.vistorias(vehicle_id);
create index if not exists idx_vistorias_tipo on public.vistorias(tipo);
create index if not exists idx_vistoria_fotos_vistoria on public.vistoria_fotos(vistoria_id);

alter table public.vistorias enable row level security;
alter table public.vistoria_fotos enable row level security;

drop policy if exists vistorias_select on public.vistorias;
create policy vistorias_select on public.vistorias for select to authenticated using (true);
drop policy if exists vistorias_write on public.vistorias;
create policy vistorias_write on public.vistorias for all to authenticated
  using (public.can_manage(array['admin','financeiro','operador']::app_role[]))
  with check (public.can_manage(array['admin','financeiro','operador']::app_role[]));

drop policy if exists vistoria_fotos_select on public.vistoria_fotos;
create policy vistoria_fotos_select on public.vistoria_fotos for select to authenticated using (true);
drop policy if exists vistoria_fotos_write on public.vistoria_fotos;
create policy vistoria_fotos_write on public.vistoria_fotos for all to authenticated
  using (public.can_manage(array['admin','financeiro','operador']::app_role[]))
  with check (public.can_manage(array['admin','financeiro','operador']::app_role[]));

-- Bucket das fotos e assinaturas de vistoria.
insert into storage.buckets (id, name, public) values ('vistorias', 'vistorias', false)
on conflict (id) do nothing;

drop policy if exists "vistorias_read" on storage.objects;
create policy "vistorias_read" on storage.objects for select to authenticated using (bucket_id = 'vistorias');
drop policy if exists "vistorias_insert" on storage.objects;
create policy "vistorias_insert" on storage.objects for insert to authenticated with check (bucket_id = 'vistorias');
drop policy if exists "vistorias_delete" on storage.objects;
create policy "vistorias_delete" on storage.objects for delete to authenticated using (bucket_id = 'vistorias');
