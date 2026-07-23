import { FileText, FileDown, FileSpreadsheet, Printer, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { abrirRelatorioTabela, exportarTabelaCsv, type RelatorioTabelaData } from "@/lib/relatorio-tabela";

/** Botão de exportação do resultado da pesquisa: HTML, PDF ou planilha (CSV). */
export function RelatorioExport({
  build, nomeArquivo, disabled, label = "Relatório",
}: {
  /** Constrói os dados do relatório a partir do estado atual (filtros/ordenação). */
  build: () => RelatorioTabelaData;
  nomeArquivo: string;
  disabled?: boolean;
  label?: string;
}) {
  function abrir(autoPrint: boolean) {
    const ok = abrirRelatorioTabela({ ...build(), autoPrint });
    if (!ok) toast.error("Permita pop-ups para gerar o relatório.");
  }
  function csv() {
    const d = build();
    exportarTabelaCsv(nomeArquivo, d.colunas, d.linhas);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <FileText className="h-4 w-4" /> {label} <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => abrir(false)}><FileDown className="h-4 w-4" /> Visualizar (HTML)</DropdownMenuItem>
        <DropdownMenuItem onClick={() => abrir(true)}><Printer className="h-4 w-4" /> Salvar PDF (imprimir)</DropdownMenuItem>
        <DropdownMenuItem onClick={csv}><FileSpreadsheet className="h-4 w-4" /> Exportar planilha (CSV)</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
