import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import type { IturanParsed } from "@/lib/ituran-parse";

export interface KmDiaRow {
  vehicle_id: string | null;
  placa: string;
  dia: string;
  odom_inicio: number | null;
  odom_fim: number | null;
  registros: number;
  min_ocioso_manut: number;
  km: number;
}

/** Leituras de KM por dia (view calculada), com filtros de período e veículo. */
export function useKmDiario(inicio?: string, fim?: string, vehicleId?: string) {
  return useQuery<KmDiaRow[]>({
    queryKey: ["km_diario", inicio ?? "", fim ?? "", vehicleId ?? ""],
    queryFn: async () => {
      let q = supabase.from("km_diario_calc").select("*").order("dia", { ascending: true }).limit(50000);
      if (inicio) q = q.gte("dia", inicio);
      if (fim) q = q.lte("dia", fim);
      if (vehicleId) q = q.eq("vehicle_id", vehicleId);
      const { data, error } = await q;
      if (error) throw error;
      return ((data ?? []) as KmDiaRow[]).map((r) => ({ ...r, km: Number(r.km), odom_inicio: r.odom_inicio == null ? null : Number(r.odom_inicio), odom_fim: r.odom_fim == null ? null : Number(r.odom_fim) }));
    },
  });
}

export interface KmMesVeiculo { mesAtual: number; mesAnterior: number }

/** KM rodado por veículo no mês corrente (até hoje) e no mês anterior. */
export function useKmMesPorVeiculo() {
  return useQuery<Record<string, KmMesVeiculo>>({
    queryKey: ["km_diario", "mes-por-veiculo"],
    queryFn: async () => {
      const hoje = new Date();
      const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const iniAtual = fmt(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
      const iniAnt = fmt(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1));
      const fimAnt = fmt(new Date(hoje.getFullYear(), hoje.getMonth(), 0)); // último dia do mês anterior
      const hojeStr = fmt(hoje);

      const { data, error } = await supabase.from("km_diario_calc")
        .select("vehicle_id, dia, km").gte("dia", iniAnt).lte("dia", hojeStr).limit(50000);
      if (error) throw error;

      const map: Record<string, KmMesVeiculo> = {};
      for (const r of (data ?? []) as { vehicle_id: string | null; dia: string; km: number }[]) {
        if (!r.vehicle_id) continue;
        const km = Number(r.km) || 0;
        const cur = map[r.vehicle_id] ?? { mesAtual: 0, mesAnterior: 0 };
        if (r.dia >= iniAtual && r.dia <= hojeStr) cur.mesAtual += km;
        else if (r.dia >= iniAnt && r.dia <= fimAnt) cur.mesAnterior += km;
        map[r.vehicle_id] = cur;
      }
      return map;
    },
  });
}

const slug = (s: string) => s.replace(/[^\w.\-]+/g, "_");

/** Importa uma ou várias planilhas do Ituran (lote): grava as leituras diárias
 *  por veículo e guarda cada arquivo no histórico de importações. */
