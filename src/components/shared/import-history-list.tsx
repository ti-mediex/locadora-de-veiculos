import { Download, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useImportHistory, baixarImportacao } from "@/hooks/use-import-history";

/** Lista as importações anteriores de um veículo (com download do arquivo). */
export function ImportHistoryList({
  vehicleId, tipo,
}: {
  vehicleId?: string;
  tipo: "detran" | "consulta_placa";
}) {
  const { data = [] } = useImportHistory(vehicleId, tipo);
  if (!vehicleId || data.length === 0) return null;
  return (
    <div className="rounded-lg border p-3 text-sm">
      <div className="mb-2 flex items-center gap-2 font-medium"><History className="h-4 w-4" /> Importações anteriores ({data.length})</div>
      <ul className="max-h-40 space-y-1 overflow-auto">
        {data.map((h) => (
          <li key={h.id} className="flex items-center justify-between gap-2">
            <span className="truncate text-xs text-muted-foreground">
              {new Date(h.created_at).toLocaleString("pt-BR")} · {h.file_name ?? "arquivo"}
            </span>
            <Button type="button" size="sm" variant="ghost" className="h-7 shrink-0" disabled={!h.storage_path}
              onClick={() => baixarImportacao(h.storage_path, h.file_name)}>
              <Download className="h-3.5 w-3.5" /> Baixar
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
