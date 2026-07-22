-- Contato do locatário na vistoria, para envio do laudo por WhatsApp/e-mail.
alter table public.vistorias
  add column if not exists locatario_telefone text,
  add column if not exists locatario_email    text;

comment on column public.vistorias.locatario_telefone is 'Telefone/WhatsApp do locatário (para envio do laudo)';
comment on column public.vistorias.locatario_email is 'E-mail do locatário (para envio do laudo)';