export function useImportarIturan() {
  const qc = useQueryClient();
  return useMutation<{ dias: number; arquivos: number; semVeiculo: string[] }, Error, { arquivos: { file: File; parsed: IturanParsed }[] }>({
    mutationFn: async ({ arquivos }) => {
      const { data: veics, error: vErr } = await supabase.from("vehicles").select("id, placa, apelido_ituran, km_atual");
      if (vErr) throw vErr;
      const normp = (s: string) => (s ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
      // Casa o identificador da planilha (placa OU apelido/Nome do Ituran) com o veículo.
      const placaMap = new Map<string, string>();
      const kmAtualMap = new Map<string, number>();
      const vidPlaca = new Map<string, string>();
      for (const v of (veics ?? []) as { id: string; placa: string; apelido_ituran: string | null; km_atual: number | null }[]) {
        placaMap.set(normp(v.placa), v.id);
        if (v.apelido_ituran) placaMap.set(normp(v.apelido_ituran), v.id);
        kmAtualMap.set(v.id, Number(v.km_atual ?? 0));
        vidPlaca.set(v.id, v.placa);
      }

      const semVeic = new Set<string>();
      // Deduplica por (veículo, dia): a mesma placa/dia pode vir em mais de uma
      // planilha (períodos sobrepostos). Sem isso, o upsert falha quando o mesmo
      // lote traz a chave repetida ("ON CONFLICT DO UPDATE command cannot affect
      // row a second time"). Consolidamos o dia (menor odômetro de início, maior
      // de fim, contagem/manutenção mais completas).
      const now = new Date().toISOString();
      interface Row { vehicle_id: string; placa: string; dia: string; odom_inicio: number; odom_fim: number; registros: number; min_ocioso_manut: number; updated_at: string; }
      const rowMap = new Map<string, Row>();
      for (const { parsed } of arquivos) {
        for (const it of parsed.itens) {
          const vid = placaMap.get(it.placa);
          if (!vid) { semVeic.add(it.placa); continue; }
          const key = `${vid}|${it.dia}`;
          const prev = rowMap.get(key);
          if (prev) {
            prev.odom_inicio = Math.min(prev.odom_inicio, it.odom_inicio);
            prev.odom_fim = Math.max(prev.odom_fim, it.odom_fim);
            prev.registros = Math.max(prev.registros, it.registros);
            prev.min_ocioso_manut = Math.max(prev.min_ocioso_manut, it.min_ocioso_manut);
          } else {
            rowMap.set(key, { vehicle_id: vid, placa: vidPlaca.get(vid) ?? it.placa, dia: it.dia, odom_inicio: it.odom_inicio, odom_fim: it.odom_fim, registros: it.registros, min_ocioso_manut: it.min_ocioso_manut, updated_at: now });
          }
        }
      }
      const rows = [...rowMap.values()];
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await supabase.from("km_diario").upsert(rows.slice(i, i + 500) as never, { onConflict: "vehicle_id,dia" });
        if (error) throw error;
      }

      // Atualiza o KM atual do veículo com o maior odômetro lido (nunca reduz).
      const maxOdom = new Map<string, number>();
      for (const r of rows as { vehicle_id: string; odom_fim: number }[]) {
        if (r.odom_fim > (maxOdom.get(r.vehicle_id) ?? 0)) maxOdom.set(r.vehicle_id, r.odom_fim);
      }
      for (const [vid, odom] of maxOdom) {
        const novo = Math.round(odom);
        if (novo > (kmAtualMap.get(vid) ?? 0)) {
          await supabase.from("vehicles").update({ km_atual: novo } as never).eq("id", vid);
        }
      }

      // Histórico: guarda cada planilha no Storage + registro.
      const { data: prof } = await supabase.auth.getUser();
      for (const { file, parsed } of arquivos) {
        try {
          const placa0 = parsed.placas[0] ?? "ituran";
          const path = `ituran/${placa0}-${Date.now()}-${slug(file.name)}`;
          const up = await supabase.storage.from("importacoes").upload(path, file, { contentType: file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", upsert: false });
          if (!up.error) {
            await supabase.from("import_history").insert({
              vehicle_id: placaMap.get(placa0) ?? null, placa: parsed.placas.join(", "), tipo: "ituran",
              file_name: file.name, storage_path: path,
              resumo: { placas: parsed.placas, periodo_ini: parsed.periodoIni, periodo_fim: parsed.periodoFim, dias: parsed.itens.length, registros: parsed.totalRegistros },
              created_by: prof.user?.id ?? null,
            } as never);
          }
        } catch { /* não bloqueia a apuração */ }
      }
      return { dias: rows.length, arquivos: arquivos.length, semVeiculo: [...semVeic] };
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["km_diario"] });
      qc.invalidateQueries({ queryKey: ["import_history"] });
      toast.success(`${r.arquivos} planilha(s) importada(s) · ${r.dias} dia(s) de leitura` + (r.semVeiculo.length ? ` · ${r.semVeiculo.length} placa(s) sem veículo` : ""));
    },
    onError: (e: Error) => toast.error("Erro na importação: " + e.message),
  });
}
