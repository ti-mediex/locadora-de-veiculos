import {
  Wallet,
  TrendingUp,
  AlertTriangle,
  Car,
  Receipt,
  Percent,
  PiggyBank,
  FileText,
  Wrench,
  IdCard,
  MessageCircle,
  Bell,
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
  PieChart,
  Pie,
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
import { Button } from "@/components/ui/button";
import { formatCurrency, formatPercent, formatDate } from "@/lib/format";
import { whatsappLink, cobrancaMessage } from "@/lib/whatsapp";
import { OCCURRENCE_TYPE } from "@/lib/options";
import { format, parseISO } from "date-fns";
import {
  useDashboardSummary,
  useMonthlyCashflow,
  useVehicleProfitability,
  useUpcomingReceivables,
  useOperationalAlerts,
  useTopDebtors,
  useOccurrencesByDay,
  useOccurrencesByType,
  useFleetAggregates,
  useDailyCashflow,
} from "@/hooks/use-dashboard";

export default function DashboardPage() {
  const { data: summary } = useDashboardSummary();
  const { data: cashflow = [] } = useMonthlyCashflow(12);
  const { data: profitability = [] } = useVehicleProfitability();
  const { data: upcoming = [] } = useUpcomingReceivables();
  const { data: alerts } = useOperationalAlerts();
  const { data: topDebtors = [] } = useTopDebtors();
  const { data: occByDay = [] } = useOccurrencesByDay(30);
  const { data: occByType = [] } = useOccurrencesByType(30);
  const { data: fleet } = useFleetAggregates();
  const { data: dailyCash = [] } = useDailyCashflow();

  const dailyCashData = dailyCash.map((d) => ({
    ...d,
    label: format(parseISO(d.dia), "dd"),
  }));

  const occTypeData = occByType.map((o) => {
    const cfg = OCCURRENCE_TYPE.find((t) => t.value === o.tipo);
    return { name: cfg?.label ?? o.tipo, value: o.total, color: cfg?.color ?? "hsl(221 83% 53%)" };
  });
  const occDayData = occByDay.map((d) => ({
    ...d,
    label: typeof d.dia === "string" ? format(parseISO(d.dia), "dd/MM") : String(d.dia),
  }));

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

      {/* Operação — Ocorrências (inspirado no Blue Fleet) */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-muted-foreground">Operação</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Ocorrências por dia</CardTitle>
              <CardDescription>Últimos 30 dias, por tipo</CardDescription>
            </CardHeader>
            <CardContent>
              {occDayData.length === 0 ? (
                <EmptyState message="Sem ocorrências no período" />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={occDayData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="label" fontSize={11} />
                    <YAxis fontSize={11} allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                    <Legend />
                    {OCCURRENCE_TYPE.map((t) => (
                      <Bar
                        key={t.value}
                        dataKey={t.value}
                        name={t.label}
                        stackId="occ"
                        fill={t.color}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ocorrências por tipo</CardTitle>
              <CardDescription>Distribuição (30 dias)</CardDescription>
            </CardHeader>
            <CardContent>
              {occTypeData.length === 0 ? (
                <EmptyState message="Sem ocorrências" />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={occTypeData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                    >
                      {occTypeData.map((e, i) => (
                        <Cell key={i} fill={e.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Frota — situação e grupo (estilo Blue Fleet) */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-muted-foreground">Frota</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Veículos por situação</CardTitle>
              <CardDescription>{fleet?.total ?? 0} veículos na frota</CardDescription>
            </CardHeader>
            <CardContent>
              {!fleet || fleet.byStatus.length === 0 ? (
                <EmptyState message="Sem veículos cadastrados" />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={fleet.byStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100}>
                      {fleet.byStatus.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Veículos por grupo</CardTitle>
              <CardDescription>Distribuição por categoria</CardDescription>
            </CardHeader>
            <CardContent>
              {!fleet || fleet.byGroup.length === 0 ? (
                <EmptyState message="Sem veículos cadastrados" />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={fleet.byGroup} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100}>
                      {fleet.byGroup.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Fluxo de Caixa diário (mês corrente) */}
      <Card>
        <CardHeader>
          <CardTitle>Fluxo de Caixa diário</CardTitle>
          <CardDescription>Entradas, saídas e saldo acumulado do mês</CardDescription>
        </CardHeader>
        <CardContent>
          {dailyCashData.length === 0 ? (
            <EmptyState message="Sem movimentação no mês" />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={dailyCashData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Legend />
                <Bar dataKey="entrada" name="Entrada" fill="hsl(142 71% 45%)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="saida" name="Saída" fill="hsl(0 72% 51%)" radius={[3, 3, 0, 0]} />
                <Line type="monotone" dataKey="saldo" name="Saldo acumulado" stroke="hsl(221 83% 53%)" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

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

      {/* Alertas operacionais + Top devedores */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-warning" /> Alertas operacionais
            </CardTitle>
            <CardDescription>Itens da frota que exigem atenção</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-2 text-sm">
                <Wrench className="h-4 w-4 text-warning" /> Manutenções pendentes
              </div>
              <span className="font-semibold">{alerts?.manutencoesPendentes ?? 0}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-destructive" /> Multas a repassar
              </div>
              <span className="font-semibold">{alerts?.multasARepassar ?? 0}</span>
            </div>
            <div className="rounded-lg border p-3">
              <div className="mb-2 flex items-center gap-2 text-sm">
                <IdCard className="h-4 w-4 text-primary" /> CNH vencendo / vencida (≤30 dias)
              </div>
              {alerts?.cnhVencendo.length ? (
                <ul className="space-y-1 text-sm">
                  {alerts.cnhVencendo.map((c) => (
                    <li key={c.id} className="flex justify-between">
                      <span className="text-muted-foreground">{c.nome}</span>
                      <span>{formatDate(c.validade_cnh)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma CNH próxima do vencimento.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" /> Top devedores
            </CardTitle>
            <CardDescription>Maiores saldos em atraso — cobre em 1 clique</CardDescription>
          </CardHeader>
          <CardContent>
            {topDebtors.length === 0 ? (
              <EmptyState message="Nenhuma inadimplência no momento 🎉" />
            ) : (
              <ul className="space-y-2">
                {topDebtors.map((d) => (
                  <li key={d.nome} className="flex items-center justify-between gap-2 rounded-lg border p-3">
                    <div>
                      <div className="text-sm font-medium">{d.nome}</div>
                      <div className="text-xs text-muted-foreground">{d.cobrancas} cobrança(s) em atraso</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-destructive">{formatCurrency(d.total)}</span>
                      {d.telefone && (
                        <Button size="icon" variant="ghost" title="Cobrar via WhatsApp" asChild>
                          <a
                            href={whatsappLink(
                              d.telefone,
                              `Olá ${d.nome.split(" ")[0]}, consta um saldo em atraso de ${formatCurrency(
                                d.total
                              )} referente ao aluguel do veículo. Por favor, regularize o pagamento. 🚗`
                            )}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <MessageCircle className="h-4 w-4 text-success" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
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
                  <TableHead className="w-12"></TableHead>
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
                    <TableCell>
                      {r.contracts?.renters?.telefone && (
                        <Button size="icon" variant="ghost" title="Cobrar via WhatsApp" asChild>
                          <a
                            href={whatsappLink(
                              r.contracts.renters.telefone,
                              cobrancaMessage({
                                nome: r.contracts?.renters?.nome,
                                numeroContrato: r.contracts?.numero,
                                valor: r.valor,
                                vencimento: r.vencimento,
                                atrasado: r.status === "atrasado",
                              })
                            )}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <MessageCircle className="h-4 w-4 text-success" />
                          </a>
                        </Button>
                      )}
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
