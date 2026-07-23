-- Permite fixar o valor FIPE manualmente por veículo (não sobrescrito pela
-- atualização automática) e guarda a categoria FIPE resolvida (carros/caminhoes)
-- para reprocessar corretamente utilitários e vans.
alter table public.vehicles add column if not exists fipe_manual boolean not null default false;
alter table public.vehicles add column if not exists fipe_categoria_ref text;
