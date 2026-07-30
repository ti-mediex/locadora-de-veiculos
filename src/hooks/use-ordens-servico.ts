import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { OCORRENCIA_DESPESA_CATEGORIA, OCORRENCIA_TIPO_SERVICO } from "@/lib/options";
import type { OrdemServico, OsItem, OsItemTipo } from "@/types/database";

export type OrdemServicoRow = OrdemServico & {
  vehicles: { placa: string; modelo: string } | null;
  ocorrencias: { numero: string | null; tipo: string; titulo: string | null } | null;
};

/** Item de peça/serviço da OS (para gravar; custo_total é derivado). */
export interface OsItemInput { tipo_item: OsItemTipo; descricao: string | null; quantidade: number; custo_unitario: number }

const TIPOS_SERVICO = new Set<string>(OCORRENCIA_TIPO_SERVICO.map((t) => t.value));
const OS_STATUS_ABERTOS = new Set(["aberta", "em_andamento", "aguardando_peca", "aguardando_aprovacao"]);
const fmtBRL = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

/** Mapeia o status da OS para o status da ocorrência vinculada. */
function statusOcorrenciaDaOS(osStatus: string): string {
  if (osStatus === "concluida") return "resolvida";
  if (osStatus === "cancelada") return "cancelada";
  if (osStatus === "aberta") return "aberta";
  return "em_andamento";
}

/** Itens (peças/serviços) de uma OS, com signed nada — dados puros. */
export function useOsItens(osId?: string) {
  return useQuery<OsItem[]>({
    queryKey: ["os_itens", osId ?? ""],
    enabled: !!osId,
    queryFn: async () => {
      const { data, error } = await supabase.from("os_itens").select("*").eq("ordem_servico_id", osId!).order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as OsItem[];
    },
  });
}

const BUCKET = "ocorrencias";
const slug = (s: string) => s.replace(/[^\w.]+/g, "_");
export interface OsFoto { id: string; storage_path: string; observacao: string | null; url?: string | null }

/** Fotos/anexos de uma OS (nota fiscal, orçamento, fotos) com signed URLs. */
export function useOsFotos(osId?: string) {
  return useQuery<OsFoto[]>({
    queryKey: ["os_fotos", osId ?? ""],
    enabled: !!osId,
    queryFn: async () => {
      const { data, error } = await supabase.from("os_fotos").select("*").eq("ordem_servico_id", osId!).order("created_at", { ascending: true });
      if (error) throw error;
      const fotos = (data ?? []) as OsFoto[];
      return Promise.all(fotos.map(async (f) => {
        const { data: s } = await supabase.storage.from(BUCKET).createSignedUrl(f.storage_path, 3600);
        return { ...f, url: s?.signedUrl ?? null };
      }));
    },
  });
}

export function useSaveOsFotos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ osId, files }: { osId: string; files: File[] }) => {
      for (const file of files) {
        const path = `os/${osId}/${Date.now()}-${slug(file.name)}`;
        const up = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || "image/jpeg", upsert: true });
        if (up.error) throw up.error;
        const { error } = await supabase.from("os_fotos").insert({ ordem_servico_id: osId, storage_path: path } as never);
        if (error) throw error;
      }
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["os_fotos", v.osId] }),
    onError: (e: Error) => toast.error("Erro ao enviar anexo: " + e.message),
  });
}

export function useDeleteOsFoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (f: OsFoto) => {
      await supabase.storage.from(BUCKET).remove([f.storage_path]);
      const { error } = await supabase.from("os_fotos").delete().eq("id", f.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["os_fotos"] }),
    onError: (e: Error) => toast.error("Erro ao remover anexo: " + e.message),
  });
}

