-- =============================================================================
-- FrotaGest — Endurecimento final de execução de funções
-- =============================================================================

-- Remove execução pública/anon do helper criado após o hardening inicial
revoke execute on function public.can_manage(app_role[]) from public, anon;

-- Funções que rodam apenas como trigger não precisam ser executáveis via API REST
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.sync_vehicle_status_on_contract() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
