-- Configurações do app (chave-valor), incluindo os templates de mensagem
-- para envio do laudo de vistoria por WhatsApp e e-mail.
create table if not exists public.app_config (
  chave      text primary key,
  valor      text,
  updated_at timestamptz not null default now()
);
alter table public.app_config enable row level security;

drop policy if exists app_config_select on public.app_config;
create policy app_config_select on public.app_config for select to authenticated using (true);
drop policy if exists app_config_write on public.app_config;
create policy app_config_write on public.app_config for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

insert into public.app_config (chave, valor) values
  ('empresa_nome', 'VIP CARS'),
  ('laudo_whatsapp_msg', 'Olá {nome}! Segue o laudo da vistoria do veículo {placa} ({tipo}).' || chr(10) || chr(10) || 'Laudo: {link}' || chr(10) || chr(10) || '{empresa}'),
  ('laudo_email_assunto', 'Laudo de vistoria ({tipo}) — {placa}'),
  ('laudo_email_corpo', 'Olá {nome},' || chr(10) || chr(10) || 'Segue em anexo o laudo da vistoria do veículo {placa} ({tipo}).' || chr(10) || chr(10) || 'Atenciosamente,' || chr(10) || '{empresa}')
on conflict (chave) do nothing;
