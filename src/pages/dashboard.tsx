import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Percent,
  Car,
  FileDown,
  AlertTriangle,
  Clock,
  ChevronRight,
  Receipt,
  ShieldAlert,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  Line,
  ComposedChart,
  Cell,
} from "recharts";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatPercent } from "@/lib/format";
import { exportToCsv } from "@/lib/csv";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  useFinanceSummary,
  useFinanceMonthly,
  useFinanceByVehicle,
} from "@/hooks/use-finance";
import {
  usePendenciasSummary,
  usePendenciasFinanceirasPorVeiculo,
  usePendenciasFinanceirasResumo,
  useMultasPorVeiculo,
} from "@/hooks/use-pendencias";
import { useList } from "@/hooks/use-crud";
import type { Vehicle } from "@/types/database";

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data: summary } = useFinanceSummary();
  const { data: monthly = [] } = useFinanceMonthly(12);
  const { data: byVehicle = [] } = useFinanceByVehicle();
  const { data: pend } = usePendenciasSummary();
  const { data: finResumo } = usePendenciasFinanceirasResumo();
  const { data: finPorVeiculo = [] } = usePendenciasFinanceirasPorVeiculo();
  const { data: veiculos = [] } = useList<Vehicle>("vehicles");
  const totalAlertas = (pend?.vencidas ?? 0) + (pend?.a_vencer_7 ?? 0) + (pend?.ituran_inativos ?? 0);
  const [showFin, setShowFin] = useState(false);

  const { data: multasRank = [] } = useMultasPorVeiculo();

  const restricaoCritica = useMemo(
    () => veiculos.filter((v) => v.busca_apreensao || v.bloqueio_judicial),
    [veiculos]
  );
  const alienados = useMemo(() => veiculos.filter((v) => v.alienacao_fiduciaria).length, [veiculos]);

  // Indicadores de gestão da frota (computados a partir dos veículos ativos)
  const ativos = useMemo(() => veiculos.filter((v) => v.status !== "inativo"), [veiculos]);
  const valorFrota = useMemo(() => ativos.reduce((s, v) => s + (v.valor_fipe ?? 0), 0), [ativos]);
  const disponiveis = useMemo(() => veiculos.filter((v) => v.status === "disponivel").length, [veiculos]);
  const idadeMedia = useMemo(() => {
    const anoAtual = new Date().getFullYear();
    const anos = ativos.map((v) => v.ano_modelo).filter((a): a is number => !!a && a > 1990 && a <= anoAtual + 1);
    if (!anos.length) return null;
    return anoAtual - anos.reduce((s, a) => s + a, 0) / anos.length;
  }, [ativos]);
  const totalMultasFrota = useMemo(() => multasRank.reduce((s, m) => s + m.valor, 0), [multasRank]);

  const topVehicles = byVehicle.slice(0, 8).map((v) => ({ nome: v.placa, resultado: v.resultado }));

  function exportVehicles() {
    exportToCsv(
      "resultado-por-veiculo",
      byVehicle.map((v) => ({ placa: v.placa, modelo: v.modelo, receita: v.receita, despesa: v.despesa, resultado: v.resultado })),
      [
        { key: "placa", label: "Placa" },
        { key: "modelo", label: "Modelo" },
        { key: "receita", label: "Receita" },
        { key: "despesa", label: "Despesa" },
        { key: "resultado", label: "Resultado" },
      ]
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard financeiro"
        description="Receitas e despesas da frota — resultado por veículo"
      />

      {/* Faixa de alertas de pendências */}
      {totalAlertas > 0 && (
        <button
          type="button"
          onClick={() => navigate("/pendencias")}
          className="flex w-full items-center gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-left transition-colors hover:bg-warning/20"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
          <div className="flex flex-1 flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="font-medium">Alertas de pendências:</span>
            {(pend?.vencidas ?? 0) > 0 && (
              <span className="text-destructive">{pend?.vencidas} vencida{pend?.vencidas! > 1 ? "s" : ""}</span>
            )}
            {(pend?.a_vencer_7 ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{pend?.a_vencer_7} a vencer em 7 dias</span>
            )}
            {(pend?.ituran_inativos ?? 0) > 0 && (
              <span>{pend?.ituran_inativos} rastreador(es) Ituran inativo(s)</span>
            )}
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      )}

      {/* KPIs do mês */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Receita (mês)" value={formatCurrency(summary?.receita_mes)} tone="success" icon={<TrendingUp className="h-5 w-5" />} />
        <StatCard title="Despesa (mês)" value={formatCurrency(summary?.despesa_mes)} tone="destructive" icon={<TrendingDown className="h-5 w-5" />} />
        <StatCard
          title="Lucro (mês)"
          value={formatCurrency(summary?.lucro_mes)}
          hint={`Margem: ${formatPercent(summary?.margem_mes)}`}
          tone={summary && summary.lucro_mes >= 0 ? "success" : "destructive"}
          icon={<PiggyBank className="h-5 w-5" />}
        />
        <StatCard title="Veículos na frota" value={summary?.total_veiculos ?? 0} icon={<Car className="h-5 w-5" />} />
      </div>

      {/* Acumulado */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Receita acumulada" value={formatCurrency(summary?.receita_total)} icon={<Wallet className="h-5 w-5" />} />
        <StatCard title="Despesa acumulada" value={formatCurrency(summary?.despesa_total)} tone="warning" icon={<Wallet className="h-5 w-5" />} />
        <StatCard
          title="Resultado acumulado"
          value={formatCurrency(summary?.lucro_total)}
          tone={summary && summary.lucro_total >= 0 ? "success" : "destructive"}
          icon={<Percent className="h-5 w-5" />}
        />
      </div>

      {/* Gestão de pendências e riscos */}
      <div className="grid gap-4 sm:grid-cols-3">
        <button type="button" onClick={() => setShowFin(true)} className="text-left">
          <StatCard
            title="Pendências financeiras (em aberto)"
            value={formatCurrency(finResumo?.total ?? 0)}
            hint={`${finPorVeiculo.length} veículo(s) · clique para detalhar`}
            tone="warning"
            icon={<Receipt className="h-5 w-5" />}
          />
        </button>
        <button type="button" onClick={() => setShowFin(true)} className="text-left">
          <StatCard
            title="Financeiro vencido"
            value={formatCurrency(finResumo?.vencido ?? 0)}
            hint="IPVA, multas, taxas e seguros vencidos"
            tone="destructive"
            icon={<AlertTriangle className="h-5 w-5" />}
          />
        </button>
        <button type="button" onClick={() => navigate("/veiculos")} className="text-left">
          <StatCard
            title="Restrições críticas"
            value={restricaoCritica.length}
            hint={`${alienados} alienado(s) · busca/apreensão e bloqueio judicial`}
            tone={restricaoCritica.length > 0 ? "destructive" : undefined}
            icon={<ShieldAlert className="h-5 w-5" />}
          />
        </button>
      </div>

      {/* Detalhamento das pendências financeiras por veículo */}
      <Dialog open={showFin} onOpenChange={setShowFin}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Pendências financeiras por veículo — total {formatCurrency(finResumo?.total ?? 0)}</DialogTitle>
          </DialogHeader>
          {finPorVeiculo.length === 0 ? (
            <EmptyState message="Nenhuma pendência financeira em aberto" />
          ) : (
            <div className="max-h-[60vh] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Veículo</TableHead>
                    <TableHead className="text-right">Itens</TableHead>
                    <TableHead className="text-right">Vencido</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {finPorVeiculo.map((v) => (
                    <TableRow key={v.vehicle_id} className="cursor-pointer" onClick={() => { setShowFin(false); navigate(`/pendencias?veiculo=${encodeURIComponent(v.placa)}`); }}>
                      <TableCell><span className="font-mono font-medium">{v.placa}</span> <span className="text-xs text-muted-foreground">{v.modelo}</span></TableCell>
                      <TableCell className="text-right">{v.qtd}</TableCell>
                      <TableCell className="text-right text-destructive">{v.vencido > 0 ? formatCurrency(v.vencido) : "—"}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(v.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Indicadores da frota */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Valor da frota (FIPE)" value={formatCurrency(valorFrota)} hint={`${ativos.length} veículo(s) ativo(s)`} icon={<Wallet className="h-5 w-5" />} />
        <StatCard title="Idade média da frota" value={idadeMedia != null ? `${idadeMedia.toFixed(1)} anos` : "—"} icon={<Clock className="h-5 w-5" />} />
        <StatCard title="Frota disponível" value={`${disponiveis}/${veiculos.length}`} hint="disponíveis / total" icon={<Car className="h-5 w-5" />} />
        <StatCard title="Multas (valor total)" value={formatCurrency(totalMultasFrota)} hint={`${multasRank.length} veículo(s) com multa`} tone={totalMultasFrota > 0 ? "warning" : undefined} icon={<Receipt className="h-5 w-5" />} />
      </div>

      {/* Ranking: veículos com mais multas */}
      {multasRank.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Veículos com mais multas</CardTitle>
            <CardDescription>Ranking por valor — clique para ver as multas</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-80 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Veículo</TableHead>
                    <TableHead className="text-right">Multas</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {multasRank.slice(0, 10).map((m) => (
                    <TableRow key={m.vehicle_id} className="cursor-pointer" onClick={() => navigate(`/pendencias?veiculo=${encodeURIComponent(m.placa)}`)}>
                      <TableCell><span className="font-mono font-medium">{m.placa}</span> <span className="text-xs text-muted-foreground">{m.modelo}</span></TableCell>
                      <TableCell className="text-right">{m.qtd}</TableCell>
                      <TableCell className="text-right font-semibold text-destructive">{formatCurrency(m.valor)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Receita x Despesa mensal */}
      <Card>
        <CardHeader>
          <CardTitle>Receita x Despesa</CardTitle>
          <CardDescription>Últimos 12 meses (com resultado)</CardDescription>
        </CardHeader>
        <CardContent>
          {monthly.length === 0 ? (
            <EmptyState message="Sem movimentação" />
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="mes" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Legend />
                <Bar dataKey="receita" name="Receita" fill="hsl(142 71% 45%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="despesa" name="Despesa" fill="hsl(0 72% 51%)" radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="resultado" name="Resultado" stroke="hsl(221 83% 53%)" strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Resultado por veículo */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Resultado por veículo</CardTitle>
            <CardDescription>Receita − despesa (Top 8)</CardDescription>
          </CardHeader>
          <CardContent>
            {topVehicles.length === 0 ? (
              <EmptyState message="Sem veículos" />
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={topVehicles} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" fontSize={11} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="nome" fontSize={11} width={70} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="resultado" name="Resultado" radius={[0, 4, 4, 0]}>
                    {topVehicles.map((e, i) => (
                      <Cell key={i} fill={e.resultado >= 0 ? "hsl(142 71% 45%)" : "hsl(0 72% 51%)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Detalhe por veículo</CardTitle>
              <CardDescription>Receita, despesa e resultado</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={exportVehicles}><FileDown className="h-4 w-4" /> CSV</Button>
          </CardHeader>
          <CardContent className="p-0">
            {byVehicle.length === 0 ? (
              <EmptyState message="Sem dados" />
            ) : (
              <div className="max-h-80 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Placa</TableHead>
                      <TableHead className="text-right">Receita</TableHead>
                      <TableHead className="text-right">Despesa</TableHead>
                      <TableHead className="text-right">Resultado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byVehicle.map((v) => (
                      <TableRow
                        key={v.vehicle_id}
                        className="cursor-pointer"
                        onClick={() => navigate(`/pendencias?veiculo=${encodeURIComponent(v.placa)}`)}
                      >
                        <TableCell className="font-mono font-medium">{v.placa}</TableCell>
                        <TableCell className="text-right text-success">{formatCurrency(v.receita)}</TableCell>
                        <TableCell className="text-right text-destructive">{formatCurrency(v.despesa)}</TableCell>
                        <TableCell className={`text-right font-semibold ${v.resultado >= 0 ? "text-success" : "text-destructive"}`}>
                          {formatCurrency(v.resultado)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
