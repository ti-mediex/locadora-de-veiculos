-- =============================================================================
-- FrotaGest — Row Level Security
-- App interno: qualquer usuário autenticado opera o sistema.
-- Gestão de usuários (profiles) restrita a admin.
-- =============================================================================

-- Helper: papel do usuário atual
create or replace function public.current_role()
returns app_role
language sql
stable
security definer set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false);
$$;

-- Habilita RLS -----------------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.vehicles      enable row level security;
alter table public.renters       enable row level security;
alter table public.contracts     enable row level security;
alter table public.receivables   enable row level security;
alter table public.maintenances  enable row level security;
alter table public.fines         enable row level security;
alter table public.expenses      enable row level security;

-- PROFILES ---------------------------------------------------------------------
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated using (true);

drop policy if exists "profiles_update_self_or_admin" on public.profiles;
create policy "profiles_update_self_or_admin" on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_admin_insert" on public.profiles;
create policy "profiles_admin_insert" on public.profiles
  for insert to authenticated with check (public.is_admin());

drop policy if exists "profiles_admin_delete" on public.profiles;
create policy "profiles_admin_delete" on public.profiles
  for delete to authenticated using (public.is_admin());

-- Tabelas operacionais: acesso total para autenticados -------------------------
do $$
declare
  t text;
  tables text[] := array['vehicles','renters','contracts','receivables','maintenances','fines','expenses'];
begin
  foreach t in array tables loop
    execute format('drop policy if exists "%s_all" on public.%s;', t, t);
    execute format(
      'create policy "%s_all" on public.%s for all to authenticated using (true) with check (true);',
      t, t
    );
  end loop;
end $$;