/** Sobe o relatório de ociosidade Ituran de uma OS e grava o caminho. */
export function useUploadIturanOS() {
  const qc = useQueryClient();
  return useMutation<string, Error, { osId: string; file: File }>({
    mutationFn: async ({ osId, file }) => {
      const path = `os/${osId}/ituran-${Date.now()}-${slug(file.name)}`;
      const up = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || "application/octet-stream", upsert: true });
      if (up.error) throw up.error;
      const { error } = await supabase.from("ordens_servico").update({ ituran_path: path } as never).eq("id", osId);
      if (error) throw error;
      return path;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ordens_servico"] }),
    onError: (e: Error) => toast.error("Erro ao enviar relatório Ituran: " + e.message),
  });
}

/** Abre o relatório Ituran (ou qualquer anexo da OS) via signed URL. */
export async function abrirArquivoOS(path: string) {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (data?.signedUrl) window.open(data.signedUrl, "_blank");
}

/** Lista de ordens de serviço (com join de veículo e ocorrência). */
export function useOrdensServico() {
  return useQuery<OrdemServicoRow[]>({
    queryKey: ["ordens_servico", "list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ordens_servico")
        .select("*, vehicles(placa, modelo), ocorrencias(numero, tipo, titulo)")
        .order("created_at", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as never;
    },
  });
}

function invalidarTudo(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["ordens_servico"] });
  qc.invalidateQueries({ queryKey: ["ocorrencias"] });
  qc.invalidateQueries({ queryKey: ["finance_entries"] });
  qc.invalidateQueries({ queryKey: ["finance"] });
  qc.invalidateQueries({ queryKey: ["vehicles"] });
  qc.invalidateQueries({ queryKey: ["os_itens"] });
}

/** Reflete no custo da ocorrência a soma das OS concluídas dela. */
async function refletirCustoOcorrencia(ocorrenciaId: string | null) {
  if (!ocorrenciaId) return;
  const { data } = await supabase.from("ordens_servico").select("valor_total, status").eq("ocorrencia_id", ocorrenciaId);
  const total = (data ?? []).filter((o: { status: string }) => o.status === "concluida").reduce((s: number, o: { valor_total: number }) => s + Number(o.valor_total ?? 0), 0);
  await supabase.from("ocorrencias").update({ custo: total || null } as never).eq("id", ocorrenciaId);
}

/** Cria/atualiza a Ocorrência vinculada à OS, autopreenchendo os campos
 *  compartilhados (veículo, tipo, início, fim, km). OS é o "driver" do processo.
 *  Retorna o ocorrencia_id (novo ou existente). */
async function sincronizarOcorrenciaDaOS(os: OrdemServico): Promise<string | null> {
  if (!os.tipo || !TIPOS_SERVICO.has(os.tipo)) return os.ocorrencia_id ?? null;
  const compartilhado = {
    vehicle_id: os.vehicle_id ?? null,
    placa: os.placa ?? null,
    tipo: os.tipo,
    inicio: os.inicio ?? new Date().toISOString(),
    fim: os.fim ?? null,
    km: os.km ?? null,
    status: statusOcorrenciaDaOS(os.status),
  };
  if (os.ocorrencia_id) {
    await supabase.from("ocorrencias").update(compartilhado as never).eq("id", os.ocorrencia_id);
    return os.ocorrencia_id;
  }
  const { data: prof } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("ocorrencias").insert({
    ...compartilhado,
    titulo: os.tipo_servico ?? null,
    descricao: os.descricao ?? null,
    gravidade: "media",
    created_by: prof.user?.id ?? null,
  } as never).select("id").single();
  if (error) throw error;
  const ocId = (data as { id: string }).id;
  await supabase.from("ordens_servico").update({ ocorrencia_id: ocId } as never).eq("id", os.id);
  os.ocorrencia_id = ocId;
  return ocId;
}

/** Automatiza o status do veículo conforme o andamento da OS: em aberto →
 *  "Em manutenção" (guardando o status anterior); concluída/cancelada → restaura. */
