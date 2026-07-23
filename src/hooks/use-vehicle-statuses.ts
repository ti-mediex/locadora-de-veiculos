import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

export interface VehicleStatus {
  id: string;
  value: string;
  label: string;
  cor: string | null;
  ordem: number;
  ativo: boolean;
}

/** Status de veículo cadastrados (configuráveis). */
export function useVehicleStatuses() {
  return useQuery<VehicleStatus[]>({
    queryKey: ["vehicle_statuses", "list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicle_statuses").select("*").eq("ativo", true).order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as VehicleStatus[];
    },
  });
}

/** Gera o valor técnico (slug) a partir do rótulo. */
export function slugStatus(label: string): string {
  return label.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "status";
}

const CORES = ["hsl(160 65% 45%)", "hsl(262 70% 62%)", "hsl(24 90% 55%)", "hsl(190 80% 45%)", "hsl(320 70% 55%)", "hsl(90 60% 45%)"];

/** Cria um novo status de veículo e retorna seu valor técnico. */
export function useCreateVehicleStatus() {
  const qc = useQueryClient();
  return useMutation<string, Error, { label: string }>({
    mutationFn: async ({ label }) => {
      const nome = label.trim();
      if (!nome) throw new Error("Informe o nome do status");
      const value = slugStatus(nome);
      const { data: prof } = await supabase.auth.getUser();
      const cor = CORES[Math.abs([...value].reduce((a, c) => a + c.charCodeAt(0), 0)) % CORES.length];
      const { error } = await supabase.from("vehicle_statuses")
        .upsert({ value, label: nome, cor, ordem: 200, created_by: prof.user?.id ?? null } as never, { onConflict: "value" });
      if (error) throw error;
      return value;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vehicle_statuses"] }); toast.success("Status criado"); },
    onError: (e: Error) => toast.error("Erro ao criar status: " + e.message),
  });
}
