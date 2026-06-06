import {
  Wallet,
  TrendingUp,
  AlertTriangle,
  Car,
  Receipt,
  Percent,
  PiggyBank,
  FileText,
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
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
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
import { formatCurrency, formatPercent, formatDate } from "@/lib/format";
import {
  useDashboardSummary,
  useMonthlyCashflow,
  useVehicleProfitability,
  useUpcomingReceivables,
} from "@/hooks/use-dashboard";

export default function DashboardPage() {
  const { data: summary } = useDashboardSummary();
  const { data: cashflow = [] } = useMonthlyCashflow(12);
  const { data: profitability = [] } = useVehicleProfitability();
  const { data: upcoming = [] } = useUpcomingReceivables();

  const topVeiculos = profitability.slice(0, 6).map((v) => ({
    nome: v.placa,
    resultado: Number(v.resultado),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Visão financeira consolidada da operação no mês corrente"
      />

      {/* KPIs principais */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Receita recebida (mês)"
          value={formatCurrency(summary?.receita_recebida)}
          hint={`Prevista: ${formatCurrency(summary?.receita_prevista)}`}
          icon={<Wallet className="h-5 w-5" />}
          tone="success"
        />
        <StatCard
          title="Lucro líquido (mês)"
          value={formatCurrency(summary?.lucro_liquido)}
          hint="Receita − despesas − manutenção − multas"
          icon={<PiggyBank className="h-5 w-5" />}
          tone={summary && summary.lucro_liquido >= 0 ? "success" : "destructive"}
        />
        <StatCard
          title="Inadimplência"
          value={formatCurrency(summary?.inadimplencia_valor)}
          hint={`${formatPercent(summary?.inadimplencia_pct)} do previsto`}
          icon={<AlertTriangle className="h-5 w-5" />}
          tone="destructive"
        />
        <StatCard
          title="Taxa de ocupação"
          value={formatPercent(summary?.taxa_ocupacao)}
          hint={`${summary?.veiculos_locados ?? 0} de ${summary?.total_veiculos ?? 0} veículos locados`}
          icon={<Percent className="h-5 w-5" />}
          tone="default"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Contratos ativos"
          value={summary?.contratos_ativos ?? 0}
          icon={<FileText className="h-5 w-5" />}
        />
        <StatCard
          title="Ticket médio"
          value={formatCurrency(summary?.ticket_medio)}
          hint="Aluguel médio por contrato"
          icon={<Receipt className="h-5 w-5" />}
        />
        <StatCard
          title="Despesas (mês)"
          value={formatCurrency((summary?.despesas ?? 0) + (summary?.manutencao ?? 0))}
          hint={`Manutenção: ${formatCurrency(summary?.manutencao)}`}
          icon={<TrendingUp className="h-5 w-5" />}
          tone="warning"
        />
        <StatCard
          title="Frota total"
          value={summary?.total_veiculos ?? 0}
          hint="Veículos ativos na frota"
          icon={<Car className="h-5 w-5" />}
        />
      </div>

      {/* Gráficos */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Receita x Despesa</CardTitle>
            <CardDescription>Últimos 12 meses</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={cashflow}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="mes" fontSize={11} />
                <YAxis
                  fontSize={11}
                  tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(v: number) => formatCurrency(v)}
                  labelClassName="text-foreground"
                  contentStyle={{ borderRadius: 8, fontSize: 12 }}
                />
                <Legend />
                <Bar dataKey="receita" name="Receita" fill="hsl(142 71% 45%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="despesa" name="Despesa" fill="hsl(0 72% 51%)" radius={[4, 4, 0, 0]} />
                <Line
                  type="monotone"
                  dataKey="resultado"
                  name="Resultado"
                  stroke="hsl(221 83% 53%)"
                  strokeWidth={2}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rentabilidade por veículo</CardTitle>
            <CardDescription>Resultado acumulado (receita − custos)</CardDescription>
          </CardHeader>
          <CardContent>
            {topVeiculos.length === 0 ? (
              <EmptyState message="Sem dados de rentabilidade ainda" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topVeiculos} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    type="number"
                    fontSize={11}
                    tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                  />
                  <YAxis type="category" dataKey="nome" fontSize={11} width={70} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="resultado" name="Resultado" radius={[0, 4, 4, 0]}>
                    {topVeiculos.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.resultado >= 0 ? "hsl(142 71% 45%)" : "hsl(0 72% 51%)"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Próximos vencimentos / atrasos */}
      <Card>
        <CardHeader>
          <CardTitle>Cobranças a vencer e em atraso</CardTitle>
          <CardDescription>Acompanhe o que precisa ser recebido</CardDescription>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <EmptyState message="Nenhuma cobrança pendente" icon={<Receipt className="h-6 w-6" />} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contrato</TableHead>
                  <TableHead>Locatário</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {upcoming.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.contracts?.numero}</TableCell>
                    <TableCell>{r.contracts?.renters?.nome}</TableCell>
                    <TableCell>{formatDate(r.vencimento)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(r.valor)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
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
