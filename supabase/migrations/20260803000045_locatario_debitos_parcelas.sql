-- Parcelamento de cobranças do locatário (ex.: KM excedente) distribuídas em
-- boletos semanais: sexta-alvo da parcela + numeração e agrupamento.
alter table public.locatario_debitos
  add column if not exists semana_venc date,      -- sexta-alvo do boleto que recebe a parcela
  add column if not exists parcela_num integer,
  add column if not exists parcela_total integer,
  add column if not exists grupo_id uuid;         -- agrupa as parcelas de uma mesma cobrança

create index if not exists idx_locdeb_semana_venc on public.locatario_debitos (semana_venc);
create index if not exists idx_locdeb_grupo on public.locatario_debitos (grupo_id);
