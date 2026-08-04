import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import type { VehicleConsorcio } from "@/types/database";

/** Item de cota para gravar (sem os campos gerados). */
export interface ConsorcioInput {
  grupo: string | null;
  cota: string | null;
  status: string;
  ultimo_pagamento: string | null;
  valor_parcela: number;
  valor_quitacao: number;
  valor_atrasadas: number;
}

/** Todas as cotas de consórcio (para somar por veículo na listagem). */
export function useConsorcios() {
  return useQuery<VehicleConsorcio[]>({
    queryKey: ["vehicle_consorcios", "list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicle_consorcios").select("*").limit(20000);
      if (error) throw error;
      return (data ?? []) as VehicleConsorcio[];
    },
  });
}

/** Cotas de um veículo. */
export function useConsorciosVeiculo(vehicleId?: string) {
  return useQuery<VehicleConsorcio[]>({
    queryKey: ["vehicle_consorcios", vehicleId ?? ""],
    enabled: !!vehicleId,
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicle_consorcios").select("*")
        .eq("vehicle_id", vehicleId!).order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as VehicleConsorcio[];
    },
  });
}

/** Substitui todas as cotas de consórcio de um veículo pelas informadas. */
export function useSalvarConsorciosVeiculo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ vehicleId, placa, itens }: { vehicleId: string; placa: string | null; itens: ConsorcioInput[] }) => {
      await supabase.from("vehicle_consorcios").delete().eq("vehicle_id", vehicleId);
      const linhas = itens
        .filter((i) => (i.grupo ?? "").trim() || (i.cota ?? "").trim() || Number(i.valor_parcela) > 0 || Number(i.valor_quitacao) > 0)
        .map((i) => ({
          vehicle_id: vehicleId, placa, banco: "Banco do Brasil", alienante: "Consórcio BB",
          grupo: i.grupo ?? null, cota: i.cota ?? null, status: i.status || "ativa",
          ultimo_pagamento: i.ultimo_pagamento || null,
          valor_parcela: Number(i.valor_parcela) || 0,
          valor_quitacao: Number(i.valor_quitacao) || 0,
          valor_atrasadas: Number(i.valor_atrasadas) || 0,
        }));
      if (linhas.length) { const { error } = await supabase.from("vehicle_consorcios").insert(linhas as never); if (error) throw error; }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vehicle_consorcios"] }); },
    onError: (e: Error) => toast.error("Erro ao salvar consórcios: " + e.message),
  });
}

/** Soma parcela/quitação/atrasadas de um conjunto de cotas. */
export function somarConsorcios(rows: { valor_parcela: number; valor_quitacao: number; valor_atrasadas: number }[]) {
  return rows.reduce(
    (a, r) => ({ parcela: a.parcela + Number(r.valor_parcela || 0), quitacao: a.quitacao + Number(r.valor_quitacao || 0), atrasadas: a.atrasadas + Number(r.valor_atrasadas || 0), n: a.n + 1 }),
    { parcela: 0, quitacao: 0, atrasadas: 0, n: 0 },
  );
}

/** Mapa vehicle_id → soma das cotas, para a listagem de veículos. */
export function useConsorcioPorVeiculo() {
  const { data: rows = [] } = useConsorcios();
  return useMemo(() => {
    const m = new Map<string, { parcela: number; quitacao: number; atrasadas: number; n: number }>();
    for (const r of rows) {
      if (!r.vehicle_id) continue;
      const cur = m.get(r.vehicle_id) ?? { parcela: 0, quitacao: 0, atrasadas: 0, n: 0 };
      cur.parcela += Number(r.valor_parcela || 0);
      cur.quitacao += Number(r.valor_quitacao || 0);
      cur.atrasadas += Number(r.valor_atrasadas || 0);
      cur.n += 1;
      m.set(r.vehicle_id, cur);
    }
    return m;
  }, [rows]);
}
