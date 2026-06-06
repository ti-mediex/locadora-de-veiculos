import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import type { Receivable } from "@/types/database";

export type ReceivableWithRefs = Receivable & {
  contracts: {
    numero: string;
    vehicles: { placa: string } | null;
    renters: { nome: string; telefone: string | null } | null;
  } | null;
};

export function useReceivables() {
  return useQuery<ReceivableWithRefs[]>({
    queryKey: ["receivables", "list-refs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("receivables")
        .select("*, contracts(numero, vehicles(placa), renters(nome, telefone))")
        .order("vencimento", { ascending: false });
      if (error) throw error;
      return (data ?? []) as never;
    },
  });
}

interface SettleArgs {
  id: string;
  valor_pago: number;
  data_pagamento: string;
  forma_pagamento?: string;
  juros?: number;
  multa?: number;
}

export function useSettleReceivable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: SettleArgs) => {
      const { error } = await supabase.rpc("settle_receivable", {
        p_receivable_id: args.id,
        p_valor_pago: args.valor_pago,
        p_data_pagamento: args.data_pagamento,
        p_forma_pagamento: args.forma_pagamento,
        p_juros: args.juros ?? 0,
        p_multa: args.multa ?? 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["receivables"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["contracts"] });
      toast.success("Pagamento registrado");
    },
    onError: (e: Error) => toast.error("Erro ao registrar pagamento: " + e.message),
  });
}

export function useMarkOverdue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("mark_overdue_receivables");
      if (error) throw error;
      return data as number;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["receivables"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(`${n} cobrança(s) atualizada(s) para atrasado`);
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });
}
