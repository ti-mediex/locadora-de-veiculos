import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import type { MaintenanceItem } from "@/types/database";

export function useMaintenanceItems(maintenanceId: string | null) {
  return useQuery<MaintenanceItem[]>({
    queryKey: ["maintenance_items", maintenanceId],
    enabled: !!maintenanceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_items")
        .select("*")
        .eq("maintenance_id", maintenanceId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as MaintenanceItem[];
    },
  });
}

/** Recalcula o valor total da OS a partir dos itens. */
async function syncTotal(maintenanceId: string) {
  const { data } = await supabase
    .from("maintenance_items")
    .select("valor, desconto")
    .eq("maintenance_id", maintenanceId);
  const total = (data ?? []).reduce(
    (s: number, i: { valor: number; desconto: number }) => s + (Number(i.valor) - Number(i.desconto)),
    0
  );
  await supabase.from("maintenances").update({ valor: total }).eq("id", maintenanceId);
}

export function useAddMaintenanceItem(maintenanceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { error } = await supabase
        .from("maintenance_items")
        .insert({ ...payload, maintenance_id: maintenanceId } as never);
      if (error) throw error;
      await syncTotal(maintenanceId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["maintenance_items", maintenanceId] });
      qc.invalidateQueries({ queryKey: ["maintenances"] });
      toast.success("Item adicionado");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });
}

export function useDeleteMaintenanceItem(maintenanceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("maintenance_items").delete().eq("id", id);
      if (error) throw error;
      await syncTotal(maintenanceId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["maintenance_items", maintenanceId] });
      qc.invalidateQueries({ queryKey: ["maintenances"] });
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });
}

/** Avança/muda a etapa de uma OS no Kanban. */
export function useUpdateMaintenanceStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, etapa }: { id: string; etapa: string }) => {
      const patch: Record<string, unknown> = { etapa };
      if (etapa === "finalizada") patch.status = "concluida";
      const { error } = await supabase.from("maintenances").update(patch as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["maintenances"] });
      toast.success("Etapa atualizada");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });
}
