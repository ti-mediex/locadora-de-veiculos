-- =============================================================================
-- VIP CARS — Remove definitivamente tabelas/funções dos módulos suprimidos
-- Mantém: profiles, vehicles, finance_entries (+ funções em uso)
-- =============================================================================
drop table if exists public.billing_items cascade;
drop table if exists public.billings cascade;
drop table if exists public.invoices cascade;
drop table if exists public.bank_accounts cascade;
drop table if exists public.ledger_entries cascade;
drop table if exists public.financing_installments cascade;
drop table if exists public.financing_contracts cascade;
drop table if exists public.maintenance_items cascade;
drop table if exists public.maintenances cascade;
drop table if exists public.inspections cascade;
drop table if exists public.occurrences cascade;
drop table if exists public.fines cascade;
drop table if exists public.receivables cascade;
drop table if exists public.contracts cascade;
drop table if exists public.expenses cascade;
drop table if exists public.renters cascade;
drop table if exists public.suppliers cascade;
drop table if exists public.vehicle_groups cascade;
drop table if exists public.yards cascade;
drop table if exists public.buyers cascade;
drop table if exists public.parts_services cascade;
drop table if exists public.vehicle_colors cascade;

drop function if exists public.generate_receivables(uuid, date) cascade;
drop function if exists public.generate_n_receivables(uuid, int) cascade;
drop function if exists public.settle_receivable(uuid, numeric, date, text, numeric, numeric) cascade;
drop function if exists public.mark_overdue_receivables() cascade;
drop function if exists public.bulk_adjust_rent(uuid[], numeric, numeric) cascade;
drop function if exists public.dashboard_summary(date, date) cascade;
drop function if exists public.monthly_cashflow(int) cascade;
drop function if exists public.vehicle_profitability() cascade;
drop function if exists public.daily_cashflow(date, date) cascade;
drop function if exists public.occurrences_by_day(int) cascade;
drop function if exists public.occurrences_by_type(int) cascade;
drop function if exists public.settle_ledger_entry(uuid, numeric, date, text) cascade;
drop function if exists public.undo_ledger_settlement(uuid) cascade;
drop function if exists public.sync_vehicle_status_on_contract() cascade;

drop type if exists renter_status cascade;
drop type if exists billing_cycle cascade;
drop type if exists contract_status cascade;
drop type if exists receivable_status cascade;
drop type if exists maintenance_type cascade;
drop type if exists maintenance_status cascade;
drop type if exists maintenance_stage cascade;
drop type if exists fine_status cascade;
drop type if exists expense_status cascade;
drop type if exists occurrence_type cascade;
drop type if exists occurrence_status cascade;
drop type if exists inspection_type cascade;
