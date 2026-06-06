import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

type TableName =
  | "vehicles"
  | "renters"
  | "contracts"
  | "receivables"
  | "maintenances"
  | "fines"
  | "expenses"
  | "profiles"
  | "occurrences"
  | "inspections"
  | "suppliers"
  | "vehicle_groups"
  | "yards"
  | "buyers"
  | "parts_services"
  | "financing_contracts"
  | "financing_installments"
  | "vehicle_colors"
  | "maintenance_items"
  | "invoices"
  | "bank_accounts"
  | "ledger_entries";

interface CrudOptions {
  select?: string;
  orderBy?: { column: string; ascending?: boolean };
}

/** Lista registros de uma tabela. */
export function useList<T>(table: TableName, options: CrudOptions = {}) {
  const { select = "*", orderBy } = options;
  return useQuery<T[]>({
    queryKey: [table, "list", select, orderBy],
    queryFn: async () => {
      let q = supabase.from(table).select(select);
      if (orderBy) {
        q = q.order(orderBy.column, { ascending: orderBy.ascending ?? false });
      } else {
        q = q.order("created_at", { ascending: false });
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as T[];
    },
  });
}

/** Cria um registro. */
export function useCreate<_T = unknown>(table: TableName, label = "Registro") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data, error } = await supabase
        .from(table)
        .insert(payload as never)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] });
      toast.success(`${label} criado com sucesso`);
    },
    onError: (e: Error) => toast.error(`Erro ao salvar: ${e.message}`),
  });
}

/** Atualiza um registro por id. */
export function useUpdate<_T = unknown>(table: TableName, label = "Registro") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & Record<string, unknown>) => {
      const { data, error } = await supabase
        .from(table)
        .update(payload as never)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] });
      toast.success(`${label} atualizado`);
    },
    onError: (e: Error) => toast.error(`Erro ao atualizar: ${e.message}`),
  });
}

/** Remove um registro por id. */
export function useDelete(table: TableName, label = "Registro") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] });
      toast.success(`${label} removido`);
    },
    onError: (e: Error) => toast.error(`Erro ao remover: ${e.message}`),
  });
}
