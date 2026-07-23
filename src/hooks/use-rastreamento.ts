import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import type { GridParsed } from "@/lib/ituran-grid-parse";

export interface RastreioRow {
  id: string;
  vehicle_id: string | null;
  placa: string;
  grupo: string | null;
  ultima_comunicacao: string | null;
  endereco: string | null;
  estados: string | null;
  km: number | null;
  referencia: string | null;
  convocado: boolean;
  convocado_em: string | null;
  updated_at: string;
  vehicles: { placa: string; modelo: string; status: string } | null;
}

/** Última comunicação de cada veículo com a central Ituran (pior primeiro). */
export function useRastreamento() {
  return useQuery<RastreioRow[]>({
    queryKey: ["rastreamento", "list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rastreamento_ituran")
        .select("*, vehicles(placa, modelo, status)")
        .order("ultima_comunicacao", { ascending: true, nullsFirst: true })
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as never;
    },
  });
}

const slug = (s: string) => s.replace(/[^\w.\-]+/g, "_");

/** Importa o relatório "Grade de veículos" (MyGridData) do Ituran. */
export function useImportarGrid() {
  const qc = useQueryClient();
  return useMutation<{ total: number; semVeiculo: string[] }, Error, { arquivos: { file: File; parsed: GridParsed }[] }>({
    mutationFn: async ({ arquivos }) => {
      const { data: veics, error: vErr } = await supabase.from("vehicles").select("id, placa");
      if (vErr) throw vErr;
      const placaMap = new Map((veics ?? []).map((v) => [(v as { placa: string }).placa.replace(/[^A-Za-z0-9]/g, "").toUpperCase(), (v as { id: string }).id]));

      // Auto-cadastra na frota os veículos do relatório que ainda não existem,
      // para que o status (ex.: vendido) possa ser associado.
      const placasArquivo = new Set<string>();
      for (const { parsed } of arquivos) for (const it of parsed.itens) placasArquivo.add(it.placa);
      const faltantes = [...placasArquivo].filter((p) => !placaMap.has(p));
      if (faltantes.length) {
        try {
          const { data: ins } = await supabase.from("vehicles")
            .insert(faltantes.map((p) => ({ placa: p, marca: "(a definir)", modelo: p, status: "disponivel" })) as never)
            .select("id, placa");
          for (const v of (ins ?? []) as { id: string; placa: string }[]) placaMap.set(v.placa.replace(/[^A-Za-z0-9]/g, "").toUpperCase(), v.id);
        } catch { /* segue sem bloquear */ }
      }

      const semVeic = new Set<string>();
      // Deduplica por placa (a última planilha vence). NÃO grava "convocado" no
      // upsert: assim o status de convocação é preservado entre importações.
      const now = new Date().toISOString();
      const rowMap = new Map<string, Record<string, unknown>>();
      for (const { parsed } of arquivos) {
        for (const it of parsed.itens) {
          const vid = placaMap.get(it.placa) ?? null;
          if (!vid) semVeic.add(it.placa);
          rowMap.set(it.placa, {
            vehicle_id: vid, placa: it.placa, grupo: it.grupo, ultima_comunicacao: it.ultima_comunicacao,
            endereco: it.endereco, estados: it.estados, km: it.km, referencia: parsed.referencia, updated_at: now,
          });
        }
      }
      const rows = [...rowMap.values()];
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await supabase.from("rastreamento_ituran").upsert(rows.slice(i, i + 500) as never, { onConflict: "placa" });
        if (error) throw error;
      }

      // Histórico: guarda cada planilha no Storage + registro.
      const { data: prof } = await supabase.auth.getUser();
      for (const { file, parsed } of arquivos) {
        try {
          const path = `ituran-grid/${Date.now()}-${slug(file.name)}`;
          const up = await supabase.storage.from("importacoes").upload(path, file, { contentType: file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", upsert: false });
          if (!up.error) {
            await supabase.from("import_history").insert({
              vehicle_id: null, placa: `${parsed.total} veículo(s)`, tipo: "ituran_grid",
              file_name: file.name, storage_path: path,
              resumo: { total: parsed.total, referencia: parsed.referencia, placas: parsed.total },
              created_by: prof.user?.id ?? null,
            } as never);
          }
        } catch { /* não bloqueia a apuração */ }
      }
      return { total: rows.length, semVeiculo: [...semVeic] };
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["rastreamento"] });
      qc.invalidateQueries({ queryKey: ["import_history"] });
      toast.success(`${r.total} veículo(s) atualizado(s)` + (r.semVeiculo.length ? ` · ${r.semVeiculo.length} fora da frota` : ""));
    },
    onError: (e: Error) => toast.error("Erro na importação: " + e.message),
  });
}

/** Marca/desmarca um veículo como convocado para ajuste do rastreador. */
export function useConvocar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, convocado }: { id: string; convocado: boolean }) => {
      const { error } = await supabase.from("rastreamento_ituran")
        .update({ convocado, convocado_em: convocado ? new Date().toISOString() : null } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => { qc.invalidateQueries({ queryKey: ["rastreamento"] }); toast.success(v.convocado ? "Veículo convocado para ajuste" : "Convocação removida"); },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });
}
