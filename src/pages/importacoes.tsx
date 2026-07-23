import { useMemo, useState } from "react";
import { Download, FileText, Car } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/shared/stat-card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useImportHistory, baixarImportacao, type ImportHistoryRow } from "@/hooks/use-import-history";
import { useSort } from "@/hooks/use-sort";
import { SortableHead } from "@/components/shared/sortable-head";
import { BuscaPlaca } from "@/components/shared/busca-placa";
import { RelatorioExport } from "@/components/shared/relatorio-export";
import { soAlfa } from "@/lib/format";
import type { RelatorioTabelaData, RelColuna } from "@/lib/relatorio-tabela";

const TIPO_LABEL: Record<string, string> = {
  detran: "Débitos (Detran)",
  consulta_placa: "Consulta Placa",
  ituran: "Ociosidade (Ituran)",
  ituran_grid: "Rastreamento (Ituran)",
};

function resumoTexto(h: ImportHistoryRow): string {
  const r = h.resumo ?? {};
  if (h.tipo === "detran") {
    const p = [];
    if (r.restricoes) p.push(`${r.restricoes} restrição(ões)`);
    if (r.debitos) p.push(`${r.debitos} débito(s)`);
    if (r.multas) p.push(`${r.multas} multa(s)`);
    if (r.ignorados) p.push(`${r.ignorados} já existia(m)`);
    return p.join(" · ") || "—";
  }
  if (h.tipo === "consulta_placa") {
    return `${r.campos ?? 0} campo(s)${r.criado ? " · veículo criado" : " · veículo atualizado"}`;
  }
  if (h.tipo === "ituran") {
    const p = [];
    if (r.dias) p.push(`${r.dias} dia(s) de leitura`);
    if (r.registros) p.push(`${r.registros} registro(s)`);
    if (r.periodo_ini && r.periodo_fim) p.push(`${r.periodo_ini} a ${r.periodo_fim}`);
    return p.join(" · ") || "—";
  }
  if (h.tipo === "ituran_grid") {
    return `${r.total ?? 0} veículo(s)` + (r.referencia ? ` · ref. ${String(r.referencia).slice(8, 10)}/${String(r.referencia).slice(5, 7)}/${String(r.referencia).slice(0, 4)}` : "");
  }
  return "—";
}

export default function ImportacoesPage() {
  const { data: rows = [], isLoading } = useImportHistory();
  const [search, setSearch] = useState("");
  const [fTipo, setFTipo] = useState("todos");

  // Sugestões de placa a partir do histórico (distintas).
  const veicSugestoes = useMemo(() => {
    const seen = new Set<string>();
    const out: { id: string; placa: string }[] = [];
    for (const h of rows) { const p = h.placa; if (p && !seen.has(p)) { seen.add(p); out.push({ id: p, placa: p }); } }
    return out;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const qa = soAlfa(search);
    return rows.filter((h) => {
      const matchTipo = fTipo === "todos" || h.tipo === fTipo;
      const matchSearch = !q || (h.placa ?? "").toLowerCase().includes(q) || (h.file_name ?? "").toLowerCase().includes(q) ||
        (qa !== "" && soAlfa(h.placa ?? "").includes(qa));
      return matchTipo && matchSearch;
    });
  }, [rows, search, fTipo]);

  const { sortKey, sortDir, toggle, useSorted } = useSort<ImportHistoryRow>("created_at", "desc");
  const sorted = useSorted(filtered, (h, k) => {
    switch (k) {
      case "created_at": return h.created_at;
      case "placa": return h.placa;
      case "tipo": return h.tipo;
      case "resumo": return resumoTexto(h);
      case "file_name": return h.file_name;
      default: return null;
    }
  });

  function buildRelatorio(): RelatorioTabelaData {
    const colunas: RelColuna[] = [
      { label: "Data" }, { label: "Veículo" }, { label: "Tipo" }, { label: "Resumo" }, { label: "Arquivo" },
    ];
    const linhas = sorted.map((h) => [
      new Date(h.created_at).toLocaleString("pt-BR"), h.placa ?? "—",
      TIPO_LABEL[h.tipo] ?? h.tipo, resumoTexto(h), h.file_name ?? "—",
    ]);
    return {
      titulo: "Histórico de importações", subtitulo: `${sorted.length} importação(ões)`,
      filtros: [{ label: "Busca", valor: search }, { label: "Tipo", valor: fTipo === "todos" ? "Todos" : (TIPO_LABEL[fTipo] ?? fTipo) }],
      colunas, linhas,
    };
  }

  const qtdDetran = rows.filter((r) => r.tipo === "detran").length;
  const qtdPlaca = rows.filter((r) => r.tipo === "consulta_placa").length;

  return (
    <div className="space-y-6">
      <PageHeader title="Importações" description="Histórico de importações de débitos e consultas por veículo"
        actions={<RelatorioExport build={buildRelatorio} nomeArquivo="importacoes" disabled={!sorted.length} />} />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Total de importações" value={rows.length} icon={<FileText className="h-5 w-5" />} />
        <StatCard title="Débitos (Detran)" value={qtdDetran} icon={<FileText className="h-5 w-5" />} />
        <StatCard title="Consultas de placa" value={qtdPlaca} icon={<Car className="h-5 w-5" />} />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flex flex-col gap-2 border-b p-4 sm:flex-row sm:items-center">
            <BuscaPlaca value={search} onChange={setSearch} vehicles={veicSugestoes} placeholder="Buscar por placa (ex.: 8451) ou arquivo..." />
            <Select value={fTipo} onValueChange={setFTipo}>
              <SelectTrigger className="w-full sm:w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os tipos</SelectItem>
                <SelectItem value="detran">Débitos (Detran)</SelectItem>
                <SelectItem value="consulta_placa">Consulta Placa</SelectItem>
                <SelectItem value="ituran">Ociosidade (Ituran)</SelectItem>
                <SelectItem value="ituran_grid">Rastreamento (Ituran)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <EmptyState message="Nenhuma importação registrada" icon={<FileText className="h-6 w-6" />} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead sortKey="created_at" activeKey={sortKey} dir={sortDir} onSort={toggle}>Data</SortableHead>
                  <SortableHead sortKey="placa" activeKey={sortKey} dir={sortDir} onSort={toggle}>Veículo</SortableHead>
                  <SortableHead sortKey="tipo" activeKey={sortKey} dir={sortDir} onSort={toggle}>Tipo</SortableHead>
                  <SortableHead sortKey="resumo" activeKey={sortKey} dir={sortDir} onSort={toggle}>Resumo</SortableHead>
                  <SortableHead sortKey="file_name" activeKey={sortKey} dir={sortDir} onSort={toggle}>Arquivo</SortableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((h) => (
                  <TableRow key={h.id} className={h.storage_path ? "cursor-pointer" : ""} onClick={() => h.storage_path && baixarImportacao(h.storage_path, h.file_name)}>
                    <TableCell className="whitespace-nowrap text-sm">{new Date(h.created_at).toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="font-mono font-medium">{h.placa ?? "—"}</TableCell>
                    <TableCell><Badge variant="secondary">{TIPO_LABEL[h.tipo] ?? h.tipo}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{resumoTexto(h)}</TableCell>
                    <TableCell className="max-w-48 truncate text-xs text-muted-foreground">{h.file_name ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <Button variant="ghost" size="sm" disabled={!h.storage_path} onClick={(e) => { e.stopPropagation(); baixarImportacao(h.storage_path, h.file_name); }}>
                          <Download className="h-4 w-4" /> Baixar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
