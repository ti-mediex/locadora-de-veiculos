import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { FileDown, BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
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
import { useVehicleProfitability, useMonthlyCashflow } from "@/hooks/use-dashboard";
import { useList } from "@/hooks/use-crud";
import { formatCurrency } from "@/lib/format";
import { exportToCsv } from "@/lib/csv";
import type { Expense } from "@/types/database";

const PIE_COLORS = [
  "hsl(221 83% 53%)",
  "hsl(142 71% 45%)",
  "hsl(38 92% 50%)",
  "hsl(0 72% 51%)",
  "hsl(280 65% 60%)",
  "hsl(190 80% 45%)",
  "hsl(20 80% 55%)",
  "hsl(330 70% 55%)",
];

export default function ReportsPage() {
  const { data: profitability = [] } = useVehicleProfitability();
  const { data: cashflow = [] } = useMonthlyCashflow(12);
  const { data: expenses = [] } = useList<Expense>("expenses");

  const despesasPorCategoria = Object.values(
    expenses
      .filter((e) => e.status !== "cancelado")
      .reduce<Record<string, { name: string; value: number }>>((acc, e) => {
        acc[e.categoria] = acc[e.categoria] ?? { name: e.categoria, value: 0 };
        acc[e.categoria].value += e.valor;
        return acc;
      }, {})
  );

  function exportProfitability() {
    exportToCsv(
      "rentabilidade-por-veiculo",
      profitability.map((v) => ({
        placa: v.placa,
        modelo: v.modelo,
        receita: v.receita,
        manutencao: v.manutencao,
        multas: v.multas,
        resultado: v.resultado,
      })),
      [
        { key: "placa", label: "Placa" },
        { key: "modelo", label: "Modelo" },
        { key: "receita", label: "Receita" },
        { key: "manutencao", label: "Manutenção" },
        { key: "multas", label: "Multas" },
        { key: "resultado", label: "Resultado" },
      ]
    );
  }

  function exportCashflow() {
    exportToCsv("fluxo-de-caixa", cashflow, [
      { key: "mes", label: "Mês" },
      { key: "receita", label: "Receita" },
      { key: "despesa", label: "Despesa" },
      { key: "resultado", label: "Resultado" },
    ]);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Relatórios" description="Análises financeiras e exportação de dados" />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Fluxo de caixa</CardTitle>
              <CardDescription>Receita x despesa nos últimos 12 meses</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={exportCashflow}>
              <FileDown className="h-4 w-4" /> CSV
            </Button>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={cashflow}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="mes" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Legend />
                <Bar dataKey="receita" name="Receita" fill="hsl(142 71% 45%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="despesa" name="Despesa" fill="hsl(0 72% 51%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Composição de despesas</CardTitle>
            <CardDescription>Distribuição por categoria</CardDescription>
          </CardHeader>
          <CardContent>
            {despesasPorCategoria.length === 0 ? (
              <EmptyState message="Sem despesas para exibir" />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={despesasPorCategoria}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={(e) => e.name}
                  >
                    {despesasPorCategoria.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Rentabilidade por veículo</CardTitle>
            <CardDescription>Receita acumulada menos custos diretos</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={exportProfitability}>
            <FileDown className="h-4 w-4" /> CSV
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {profitability.length === 0 ? (
            <EmptyState message="Sem dados de rentabilidade" icon={<BarChart3 className="h-6 w-6" />} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Placa</TableHead>
                  <TableHead>Veículo</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                  <TableHead className="text-right">Manutenção</TableHead>
                  <TableHead className="text-right">Multas</TableHead>
                  <TableHead className="text-right">Resultado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profitability.map((v) => (
                  <TableRow key={v.vehicle_id}>
                    <TableCell className="font-mono font-medium">{v.placa}</TableCell>
                    <TableCell>{v.modelo}</TableCell>
                    <TableCell className="text-right text-success">{formatCurrency(v.receita)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(v.manutencao)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(v.multas)}</TableCell>
                    <TableCell className={`text-right font-semibold ${Number(v.resultado) >= 0 ? "text-success" : "text-destructive"}`}>
                      {formatCurrency(v.resultado)}
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
