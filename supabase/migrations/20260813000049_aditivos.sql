-- Aditivos de contrato para assinatura do locatário (confirmação de posse do
-- veículo, aditivo de troca, etc.). A assinatura é feita por um link público
-- com token; o locatário confirma nome/CPF e assina (opcionalmente desenhando).

create sequence if not exists public.aditivos_numero_seq;

create table if not exists public.aditivos (
  id uuid primary key default gen_random_uuid(),
  numero text unique,
  contrato_id uuid references public.contratos(id) on delete set null,
  locatario_id uuid references public.locatarios(id) on delete set null,
  troca_id uuid references public.trocas_veiculo(id) on delete set null,
  tipo text not null default 'confirmacao_posse',   -- confirmacao_posse | troca_veiculo | outro
  vehicle_id uuid references public.vehicles(id) on delete set null,
  placa text,
  cliente_nome text,
  cliente_cpf text,
  conteudo text,
  status text not null default 'rascunho',           -- rascunho | enviado | assinado | cancelado
  token text unique default replace(gen_random_uuid()::text, '-', ''),
  enviado_em timestamptz,
  assinado_em timestamptz,
  assinante_nome text,
  assinante_cpf text,
  assinante_ip text,
  assinatura_img text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_aditivos_contrato on public.aditivos (contrato_id);
create index if not exists idx_aditivos_troca on public.aditivos (troca_id);
create index if not exists idx_aditivos_status on public.aditivos (status);

-- Numeração ADT-#### automática.
create or replace function public.set_aditivo_numero() returns trigger
language plpgsql as $$
begin
  if new.numero is null then
    new.numero := 'ADT-' || lpad(nextval('public.aditivos_numero_seq')::text, 4, '0');
  end if;
  return new;
end $$;

alter function public.set_aditivo_numero() set search_path = public;

drop trigger if exists trg_aditivos_numero on public.aditivos;
create trigger trg_aditivos_numero before insert on public.aditivos
  for each row execute function public.set_aditivo_numero();

create trigger trg_aditivos_updated before update on public.aditivos
  for each row execute function public.set_updated_at();

alter table public.aditivos enable row level security;
drop policy if exists aditivos_select on public.aditivos;
create policy aditivos_select on public.aditivos for select using (true);
drop policy if exists aditivos_write on public.aditivos;
create policy aditivos_write on public.aditivos for all
  using (public.can_manage(array['admin','financeiro','operador']::app_role[]))
  with check (public.can_manage(array['admin','financeiro','operador']::app_role[]));

-- RPC pública: lê o aditivo pelo token (para a página de assinatura), sem exigir login.
create or replace function public.get_aditivo_por_token(p_token text)
returns table (
  id uuid, numero text, tipo text, status text, placa text,
  cliente_nome text, cliente_cpf text, conteudo text,
  assinado_em timestamptz, assinante_nome text
)
language sql security definer set search_path = public as $$
  select a.id, a.numero, a.tipo, a.status, a.placa,
         a.cliente_nome, a.cliente_cpf, a.conteudo,
         a.assinado_em, a.assinante_nome
  from public.aditivos a
  where a.token = p_token
  limit 1;
$$;

-- RPC pública: registra a assinatura do locatário pelo token.
create or replace function public.assinar_aditivo(
  p_token text, p_nome text, p_cpf text, p_assinatura text default null
)
returns text
language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  select status into v_status from public.aditivos where token = p_token;
  if v_status is null then return 'nao_encontrado'; end if;
  if v_status = 'assinado' then return 'ja_assinado'; end if;
  if v_status = 'cancelado' then return 'cancelado'; end if;

  update public.aditivos set
    status = 'assinado',
    assinado_em = now(),
    assinante_nome = p_nome,
    assinante_cpf = p_cpf,
    assinatura_img = p_assinatura
  where token = p_token;
  return 'ok';
end $$;

grant execute on function public.get_aditivo_por_token(text) to anon, authenticated;
grant execute on function public.assinar_aditivo(text, text, text, text) to anon, authenticated;
