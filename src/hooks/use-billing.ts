import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import type { Billing, BillingItem } from "@/types/database";

export type BillingWithRefs = Billing & {
  contracts: { numero: string } | null;
  renters: { nome: string } | null;
};

export function useBillings() {
  return useQuery<BillingWithRefs[]>({
    queryKey: ["billings", "list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billings")
        .select("*, contracts(numero), renters(nome)")
        .order("data_emissao", { ascending: false });
      if (error) throw error;
      return (data ?? []) as never;
    },
  });
}

export function useBillingItems(billingId: string | null) {
  return useQuery<BillingItem[]>({
    queryKey: ["billing_items", billingId],
    enabled: !!billingId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billing_items")
        .select("*")
        .eq("billing_id", billingId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as BillingItem[];
    },
  });
}

/** Itens faturáveis em aberto de um contrato: aluguel (recebíveis), multas e ocorrências repassáveis. */
export function useBillableItems(contractId: string | null, renterId: string | null) {
  return useQuery({
    queryKey: ["billable", contractId, renterId],
    enabled: !!contractId,
    queryFn: async () => {
      const [rec, fines, occ] = await Promise.all([
        supabase.from("receivables").select("id, competencia, vencimento, valor, valor_pago, status")
          .eq("contract_id", contractId).in("status", ["pendente", "atrasado", "parcial"]),
        renterId
          ? supabase.from("fines").select("id, descricao, valor, data_infracao")
              .eq("renter_id", renterId).eq("repassar_locatario", true).eq("repassado", false).neq("status", "cancelada")
          : Promise.resolve({ data: [] as unknown[], error: null }),
        supabase.from("occurrences").select("id, descricao, valor, data, tipo")
          .eq("contract_id", contractId).not("valor", "is", null).neq("status", "cancelada"),
      ]);
      if (rec.error) throw rec.error;
      return {
        receivables: (rec.data ?? []) as { id: string; competencia: string | null; vencimento: string; valor: number; valor_pago: number }[],
        fines: ((fines as { data: unknown[] }).data ?? []) as { id: string; descricao: string; valor: number; data_infracao: string }[],
        occurrences: (occ.data ?? []) as { id: string; descricao: string; valor: number; data: string; tipo: string }[],
      };
    },
  });
}

interface CreateBillingArgs {
  billing: Record<string, unknown>;
  items: { tipo: string; descricao: string; valor: number; ref_id?: string }[];
}

export function useCreateBilling() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ billing, items }: CreateBillingArgs) => {
      const total = items.reduce((s, i) => s + i.valor, 0);
      const { data, error } = await supabase
        .from("billings")
        .insert({ ...billing, valor_total: total, status: "fechada" } as never)
        .select()
        .single();
      if (error) throw error;
      const created = data as Billing;
      if (items.length > 0) {
        const rows = items.map((i) => ({ ...i, billing_id: created.id }));
        const { error: e2 } = await supabase.from("billing_items").insert(rows as never);
        if (e2) throw e2;
      }
      return created;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["billings"] });
      toast.success("Fatura gerada");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });
}

export function useCancelBilling() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("billings").update({ status: "cancelada" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["billings"] });
      toast.success("Fatura cancelada");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });
}
