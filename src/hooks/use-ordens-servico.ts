import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { OCORRENCIA_DESPESA_CATEGORIA } from "@/lib/options";
import type { OrdemServico } from "@/types/database";

export type OrdemServicoRow = OrdemServico & {
  vehicles: { placa: string; modelo: string } | null;
  ocorrencias: { tipo: string; titulo: string | null } | null;
};

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

/** Lista de ordens de serviço (com join de veículo e ocorrência). */
export function useOrdensServico() {
  return useQuery<OrdemServicoRow[]>({
    queryKey: ["ordens_servico", "list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ordens_servico")
        .select("*, vehicles(placa, modelo), ocorrencias(tipo, titulo)")
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
}

/** Reflete no custo da ocorrência a soma das OS concluídas dela. */
async function refletirCustoOcorrencia(ocorrenciaId: string | null) {
  if (!ocorrenciaId) return;
  const { data } = await supabase.from("ordens_servico").select("valor_total, status").eq("ocorrencia_id", ocorrenciaId);
  const total = (data ?? []).filter((o: { status: string }) => o.status === "concluida").reduce((s: number, o: { valor_total: number }) => s + Number(o.valor_total ?? 0), 0);
  await supabase.from("ocorrencias").update({ custo: total || null } as never).eq("id", ocorrenciaId);
}

/** Lança/atualiza/remove a despesa vinculada a uma OS (idempotente por ordem_servico_id). */
async function sincronizarDespesa(os: OrdemServico) {
  const { data: existentes } = await supabase.from("finance_entries").select("id").eq("ordem_servico_id", os.id);
  const despId = (existentes ?? [])[0]?.id as string | undefined;
  const deveGerar = os.status === "concluida" && Number(os.valor_total) > 0;

  if (!deveGerar) {
    if (despId) await supabase.from("finance_entries").delete().eq("id", despId);
    return;
  }
  // Busca o tipo/veículo da ocorrência para categoria e vínculo.
  let tipoOc = "manutencao";
  if (os.ocorrencia_id) {
    const { data: oc } = await supabase.from("ocorrencias").select("tipo").eq("id", os.ocorrencia_id).single();
    if (oc?.tipo) tipoOc = oc.tipo as string;
  }
  const payload = {
    tipo: "despesa",
    data: os.data_conclusao ?? new Date().toISOString().slice(0, 10),
    vehicle_id: os.vehicle_id ?? null,
    categoria: OCORRENCIA_DESPESA_CATEGORIA[tipoOc] ?? "Manutenção",
    descricao: `OS ${os.numero}${os.tipo_servico ? ` — ${os.tipo_servico}` : ""}${os.placa ? ` (${os.placa})` : ""}`,
    valor: Number(os.valor_total),
    observacoes: os.oficina ? `Oficina: ${os.oficina}` : null,
    ocorrencia_id: os.ocorrencia_id ?? null,
    ordem_servico_id: os.id,
  };
  if (despId) await supabase.from("finance_entries").update(payload as never).eq("id", despId);
  else await supabase.from("finance_entries").insert(payload as never);
}

/** Cria ou atualiza uma OS, recalcula o total e sincroniza despesa + custo da ocorrência. */
export function useSalvarOrdemServico() {
  const qc = useQueryClient();
  return useMutation<OrdemServico, Error, { id?: string } & Partial<OrdemServico>>({
    mutationFn: async ({ id, ...campos }) => {
      const total = Number(campos.valor_mao_obra ?? 0) + Number(campos.valor_pecas ?? 0);
      const patch = { ...campos, valor_total: total };
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

/** Abre automaticamente uma OS (status aberta) para uma ocorrência. */
export function useAbrirOSAuto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (oc: { id: string; vehicle_id: string | null; placa: string | null; tipo: string; titulo: string | null }) => {
      const { data: prof } = await supabase.auth.getUser();
      const { error } = await supabase.from("ordens_servico").insert({
        ocorrencia_id: oc.id, vehicle_id: oc.vehicle_id, placa: oc.placa,
        tipo_servico: oc.titulo ?? null, status: "aberta", created_by: prof.user?.id ?? null,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ordens_servico"] }),
    onError: (e: Error) => toast.error("Erro ao abrir OS: " + e.message),
  });
}
