-- Histórico de importações (Detran e Consulta Placa) por veículo, com o
-- arquivo original guardado no Storage para visualização/download futuro.
create table if not exists public.import_history (
  id           uuid primary key default gen_random_uuid(),
  vehicle_id   uuid references public.vehicles(id) on delete set null,
  placa        text,
  tipo         text not null check (tipo in ('detran','consulta_placa')),
  file_name    text,
  storage_path text,
  resumo       jsonb,
  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now()
);

create index if not exists idx_import_history_vehicle on public.import_history(vehicle_id);
create index if not exists idx_import_history_tipo on public.import_history(tipo);

alter table public.import_history enable row level security;

drop policy if exists import_history_select on public.import_history;
create policy import_history_select on public.import_history
  for select to authenticated using (true);

drop policy if exists import_history_write on public.import_history;
create policy import_history_write on public.import_history
  for all to authenticated
  using (public.can_manage(array['admin','financeiro','operador']::app_role[]))
  with check (public.can_manage(array['admin','financeiro','operador']::app_role[]));

-- Bucket privado para os PDFs importados.
insert into storage.buckets (id, name, public)
values ('importacoes', 'importacoes', false)
on conflict (id) do nothing;

drop policy if exists "importacoes_read" on storage.objects;
create policy "importacoes_read" on storage.objects
  for select to authenticated using (bucket_id = 'importacoes');

drop policy if exists "importacoes_insert" on storage.objects;
create policy "importacoes_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'importacoes');

drop policy if exists "importacoes_delete" on storage.objects;
create policy "importacoes_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'importacoes');
