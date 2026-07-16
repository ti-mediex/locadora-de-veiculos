import {
  Wallet,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Percent,
  Car,
  FileDown,
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
  useFinanceSummary,
  useFinanceMonthly,
  useFinanceByVehicle,
} from "@/hooks/use-finance";

export default function DashboardPage() {
  const { data: summary } = useFinanceSummary();
  const { data: monthly = [] } = useFinanceMonthly(12);
  const { data: byVehicle = [] } = useFinanceByVehicle();

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
                      <TableRow key={v.vehicle_id}>
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
