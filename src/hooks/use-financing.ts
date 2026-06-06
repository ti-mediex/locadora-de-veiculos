import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { addMonths, format } from "date-fns";
import { supabase } from "@/lib/supabase";

export interface FinancingContract {
  id: string;
  numero: string | null;
  instituicao: string | null;
  vehicle_id: string | null;
  tipo: string | null;
  tabela: string | null;
  forma_pagamento: string | null;
  valor_principal: number;
  valor_entrada: number | null;
  valor_parcela: number | null;
  qtd_parcelas: number;
  taxa_juros_mensal: number;
  iof: number | null;
  tarifa: number | null;
  data_inicio: string;
  primeiro_vencimento: string | null;
  status: string;
  observacoes: string | null;
  vehicles?: { placa: string } | null;
}

export interface Installment {
  numero: number;
  vencimento: string;
  saldo_inicial: number;
  juros: number;
  amortizacao: number;
  parcela: number;
  saldo_final: number;
}

/** Calcula a tabela PRICE de amortização. */
export function calcPriceSchedule(
  principal: number,
  taxaMensalPct: number,
  n: number,
  primeiroVencimento: string
): { parcela: number; schedule: Installment[] } {
  const i = (taxaMensalPct || 0) / 100;
  const pmt = i > 0 ? (principal * i) / (1 - Math.pow(1 + i, -n)) : principal / n;
  const schedule: Installment[] = [];
  let saldo = principal;
  const base = primeiroVencimento ? new Date(primeiroVencimento + "T00:00:00") : new Date();
  for (let k = 0; k < n; k++) {
    const juros = saldo * i;
    const amort = pmt - juros;
    const saldoFinal = Math.max(0, saldo - amort);
    schedule.push({
      numero: k + 1,
      vencimento: format(addMonths(base, k), "yyyy-MM-dd"),
      saldo_inicial: round2(saldo),
      juros: round2(juros),
      amortizacao: round2(amort),
      parcela: round2(pmt),
      saldo_final: round2(saldoFinal),
    });
    saldo = saldoFinal;
  }
  return { parcela: round2(pmt), schedule };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function useFinancingContracts() {
  return useQuery<FinancingContract[]>({
    queryKey: ["financing_contracts", "list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financing_contracts")
        .select("*, vehicles(placa)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as never;
    },
  });
}

export function useInstallments(financingId: string | null) {
  return useQuery<(Installment & { id: string; pago: boolean })[]>({
    queryKey: ["financing_installments", financingId],
    enabled: !!financingId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financing_installments")
        .select("*")
        .eq("financing_id", financingId)
        .order("numero", { ascending: true });
      if (error) throw error;
      return (data ?? []) as never;
    },
  });
}

interface CreateArgs {
  contract: Record<string, unknown>;
  schedule: Installment[];
}

export function useCreateFinancing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ contract, schedule }: CreateArgs) => {
      const { data, error } = await supabase
        .from("financing_contracts")
        .insert(contract as never)
        .select()
        .single();
      if (error) throw error;
      const created = data as FinancingContract;
      if (schedule.length > 0) {
        const rows = schedule.map((s) => ({ ...s, financing_id: created.id }));
        const { error: e2 } = await supabase.from("financing_installments").insert(rows as never);
        if (e2) throw e2;
      }
      return created;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financing_contracts"] });
      toast.success("Financiamento cadastrado com parcelas geradas");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });
}

export function useDeleteFinancing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("financing_contracts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financing_contracts"] });
      toast.success("Financiamento removido");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });
}
