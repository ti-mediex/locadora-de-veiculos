import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

export interface ImportHistoryRow {
  id: string;
  vehicle_id: string | null;
  placa: string | null;
  tipo: "detran" | "consulta_placa";
  file_name: string | null;
  storage_path: string | null;
  resumo: Record<string, unknown> | null;
  created_at: string;
}

const BUCKET = "importacoes";

export interface SalvarImportArgs {
  vehicleId: string | null;
  placa: string | null;
  tipo: "detran" | "consulta_placa";
  file: File;
  resumo: Record<string, unknown>;
}

/** Núcleo: sobe o PDF ao Storage e registra o histórico (sem toast). */
export async function salvarImportacao(args: SalvarImportArgs): Promise<void> {
  const safeName = args.file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${args.vehicleId ?? "sem-veiculo"}/${args.tipo}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${safeName}`;
  const up = await supabase.storage.from(BUCKET).upload(path, args.file, {
    contentType: args.file.type || "application/pdf",
    upsert: false,
  });
  if (up.error) throw up.error;
  const { data: prof } = await supabase.auth.getUser();
  const { error } = await supabase.from("import_history").insert({
    vehicle_id: args.vehicleId, placa: args.placa, tipo: args.tipo,
    file_name: args.file.name, storage_path: path, resumo: args.resumo,
    created_by: prof.user?.id ?? null,
  } as never);
  if (error) throw error;
}

/** Histórico de importações, opcionalmente filtrado por veículo e/ou tipo. */
export function useImportHistory(vehicleId?: string, tipo?: "detran" | "consulta_placa") {
  return useQuery<ImportHistoryRow[]>({
    queryKey: ["import_history", vehicleId ?? "todos", tipo ?? "todos"],
    queryFn: async () => {
      let q = supabase.from("import_history").select("*").order("created_at", { ascending: false }).limit(500);
      if (vehicleId) q = q.eq("vehicle_id", vehicleId);
      if (tipo) q = q.eq("tipo", tipo);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ImportHistoryRow[];
    },
  });
}

/** Guarda uma importação: sobe o PDF ao Storage e registra o histórico. */
export function useSaveImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: SalvarImportArgs) => salvarImportacao(args),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["import_history"] }),
    // Não bloqueia a importação principal se o arquivo falhar ao subir.
    onError: (e: Error) => toast.error("Importado, mas não foi possível guardar o arquivo: " + e.message),
  });
}

/** Gera uma URL assinada e abre o arquivo importado para download/visualização. */
export async function baixarImportacao(path: string | null, fileName?: string | null) {
  if (!path) return;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 120, { download: fileName ?? undefined });
  if (error) { toast.error("Erro ao gerar link: " + error.message); return; }
  window.open(data.signedUrl, "_blank");
}
