import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

async function callAdmin(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("admin-users", { body });
  if (error) {
    let msg = error.message;
    try {
      const ctx = (error as { context?: Response }).context;
      const j = ctx && "json" in ctx ? await ctx.json() : null;
      if (j?.error) msg = j.error;
    } catch { /* mantém msg */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { email: string; password: string; full_name: string; role: string }) => callAdmin({ action: "create", ...v }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["profiles"] }); toast.success("Usuário criado"); },
    onError: (e: Error) => toast.error("Erro ao criar usuário: " + e.message),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; role?: string; active?: boolean; full_name?: string }) => callAdmin({ action: "update", ...v }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["profiles"] }); toast.success("Usuário atualizado"); },
    onError: (e: Error) => toast.error("Erro ao atualizar: " + e.message),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (v: { id: string; password: string }) => callAdmin({ action: "password", ...v }),
    onSuccess: () => toast.success("Senha redefinida"),
    onError: (e: Error) => toast.error("Erro ao redefinir senha: " + e.message),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => callAdmin({ action: "delete", id }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["profiles"] }); toast.success("Usuário excluído"); },
    onError: (e: Error) => toast.error("Erro ao excluir: " + e.message),
  });
}
