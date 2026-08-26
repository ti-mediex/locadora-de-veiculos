import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

export type AjusteTipo = "desconto" | "acrescimo";

export interface BoletoAjuste {
  id: string;
  contrato_id: string | null;
  vehicle_id: string | null;
  semana_venc: string;
  descricao: string;
  valor: number;
  tipo: AjusteTipo;
  created_at: string;
  updated_at: string;
}

/** Ajustes manuais de todos os boletos de uma semana (sexta de vencimento). */
export function useBoletoAjustes(semanaVenc?: string) {
  return useQuery<BoletoAjuste[]>({
    queryKey: ["boleto_ajustes", semanaVenc ?? ""],
    enabled: !!semanaVenc,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("boleto_ajustes")
        .select("*")
        .eq("semana_venc", semanaVenc!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as BoletoAjuste[];
    },
  });
}

/** Mapa contrato_id → ajustes da semana. */
export function useBoletoAjustesPorContrato(semanaVenc?: string) {
  const { data: ajustes = [] } = useBoletoAjustes(semanaVenc);
  return useMemo(() => {
    const m = new Map<string, BoletoAjuste[]>();
    for (const a of ajustes) {
      if (!a.contrato_id) continue;
      const arr = m.get(a.contrato_id) ?? [];
      arr.push(a);
      m.set(a.contrato_id, arr);
    }
    return m;
  }, [ajustes]);
}

export function useAddBoletoAjuste() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { contrato_id: string; vehicle_id: string | null; semana_venc: string; descricao: string; valor: number; tipo: AjusteTipo }) => {
      const { data: prof } = await supabase.auth.getUser();
      const { error } = await supabase.from("boleto_ajustes").insert({ ...p, created_by: prof.user?.id ?? null } as never);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["boleto_ajustes"] }); toast.success("Lançamento adicionado ao boleto"); },
    onError: (e: Error) => toast.error("Erro ao adicionar lançamento: " + e.message),
  });
}

export function useDeleteBoletoAjuste() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("boleto_ajustes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["boleto_ajustes"] }); toast.success("Lançamento removido"); },
    onError: (e: Error) => toast.error("Erro ao remover: " + e.message),
  });
}
