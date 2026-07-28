import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { PENDENCIA_ITENS_PADRAO } from "@/lib/options";
import { salvarImportacao } from "@/hooks/use-import-history";
import { extrairPlaca, placaVariantes } from "@/lib/format";
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

/** Restrição de natureza judicial (bloqueio/penhora/busca e apreensão/RENAJUD). */
export const restricaoEhJudicial = (titulo: string) =>
  /judicial|renajud|busca e apreens|penhor|bloqueio/i.test(titulo ?? "");

export interface RestricaoVeiculo { total: number; judicial: number }

/** Restrições (categoria "Restrição") em aberto, agrupadas por veículo. */
export function useRestricoesPorVeiculo() {
  return useQuery<Record<string, RestricaoVeiculo>>({
    queryKey: ["vehicle_pendencias", "restricoes-por-veiculo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_pendencias")
        .select("vehicle_id, titulo")
        .eq("categoria", "Restrição")
        .in("status", ["aberta", "em_andamento"])
        .limit(5000);
      if (error) throw error;
      const map: Record<string, RestricaoVeiculo> = {};
      for (const r of (data ?? []) as { vehicle_id: string; titulo: string }[]) {
        const cur = map[r.vehicle_id] ?? { total: 0, judicial: 0 };
        cur.total += 1;
        if (restricaoEhJudicial(r.titulo)) cur.judicial += 1;
        map[r.vehicle_id] = cur;
      }
      return map;
    },
  });
}

export interface PendenciaFinanceiraVeiculo {
  vehicle_id: string;
  placa: string;
  modelo: string;
  total: number;
  vencido: number;
  qtd: number;
}
export interface PendenciasFinanceirasResumo {
  total: number;
  vencido: number;
  por_categoria: Record<string, number>;
}

/** Pendências financeiras (com valor) em aberto, agrupadas por veículo. */
export function usePendenciasFinanceirasPorVeiculo() {
  return useQuery<PendenciaFinanceiraVeiculo[]>({
    queryKey: ["vehicle_pendencias", "financeiras-por-veiculo"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pendencias_financeiras_por_veiculo");
      if (error) throw error;
      return ((data ?? []) as PendenciaFinanceiraVeiculo[]).map((r) => ({
        ...r, total: Number(r.total), vencido: Number(r.vencido), qtd: Number(r.qtd),
      }));
    },
  });
}

export interface MultaPorVeiculo {
  vehicle_id: string;
  placa: string;
  modelo: string;
  qtd: number;
  valor: number;
}

/** Ranking de multas por veículo (valor e quantidade). */
export function useMultasPorVeiculo() {
  return useQuery<MultaPorVeiculo[]>({
    queryKey: ["vehicle_pendencias", "multas-por-veiculo"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("multas_por_veiculo");
      if (error) throw error;
      return ((data ?? []) as MultaPorVeiculo[]).map((r) => ({ ...r, qtd: Number(r.qtd), valor: Number(r.valor) }));
    },
  });
}

