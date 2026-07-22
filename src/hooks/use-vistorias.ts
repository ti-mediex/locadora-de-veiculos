import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import type { Vistoria, VistoriaFoto, ChecklistItem } from "@/types/database";

export type VistoriaRow = Vistoria & { vehicles: { placa: string; modelo: string } | null; fotos: { count: number }[] };

const BUCKET = "vistorias";
const slug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export function useVistorias() {
  return useQuery<VistoriaRow[]>({
    queryKey: ["vistorias", "list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vistorias")
        .select("*, vehicles(placa, modelo), fotos:vistoria_fotos(count)")
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as never;
    },
  });
}

export interface VistoriaDetalhe extends Vistoria {
  vehicles: { placa: string; modelo: string } | null;
  fotos: (VistoriaFoto & { url: string | null })[];
  assinatura_url: string | null;
  laudo_externo_url: string | null;
}

/** Cria uma vistoria a partir de um laudo em PDF de outro sistema (ex.: Vex). */
export function useCreateVistoriaExterna() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { vehicle_id: string | null; placa: string | null; tipo: string; data: string; locatario_nome: string; file: File }) => {
      const { data: prof } = await supabase.auth.getUser();
      const insert: Record<string, unknown> = {
        vehicle_id: v.vehicle_id, placa: v.placa, tipo: v.tipo,
        locatario_nome: v.locatario_nome || null, status: "concluida", created_by: prof.user?.id ?? null,
        laudo_arquivo_nome: v.file.name,
      };
      if (v.data) insert.created_at = `${v.data}T12:00:00`;
      const { data: ins, error } = await supabase.from("vistorias").insert(insert as never).select("id").single();
      if (error) throw error;
      const id = (ins as { id: string }).id;
      const path = `${id}/laudo-externo.pdf`;
      const up = await supabase.storage.from(BUCKET_V).upload(path, v.file, { contentType: "application/pdf", upsert: true });
      if (up.error) throw up.error;
      const { error: uErr } = await supabase.from("vistorias").update({ laudo_externo_path: path } as never).eq("id", id);
      if (uErr) throw uErr;
      return id;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vistorias"] }); toast.success("Laudo externo anexado"); },
    onError: (e: Error) => toast.error("Erro ao anexar laudo: " + e.message),
  });
}

