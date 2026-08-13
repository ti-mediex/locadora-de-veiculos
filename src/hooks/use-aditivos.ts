import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

export type AditivoTipo = "confirmacao_posse" | "troca_veiculo" | "outro";
export type AditivoStatus = "rascunho" | "enviado" | "assinado" | "cancelado";

export interface Aditivo {
  id: string;
  numero: string;
  contrato_id: string | null;
  locatario_id: string | null;
  troca_id: string | null;
  tipo: AditivoTipo;
  vehicle_id: string | null;
  placa: string | null;
  cliente_nome: string | null;
  cliente_cpf: string | null;
  conteudo: string | null;
  status: AditivoStatus;
  token: string;
  enviado_em: string | null;
  assinado_em: string | null;
  assinante_nome: string | null;
  assinante_cpf: string | null;
  assinatura_img: string | null;
  created_at: string;
  updated_at: string;
}

export const ADITIVO_TIPO_LABEL: Record<AditivoTipo, string> = {
  confirmacao_posse: "Confirmação de posse",
  troca_veiculo: "Troca de veículo",
  outro: "Outro",
};

export const ADITIVO_STATUS_LABEL: Record<AditivoStatus, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  assinado: "Assinado",
  cancelado: "Cancelado",
};

/** Link público de assinatura de um aditivo. */
export const linkAssinatura = (token: string) => `${window.location.origin}/assinar/${token}`;

export function useAditivos() {
  return useQuery<Aditivo[]>({
    queryKey: ["aditivos", "list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("aditivos").select("*").order("created_at", { ascending: false }).limit(5000);
      if (error) throw error;
      return (data ?? []) as Aditivo[];
    },
  });
}

/** Aditivos de um contrato. */
export function useAditivosPorContrato(contratoId?: string) {
  const { data: aditivos = [] } = useAditivos();
  return useMemo(() => (contratoId ? aditivos.filter((a) => a.contrato_id === contratoId) : []), [aditivos, contratoId]);
}

export type AditivoPayload = Partial<Omit<Aditivo, "id" | "numero" | "token" | "created_at" | "updated_at" | "assinado_em" | "assinante_nome" | "assinante_cpf" | "assinatura_img">>;

/** Cria o aditivo (status "enviado" por padrão) e retorna número + token. */
export function useCriarAditivo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: AditivoPayload) => {
      const { data: prof } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("aditivos")
        .insert({ status: "enviado", enviado_em: new Date().toISOString(), ...payload, created_by: prof.user?.id ?? null } as never)
        .select("id, numero, token")
        .single();
      if (error) throw error;
      return data as { id: string; numero: string; token: string };
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["aditivos"] }); },
    onError: (e: Error) => toast.error("Erro ao gerar aditivo: " + e.message),
  });
}

export function useCancelarAditivo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("aditivos").update({ status: "cancelado" } as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["aditivos"] }); toast.success("Aditivo cancelado"); },
    onError: (e: Error) => toast.error("Erro ao cancelar: " + e.message),
  });
}

export function useDeleteAditivo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("aditivos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["aditivos"] }); toast.success("Aditivo removido"); },
    onError: (e: Error) => toast.error("Erro ao remover: " + e.message),
  });
}

// ---- Página pública de assinatura (via RPC, sem login) ----

export interface AditivoPublico {
  id: string;
  numero: string;
  tipo: AditivoTipo;
  status: AditivoStatus;
  placa: string | null;
  cliente_nome: string | null;
  cliente_cpf: string | null;
  conteudo: string | null;
  assinado_em: string | null;
  assinante_nome: string | null;
}

export function useAditivoPorToken(token?: string) {
  return useQuery<AditivoPublico | null>({
    queryKey: ["aditivo_publico", token],
    enabled: !!token,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_aditivo_por_token", { p_token: token });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return (row ?? null) as AditivoPublico | null;
    },
  });
}

export function useAssinarAditivo() {
  const qc = useQueryClient();
  return useMutation<string, Error, { token: string; nome: string; cpf: string; assinatura?: string | null }>({
    mutationFn: async ({ token, nome, cpf, assinatura }) => {
      const { data, error } = await supabase.rpc("assinar_aditivo", { p_token: token, p_nome: nome, p_cpf: cpf, p_assinatura: assinatura ?? null });
      if (error) throw error;
      return (data as string) ?? "";
    },
    onSuccess: (res) => {
      if (res === "ok") qc.invalidateQueries({ queryKey: ["aditivo_publico"] });
    },
  });
}
