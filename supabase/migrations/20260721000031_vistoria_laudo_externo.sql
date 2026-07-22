-- Permite anexar um laudo de vistoria em PDF gerado em outro sistema (ex.: Vex).
alter table public.vistorias add column if not exists laudo_externo_path text;
comment on column public.vistorias.laudo_externo_path is 'Caminho no Storage do laudo em PDF importado de outro sistema (ex.: Vex)';
