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
      return { ...v, fotos, assinatura_url: await signedUrl(v.assinatura_path) } as VistoriaDetalhe;
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
