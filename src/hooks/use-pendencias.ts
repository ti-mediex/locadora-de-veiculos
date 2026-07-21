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

import type { DetranParsed } from "@/lib/detran-parse";

export interface ImportDetranOpcoes {
  restricoes: boolean;
  debitos: boolean;
  multas: boolean;
  marcarAlienacao: boolean;
}
export interface ImportDetranResultado {
  restricoes: number;
  debitos: number;
  multas: number;
  ignorados: number;
}

/** Importa débitos/pendências extraídos do PDF do Detran para um veículo. */
export function useImportDetran() {
  const qc = useQueryClient();
  return useMutation<ImportDetranResultado, Error, { vehicleId: string; parsed: DetranParsed; opcoes: ImportDetranOpcoes }>({
    mutationFn: async ({ vehicleId, parsed, opcoes }) => {
      const res: ImportDetranResultado = { restricoes: 0, debitos: 0, multas: 0, ignorados: 0 };

      // Pendências já existentes do veículo (anti-duplicidade)
      const { data: existentes, error: exErr } = await supabase
        .from("vehicle_pendencias")
        .select("id, categoria, titulo, vencimento")
        .eq("vehicle_id", vehicleId);
      if (exErr) throw exErr;
      const jaTem = (categoria: string, chave: string) =>
        ((existentes ?? []) as { categoria: string; titulo: string; vencimento: string | null }[]).some(
          (p) => p.categoria === categoria && (p.titulo === chave || p.vencimento === chave)
        );

      // Restrições
      if (opcoes.restricoes) {
        for (const r of parsed.restricoes) {
          if (jaTem("Restrição", r)) { res.ignorados++; continue; }
          const { error } = await supabase.from("vehicle_pendencias").insert({
            vehicle_id: vehicleId, categoria: "Restrição", titulo: r, status: "aberta", prioridade: "alta",
          } as never);
          if (error) throw error;
          res.restricoes++;
        }
      }
      if (opcoes.marcarAlienacao && parsed.alienacaoFiduciaria) {
        await supabase.from("vehicles").update({ alienacao_fiduciaria: true } as never).eq("id", vehicleId);
      }

      // Débitos (IPVA, Licenciamento, Taxas, Seguro)
      if (opcoes.debitos) {
        for (const d of parsed.debitos) {
          if (jaTem(d.categoria, d.vencimento || d.titulo)) { res.ignorados++; continue; }
          const { error } = await supabase.from("vehicle_pendencias").insert({
            vehicle_id: vehicleId, categoria: d.categoria, titulo: d.titulo, status: "aberta", prioridade: "media",
            vencimento: d.vencimento || null, valor: d.valor || null, observacoes: d.observacoes ?? null,
          } as never);
          if (error) throw error;
          res.debitos++;
        }
      }

      // Multas — agrupa numa única pendência, ignorando autos já cadastrados
      if (opcoes.multas && parsed.multas.length) {
        const { data: docsExist } = await supabase
          .from("pendencia_multas")
          .select("documento, pendencia_id, vehicle_pendencias!inner(vehicle_id)")
          .eq("vehicle_pendencias.vehicle_id", vehicleId);
        const docs = new Set(((docsExist ?? []) as { documento: string | null }[]).map((d) => d.documento).filter(Boolean));
        const novas = parsed.multas.filter((m) => !docs.has(m.documento));
        res.ignorados += parsed.multas.length - novas.length;
        if (novas.length) {
          const total = novas.reduce((s, m) => s + m.valor, 0);
          const hoje = new Date().toISOString().slice(0, 10);
          const { data: pend, error: pErr } = await supabase.from("vehicle_pendencias").insert({
            vehicle_id: vehicleId, categoria: "Multa", titulo: `Multas Detran (${novas.length}) — importadas`,
            status: "aberta", prioridade: "alta", valor: total,
            observacoes: `Importado do Detalhamento de débitos em ${hoje}`,
          } as never).select("id").single();
          if (pErr) throw pErr;
          const rows = novas.map((m) => ({
            pendencia_id: (pend as { id: string }).id,
            documento: m.documento, infracao: m.infracao, data_ocorrencia: m.data_ocorrencia || null,
            vencimento: m.vencimento || null, valor: m.valor || null, local: m.local || null,
          }));
          const { error: mErr } = await supabase.from("pendencia_multas").insert(rows as never);
          if (mErr) throw mErr;
          res.multas = novas.length;
        }
      }

      return res;
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["vehicle_pendencias"] });
      qc.invalidateQueries({ queryKey: ["vehicles"] });
      const total = r.restricoes + r.debitos + r.multas;
      toast.success(
        `Importação concluída: ${total} pendência(s) criada(s)` +
          ` (${r.restricoes} restrição, ${r.debitos} débito, ${r.multas} multa)` +
          (r.ignorados ? ` · ${r.ignorados} já existia(m)` : "")
      );
    },
    onError: (e: Error) => toast.error("Erro na importação: " + e.message),
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
