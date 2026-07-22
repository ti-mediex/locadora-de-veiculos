import { useAuth } from "@/contexts/auth-context";
import type { AppRole } from "@/types/database";

// Espelha as permissões de escrita do banco (RLS) para gating visual na UI.
export type WriteModule =
  | "vehicles"
  | "renters"
  | "maintenances"
  | "occurrences"
  | "inspections"
  | "suppliers"
  | "vehicle_groups"
  | "yards"
  | "buyers"
  | "parts_services"
  | "vehicle_colors"
  | "financing"
  | "invoices"
  | "bank_accounts"
  | "lancamentos"
  | "billing"
  | "finance"
  | "pendencias"
  | "vistorias"
  | "contracts"
  | "receivables"
  | "expenses"
  | "fines"
  | "users";

const MODULE_ROLES: Record<WriteModule, AppRole[]> = {
  vehicles: ["admin", "operador"],
  renters: ["admin", "operador"],
  maintenances: ["admin", "operador"],
  inspections: ["admin", "operador"],
  suppliers: ["admin", "operador"],
  vehicle_groups: ["admin", "operador"],
  yards: ["admin", "operador"],
  buyers: ["admin", "operador"],
  parts_services: ["admin", "operador"],
  vehicle_colors: ["admin", "operador"],
  financing: ["admin", "financeiro"],
  invoices: ["admin", "financeiro"],
  bank_accounts: ["admin", "financeiro"],
  lancamentos: ["admin", "financeiro"],
  billing: ["admin", "financeiro"],
  finance: ["admin", "financeiro"],
  pendencias: ["admin", "financeiro", "operador"],
  vistorias: ["admin", "financeiro", "operador", "vistoriador"],
  occurrences: ["admin", "operador", "financeiro"],
  contracts: ["admin", "financeiro"],
  receivables: ["admin", "financeiro"],
  expenses: ["admin", "financeiro"],
  fines: ["admin", "financeiro"],
  users: ["admin"],
};

/** Retorna se o usuário atual pode escrever no módulo informado. */
export function useCanWrite(module: WriteModule): boolean {
  const { profile } = useAuth();
  const role = profile?.role;
  if (!role) return false;
  return MODULE_ROLES[module].includes(role);
}
