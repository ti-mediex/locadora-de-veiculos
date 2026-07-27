import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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

export interface GerarReceitaResult { criados: number; contratos: number; jaExistiam: number }

/** Gera lançamentos de receita de aluguel (categoria "Aluguel") por semana a
 *  partir dos contratos ATIVOS, para o mês de referência. Uma semana por
 *  contrato, ancorada na data de entrega, apenas para semanas já ocorridas
 *  (início ≤ hoje) e dentro da vigência. Idempotente por (contrato_id, data). */
export function useGerarReceitaAluguel() {
  const qc = useQueryClient();
  return useMutation<GerarReceitaResult, Error, { refMes?: Date }>({
    mutationFn: async ({ refMes = new Date() }) => {
      const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const y = refMes.getFullYear(), m = refMes.getMonth();
      const monthStart = new Date(y, m, 1);
      const monthEnd = new Date(y, m + 1, 0);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const iniStr = fmt(monthStart), fimStr = fmt(monthEnd);

      const { data: contratos, error: cErr } = await supabase
        .from("contratos")
        .select("id, numero, cliente_nome, vehicle_id, valor_locacao, semanas, data_entrega, devolucao_prevista, status")
        .eq("status", "ativo");
      if (cErr) throw cErr;
      const ativos = ((contratos ?? []) as {
        id: string; numero: string; cliente_nome: string | null; vehicle_id: string | null;
        valor_locacao: number | string | null; semanas: number | null; data_entrega: string | null; devolucao_prevista: string | null;
      }[]).filter((c) => c.vehicle_id && Number(c.valor_locacao) > 0 && c.data_entrega);

      // Idempotência: lançamentos de aluguel já existentes no mês, por contrato+data.
      const { data: existentes, error: eErr } = await supabase
        .from("finance_entries")
        .select("contrato_id, data")
        .eq("tipo", "receita")
        .not("contrato_id", "is", null)
        .gte("data", iniStr).lte("data", fimStr);
      if (eErr) throw eErr;
      const jaTem = new Set(((existentes ?? []) as { contrato_id: string; data: string }[]).map((e) => `${e.contrato_id}|${e.data}`));

      // Sextas-feiras do mês = vencimento de todos os boletos de locação.
      const sextas: Date[] = [];
      { const f = new Date(monthStart); f.setDate(f.getDate() + ((5 - f.getDay()) + 7) % 7); for (; f <= monthEnd; f.setDate(f.getDate() + 7)) sextas.push(new Date(f)); }

      const rows: Record<string, unknown>[] = [];
      const contratosLancados = new Set<string>();
      let jaExistiam = 0;
      for (const c of ativos) {
        const inicio = new Date(c.data_entrega! + "T00:00:00");
        // Fim da vigência: nunca além de hoje.
        let limite = today;
        if (c.devolucao_prevista) {
          const dev = new Date(c.devolucao_prevista + "T00:00:00");
          if (dev < limite) limite = dev;
        } else if (c.semanas) {
          const s = new Date(inicio); s.setDate(s.getDate() + Number(c.semanas) * 7 - 1);
          if (s < limite) limite = s;
        }
        for (const d of sextas) {
          if (d < inicio || d > limite) continue;
          const ds = fmt(d);
          const key = `${c.id}|${ds}`;
          if (jaTem.has(key)) { jaExistiam++; contratosLancados.add(c.id); continue; }
          jaTem.add(key);
          contratosLancados.add(c.id);
          rows.push({
            tipo: "receita", data: ds, vehicle_id: c.vehicle_id, categoria: "Aluguel",
            descricao: `Aluguel semanal — ${c.numero} (${c.cliente_nome ?? ""})`.trim(),
            valor: Number(c.valor_locacao), contrato_id: c.id,
            observacoes: "Gerado automaticamente do contrato ativo (vencimento sexta)",
          });
        }
      }
      for (let i = 0; i < rows.length; i += 200) {
        const { error } = await supabase.from("finance_entries").insert(rows.slice(i, i + 200) as never);
        if (error) throw error;
      }
      return { criados: rows.length, contratos: contratosLancados.size, jaExistiam };
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["finance"] });
      qc.invalidateQueries({ queryKey: ["finance_entries"] });
      toast.success(
        r.criados > 0
          ? `${r.criados} lançamento(s) de aluguel gerado(s) para ${r.contratos} contrato(s)` + (r.jaExistiam ? ` · ${r.jaExistiam} já existia(m)` : "")
          : r.jaExistiam ? `Nada a gerar — ${r.jaExistiam} semana(s) já lançada(s)` : "Nenhuma semana de aluguel a lançar no período"
      );
    },
    onError: (e: Error) => toast.error("Erro ao gerar receita de aluguel: " + e.message),
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