async function aplicarStatusVeiculo(os: OrdemServico) {
  if (!os.vehicle_id) return;
  const { data: v } = await supabase.from("vehicles").select("status").eq("id", os.vehicle_id).single();
  const statusAtual = (v as { status: string } | null)?.status;
  if (!statusAtual) return;
  const aberta = OS_STATUS_ABERTOS.has(os.status);

  if (aberta && statusAtual !== "manutencao") {
    if (!os.status_veiculo_anterior) {
      await supabase.from("ordens_servico").update({ status_veiculo_anterior: statusAtual } as never).eq("id", os.id);
      os.status_veiculo_anterior = statusAtual;
    }
    await supabase.from("vehicles").update({ status: "manutencao" } as never).eq("id", os.vehicle_id);
  } else if (!aberta && os.status_veiculo_anterior && statusAtual === "manutencao") {
    await supabase.from("vehicles").update({ status: os.status_veiculo_anterior } as never).eq("id", os.vehicle_id);
    await supabase.from("ordens_servico").update({ status_veiculo_anterior: null } as never).eq("id", os.id);
    os.status_veiculo_anterior = null;
  }
}

/** Lança/atualiza/remove a despesa vinculada a uma OS (idempotente por ordem_servico_id),
 *  amarrando nº da OS + nº da Ocorrência e o detalhamento dos itens. */
async function sincronizarDespesa(os: OrdemServico) {
  const { data: existentes } = await supabase.from("finance_entries").select("id").eq("ordem_servico_id", os.id);
  const despId = (existentes ?? [])[0]?.id as string | undefined;
  const deveGerar = os.status === "concluida" && Number(os.valor_total) > 0;

  if (!deveGerar) {
    if (despId) await supabase.from("finance_entries").delete().eq("id", despId);
    return;
  }
  let ocNumero: string | null = null;
  if (os.ocorrencia_id) {
    const { data: oc } = await supabase.from("ocorrencias").select("numero").eq("id", os.ocorrencia_id).single();
    ocNumero = (oc as { numero: string | null } | null)?.numero ?? null;
  }
  const { data: itens } = await supabase.from("os_itens").select("tipo_item, descricao, quantidade, custo_unitario, custo_total").eq("ordem_servico_id", os.id);
  const resumoItens = (itens ?? []).map((i: { tipo_item: string; descricao: string | null; quantidade: number; custo_total: number }) =>
    `• ${i.tipo_item === "peca" ? "Peça" : "Serviço"}: ${i.descricao ?? "—"} (${i.quantidade}× = ${fmtBRL(Number(i.custo_total))})`).join("\n");
  const obs = [
    ocNumero ? `Ocorrência ${ocNumero}` : null,
    os.oficina ? `Oficina: ${os.oficina}` : null,
    resumoItens || null,
  ].filter(Boolean).join("\n");
  const payload = {
    tipo: "despesa",
    data: os.data_conclusao ?? (os.fim ? os.fim.slice(0, 10) : new Date().toISOString().slice(0, 10)),
    vehicle_id: os.vehicle_id ?? null,
    categoria: OCORRENCIA_DESPESA_CATEGORIA[os.tipo ?? ""] ?? "Manutenção",
    descricao: `OS ${os.numero}${ocNumero ? ` · ${ocNumero}` : ""}${os.tipo_servico ? ` — ${os.tipo_servico}` : ""}${os.placa ? ` (${os.placa})` : ""}`,
    valor: Number(os.valor_total),
    observacoes: obs || null,
    ocorrencia_id: os.ocorrencia_id ?? null,
    ordem_servico_id: os.id,
  };
  if (despId) await supabase.from("finance_entries").update(payload as never).eq("id", despId);
  else await supabase.from("finance_entries").insert(payload as never);
}

/** Substitui os itens (peças/serviços) da OS pelos informados. */
async function salvarItensOS(osId: string, itens: OsItemInput[]) {
  await supabase.from("os_itens").delete().eq("ordem_servico_id", osId);
  const linhas = itens
    .filter((i) => (i.descricao ?? "").trim() || Number(i.custo_unitario) > 0)
    .map((i) => ({
      ordem_servico_id: osId,
      tipo_item: i.tipo_item,
      descricao: i.descricao ?? null,
      quantidade: Number(i.quantidade) || 1,
      custo_unitario: Number(i.custo_unitario) || 0,
      custo_total: (Number(i.quantidade) || 1) * (Number(i.custo_unitario) || 0),
    }));
  if (linhas.length) { const { error } = await supabase.from("os_itens").insert(linhas as never); if (error) throw error; }
}

