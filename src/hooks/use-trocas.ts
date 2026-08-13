import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

export interface TrocaVeiculo {
  id: string;
  contrato_id: string | null;
  locatario_id: string | null;
  locatario_nome: string | null;
  veiculo_origem_id: string | null;
  placa_origem: string | null;
  veiculo_reserva_id: string | null;
  placa_reserva: string | null;
  motivo: string;
  ocorrencia_id: string | null;
  data_troca: string;
  hora_troca: string | null;
  km_origem: number | null;
  km_reserva: number | null;
  data_retorno: string | null;
  km_retorno: number | null;
  status: "ativa" | "encerrada";
  observacoes: string | null;
  contrato_numero?: string | null;
  created_at: string;
  updated_at: string;
}

export type TrocaRow = TrocaVeiculo & { contratos: { numero: string } | null };

export const TROCA_MOTIVO = [
  { value: "manutencao", label: "Manutenção" },
  { value: "sinistro", label: "Sinistro" },
  { value: "revisao", label: "Revisão" },
  { value: "outro", label: "Outro" },
] as const;

export const motivoLabel = (m?: string | null) => TROCA_MOTIVO.find((x) => x.value === m)?.label ?? m ?? "—";

/** Todas as trocas (mais recentes primeiro), com número do contrato. */
export function useTrocas() {
  return useQuery<TrocaRow[]>({
    queryKey: ["trocas_veiculo", "list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trocas_veiculo")
        .select("*, contratos(numero)")
        .order("data_troca", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as never;
    },
  });
}

export interface TrocaAviso {
  troca: TrocaRow;
  /** Papel do veículo consultado nesta troca. */
  papel: "origem" | "reserva";
}

/** Mapa vehicle_id → troca ativa, tanto pelo veículo de origem quanto pelo reserva,
 *  para exibir avisos na ficha do veículo e no painel da frota. */
export function useTrocasAtivasPorVeiculo() {
  const { data: trocas = [] } = useTrocas();
  return useMemo(() => {
    const m = new Map<string, TrocaAviso>();
    for (const t of trocas) {
      if (t.status !== "ativa") continue;
      if (t.veiculo_origem_id && !m.has(t.veiculo_origem_id)) m.set(t.veiculo_origem_id, { troca: t, papel: "origem" });
      if (t.veiculo_reserva_id && !m.has(t.veiculo_reserva_id)) m.set(t.veiculo_reserva_id, { troca: t, papel: "reserva" });
    }
    return m;
  }, [trocas]);
}

/** Trocas de um contrato (histórico do locatário). */
export function useTrocasPorContrato(contratoId?: string) {
  const { data: trocas = [] } = useTrocas();
  return useMemo(() => (contratoId ? trocas.filter((t) => t.contrato_id === contratoId) : []), [trocas, contratoId]);
}

export type TrocaPayload = Partial<Omit<TrocaVeiculo, "id" | "created_at" | "updated_at" | "contrato_numero">>;

export function useCreateTroca() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: TrocaPayload) => {
      const { data: prof } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("trocas_veiculo")
        .insert({ ...payload, created_by: prof.user?.id ?? null } as never)
        .select("id")
        .single();
      if (error) throw error;
      return data as { id: string };
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["trocas_veiculo"] }); toast.success("Troca registrada"); },
    onError: (e: Error) => toast.error("Erro ao registrar troca: " + e.message),
  });
}

export function useUpdateTroca() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & TrocaPayload) => {
      const { error } = await supabase.from("trocas_veiculo").update(patch as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["trocas_veiculo"] }); toast.success("Troca atualizada"); },
    onError: (e: Error) => toast.error("Erro ao atualizar troca: " + e.message),
  });
}

/** Encerra a troca (veículo original retornou / reserva devolvido). */
export function useEncerrarTroca() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data_retorno, km_retorno }: { id: string; data_retorno: string; km_retorno?: number | null }) => {
      const { error } = await supabase.from("trocas_veiculo")
        .update({ status: "encerrada", data_retorno, km_retorno: km_retorno ?? null } as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["trocas_veiculo"] }); toast.success("Troca encerrada"); },
    onError: (e: Error) => toast.error("Erro ao encerrar troca: " + e.message),
  });
}

export function useDeleteTroca() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("trocas_veiculo").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["trocas_veiculo"] }); toast.success("Troca removida"); },
    onError: (e: Error) => toast.error("Erro ao remover troca: " + e.message),
  });
}
