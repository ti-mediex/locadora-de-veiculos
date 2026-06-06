import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import type { Contract, Vehicle, Renter } from "@/types/database";

export type ContractWithRefs = Contract & {
  vehicles: Pick<Vehicle, "id" | "placa" | "marca" | "modelo"> | null;
  renters: Pick<Renter, "id" | "nome" | "cpf"> | null;
};

export function useContracts() {
  return useQuery<ContractWithRefs[]>({
    queryKey: ["contracts", "list-refs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select("*, vehicles(id, placa, marca, modelo), renters(id, nome, cpf)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as never;
    },
  });
}

/** Cria contrato e já gera os recebíveis do período. */
export function useCreateContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data, error } = await supabase
        .from("contracts")
        .insert(payload as never)
        .select()
        .single();
      if (error) throw error;
      const contract = data as Contract;
      // Gera recebíveis até a data fim (ou +60 dias)
      const { error: genErr } = await supabase.rpc("generate_receivables", {
        p_contract_id: contract.id,
      });
      if (genErr) throw genErr;
      return contract;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contracts"] });
      qc.invalidateQueries({ queryKey: ["receivables"] });
      qc.invalidateQueries({ queryKey: ["vehicles"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Contrato criado e cobranças geradas");
    },
    onError: (e: Error) => toast.error("Erro ao criar contrato: " + e.message),
  });
}

export function useUpdateContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & Record<string, unknown>) => {
      const { error } = await supabase
        .from("contracts")
        .update(payload as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contracts"] });
      qc.invalidateQueries({ queryKey: ["vehicles"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Contrato atualizado");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });
}

/** Gera mais recebíveis para um contrato (renovação do período). */
export function useGenerateReceivables() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (contractId: string) => {
      const { data, error } = await supabase.rpc("generate_receivables", {
        p_contract_id: contractId,
      });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["receivables"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(`${n} nova(s) cobrança(s) gerada(s)`);
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });
}
