import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { addMonths, format } from "date-fns";
import { supabase } from "@/lib/supabase";

/** Cria lançamento(s): único, parcelado (N parcelas mensais) ou recorrente. */
export function useCreateLedger() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      modo: "unico" | "parcelado" | "recorrente";
      base: Record<string, unknown>;
      parcelas?: number;
    }) => {
      const { modo, base, parcelas = 1 } = args;
      const dataStr = String(base.data ?? new Date().toISOString().slice(0, 10));
      const baseDate = new Date(dataStr + "T00:00:00");

      if (modo === "unico") {
        const { error } = await supabase.from("ledger_entries").insert(base as never);
        if (error) throw error;
        return 1;
      }

      const grupo = crypto.randomUUID();
      const n = modo === "parcelado" ? Math.max(parcelas, 1) : Math.max(parcelas, 1);
      const valorTotal = Number(base.valor) || 0;
      const valorParcela = modo === "parcelado" ? Math.round((valorTotal / n) * 100) / 100 : valorTotal;
      const rows = Array.from({ length: n }, (_, i) => ({
        ...base,
        valor: valorParcela,
        data: format(addMonths(baseDate, i), "yyyy-MM-dd"),
        vencimento: format(addMonths(baseDate, i), "yyyy-MM-dd"),
        recorrente: modo === "recorrente",
        parcela_num: i + 1,
        parcela_total: n,
        grupo,
      }));
      const { error } = await supabase.from("ledger_entries").insert(rows as never);
      if (error) throw error;
      return n;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["ledger_entries"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(`${n} lançamento(s) criado(s)`);
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });
}

/** Transferência entre contas: cria saída na origem e entrada no destino. */
export function useTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      origem: string;
      destino: string;
      valor: number;
      data: string;
      descricao: string;
    }) => {
      const grupo = crypto.randomUUID();
      const rows = [
        {
          data: args.data, tipo: "saida", categoria: "Transferência", descricao: args.descricao,
          valor: args.valor, valor_pago: args.valor, status: "baixado", conta_id: args.origem,
          conta_destino_id: args.destino, grupo, data_baixa: args.data,
        },
        {
          data: args.data, tipo: "entrada", categoria: "Transferência", descricao: args.descricao,
          valor: args.valor, valor_pago: args.valor, status: "baixado", conta_id: args.destino,
          conta_destino_id: args.origem, grupo, data_baixa: args.data,
        },
      ];
      const { error } = await supabase.from("ledger_entries").insert(rows as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ledger_entries"] });
      toast.success("Transferência registrada");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });
}

export function useSettleLedger() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; valor: number; data: string; forma?: string }) => {
      const { error } = await supabase.rpc("settle_ledger_entry", {
        p_id: args.id, p_valor: args.valor, p_data: args.data, p_forma: args.forma ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ledger_entries"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Baixa registrada");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });
}

export function useUndoLedger() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("undo_ledger_settlement", { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ledger_entries"] });
      toast.success("Baixa desfeita");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });
}
