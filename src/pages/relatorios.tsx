import { useMemo, useState, type ReactNode } from "react";
import { FileDown, TrendingUp, TrendingDown, Scale, ListChecks, Car, ShieldCheck, FileSpreadsheet, FileText, FileType, ChevronDown } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCurrency, formatDate, formatPercent } from "@/lib/format";
import { exportCsv, exportXlsx, exportHtml, exportPdf } from "@/lib/export-report";
import { useFinanceEntries, useFinanceByVehicle } from "@/hooks/use-finance";
import { usePendencias, vencimentoStatus } from "@/hooks/use-pendencias";
import { useList } from "@/hooks/use-crud";
import type { Vehicle } from "@/types/database";

type Col<T> = { key: keyof T; label: string; align?: "right"; fmt?: (row: T) => ReactNode };

function ReportTable<T extends object>({
  title, description, columns, rows, filename, footer,
}: {
  title: string;
  description?: string;
  columns: Col<T>[];
  rows: T[];
  filename: string;
  footer?: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={rows.length === 0}>
              <FileDown className="h-4 w-4" /> Exportar <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(() => { const cols = columns.map((c) => ({ key: c.key, label: c.label })); return (<>
              <DropdownMenuItem onClick={() => exportXlsx(filename, rows, cols, title)}><FileSpreadsheet className="h-4 w-4" /> Planilha (Excel)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportCsv(filename, rows, cols)}><FileSpreadsheet className="h-4 w-4" /> CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportHtml(filename, title, rows, cols)}><FileText className="h-4 w-4" /> HTML</DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportPdf(title, rows, cols)}><FileType className="h-4 w-4" /> PDF (imprimir)</DropdownMenuItem>
            </>); })()}
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <EmptyState message="Sem dados no período" />
        ) : (
          <div className="max-h-[28rem] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((c) => (
                    <TableHead key={String(c.key)} className={c.align === "right" ? "text-right" : ""}>{c.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, i) => (
                  <TableRow key={i}>
                    {columns.map((c) => (
                      <TableCell key={String(c.key)} className={c.align === "right" ? "text-right" : ""}>
                        {c.fmt ? c.fmt(row) : String(row[c.key] ?? "—")}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {footer}
      </CardContent>
    </Card>
  );
}

/** Agrupa somando um valor por chave. */
function groupSum<T>(rows: T[], keyFn: (r: T) => string, valFn: (r: T) => number) {
  const m = new Map<string, number>();
  for (const r of rows) m.set(keyFn(r), (m.get(keyFn(r)) ?? 0) + valFn(r));
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

export default function RelatoriosPage() {
  const hoje = new Date().toISOString().slice(0, 10);
  const inicioAno = hoje.slice(0, 4) + "-01-01";
  const [inicio, setInicio] = useState(inicioAno);
  const [fim, setFim] = useState(hoje);
  const [fVeiculo, setFVeiculo] = useState("todos");
  const [fSituacao, setFSituacao] = useState<"ativos" | "todos">("ativos");

  const { data: entries = [] } = useFinanceEntries(inicio || undefined, fim || undefined);
  const { data: porVeiculoAll = [] } = useFinanceByVehicle();
  const { data: pendAll = [] } = usePendencias();
  const { data: veiculosAll = [] } = useList<Vehicle>("vehicles");

  // Filtros de escopo: veículo específico ou frota (só ativos / todos).
  const ativosSet = useMemo(() => new Set(veiculosAll.filter((v) => v.status !== "inativo").map((v) => v.id)), [veiculosAll]);
  const incluiVeiculo = (vehicleId: string | null) => {
    if (fVeiculo !== "todos") return vehicleId === fVeiculo;
    if (fSituacao === "ativos") return vehicleId === null || ativosSet.has(vehicleId);
    return true;
  };

  const entriesF = useMemo(() => entries.filter((e) => incluiVeiculo(e.vehicle_id)), [entries, fVeiculo, fSituacao, ativosSet]);
  const porVeiculo = useMemo(() => porVeiculoAll.filter((p) => incluiVeiculo(p.vehicle_id)), [porVeiculoAll, fVeiculo, fSituacao, ativosSet]);
  const pend = useMemo(() => pendAll.filter((p) => incluiVeiculo(p.vehicle_id)), [pendAll, fVeiculo, fSituacao, ativosSet]);
  const veiculos = useMemo(() => veiculosAll.filter((v) => (fVeiculo !== "todos" ? v.id === fVeiculo : fSituacao === "ativos" ? v.status !== "inativo" : true)), [veiculosAll, fVeiculo, fSituacao]);

  const receitas = useMemo(() => entriesF.filter((e) => e.tipo === "receita"), [entriesF]);
  const despesas = useMemo(() => entriesF.filter((e) => e.tipo === "despesa"), [entriesF]);

  // ---- Receitas ----
  const recPorVeiculo = useMemo(() => groupSum(receitas, (r) => r.placa ?? "Frota (geral)", (r) => r.valor)
    .map(([veiculo, total]) => ({ veiculo, total })), [receitas]);
  const recPorCategoria = useMemo(() => groupSum(receitas, (r) => r.categoria ?? "Sem categoria", (r) => r.valor)
    .map(([categoria, total]) => ({ categoria, total })), [receitas]);
  const recPorMes = useMemo(() => groupSum(receitas, (r) => r.data.slice(0, 7), (r) => r.valor)
    .sort((a, b) => a[0].localeCompare(b[0])).map(([mes, total]) => ({ mes, total })), [receitas]);
  const totalReceitas = useMemo(() => receitas.reduce((s, r) => s + r.valor, 0), [receitas]);

  // ---- Despesas ----
  const despPorVeiculo = useMemo(() => groupSum(despesas, (r) => r.placa ?? "Frota (geral)", (r) => r.valor)
    .map(([veiculo, total]) => ({ veiculo, total })), [despesas]);
  const despPorCategoria = useMemo(() => groupSum(despesas, (r) => r.categoria ?? "Sem categoria", (r) => r.valor)
    .map(([categoria, total]) => ({ categoria, total })), [despesas]);
  const despPorMes = useMemo(() => groupSum(despesas, (r) => r.data.slice(0, 7), (r) => r.valor)
    .sort((a, b) => a[0].localeCompare(b[0])).map(([mes, total]) => ({ mes, total })), [despesas]);
  const totalDespesas = useMemo(() => despesas.reduce((s, r) => s + r.valor, 0), [despesas]);

  // ---- Resultado ----
  const resultadoGeral = totalReceitas - totalDespesas;
  const margemGeral = totalReceitas > 0 ? resultadoGeral / totalReceitas : 0;

  // ---- Pendências ----
  const pendComValor = useMemo(() => pend.filter((p) => p.status !== "cancelada"), [pend]);
  const pendPorVeiculo = useMemo(() => {
    const m = new Map<string, { placa: string; qtd: number; aberto: number; vencido: number }>();
    for (const p of pendComValor) {
      const placa = p.vehicles?.placa ?? "—";
      const cur = m.get(placa) ?? { placa, qtd: 0, aberto: 0, vencido: 0 };
      cur.qtd += 1;
      const ativa = p.status === "aberta" || p.status === "em_andamento";
      if (ativa && p.valor) cur.aberto += p.valor;
      if (ativa && p.valor && vencimentoStatus(p.vencimento, p.status) === "vencida") cur.vencido += p.valor;
      m.set(placa, cur);
    }
    return [...m.values()].sort((a, b) => b.aberto - a.aberto);
  }, [pendComValor]);
  const pendPorCategoria = useMemo(() => {
    const m = new Map<string, { categoria: string; qtd: number; valor: number }>();
    for (const p of pendComValor) {
      const cur = m.get(p.categoria) ?? { categoria: p.categoria, qtd: 0, valor: 0 };
      cur.qtd += 1;
      if ((p.status === "aberta" || p.status === "em_andamento") && p.valor) cur.valor += p.valor;
      m.set(p.categoria, cur);
    }
    return [...m.values()].sort((a, b) => b.valor - a.valor);
  }, [pendComValor]);
  const aging = useMemo(() => {
    const buckets = { vencida: 0, vence7: 0, vence30: 0, em_dia: 0 };
    for (const p of pendComValor) {
      if (!(p.status === "aberta" || p.status === "em_andamento") || !p.valor) continue;
      const s = vencimentoStatus(p.vencimento, p.status);
      if (s === "vencida") buckets.vencida += p.valor;
      else if (s === "vence7") buckets.vence7 += p.valor;
      else if (s === "vence30") buckets.vence30 += p.valor;
      else if (s === "em_dia") buckets.em_dia += p.valor;
    }
    return [
      { faixa: "Vencidas", valor: buckets.vencida },
      { faixa: "A vencer em 7 dias", valor: buckets.vence7 },
      { faixa: "A vencer em 30 dias", valor: buckets.vence30 },
      { faixa: "Em dia (> 30 dias)", valor: buckets.em_dia },
    ];
  }, [pendComValor]);
  const multasVeic = useMemo(() => {
    const m = new Map<string, { placa: string; qtd: number; valor: number }>();
    for (const p of pendComValor) {
      if (!/multa/i.test(p.categoria)) continue;
      const placa = p.vehicles?.placa ?? "—";
      const cur = m.get(placa) ?? { placa, qtd: 0, valor: 0 };
      cur.qtd += 1;
      cur.valor += p.valor ?? 0;
      m.set(placa, cur);
    }
    return [...m.values()].sort((a, b) => b.valor - a.valor);
  }, [pendComValor]);

  // ---- Frota / Auditoria ----
  const ativos = useMemo(() => veiculos.filter((v) => v.status !== "inativo"), [veiculos]);
  const frotaPorStatus = useMemo(() => groupSum(veiculos, (v) => v.status, () => 1).map(([status, qtd]) => ({ status, qtd })), [veiculos]);
  const restricoes = useMemo(() => veiculos.filter((v) => v.alienacao_fiduciaria || v.busca_apreensao || v.bloqueio_judicial), [veiculos]);
  const incompletos = useMemo(() => veiculos.filter((v) => !v.chassi || !v.renavam || !v.valor_fipe), [veiculos]);

  return (
    <div className="space-y-6">
      <PageHeader title="Relatórios" description="Gestão operacional, financeira e auditoria da frota" />

      <div className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Período — início</label>
          <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className="w-44" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Período — fim</label>
          <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className="w-44" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Veículo</label>
          <Select value={fVeiculo} onValueChange={setFVeiculo}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Frota toda</SelectItem>
              {veiculosAll.map((v) => <SelectItem key={v.id} value={v.id}>{v.placa} — {v.modelo}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Situação</label>
          <Select value={fSituacao} onValueChange={(v) => setFSituacao(v as "ativos" | "todos")} disabled={fVeiculo !== "todos"}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ativos">Somente ativos</SelectItem>
              <SelectItem value="todos">Todos os veículos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <span className="text-xs text-muted-foreground">Filtre por um veículo ou pela frota. O período afeta Receitas e Despesas.</span>
      </div>

      <Tabs defaultValue="receitas">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="receitas"><TrendingUp className="mr-1 h-4 w-4" /> Receitas</TabsTrigger>
          <TabsTrigger value="despesas"><TrendingDown className="mr-1 h-4 w-4" /> Despesas</TabsTrigger>
          <TabsTrigger value="resultado"><Scale className="mr-1 h-4 w-4" /> Resultado</TabsTrigger>
          <TabsTrigger value="pendencias"><ListChecks className="mr-1 h-4 w-4" /> Pendências</TabsTrigger>
          <TabsTrigger value="frota"><Car className="mr-1 h-4 w-4" /> Frota</TabsTrigger>
          <TabsTrigger value="auditoria"><ShieldCheck className="mr-1 h-4 w-4" /> Auditoria</TabsTrigger>
        </TabsList>

        {/* RECEITAS */}
        <TabsContent value="receitas" className="space-y-4">
          <ReportTable title="Receitas por veículo" description={`Total no período: ${formatCurrency(totalReceitas)}`}
            filename="receitas-por-veiculo" rows={recPorVeiculo}
            columns={[
              { key: "veiculo", label: "Veículo" },
              { key: "total", label: "Total", align: "right", fmt: (r) => formatCurrency(r.total) },
            ]} />
          <ReportTable title="Receitas por categoria" filename="receitas-por-categoria" rows={recPorCategoria}
            columns={[
              { key: "categoria", label: "Categoria" },
              { key: "total", label: "Total", align: "right", fmt: (r) => formatCurrency(r.total) },
            ]} />
          <ReportTable title="Receitas por mês" filename="receitas-por-mes" rows={recPorMes}
            columns={[
              { key: "mes", label: "Mês" },
              { key: "total", label: "Total", align: "right", fmt: (r) => formatCurrency(r.total) },
            ]} />
        </TabsContent>

        {/* DESPESAS */}
        <TabsContent value="despesas" className="space-y-4">
          <ReportTable title="Despesas por veículo" description={`Total no período: ${formatCurrency(totalDespesas)}`}
            filename="despesas-por-veiculo" rows={despPorVeiculo}
            columns={[
              { key: "veiculo", label: "Veículo" },
              { key: "total", label: "Total", align: "right", fmt: (r) => formatCurrency(r.total) },
            ]} />
          <ReportTable title="Despesas por categoria" description="Manutenção, combustível, documentação, etc."
            filename="despesas-por-categoria" rows={despPorCategoria}
            columns={[
              { key: "categoria", label: "Categoria" },
              { key: "total", label: "Total", align: "right", fmt: (r) => formatCurrency(r.total) },
            ]} />
          <ReportTable title="Despesas por mês" filename="despesas-por-mes" rows={despPorMes}
            columns={[
              { key: "mes", label: "Mês" },
              { key: "total", label: "Total", align: "right", fmt: (r) => formatCurrency(r.total) },
            ]} />
        </TabsContent>

        {/* RESULTADO */}
        <TabsContent value="resultado" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-4">
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Receita (período)</div><div className="text-lg font-semibold text-success">{formatCurrency(totalReceitas)}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Despesa (período)</div><div className="text-lg font-semibold text-destructive">{formatCurrency(totalDespesas)}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Resultado</div><div className={`text-lg font-semibold ${resultadoGeral >= 0 ? "text-success" : "text-destructive"}`}>{formatCurrency(resultadoGeral)}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Margem</div><div className="text-lg font-semibold">{formatPercent(margemGeral)}</div></CardContent></Card>
          </div>
          <ReportTable title="Resultado por veículo (acumulado)" description="Receita − despesa e margem por veículo"
            filename="resultado-por-veiculo" rows={porVeiculo}
            columns={[
              { key: "placa", label: "Placa" },
              { key: "modelo", label: "Modelo" },
              { key: "receita", label: "Receita", align: "right", fmt: (r) => formatCurrency(r.receita) },
              { key: "despesa", label: "Despesa", align: "right", fmt: (r) => formatCurrency(r.despesa) },
              { key: "resultado", label: "Resultado", align: "right", fmt: (r) => <span className={r.resultado >= 0 ? "text-success" : "text-destructive"}>{formatCurrency(r.resultado)}</span> },
            ]} />
        </TabsContent>

        {/* PENDÊNCIAS */}
        <TabsContent value="pendencias" className="space-y-4">
          <ReportTable title="Pendências por veículo" description="Quantidade, valor em aberto e vencido por veículo"
            filename="pendencias-por-veiculo" rows={pendPorVeiculo}
            columns={[
              { key: "placa", label: "Veículo" },
              { key: "qtd", label: "Pendências", align: "right" },
              { key: "vencido", label: "Vencido", align: "right", fmt: (r) => r.vencido > 0 ? <span className="text-destructive">{formatCurrency(r.vencido)}</span> : "—" },
              { key: "aberto", label: "Em aberto", align: "right", fmt: (r) => formatCurrency(r.aberto) },
            ]} />
          <ReportTable title="Pendências por categoria" description="IPVA, multas, licenciamento, CRLV, seguro, etc."
            filename="pendencias-por-categoria" rows={pendPorCategoria}
            columns={[
              { key: "categoria", label: "Categoria" },
              { key: "qtd", label: "Qtd", align: "right" },
              { key: "valor", label: "Valor em aberto", align: "right", fmt: (r) => formatCurrency(r.valor) },
            ]} />
          <ReportTable title="Aging — vencimento das pendências financeiras" description="Distribuição do valor em aberto por faixa de vencimento"
            filename="pendencias-aging" rows={aging}
            columns={[
              { key: "faixa", label: "Faixa" },
              { key: "valor", label: "Valor", align: "right", fmt: (r) => formatCurrency(r.valor) },
            ]} />
          <ReportTable title="Multas por veículo" description="Ranking por valor de multas"
            filename="multas-por-veiculo" rows={multasVeic}
            columns={[
              { key: "placa", label: "Veículo" },
              { key: "qtd", label: "Multas", align: "right" },
              { key: "valor", label: "Valor", align: "right", fmt: (r) => <span className="text-destructive">{formatCurrency(r.valor)}</span> },
            ]} />
        </TabsContent>

        {/* FROTA */}
        <TabsContent value="frota" className="space-y-4">
          <ReportTable title="Inventário da frota" description={`${veiculos.length} veículo(s) cadastrado(s)`}
            filename="inventario-frota" rows={veiculos}
            columns={[
              { key: "placa", label: "Placa" },
              { key: "marca", label: "Marca" },
              { key: "modelo", label: "Modelo" },
              { key: "ano_modelo", label: "Ano", align: "right" },
              { key: "cor", label: "Cor" },
              { key: "status", label: "Status", fmt: (v) => <Badge variant="secondary">{v.status}</Badge> },
              { key: "valor_fipe", label: "FIPE", align: "right", fmt: (v) => formatCurrency(v.valor_fipe) },
            ]} />
          <div className="grid gap-4 lg:grid-cols-2">
            <ReportTable title="Frota por status" filename="frota-por-status" rows={frotaPorStatus}
              columns={[
                { key: "status", label: "Status" },
                { key: "qtd", label: "Quantidade", align: "right" },
              ]} />
            <Card>
              <CardHeader><CardTitle className="text-base">Valor total da frota (FIPE)</CardTitle></CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(ativos.reduce((s, v) => s + (v.valor_fipe ?? 0), 0))}</div>
                <p className="text-sm text-muted-foreground">{ativos.length} veículo(s) ativo(s)</p>
              </CardContent>
            </Card>
          </div>
          <ReportTable title="Veículos com restrições" description="Alienação fiduciária, busca e apreensão, bloqueio judicial"
            filename="veiculos-restricoes" rows={restricoes}
            columns={[
              { key: "placa", label: "Placa" },
              { key: "modelo", label: "Modelo" },
              { key: "alienante", label: "Alienante", fmt: (v) => v.alienacao_fiduciaria ? (v.alienante ?? "Sim") : "—" },
              { key: "busca_apreensao", label: "Busca/apreensão", fmt: (v) => v.busca_apreensao ? <Badge variant="destructive">Sim</Badge> : "—" },
              { key: "bloqueio_judicial", label: "Bloqueio judicial", fmt: (v) => v.bloqueio_judicial ? <Badge variant="destructive">Sim</Badge> : "—" },
            ]} />
        </TabsContent>

        {/* AUDITORIA */}
        <TabsContent value="auditoria" className="space-y-4">
          <ReportTable title="Cadastros incompletos" description="Veículos sem chassi, renavam ou valor FIPE"
            filename="auditoria-cadastros-incompletos" rows={incompletos}
            columns={[
              { key: "placa", label: "Placa" },
              { key: "modelo", label: "Modelo" },
              { key: "chassi", label: "Chassi", fmt: (v) => v.chassi ? "OK" : <Badge variant="warning">Falta</Badge> },
              { key: "renavam", label: "Renavam", fmt: (v) => v.renavam ? "OK" : <Badge variant="warning">Falta</Badge> },
              { key: "valor_fipe", label: "FIPE", fmt: (v) => v.valor_fipe ? "OK" : <Badge variant="warning">Falta</Badge> },
            ]} />
          <ReportTable title="Pendências vencidas (risco financeiro)" description="Pendências com valor vencidas e ainda em aberto"
            filename="auditoria-vencidas"
            rows={pendComValor.filter((p) => (p.status === "aberta" || p.status === "em_andamento") && p.valor && vencimentoStatus(p.vencimento, p.status) === "vencida")
              .map((p) => ({ placa: p.vehicles?.placa ?? "—", categoria: p.categoria, titulo: p.titulo, vencimento: p.vencimento, valor: p.valor ?? 0 }))
              .sort((a, b) => (a.vencimento ?? "").localeCompare(b.vencimento ?? ""))}
            columns={[
              { key: "placa", label: "Veículo" },
              { key: "categoria", label: "Categoria" },
              { key: "titulo", label: "Descrição" },
              { key: "vencimento", label: "Vencimento", fmt: (r) => r.vencimento ? formatDate(r.vencimento) : "—" },
              { key: "valor", label: "Valor", align: "right", fmt: (r) => <span className="text-destructive">{formatCurrency(r.valor)}</span> },
            ]} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