/** Cria ou atualiza uma OS: deriva totais dos itens, autopreenche a Ocorrência,
 *  automatiza o status do veículo e sincroniza despesa + custo da ocorrência. */
export function useSalvarOrdemServico() {
  const qc = useQueryClient();
  return useMutation<OrdemServico, Error, { id?: string; itens?: OsItemInput[] } & Partial<OrdemServico>>({
    mutationFn: async ({ id, itens, ...campos }) => {
      const patch: Partial<OrdemServico> = { ...campos };
      if (itens) {
        patch.valor_pecas = itens.filter((i) => i.tipo_item === "peca").reduce((s, i) => s + (Number(i.quantidade) || 1) * (Number(i.custo_unitario) || 0), 0);
        patch.valor_mao_obra = itens.filter((i) => i.tipo_item === "servico").reduce((s, i) => s + (Number(i.quantidade) || 1) * (Number(i.custo_unitario) || 0), 0);
      }
      patch.valor_total = Number(patch.valor_mao_obra ?? 0) + Number(patch.valor_pecas ?? 0);
      let saved: OrdemServico;
      if (id) {
        const { data, error } = await supabase.from("ordens_servico").update(patch as never).eq("id", id).select("*").single();
        if (error) throw error;
        saved = data as OrdemServico;
      } else {
        const { data: prof } = await supabase.auth.getUser();
        const { data, error } = await supabase.from("ordens_servico").insert({ ...patch, created_by: prof.user?.id ?? null } as never).select("*").single();
        if (error) throw error;
        saved = data as OrdemServico;
      }
      if (itens) await salvarItensOS(saved.id, itens);
      await sincronizarOcorrenciaDaOS(saved);
      await aplicarStatusVeiculo(saved);
      await sincronizarDespesa(saved);
      await refletirCustoOcorrencia(saved.ocorrencia_id);
      return saved;
    },
    onSuccess: () => { invalidarTudo(qc); toast.success("Ordem de serviço salva"); },
    onError: (e) => toast.error("Erro ao salvar OS: " + e.message),
  });
}

export function useDeleteOrdemServico() {
  const qc = useQueryClient();
  return useMutation<void, Error, OrdemServicoRow>({
    mutationFn: async (os) => {
      await supabase.from("finance_entries").delete().eq("ordem_servico_id", os.id);
      const { error } = await supabase.from("ordens_servico").delete().eq("id", os.id);
      if (error) throw error;
      await refletirCustoOcorrencia(os.ocorrencia_id);
    },
    onSuccess: () => { invalidarTudo(qc); toast.success("OS removida"); },
    onError: (e) => toast.error("Erro ao remover OS: " + e.message),
  });
}

/** Abre automaticamente uma OS (status aberta) para uma ocorrência, copiando os
 *  campos compartilhados (tipo, início, fim, km) — fluxo reverso (ocorrência → OS). */
export function useAbrirOSAuto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (oc: { id: string; vehicle_id: string | null; placa: string | null; tipo: string; titulo: string | null; inicio?: string | null; fim?: string | null; km?: number | null }) => {
      const { data: prof } = await supabase.auth.getUser();
      const { error } = await supabase.from("ordens_servico").insert({
        ocorrencia_id: oc.id, vehicle_id: oc.vehicle_id, placa: oc.placa, tipo: oc.tipo,
        inicio: oc.inicio ?? null, fim: oc.fim ?? null, km: oc.km ?? null,
        tipo_servico: oc.titulo ?? null, status: "aberta", created_by: prof.user?.id ?? null,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ordens_servico"] }); qc.invalidateQueries({ queryKey: ["vehicles"] }); },
    onError: (e: Error) => toast.error("Erro ao abrir OS: " + e.message),
  });
}
