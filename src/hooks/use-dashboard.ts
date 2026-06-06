import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type {
  DashboardSummary,
  MonthlyCashflow,
  VehicleProfitability,
  Receivable,
} from "@/types/database";

export function useDashboardSummary(inicio?: string, fim?: string) {
  return useQuery<DashboardSummary>({
    queryKey: ["dashboard", "summary", inicio, fim],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("dashboard_summary", {
        p_inicio: inicio,
        p_fim: fim,
      });
      if (error) throw error;
      return data as DashboardSummary;
    },
  });
}

export function useMonthlyCashflow(meses = 12) {
  return useQuery<MonthlyCashflow[]>({
    queryKey: ["dashboard", "cashflow", meses],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("monthly_cashflow", {
        p_meses: meses,
      });
      if (error) throw error;
      return ((data ?? []) as MonthlyCashflow[]).map((d) => ({
        ...d,
        receita: Number(d.receita),
        despesa: Number(d.despesa),
        resultado: Number(d.receita) - Number(d.despesa),
      }));
    },
  });
}

export function useVehicleProfitability() {
  return useQuery<VehicleProfitability[]>({
    queryKey: ["dashboard", "profitability"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("vehicle_profitability");
      if (error) throw error;
      return (data ?? []) as VehicleProfitability[];
    },
  });
}

/** Próximos vencimentos e cobranças em atraso para o painel. */
export function useUpcomingReceivables() {
  return useQuery<(Receivable & { contracts: { numero: string; renters: { nome: string } } })[]>({
    queryKey: ["dashboard", "upcoming-receivables"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("receivables")
        .select("*, contracts(numero, renters(nome))")
        .in("status", ["pendente", "atrasado", "parcial"])
        .order("vencimento", { ascending: true })
        .limit(8);
      if (error) throw error;
      return (data ?? []) as never;
    },
  });
}
