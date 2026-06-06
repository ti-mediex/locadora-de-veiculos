-- =============================================================================
-- FrotaGest — Hardening de segurança
-- Restringe a execução das funções RPC ao papel autenticado e fixa search_path.
-- =============================================================================

-- Fixa search_path da função de trigger (evita search_path mutável)
alter function public.set_updated_at() set search_path = public;

-- Remove a execução implícita (PUBLIC/anon) de todas as funções do schema
revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from anon;

-- Concede execução apenas ao papel autenticado, somente nas funções usadas pelo app
grant execute on function public.dashboard_summary(date, date) to authenticated;
grant execute on function public.monthly_cashflow(integer) to authenticated;
grant execute on function public.vehicle_profitability() to authenticated;
grant execute on function public.generate_receivables(uuid, date) to authenticated;
grant execute on function public.settle_receivable(uuid, numeric, date, text, numeric, numeric) to authenticated;
grant execute on function public.mark_overdue_receivables() to authenticated;

-- Funções auxiliares usadas pelas políticas de RLS
grant execute on function public.is_admin() to authenticated;
grant execute on function public.current_role() to authenticated;

-- Nota: as políticas "<tabela>_all" usam USING(true)/WITH CHECK(true) de forma
-- intencional — este é um sistema interno onde todo usuário autenticado opera a
-- frota. Para granularidade por papel (admin/financeiro/operador), troque as
-- políticas por expressões baseadas em public.current_role().
