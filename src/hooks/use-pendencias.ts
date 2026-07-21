import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { PENDENCIA_ITENS_PADRAO } from "@/lib/options";
import type { VehiclePendencia } from "@/types/database";

export type PendenciaRow = VehiclePendencia & { vehicles: { placa: string; modelo: string } | null };

export interface PendenciasSummary {
  abertas: number;
  vencidas: number;
  a_vencer_7: number;
  a_vencer_30: number;
  criticas: number;
  ituran_inativos: number;
}

export function usePendencias() {
  return useQuery<PendenciaRow[]>({
    queryKey: ["vehicle_pendencias", "list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_pendencias")
        .select("*, vehicles(placa, modelo)")
        .order("vencimento", { ascending: true, nullsFirst: false })
        .limit(3000);
      if (error) throw error;
      return (data ?? []) as never;
    },
  });
}

export function usePendenciasSummary() {
  return useQuery<PendenciasSummary>({
    queryKey: ["vehicle_pendencias", "summary"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pendencias_summary");
      if (error) throw error;
      return data as PendenciasSummary;
    },
  });
}

export function usePendenciasPorVeiculo() {
  return useQuery<Record<string, { abertas: number; vencidas: number }>>({
    queryKey: ["vehicle_pendencias", "por-veiculo"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pendencias_por_veiculo");
      if (error) throw error;
      const map: Record<string, { abertas: number; vencidas: number }> = {};
      for (const r of (data ?? []) as { vehicle_id: string; abertas: number; vencidas: number }[]) {
        map[r.vehicle_id] = { abertas: Number(r.abertas), vencidas: Number(r.vencidas) };
      }
      return map;
    },
  });
}

/** Gera os itens de controle padrão para os veículos que ainda não os têm. */
export function useGenerateDefaultPendencias() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const [vehiclesRes, pendRes] = await Promise.all([
        supabase.from("vehicles").select("id").neq("status", "inativo"),
        supabase.from("vehicle_pendencias").select("vehicle_id, categoria"),
      ]);
      if (vehiclesRes.error) throw vehiclesRes.error;
      const existentes = new Set(
        ((pendRes.data ?? []) as { vehicle_id: string; categoria: string }[]).map((p) => `${p.vehicle_id}|${p.categoria}`)
      );
      const rows: Record<string, unknown>[] = [];
      for (const v of (vehiclesRes.data ?? []) as { id: string }[]) {
        for (const item of PENDENCIA_ITENS_PADRAO) {
          if (existentes.has(`${v.id}|${item.categoria}`)) continue;
          rows.push({
            vehicle_id: v.id,
            categoria: item.categoria,
            titulo: item.titulo,
            status: "aberta",
            prioridade: "media",
            ativo: item.controle === "ativo" ? true : null,
          });
        }
      }
      if (rows.length === 0) return 0;
      for (let i = 0; i < rows.length; i += 200) {
        const { error } = await supabase.from("vehicle_pendencias").insert(rows.slice(i, i + 200) as never);
        if (error) throw error;
      }
      return rows.length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["vehicle_pendencias"] });
      toast.success(n > 0 ? `${n} item(ns) de controle criado(s)` : "Todos os veículos já têm os itens de controle");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });
}

export interface MultaLinha {
  documento: string;       // nº do auto
  infracao: string;        // descrição da infração
  data_ocorrencia: string; // data da infração
  vencimento: string;
  valor: string;
  local: string;
}

export const parseValor = (v: string) => (v ? Number(v.replace(/\./g, "").replace(",", ".")) || 0 : 0);

/** Itens de multa de uma pendência (várias multas numa mesma pendência). */
export function usePendenciaMultasItens(pendenciaId?: string) {
  return useQuery<MultaLinha[]>({
    queryKey: ["pendencia_multas", pendenciaId],
    enabled: !!pendenciaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pendencia_multas")
        .select("*")
        .eq("pendencia_id", pendenciaId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
        documento: (r.documento as string) ?? "",
        infracao: (r.infracao as string) ?? "",
        data_ocorrencia: (r.data_ocorrencia as string) ?? "",
        vencimento: (r.vencimento as string) ?? "",
        valor: r.valor != null ? String(r.valor) : "",
        local: (r.local as string) ?? "",
      }));
    },
  });
}

/** Substitui os itens de multa de uma pendência (delete + insert). */
export function useSavePendenciaMultasItens() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ pendenciaId, itens }: { pendenciaId: string; itens: MultaLinha[] }) => {
      const del = await supabase.from("pendencia_multas").delete().eq("pendencia_id", pendenciaId);
      if (del.error) throw del.error;
      const rows = itens
        .filter((m) => m.infracao.trim() || m.documento.trim() || m.valor.trim())
        .map((m) => ({
          pendencia_id: pendenciaId,
          documento: m.documento.trim() || null,
          infracao: m.infracao.trim() || null,
          data_ocorrencia: m.data_ocorrencia || null,
          vencimento: m.vencimento || null,
          valor: m.valor ? parseValor(m.valor) : null,
          local: m.local.trim() || null,
        }));
      if (rows.length) {
        const { error } = await supabase.from("pendencia_multas").insert(rows as never);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pendencia_multas"] }),
  });
}

/** Classificação derivada do vencimento. */
export type VencStatus = "sem" | "vencida" | "vence7" | "vence30" | "em_dia";
export function vencimentoStatus(venc: string | null, status: string): VencStatus {
  if (status === "resolvida" || status === "cancelada" || !venc) return "sem";
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const d = new Date(venc + "T00:00:00");
  const dias = Math.round((d.getTime() - hoje.getTime()) / 86400000);
  if (dias < 0) return "vencida";
  if (dias <= 7) return "vence7";
  if (dias <= 30) return "vence30";
  return "em_dia";
}