/** Resumo financeiro geral das pendências em aberto (total, vencido, por categoria). */
export function usePendenciasFinanceirasResumo() {
  return useQuery<PendenciasFinanceirasResumo>({
    queryKey: ["vehicle_pendencias", "financeiras-resumo"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pendencias_financeiras_resumo");
      if (error) throw error;
      return data as PendenciasFinanceirasResumo;
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
/** Núcleo: aplica restrições/débitos/multas do Detran a um veículo (sem toast). */
export async function aplicarDetran(vehicleId: string, parsed: DetranParsed, opcoes: ImportDetranOpcoes): Promise<ImportDetranResultado> {
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

      // Sincroniza as flags jurídicas do veículo a partir das restrições
      // importadas, para que Dashboard/Relatórios (que leem as flags) e
      // Pendências/Rastreamento (que leem o texto) fiquem coerentes.
      if (opcoes.restricoes && parsed.restricoes.length) {
        const txt = parsed.restricoes.join(" | ").toLowerCase();
        const upd: Record<string, boolean> = {};
        if (/busca e apreens/.test(txt)) upd.busca_apreensao = true;
        if (/renajud|bloqueio judicial|penhor|restri[çc][aã]o judicial/.test(txt)) upd.bloqueio_judicial = true;
        if (Object.keys(upd).length) {
          const { error: flagErr } = await supabase.from("vehicles").update(upd as never).eq("id", vehicleId);
          if (flagErr) console.warn("Falha ao sincronizar flags jurídicas do veículo:", flagErr.message);
        }
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

      // Multas — cada multa vira uma pendência separada, ignorando autos já cadastrados
      if (opcoes.multas && parsed.multas.length) {
        const docs = new Set<string>();
        // autos já cadastrados como pendência separada (vehicle_pendencias.documento)
        const { data: pendDocs } = await supabase
          .from("vehicle_pendencias")
          .select("documento")
          .eq("vehicle_id", vehicleId)
          .eq("categoria", "Multa")
          .not("documento", "is", null);
        for (const d of (pendDocs ?? []) as { documento: string | null }[]) if (d.documento) docs.add(d.documento);
        // autos em pendências de multa agrupadas (pendencia_multas.documento)
        const { data: itemDocs } = await supabase
          .from("pendencia_multas")
          .select("documento, vehicle_pendencias!inner(vehicle_id)")
          .eq("vehicle_pendencias.vehicle_id", vehicleId);
        for (const d of (itemDocs ?? []) as { documento: string | null }[]) if (d.documento) docs.add(d.documento);

        const novas = parsed.multas.filter((m) => !docs.has(m.documento));
        res.ignorados += parsed.multas.length - novas.length;
        if (novas.length) {
          const rows = novas.map((m) => ({
            vehicle_id: vehicleId,
            categoria: "Multa",
            titulo: m.infracao || `Multa ${m.documento}`,
            status: "aberta",
            prioridade: "alta",
            vencimento: m.vencimento || null,
            valor: m.valor || null,
            documento: m.documento,
            data_ocorrencia: m.data_ocorrencia || null,
            local: m.local || null,
          }));
          const { error: mErr } = await supabase.from("vehicle_pendencias").insert(rows as never);
          if (mErr) throw mErr;
          res.multas = novas.length;

          // Vincula cada multa ao contrato/locatário vigente na DATA DA INFRAÇÃO e
          // cadastra como débito do locatário (idempotente pelo nº do auto).
          const comData = novas.filter((m) => m.data_ocorrencia);
          if (comData.length) {
            const { data: cts } = await supabase
              .from("contratos")
              .select("id, locatario_id, placa, data_entrega, data_encerramento, devolucao_prevista, status")
              .eq("vehicle_id", vehicleId);
            const ctrs = (cts ?? []) as { id: string; locatario_id: string | null; placa: string | null; data_entrega: string | null; data_encerramento: string | null; devolucao_prevista: string | null; status: string }[];
            const hoje = new Date().toISOString().slice(0, 10);
            const vigenteEm = (data: string) => ctrs
              .filter((c) => c.locatario_id && c.data_entrega && c.data_entrega <= data && (c.data_encerramento ?? (c.status === "ativo" ? hoje : c.devolucao_prevista) ?? hoje) >= data)
              .sort((a, b) => (b.data_entrega ?? "").localeCompare(a.data_entrega ?? ""))[0];
            const { data: jaDeb } = await supabase.from("locatario_debitos").select("documento").eq("vehicle_id", vehicleId).not("documento", "is", null);
            const debDocs = new Set(((jaDeb ?? []) as { documento: string | null }[]).map((d) => d.documento));
            const debRows: Record<string, unknown>[] = [];
            for (const m of comData) {
              if (debDocs.has(m.documento)) continue;
              const ct = vigenteEm(m.data_ocorrencia);
              if (!ct || !ct.locatario_id) continue;
              debRows.push({
                locatario_id: ct.locatario_id, contrato_id: ct.id, vehicle_id: vehicleId, placa: ct.placa,
                categoria: "multa", descricao: `Multa ${m.documento} — ${m.infracao || "infração"}`,
                valor: m.valor || 0, competencia: m.data_ocorrencia, pago: false, documento: m.documento,
              });
            }
            if (debRows.length) {
              const { error: dErr } = await supabase.from("locatario_debitos").insert(debRows as never);
              if (dErr) console.warn("Falha ao cadastrar débito de multa do locatário:", dErr.message);
            }
          }
        }
      }

      return res;
}

// ===== Baixa automática por consulta Detran (débito pago = desaparecido) =====

/** Categoria da despesa correspondente à categoria da pendência. */
export function despesaCategoriaDe(catPendencia: string): string {
  const c = (catPendencia ?? "").toLowerCase();
  if (c.includes("multa")) return "Multas";
  if (c.includes("seguro") || c.includes("csv")) return "Seguro";
  if (c.includes("ipva") || c.includes("licenc") || c.includes("taxa")) return "IPVA/Licenciamento";
  return "Administrativo";
}

const soNum = (s?: string | null) => (s ?? "").replace(/\D+/g, "");
const normTit = (s?: string | null) => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

export interface BaixaDetranItem {
  pendencia: PendenciaRow;
  categoriaDespesa: string;
  valor: number;
  descricao: string;
}

/** Detecta débitos PAGOS = pendências financeiras abertas do veículo que NÃO
 *  aparecem mais na consulta atual do Detran. Casa IPVA/Licenciamento/Taxas/Seguro
 *  pelo título (ex.: "IPVA 2026 — cota 4") e multas pelo nº do auto. */
export function reconciliarDetran(parsed: DetranParsed, pendenciasDoVeiculo: PendenciaRow[]): BaixaDetranItem[] {
  const debitosAtuais = new Set(parsed.debitos.map((d) => normTit(d.titulo)));
  const multasAtuais = new Set(parsed.multas.map((m) => soNum(m.documento)));
  const CATS_FIN = ["IPVA", "Licenciamento", "Taxas Detran", "Seguro/CSV"];
  const out: BaixaDetranItem[] = [];
  for (const p of pendenciasDoVeiculo) {
    if (p.status !== "aberta" && p.status !== "em_andamento") continue;
    const placa = p.vehicles?.placa ?? "";
    if (p.categoria === "Multa") {
      if (p.documento && !multasAtuais.has(soNum(p.documento)) && (p.valor ?? 0) > 0) {
        out.push({ pendencia: p, categoriaDespesa: "Multas", valor: p.valor ?? 0, descricao: `Pagamento multa ${p.documento} (${placa})`.trim() });
      }
    } else if (CATS_FIN.includes(p.categoria)) {
      if (!debitosAtuais.has(normTit(p.titulo)) && (p.valor ?? 0) > 0) {
        out.push({ pendencia: p, categoriaDespesa: despesaCategoriaDe(p.categoria), valor: p.valor ?? 0, descricao: `Pagamento ${p.titulo} (${placa})`.trim() });
      }
    }
  }
  return out;
}

/** Aplica a baixa: resolve as pendências pagas e lança a despesa correspondente
 *  (idempotente por pendencia_id — não duplica ao reprocessar). */
export function useAplicarBaixaDetran() {
  const qc = useQueryClient();
  return useMutation<{ baixados: number; despesas: number }, Error, BaixaDetranItem[]>({
    mutationFn: async (itens) => {
      const hoje = new Date().toISOString().slice(0, 10);
      const { data: prof } = await supabase.auth.getUser();
      let baixados = 0, despesas = 0;
      for (const it of itens) {
        const p = it.pendencia;
        await supabase.from("vehicle_pendencias").update({ status: "resolvida", resolvido_em: hoje, pago: true } as never).eq("id", p.id);
        baixados++;
        const { data: ja } = await supabase.from("finance_entries").select("id").eq("pendencia_id", p.id).limit(1);
        if (!ja?.length) {
          const { error } = await supabase.from("finance_entries").insert({
            tipo: "despesa", data: hoje, vehicle_id: p.vehicle_id, categoria: it.categoriaDespesa,
            descricao: it.descricao, valor: it.valor, pendencia_id: p.id, created_by: prof.user?.id ?? null,
          } as never);
          if (error) throw error;
          despesas++;
        }
      }
      return { baixados, despesas };
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["vehicle_pendencias"] });
      qc.invalidateQueries({ queryKey: ["finance_entries"] });
      qc.invalidateQueries({ queryKey: ["finance"] });
      toast.success(`${r.baixados} baixa(s) · ${r.despesas} despesa(s) lançada(s)`);
    },
    onError: (e: Error) => toast.error("Erro ao aplicar baixa: " + e.message),
  });
}

export interface AnexoLoteResultado { anexados: number; semVeiculo: string[] }

/** Anexa boletos/comprovantes em lote, casando pela placa no nome do arquivo, às
 *  despesas de IPVA/Multas e às pendências resolvidas do veículo (bucket importacoes). */
export function useAnexarLoteDetran() {
  const qc = useQueryClient();
  const slug = (s: string) => s.replace(/[^\w.\-]+/g, "_");
  return useMutation<AnexoLoteResultado, Error, { arquivos: File[]; campo: "boleto_path" | "comprovante_path" }>({
    mutationFn: async ({ arquivos, campo }) => {
      const { data: veics } = await supabase.from("vehicles").select("id, placa");
      const placaMap = new Map<string, string>();
      for (const v of (veics ?? []) as { id: string; placa: string }[]) for (const k of placaVariantes(v.placa)) placaMap.set(k, v.id);
      const res: AnexoLoteResultado = { anexados: 0, semVeiculo: [] };
      for (const file of arquivos) {
        const placa = extrairPlaca(file.name.toUpperCase().replace(/[^A-Z0-9]/g, ""));
        const vid = placa ? [...placaVariantes(placa)].map((k) => placaMap.get(k)).find(Boolean) : undefined;
        if (!vid) { res.semVeiculo.push(file.name); continue; }
        const path = `detran/${vid}/${Date.now()}-${slug(file.name)}`;
        const up = await supabase.storage.from("importacoes").upload(path, file, { contentType: file.type || "application/pdf", upsert: true });
        if (up.error) continue;
        // Anexa às despesas do veículo vinculadas a pendências (IPVA/Multas) sem arquivo ainda.
        await supabase.from("finance_entries").update({ [campo]: path } as never)
          .eq("vehicle_id", vid).eq("tipo", "despesa").not("pendencia_id", "is", null).is(campo, null);
        // Anexa às pendências resolvidas do veículo sem arquivo ainda.
        await supabase.from("vehicle_pendencias").update({ [campo]: path } as never)
          .eq("vehicle_id", vid).eq("status", "resolvida").is(campo, null);
        res.anexados++;
      }
      return res;
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["vehicle_pendencias"] });
      qc.invalidateQueries({ queryKey: ["finance_entries"] });
      qc.invalidateQueries({ queryKey: ["finance"] });
      toast.success(`${r.anexados} arquivo(s) anexado(s)` + (r.semVeiculo.length ? ` · ${r.semVeiculo.length} sem veículo` : ""));
    },
    onError: (e: Error) => toast.error("Erro ao anexar: " + e.message),
  });
}

type PendAnexoCampo = "comprovante_path" | "boleto_path" | "consulta_path";

/** Envia um anexo (comprovante/boleto/consulta) de uma pendência e grava o caminho. */
export function useUploadArquivoPendencia() {
  const qc = useQueryClient();
  const slug = (s: string) => s.replace(/[^\w.\-]+/g, "_");
  return useMutation<string, Error, { pendenciaId: string; file: File; campo: PendAnexoCampo }>({
    mutationFn: async ({ pendenciaId, file, campo }) => {
      const pasta = campo === "comprovante_path" ? "comprovantes" : campo === "boleto_path" ? "boletos" : "consultas";
      const path = `pendencias/${pasta}/${pendenciaId}/${Date.now()}-${slug(file.name)}`;
      const up = await supabase.storage.from("importacoes").upload(path, file, { contentType: file.type || "application/octet-stream", upsert: true });
      if (up.error) throw up.error;
      const { error } = await supabase.from("vehicle_pendencias").update({ [campo]: path } as never).eq("id", pendenciaId);
      if (error) throw error;
      return path;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vehicle_pendencias"] }); toast.success("Anexo enviado"); },
    onError: (e: Error) => toast.error("Erro ao enviar anexo: " + e.message),
  });
}

export function useImportDetran() {
  const qc = useQueryClient();
  return useMutation<ImportDetranResultado, Error, { vehicleId: string; parsed: DetranParsed; opcoes: ImportDetranOpcoes }>({
    mutationFn: ({ vehicleId, parsed, opcoes }) => aplicarDetran(vehicleId, parsed, opcoes),
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

export interface DetranItem { parsed: DetranParsed; vehicleId: string; placa: string | null; file: File; }

/** Importa vários "Detalhamento de débitos" do Detran em lote (um por PDF/placa). */
export function useImportDetranLote() {
  const qc = useQueryClient();
  return useMutation<{ veiculos: number; restricoes: number; debitos: number; multas: number; ignorados: number; erros: string[] }, Error, { itens: DetranItem[]; opcoes: ImportDetranOpcoes }>({
    mutationFn: async ({ itens, opcoes }) => {
      const acc = { veiculos: 0, restricoes: 0, debitos: 0, multas: 0, ignorados: 0, erros: [] as string[] };
      for (const it of itens) {
        try {
          const r = await aplicarDetran(it.vehicleId, it.parsed, opcoes);
          acc.veiculos++; acc.restricoes += r.restricoes; acc.debitos += r.debitos; acc.multas += r.multas; acc.ignorados += r.ignorados;
          try { await salvarImportacao({ vehicleId: it.vehicleId, placa: it.placa, tipo: "detran", file: it.file, resumo: { ...r, placa: it.placa } }); } catch { /* não bloqueia */ }
        } catch (e) { acc.erros.push(`${it.placa ?? it.file.name}: ${(e as Error).message}`); }
      }
      return acc;
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["vehicle_pendencias"] });
      qc.invalidateQueries({ queryKey: ["vehicles"] });
      qc.invalidateQueries({ queryKey: ["import_history"] });
      toast.success(`${r.veiculos} veículo(s) · ${r.restricoes + r.debitos + r.multas} pendência(s)` + (r.ignorados ? ` · ${r.ignorados} já existia(m)` : "") + (r.erros.length ? ` · ${r.erros.length} erro(s)` : ""));
    },
    onError: (e: Error) => toast.error("Erro na importação em lote: " + e.message),
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
