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

export interface OccurrenceByType {
  tipo: string;
  total: number;
}

/** Ocorrências por dia (long format) pivotado para o gráfico de barras empilhadas. */
export function useOccurrencesByDay(dias = 30) {
  return useQuery<Record<string, number | string>[]>({
    queryKey: ["dashboard", "occ-by-day", dias],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("occurrences_by_day", { p_dias: dias });
      if (error) throw error;
      const rows = (data ?? []) as { dia: string; tipo: string; total: number }[];
      const map = new Map<string, Record<string, number | string>>();
      for (const r of rows) {
        const key = r.dia;
        const cur = map.get(key) ?? { dia: key };
        cur[r.tipo] = Number(r.total);
        map.set(key, cur);
      }
      return Array.from(map.values());
    },
  });
}

export function useOccurrencesByType(dias = 30) {
  return useQuery<OccurrenceByType[]>({
    queryKey: ["dashboard", "occ-by-type", dias],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("occurrences_by_type", { p_dias: dias });
      if (error) throw error;
      return ((data ?? []) as OccurrenceByType[]).map((d) => ({
        tipo: d.tipo,
        total: Number(d.total),
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

type UpcomingReceivable = Receivable & {
  contracts: { numero: string; renters: { nome: string; telefone: string | null } } | null;
};

/** Próximos vencimentos e cobranças em atraso para o painel. */
export function useUpcomingReceivables() {
  return useQuery<UpcomingReceivable[]>({
    queryKey: ["dashboard", "upcoming-receivables"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("receivables")
        .select("*, contracts(numero, renters(nome, telefone))")
        .in("status", ["pendente", "atrasado", "parcial"])
        .order("vencimento", { ascending: true })
        .limit(8);
      if (error) throw error;
      return (data ?? []) as never;
    },
  });
}

export interface OperationalAlerts {
  cnhVencendo: { id: string; nome: string; validade_cnh: string | null }[];
  manutencoesPendentes: number;
  multasARepassar: number;
}

/** Alertas operacionais: CNH vencendo (≤30 dias ou vencida), manutenções e multas pendentes. */
export function useOperationalAlerts() {
  return useQuery<OperationalAlerts>({
    queryKey: ["dashboard", "alerts"],
    queryFn: async () => {
      const limite = new Date();
      limite.setDate(limite.getDate() + 30);
      const limiteStr = limite.toISOString().slice(0, 10);

      const [cnh, manut, multas] = await Promise.all([
        supabase
          .from("renters")
          .select("id, nome, validade_cnh")
          .not("validade_cnh", "is", null)
          .lte("validade_cnh", limiteStr)
          .order("validade_cnh", { ascending: true })
          .limit(10),
        supabase
          .from("maintenances")
          .select("id", { count: "exact", head: true })
          .in("status", ["agendada", "em_andamento"]),
        supabase
          .from("fines")
          .select("id", { count: "exact", head: true })
          .eq("repassar_locatario", true)
          .eq("repassado", false)
          .neq("status", "cancelada"),
      ]);

      return {
        cnhVencendo: (cnh.data ?? []) as never,
        manutencoesPendentes: manut.count ?? 0,
        multasARepassar: multas.count ?? 0,
      };
    },
  });
}

export interface TopDebtor {
  nome: string;
  telefone: string | null;
  total: number;
  cobrancas: number;
}

/** Top devedores: locatários com maior valor em atraso. */
export function useTopDebtors() {
  return useQuery<TopDebtor[]>({
    queryKey: ["dashboard", "top-debtors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("receivables")
        .select("valor, valor_pago, juros, multa, contracts(renters(nome, telefone))")
        .eq("status", "atrasado");
      if (error) throw error;

      const map = new Map<string, TopDebtor>();
      for (const r of (data ?? []) as never[]) {
        const row = r as {
          valor: number;
          valor_pago: number;
          juros: number;
          multa: number;
          contracts: { renters: { nome: string; telefone: string | null } | null } | null;
        };
        const renter = row.contracts?.renters;
        if (!renter) continue;
        const saldo = row.valor + row.juros + row.multa - row.valor_pago;
        const cur = map.get(renter.nome) ?? {
          nome: renter.nome,
          telefone: renter.telefone,
          total: 0,
          cobrancas: 0,
        };
        cur.total += saldo;
        cur.cobrancas += 1;
        map.set(renter.nome, cur);
      }
      return Array.from(map.values())
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);
    },
  });
}
