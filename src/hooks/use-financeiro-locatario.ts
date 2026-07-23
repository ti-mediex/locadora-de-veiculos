import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import type { LocatarioDebito, LocatarioCaucao } from "@/types/database";

export function useDebitos() {
  return useQuery<LocatarioDebito[]>({
    queryKey: ["locatario_debitos", "list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("locatario_debitos").select("*").order("competencia", { ascending: false }).limit(20000);
      if (error) throw error;
      return (data ?? []) as LocatarioDebito[];
    },
  });
}

export function useCaucoes() {
  return useQuery<LocatarioCaucao[]>({
    queryKey: ["locatario_caucoes", "list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("locatario_caucoes").select("*").order("data", { ascending: false }).limit(20000);
      if (error) throw error;
      return (data ?? []) as LocatarioCaucao[];
    },
  });
}

const withUser = async (campos: Record<string, unknown>) => {
  const { data: prof } = await supabase.auth.getUser();
  return { ...campos, created_by: prof.user?.id ?? null };
};

export function useSaveDebito() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<LocatarioDebito> & { id?: string }) => {
      const { id, created_at, updated_at, created_by, ...campos } = input as Record<string, unknown> & { id?: string };
      if (id) {
        const { error } = await supabase.from("locatario_debitos").update(campos as never).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("locatario_debitos").insert((await withUser(campos)) as never);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["locatario_debitos"] }); toast.success("Débito salvo"); },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });
}

export function useDeleteDebito() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("locatario_debitos").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["locatario_debitos"] }); toast.success("Débito removido"); },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });
}

export function useSaveCaucao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<LocatarioCaucao> & { id?: string }) => {
      const { id, created_at, updated_at, created_by, ...campos } = input as Record<string, unknown> & { id?: string };
      if (id) {
        const { error } = await supabase.from("locatario_caucoes").update(campos as never).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("locatario_caucoes").insert((await withUser(campos)) as never);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["locatario_caucoes"] }); toast.success("Caução salvo"); },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });
}

export function useDeleteCaucao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("locatario_caucoes").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["locatario_caucoes"] }); toast.success("Caução removido"); },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });
}

/** Marca o caução como devolvido (na devolução após o prazo). */
export function useDevolverCaucao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, valor }: { id: string; valor: number }) => {
      const { error } = await supabase.from("locatario_caucoes")
        .update({ devolvido: true, devolvido_em: new Date().toISOString().slice(0, 10), valor_devolvido: valor } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["locatario_caucoes"] }); toast.success("Devolução registrada"); },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });
}
