import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import type { Locatario } from "@/types/database";

/** Cadastro de locatários (ordenado por nome). */
export function useLocatarios() {
  return useQuery<Locatario[]>({
    queryKey: ["locatarios", "list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("locatarios").select("*").order("nome", { ascending: true }).limit(5000);
      if (error) throw error;
      return (data ?? []) as Locatario[];
    },
  });
}

export type LocatarioInput = Partial<Omit<Locatario, "id" | "created_by" | "created_at" | "updated_at">> & { id?: string };

/** Cria ou atualiza um locatário. */
export function useSaveLocatario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: LocatarioInput) => {
      const { id, ...campos } = input;
      if (id) {
        const { data, error } = await supabase.from("locatarios").update(campos as never).eq("id", id).select("id").single();
        if (error) throw error;
        return data as { id: string };
      }
      const { data: prof } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("locatarios").insert({ ...campos, created_by: prof.user?.id ?? null } as never).select("id").single();
      if (error) throw error;
      return data as { id: string };
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["locatarios"] }); toast.success("Locatário salvo"); },
    onError: (e: Error) => toast.error("Erro ao salvar locatário: " + e.message),
  });
}

export function useDeleteLocatario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("locatarios").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["locatarios"] }); toast.success("Locatário removido"); },
    onError: (e: Error & { code?: string }) => {
      if (e.code === "23503") toast.error("Não é possível excluir: locatário vinculado a contratos. Inative-o.", { duration: 6000 });
      else toast.error("Erro ao remover: " + e.message);
    },
  });
}

/** Localiza um locatário existente por CPF (normalizado) para evitar duplicidade. */
export function acharPorCpf(lista: Locatario[], cpf?: string | null): Locatario | undefined {
  const c = (cpf ?? "").replace(/\D/g, "");
  if (!c) return undefined;
  return lista.find((l) => (l.cpf ?? "").replace(/\D/g, "") === c);
}