async function signedUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export function useVistoriaDetalhe(id?: string) {
  return useQuery<VistoriaDetalhe>({
    queryKey: ["vistorias", "detalhe", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vistorias")
        .select("*, vehicles(placa, modelo), fotos:vistoria_fotos(*)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      const v = data as unknown as Vistoria & { vehicles: { placa: string; modelo: string } | null; fotos: VistoriaFoto[] };
      const fotos = await Promise.all((v.fotos ?? []).map(async (f) => ({ ...f, url: await signedUrl(f.storage_path) })));
      return { ...v, fotos, assinatura_url: await signedUrl(v.assinatura_path), laudo_externo_url: await signedUrl(v.laudo_externo_path) } as VistoriaDetalhe;
    },
  });
}

export interface FotoInput {
  parte: string;
  file: File | null;
  avaria: boolean;
  observacao: string;
}

export interface NovaVistoria {
  vehicle_id: string | null;
  placa: string | null;
  tipo: string;
  locatario_nome: string;
  locatario_documento: string;
  locatario_telefone: string;
  locatario_email: string;
  vistoriador: string;
  km: string;
  combustivel: string;
  checklist: ChecklistItem[];
  observacoes: string;
  avarias: string;
  fotos: FotoInput[];
  assinaturaDataUrl: string | null;
  gps: { lat: number; lng: number } | null;
}

export function useCreateVistoria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: NovaVistoria) => {
      const { data: prof } = await supabase.auth.getUser();
      const { data: ins, error } = await supabase.from("vistorias").insert({
        vehicle_id: v.vehicle_id, placa: v.placa, tipo: v.tipo,
        locatario_nome: v.locatario_nome || null, locatario_documento: v.locatario_documento || null,
        locatario_telefone: v.locatario_telefone || null, locatario_email: v.locatario_email || null,
        vistoriador: v.vistoriador || null, km: v.km ? Number(v.km) : null, combustivel: v.combustivel || null,
        checklist: v.checklist, observacoes: v.observacoes || null, avarias: v.avarias || null,
        gps_lat: v.gps?.lat ?? null, gps_lng: v.gps?.lng ?? null, status: "concluida",
        created_by: prof.user?.id ?? null,
      } as never).select("id").single();
      if (error) throw error;
      const vistoriaId = (ins as { id: string }).id;

      // Fotos
      const comFoto = v.fotos.filter((f) => f.file);
      for (const f of comFoto) {
        const path = `${vistoriaId}/${slug(f.parte)}-${f.file!.name.replace(/[^\w.]+/g, "_")}`;
        const up = await supabase.storage.from(BUCKET).upload(path, f.file!, { contentType: f.file!.type || "image/jpeg", upsert: true });
        if (up.error) throw up.error;
        const { error: fErr } = await supabase.from("vistoria_fotos").insert({
          vistoria_id: vistoriaId, parte: f.parte, storage_path: path, avaria: f.avaria, observacao: f.observacao || null,
        } as never);
        if (fErr) throw fErr;
      }

      // Assinatura (dataURL -> blob)
      if (v.assinaturaDataUrl) {
        const blob = await (await fetch(v.assinaturaDataUrl)).blob();
        const path = `${vistoriaId}/assinatura.png`;
        const up = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: "image/png", upsert: true });
        if (!up.error) await supabase.from("vistorias").update({ assinatura_path: path } as never).eq("id", vistoriaId);
      }
      return vistoriaId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vistorias"] });
      toast.success("Vistoria registrada com sucesso");
    },
    onError: (e: Error) => toast.error("Erro ao salvar vistoria: " + e.message),
  });
}

/** Atualiza os contatos do locatário de uma vistoria (usado no envio do laudo). */
export function useUpdateVistoriaContato() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, telefone, email }: { id: string; telefone?: string; email?: string }) => {
      const patch: Record<string, unknown> = {};
      if (telefone !== undefined) patch.locatario_telefone = telefone || null;
      if (email !== undefined) patch.locatario_email = email || null;
      const { error } = await supabase.from("vistorias").update(patch as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vistorias"] }),
  });
}

/** Nome padronizado do laudo: Laudo-PLACA-AAAA-MM-DD-tipo. */
export function nomeArquivoLaudo(v: { placa: string | null; vehicles: { placa: string } | null; tipo: string; created_at: string }) {
  const placa = (v.vehicles?.placa ?? v.placa ?? "veiculo").replace(/[^A-Za-z0-9]/g, "");
  const data = v.created_at.slice(0, 10);
  return `Laudo-${placa}-${data}-${v.tipo}`;
}

const BUCKET_V = "vistorias";
export async function urlToDataUrl(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const blob = await (await fetch(url)).blob();
    return await new Promise((res) => { const r = new FileReader(); r.onloadend = () => res(r.result as string); r.readAsDataURL(blob); });
  } catch { return null; }
}

/** Guarda o PDF do laudo no Storage e devolve um link assinado de 7 dias.
 *  PDF é aberto nativamente pelo WhatsApp e navegador (ao contrário do HTML). */
export async function salvarLaudoPdfLink(vistoriaId: string, pdfBlob: Blob): Promise<string | null> {
  const path = `${vistoriaId}/laudo.pdf`;
  const up = await supabase.storage.from(BUCKET_V).upload(path, pdfBlob, { contentType: "application/pdf", upsert: true });
  if (up.error) throw up.error;
  const { data, error } = await supabase.storage.from(BUCKET_V).createSignedUrl(path, 604800); // 7 dias
  if (error) throw error;
  return data?.signedUrl ?? null;
}

export function useDeleteVistoria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vistorias").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vistorias"] }); toast.success("Vistoria removida"); },
    onError: (e: Error) => toast.error("Erro ao remover: " + e.message),
  });
}
