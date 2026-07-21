import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

interface FipeResult {
  atualizados: number;
  sem_correspondencia: number;
  mes_referencia: string;
  total: number;
}

/** Invoca a Edge Function que consulta a Tabela FIPE e grava o valor no veículo. */
export function useUpdateFipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (opts: { vehicle_id?: string; all?: boolean }) => {
      const { data, error } = await supabase.functions.invoke<FipeResult>("fipe-update", {
        body: opts,
      });
      if (error) throw error;
      return data as FipeResult;
    },
    onSuccess: (r, vars) => {
      qc.invalidateQueries({ queryKey: ["vehicles"] });
      if (vars.vehicle_id) {
        if (r.atualizados > 0) toast.success(`Valor FIPE atualizado (${r.mes_referencia})`);
        else toast.warning("Não foi possível localizar este veículo na Tabela FIPE");
      } else {
        toast.success(
          `FIPE atualizada: ${r.atualizados} de ${r.total} veículo(s)` +
            (r.sem_correspondencia ? ` · ${r.sem_correspondencia} sem correspondência` : "") +
            (r.mes_referencia ? ` · ${r.mes_referencia}` : "")
        );
      }
    },
    onError: (e: Error) => toast.error("Erro ao atualizar FIPE: " + e.message),
  });
}
