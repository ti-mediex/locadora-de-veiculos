-- Guarda o nome do arquivo do laudo importado, para evitar anexar duplicatas.
alter table public.vistorias add column if not exists laudo_arquivo_nome text;
comment on column public.vistorias.laudo_arquivo_nome is 'Nome do arquivo do laudo importado (para evitar duplicatas)';
