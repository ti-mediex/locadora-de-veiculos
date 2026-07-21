import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface FinanceSummary {
  periodo_inicio: string;
  periodo_fim: string;
  receita_mes: number;
  despesa_mes: number;
  lucro_mes: number;
  margem_mes: number;
  receita_total: number;
  despesa_total: number;
  lucro_total: number;
  total_veiculos: number;
}

export interface FinanceMonthly {
  mes: string;
  receita: number;
  despesa: number;
  resultado: number;
}

export interface FinanceByVehicle {
  vehicle_id: string;
  placa: string;
  modelo: string;
  receita: number;
  despesa: number;
  resultado: number;
}

export function useFinanceSummary(inicio?: string, fim?: string) {
  return useQuery<FinanceSummary>({
    queryKey: ["finance", "summary", inicio, fim],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("finance_summary", { p_inicio: inicio, p_fim: fim });
      if (error) throw error;
      return data as FinanceSummary;
    },
  });
}

export function useFinanceMonthly(meses = 12) {
  return useQuery<FinanceMonthly[]>({
    queryKey: ["finance", "monthly", meses],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("finance_monthly", { p_meses: meses });
      if (error) throw error;
      return ((data ?? []) as { mes: string; receita: number; despesa: number }[]).map((d) => ({
        mes: d.mes,
        receita: Number(d.receita),
        despesa: Number(d.despesa),
        resultado: Number(d.receita) - Number(d.despesa),
      }));
    },
  });
}

export interface FinanceEntryRow {
  id: string;
  tipo: "receita" | "despesa";
  data: string;
  vehicle_id: string | null;
  categoria: string | null;
  descricao: string;
  valor: number;
  placa: string | null;
}

/** Lançamentos financeiros detalhados (para relatórios), com placa do veículo. */
export function useFinanceEntries(inicio?: string, fim?: string) {
  return useQuery<FinanceEntryRow[]>({
    queryKey: ["finance", "entries", inicio, fim],
    queryFn: async () => {
      let q = supabase
        .from("finance_entries")
        .select("id, tipo, data, vehicle_id, categoria, descricao, valor, vehicles(placa)")
        .order("data", { ascending: false })
        .limit(5000);
      if (inicio) q = q.gte("data", inicio);
      if (fim) q = q.lte("data", fim);
      const { data, error } = await q;
      if (error) throw error;
      return ((data ?? []) as unknown as (Omit<FinanceEntryRow, "placa" | "valor"> & { valor: number | string; vehicles: { placa: string } | null })[]).map((r) => ({
        id: r.id, tipo: r.tipo, data: r.data, vehicle_id: r.vehicle_id,
        categoria: r.categoria, descricao: r.descricao, valor: Number(r.valor),
        placa: r.vehicles?.placa ?? null,
      }));
    },
  });
}

export function useFinanceByVehicle() {
  return useQuery<FinanceByVehicle[]>({
    queryKey: ["finance", "by-vehicle"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("finance_by_vehicle");
      if (error) throw error;
      return ((data ?? []) as FinanceByVehicle[]).map((d) => ({
        ...d,
        receita: Number(d.receita),
        despesa: Number(d.despesa),
        resultado: Number(d.resultado),
      }));
    },
  });
}
