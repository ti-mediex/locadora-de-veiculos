import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Wallet, TrendingUp, TrendingDown, PiggyBank, Percent, Car, FileDown,
  AlertTriangle, Clock, ChevronRight, Receipt, ShieldAlert,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  Legend, Line, ComposedChart, Cell,
} from "recharts";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency, formatPercent } from "@/lib/format";
import { exportToCsv } from "@/lib/csv";
import { useFinanceEntries } from "@/hooks/use-finance";
import { usePendencias, vencimentoStatus } from "@/hooks/use-pendencias";
import { useList } from "@/hooks/use-crud";
import type { Vehicle } from "@/types/database";

export default function DashboardPage() {
  const navigate = useNavigate();
  const [fVeiculo, setFVeiculo] = useState("todos");
  const [fSituacao, setFSituacao] = useState<"ativos" | "todos">("ativos");
  const [showFin, setShowFin] = useState(false);

  const { data: entries = [] } = useFinanceEntries();
  const { data: pendAll = [] } = usePendencias();
  const { data: veiculosAll = [] } = useList<Vehicle>("vehicles");

  const ativosSet = useMemo(() => new Set(veiculosAll.filter((v) => v.status !== "inativo").map((v) => v.id)), [veiculosAll]);
  const vMap = useMemo(() => new Map(veiculosAll.map((v) => [v.id, v])), [veiculosAll]);
  const incluiVeiculo = (vehicleId: string | null) => {
    if (fVeiculo !== "todos") return vehicleId === fVeiculo;
    if (fSituacao === "ativos") return vehicleId === null || ativosSet.has(vehicleId);
    return true;
  };

  const entriesF = useMemo(() => entries.filter((e) => incluiVeiculo(e.vehicle_id)), [entries, fVeiculo, fSituacao, ativosSet]);
  const pendF = useMemo(() => pendAll.filter((p) => incluiVeiculo(p.vehicle_id)), [pendAll, fVeiculo, fSituacao, ativosSet]);
  const veiculos = useMemo(() => veiculosAll.filter((v) => (fVeiculo !== "todos" ? v.id === fVeiculo : fSituacao === "ativos" ? v.status !== "inativo" : true)), [veiculosAll, fVeiculo, fSituacao]);

  // ---- KPIs financeiros ----
  const now = new Date();
  const ymAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const fin = useMemo(() => {
    let recMes = 0, despMes = 0, recTot = 0, despTot = 0;
    for (const e of entriesF) {
      const noMes = e.data.slice(0, 7) === ymAtual;
      if (e.tipo === "receita") { recTot += e.valor; if (noMes) recMes += e.valor; }
      else { despTot += e.valor; if (noMes) despMes += e.valor; }
    }
    return {
      recMes, despMes, lucroMes: recMes - despMes, margemMes: recMes > 0 ? (recMes - despMes) / recMes : 0,
      recTot, despTot, lucroTot: recTot - despTot,
    };
  }, [entriesF, ymAtual]);

  const monthly = useMemo(() => {
    const meses: { mes: string; ym: string; receita: number; despesa: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      meses.push({ mes: d.toLocaleDateString("pt-BR", { month: "short" }), ym: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, receita: 0, despesa: 0 });
    }
    const map = new Map(meses.map((m) => [m.ym, m]));
    for (const e of entriesF) {
      const m = map.get(e.data.slice(0, 7));
      if (m) { if (e.tipo === "receita") m.receita += e.valor; else m.despesa += e.valor; }
    }
    return meses.map((m) => ({ mes: m.mes, receita: m.receita, despesa: m.despesa, resultado: m.receita - m.despesa }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entriesF]);

  const byVehicle = useMemo(() => {
    const map = new Map<string, { vehicle_id: string; placa: string; modelo: string; receita: number; despesa: number }>();
    for (const e of entriesF) {
      if (!e.vehicle_id) continue;
      const v = vMap.get(e.vehicle_id);
      const cur = map.get(e.vehicle_id) ?? { vehicle_id: e.vehicle_id, placa: e.placa ?? v?.placa ?? "—", modelo: v?.modelo ?? "", receita: 0, despesa: 0 };
      if (e.tipo === "receita") cur.receita += e.valor; else cur.despesa += e.valor;
      map.set(e.vehicle_id, cur);
    }
    return [...map.values()].map((v) => ({ ...v, resultado: v.receita - v.despesa })).sort((a, b) => b.resultado - a.resultado);
  }, [entriesF, vMap]);
  const topVehicles = byVehicle.slice(0, 8).map((v) => ({ nome: v.placa, resultado: v.resultado }));

  // ---- Pendências ----
  const alertas = useMemo(() => {
    let vencidas = 0, a_vencer_7 = 0, ituran = 0;
    for (const p of pendF) {
      if (p.status === "resolvida" || p.status === "cancelada") { if (/ituran/i.test(p.categoria) && p.ativo === false) ituran++; continue; }
      const s = vencimentoStatus(p.vencimento, p.status);
      if (s === "vencida") vencidas++; else if (s === "vence7") a_vencer_7++;
      if (/ituran/i.test(p.categoria) && p.ativo === false) ituran++;
    }
    return { vencidas, a_vencer_7, ituran };
  }, [pendF]);
  const totalAlertas = alertas.vencidas + alertas.a_vencer_7 + alertas.ituran;

  // Restrições Detran (categoria "Restrição") por natureza.
  const restricoes = useMemo(() => {
    const veic = new Set<string>(), veicJud = new Set<string>();
    for (const p of pendF) {
      if (p.categoria !== "Restrição" || p.status === "cancelada" || p.status === "resolvida") continue;
      veic.add(p.vehicle_id);
      if (/judicial|renajud|busca e apreens|penhor|bloqueio/i.test(p.titulo)) veicJud.add(p.vehicle_id);
    }
    return { veic: veic.size, veicJud: veicJud.size };
  }, [pendF]);

  const finPorVeiculo = useMemo(() => {
    const map = new Map<string, { vehicle_id: string; placa: string; modelo: string; total: number; vencido: number; qtd: number }>();
    for (const p of pendF) {
      if (!(p.status === "aberta" || p.status === "em_andamento") || !p.valor) continue;
      const cur = map.get(p.vehicle_id) ?? { vehicle_id: p.vehicle_id, placa: p.vehicles?.placa ?? "—", modelo: p.vehicles?.modelo ?? "", total: 0, vencido: 0, qtd: 0 };
      cur.total += p.valor; cur.qtd += 1;
      if (vencimentoStatus(p.vencimento, p.status) === "vencida") cur.vencido += p.valor;
      map.set(p.vehicle_id, cur);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [pendF]);
  const finTotal = useMemo(() => finPorVeiculo.reduce((s, v) => s + v.total, 0), [finPorVeiculo]);
  const finVencido = useMemo(() => finPorVeiculo.reduce((s, v) => s + v.vencido, 0), [finPorVeiculo]);

  const multasRank = useMemo(() => {
    const map = new Map<string, { vehicle_id: string; placa: string; modelo: string; qtd: number; valor: number }>();
    for (const p of pendF) {
      if (!/multa/i.test(p.categoria) || p.status === "cancelada") continue;
      const cur = map.get(p.vehicle_id) ?? { vehicle_id: p.vehicle_id, placa: p.vehicles?.placa ?? "—", modelo: p.vehicles?.modelo ?? "", qtd: 0, valor: 0 };
      cur.qtd += 1; cur.valor += p.valor ?? 0;
      map.set(p.vehicle_id, cur);
    }
    return [...map.values()].filter((m) => m.valor > 0 || m.qtd > 0).sort((a, b) => b.valor - a.valor);
  }, [pendF]);
  const totalMultasFrota = useMemo(() => multasRank.reduce((s, m) => s + m.valor, 0), [multasRank]);

  // ---- Frota ----
  const ativos = useMemo(() => veiculos.filter((v) => v.status !== "inativo"), [veiculos]);
  const valorFrota = useMemo(() => ativos.reduce((s, v) => s + (v.valor_fipe ?? 0), 0), [ativos]);
  const disponiveis = useMemo(() => veiculos.filter((v) => v.status === "disponivel").length, [veiculos]);
  const restricaoCritica = useMemo(() => veiculos.filter((v) => v.busca_apreensao || v.bloqueio_judicial), [veiculos]);
  const alienados = useMemo(() => veiculos.filter((v) => v.alienacao_fiduciaria).length, [veiculos]);
  const idadeMedia = useMemo(() => {
    const anoAtual = now.getFullYear();
    const anos = ativos.map((v) => v.ano_modelo).filter((a): a is number => !!a && a > 1990 && a <= anoAtual + 1);
    if (!anos.length) return null;
    return anoAtual - anos.reduce((s, a) => s + a, 0) / anos.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativos]);

  const escopoLabel = fVeiculo !== "todos" ? (vMap.get(fVeiculo)?.placa ?? "veículo") : fSituacao === "ativos" ? "frota ativa" : "frota completa";

  function exportVehicles() {
    exportToCsv("resultado-por-veiculo",
      byVehicle.map((v) => ({ placa: v.placa, modelo: v.modelo, receita: v.receita, despesa: v.despesa, resultado: v.resultado })),
      [{ key: "placa", label: "Placa" }, { key: "modelo", label: "Modelo" }, { key: "receita", label: "Receita" }, { key: "despesa", label: "Despesa" }, { key: "resultado", label: "Resultado" }]);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard financeiro" description={`Visão da ${escopoLabel} — receitas, despesas e pendências`} />

      {/* Filtros de escopo */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border p-3 sm:p-4">
        <div className="w-full sm:w-auto">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Veículo</label>
          <Select value={fVeiculo} onValueChange={setFVeiculo}>
            <SelectTrigger className="w-full sm:w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Frota toda</SelectItem>
              {veiculosAll.map((v) => <SelectItem key={v.id} value={v.id}>{v.placa} — {v.modelo}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-auto">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Situação</label>
          <Select value={fSituacao} onValueChange={(v) => setFSituacao(v as "ativos" | "todos")} disabled={fVeiculo !== "todos"}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ativos">Somente ativos</SelectItem>
              <SelectItem value="todos">Todos os veículos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Faixa de alertas de pendências */}
      {totalAlertas > 0 && (
        <button type="button" onClick={() => navigate("/pendencias")}
          className="flex w-full items-center gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-left transition-colors hover:bg-warning/20">
          <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
          <div className="flex flex-1 flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="font-medium">Alertas de pendências:</span>
            {alertas.vencidas > 0 && <span className="text-destructive">{alertas.vencidas} vencida{alertas.vencidas > 1 ? "s" : ""}</span>}
            {alertas.a_vencer_7 > 0 && <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{alertas.a_vencer_7} a vencer em 7 dias</span>}
            {alertas.ituran > 0 && <span>{alertas.ituran} rastreador(es) Ituran inativo(s)</span>}
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      )}

      {/* Faixa de restrições Detran */}
      {restricoes.veic > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-3">
            <ShieldAlert className="h-5 w-5 shrink-0 text-destructive" />
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="font-medium">Restrições Detran:</span>
              <span>{restricoes.veic} veículo(s) com restrição</span>
              {restricoes.veicJud > 0 && (
                <span className="text-destructive">{restricoes.veicJud} com restrição judicial / RENAJUD</span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/pendencias?restr=todas")}>
              Ver restrições <ChevronRight className="h-4 w-4" />
            </Button>
            {restricoes.veicJud > 0 && (
              <Button variant="destructive" size="sm" onClick={() => navigate("/pendencias?restr=judicial")}>
                Judiciais / RENAJUD <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* KPIs do mês */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Receita (mês)" value={formatCurrency(fin.recMes)} tone="success" icon={<TrendingUp className="h-5 w-5" />} />
        <StatCard title="Despesa (mês)" value={formatCurrency(fin.despMes)} tone="destructive" icon={<TrendingDown className="h-5 w-5" />} />
        <StatCard title="Lucro (mês)" value={formatCurrency(fin.lucroMes)} hint={`Margem: ${formatPercent(fin.margemMes)}`} tone={fin.lucroMes >= 0 ? "success" : "destructive"} icon={<PiggyBank className="h-5 w-5" />} />
        <StatCard title="Veículos no escopo" value={veiculos.length} icon={<Car className="h-5 w-5" />} />
      </div>

      {/* Acumulado */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Receita acumulada" value={formatCurrency(fin.recTot)} icon={<Wallet className="h-5 w-5" />} />
        <StatCard title="Despesa acumulada" value={formatCurrency(fin.despTot)} tone="warning" icon={<Wallet className="h-5 w-5" />} />
        <StatCard title="Resultado acumulado" value={formatCurrency(fin.lucroTot)} tone={fin.lucroTot >= 0 ? "success" : "destructive"} icon={<Percent className="h-5 w-5" />} />
      </div>

      {/* Gestão de pendências e riscos */}
      <div className="grid gap-4 sm:grid-cols-3">
        <button type="button" onClick={() => setShowFin(true)} className="text-left">
          <StatCard title="Pendências financeiras (em aberto)" value={formatCurrency(finTotal)} hint={`${finPorVeiculo.length} veículo(s) · clique para detalhar`} tone="warning" icon={<Receipt className="h-5 w-5" />} />
        </button>
        <button type="button" onClick={() => setShowFin(true)} className="text-left">
          <StatCard title="Financeiro vencido" value={formatCurrency(finVencido)} hint="IPVA, multas, taxas e seguros vencidos" tone="destructive" icon={<AlertTriangle className="h-5 w-5" />} />
        </button>
        <button type="button" onClick={() => navigate("/veiculos")} className="text-left">
          <StatCard title="Restrições críticas" value={restricaoCritica.length} hint={`${alienados} alienado(s) · busca/apreensão e bloqueio judicial`} tone={restricaoCritica.length > 0 ? "destructive" : undefined} icon={<ShieldAlert className="h-5 w-5" />} />
        </button>
      </div>

      {/* Detalhamento das pendências financeiras por veículo */}
      <Dialog open={showFin} onOpenChange={setShowFin}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Pendências financeiras por veículo — total {formatCurrency(finTotal)}</DialogTitle>
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
        <StatCard title="Frota disponível" value={`${disponiveis}/${veiculos.length}`} hint="disponíveis / no escopo" icon={<Car className="h-5 w-5" />} />
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
                    {topVehicles.map((e, i) => (<Cell key={i} fill={e.resultado >= 0 ? "hsl(142 71% 45%)" : "hsl(0 72% 51%)"} />))}
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
                      <TableRow key={v.vehicle_id} className="cursor-pointer" onClick={() => navigate(`/pendencias?veiculo=${encodeURIComponent(v.placa)}`)}>
                        <TableCell className="font-mono font-medium">{v.placa}</TableCell>
                        <TableCell className="text-right text-success">{formatCurrency(v.receita)}</TableCell>
                        <TableCell className="text-right text-destructive">{formatCurrency(v.despesa)}</TableCell>
                        <TableCell className={`text-right font-semibold ${v.resultado >= 0 ? "text-success" : "text-destructive"}`}>{formatCurrency(v.resultado)}</TableCell>
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
