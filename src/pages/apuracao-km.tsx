import { useMemo, useState } from "react";
import {
  Gauge, Route, CalendarClock, Wrench, AlertTriangle, Upload, FileDown,
  TrendingUp, ParkingCircle, ChevronLeft, FileText,
} from "lucide-react";
import { toast } from "sonner";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from "recharts";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatNumber } from "@/lib/format";
import { exportToCsv } from "@/lib/csv";
import { useKmDiario, type KmDiaRow } from "@/hooks/use-km";
import { useAppConfig } from "@/hooks/use-app-config";
import { useCanWrite } from "@/hooks/use-can-write";
import { useList } from "@/hooks/use-crud";
import { ImportarIturanDialog } from "@/components/km/importar-ituran-dialog";
import { abrirRelatorioKm } from "@/lib/relatorio-km";
import { RelatorioExport } from "@/components/shared/relatorio-export";
import { VehicleStatusBadge, statusVeiculoLabel } from "@/components/shared/vehicle-status-badge";
import type { RelatorioTabelaData, RelColuna } from "@/lib/relatorio-tabela";
import type { Vehicle } from "@/types/database";

type Gran = "dia" | "semana" | "mes" | "ano";

const km0 = (n: number) => `${formatNumber(Math.round(n))} km`;

/** Chave/rótulo de agrupamento temporal a partir de uma data YYYY-MM-DD. */
function bucket(dia: string, g: Gran): { key: string; label: string } {
  const [y, m, d] = dia.split("-").map(Number);
  if (g === "ano") return { key: `${y}`, label: `${y}` };
  if (g === "mes") return { key: `${y}-${String(m).padStart(2, "0")}`, label: `${String(m).padStart(2, "0")}/${y}` };
  if (g === "semana") {
    const dt = new Date(Date.UTC(y, m - 1, d));
    const day = dt.getUTCDay() || 7;
    dt.setUTCDate(dt.getUTCDate() + 4 - day);
    const yStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((dt.getTime() - yStart.getTime()) / 86400000 + 1) / 7);
    return { key: `${dt.getUTCFullYear()}-S${String(week).padStart(2, "0")}`, label: `S${String(week).padStart(2, "0")}/${dt.getUTCFullYear()}` };
  }
  return { key: dia, label: `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}` };
}

export default function ApuracaoKmPage() {
  const podeEscrever = useCanWrite("pendencias");
  const { data: config } = useAppConfig();
  const { data: veiculos = [] } = useList<Vehicle>("vehicles");

  const [fVeiculo, setFVeiculo] = useState("todos");
  const [ini, setIni] = useState("");
  const [fim, setFim] = useState("");
  const [mes, setMes] = useState(""); // "YYYY-MM" — atalho de mês específico
  const [gran, setGran] = useState<Gran>("mes");
  const [tab, setTab] = useState("geral");
  const [showImport, setShowImport] = useState(false);

  // Seleciona um mês específico (ex.: janeiro/2026) definindo o período de/até.
  function aplicarMes(m: string) {
    setMes(m);
    if (m) {
      const [y, mm] = m.split("-").map(Number);
      const ultimo = new Date(y, mm, 0).getDate();
      setIni(`${m}-01`);
      setFim(`${m}-${String(ultimo).padStart(2, "0")}`);
    } else {
      setIni("");
      setFim("");
    }
  }

  const vehicleId = fVeiculo === "todos" ? undefined : fVeiculo;
  const { data: rows = [], isLoading } = useKmDiario(ini || undefined, fim || undefined, vehicleId);

  const franquia = Number(config?.franquia_km_mensal ?? 6000) || 6000;
  const vMap = useMemo(() => new Map(veiculos.map((v) => [v.id, v])), [veiculos]);

  // ---- KPIs gerais ----
  const kpi = useMemo(() => {
    let kmTotal = 0, diasRodados = 0, diasParados = 0, minManut = 0;
    const diasManut = new Set<string>();
    for (const r of rows) {
      kmTotal += r.km;
      if (r.km > 0.05) diasRodados++; else diasParados++;
      minManut += r.min_ocioso_manut;
      if (r.min_ocioso_manut > 0) diasManut.add(`${r.vehicle_id}|${r.dia}`);
    }
    const dias = rows.length;
    return {
      kmTotal, dias, diasRodados, diasParados,
      kmMediaDia: diasRodados ? kmTotal / diasRodados : 0,
      minManut, diasManut: diasManut.size,
    };
  }, [rows]);

  // ---- Série temporal (gráfico clicável) ----
  const serie = useMemo(() => {
    const map = new Map<string, { key: string; label: string; km: number }>();
    for (const r of rows) {
      const b = bucket(r.dia, gran);
      const cur = map.get(b.key) ?? { key: b.key, label: b.label, km: 0 };
      cur.km += r.km;
      map.set(b.key, cur);
    }
    return [...map.values()].sort((a, b) => a.key.localeCompare(b.key)).map((x) => ({ ...x, km: Math.round(x.km) }));
  }, [rows, gran]);

  // ---- Por veículo ----
  const porVeiculo = useMemo(() => {
    const map = new Map<string, { vehicle_id: string; placa: string; modelo: string; km: number; dias: number; diasRodados: number; minManut: number; meses: Set<string> }>();
    for (const r of rows) {
      const id = r.vehicle_id ?? "sem";
      const v = r.vehicle_id ? vMap.get(r.vehicle_id) : undefined;
      const cur = map.get(id) ?? { vehicle_id: id, placa: r.placa, modelo: v?.modelo ?? "", km: 0, dias: 0, diasRodados: 0, minManut: 0, meses: new Set<string>() };
      cur.km += r.km; cur.dias++; if (r.km > 0.05) cur.diasRodados++;
      cur.minManut += r.min_ocioso_manut;
      cur.meses.add(r.dia.slice(0, 7));
      map.set(id, cur);
    }
    return [...map.values()].map((v) => ({
      ...v, mesesN: v.meses.size,
      kmMes: v.meses.size ? v.km / v.meses.size : 0,
    })).sort((a, b) => b.km - a.km);
  }, [rows, vMap]);

  // ---- KM por mês × veículo (pivô) ----
  const meses = useMemo(() => [...new Set(rows.map((r) => r.dia.slice(0, 7)))].sort(), [rows]);
  const pivot = useMemo(() => {
    const map = new Map<string, { vehicle_id: string; placa: string; modelo: string; total: number; por: Record<string, number> }>();
    for (const r of rows) {
      const id = r.vehicle_id ?? "sem";
      const cur = map.get(id) ?? { vehicle_id: id, placa: r.placa, modelo: (r.vehicle_id ? vMap.get(r.vehicle_id)?.modelo : "") ?? "", total: 0, por: {} };
      const ym = r.dia.slice(0, 7);
      cur.por[ym] = (cur.por[ym] ?? 0) + r.km;
      cur.total += r.km;
      map.set(id, cur);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [rows, vMap]);
  const totMes = useMemo(() => {
    const t: Record<string, number> = {};
    for (const p of pivot) for (const m of meses) t[m] = (t[m] ?? 0) + (p.por[m] ?? 0);
    return t;
  }, [pivot, meses]);

  // ---- Franquia por veículo × mês ----
  const franquiaRows = useMemo(() => {
    const map = new Map<string, { vehicle_id: string; placa: string; ym: string; km: number }>();
    for (const r of rows) {
      const ym = r.dia.slice(0, 7);
      const key = `${r.vehicle_id}|${ym}`;
      const cur = map.get(key) ?? { vehicle_id: r.vehicle_id ?? "sem", placa: r.placa, ym, km: 0 };
      cur.km += r.km;
      map.set(key, cur);
    }
    return [...map.values()]
      .map((x) => ({ ...x, excedente: Math.max(0, x.km - franquia) }))
      .sort((a, b) => (b.excedente - a.excedente) || b.km - a.km);
  }, [rows, franquia]);
  const excedenteTotal = useMemo(() => franquiaRows.reduce((s, r) => s + r.excedente, 0), [franquiaRows]);
  const mesesExcedidos = useMemo(() => franquiaRows.filter((r) => r.excedente > 0).length, [franquiaRows]);

  // ---- Manutenção / paralisação (desconto) por veículo ----
  const manutRows = useMemo(() => {
    const map = new Map<string, { vehicle_id: string; placa: string; min: number; dias: Set<string> }>();
    for (const r of rows) {
      if (r.min_ocioso_manut <= 0) continue;
      const cur = map.get(r.vehicle_id ?? "sem") ?? { vehicle_id: r.vehicle_id ?? "sem", placa: r.placa, min: 0, dias: new Set<string>() };
      cur.min += r.min_ocioso_manut; cur.dias.add(r.dia);
      map.set(r.vehicle_id ?? "sem", cur);
    }
    return [...map.values()].map((v) => ({ ...v, diasN: v.dias.size, horas: v.min / 60 })).sort((a, b) => b.min - a.min);
  }, [rows]);

  // ---- Detalhe diário (quando 1 veículo) ----
  const diario = useMemo(() => [...rows].sort((a, b) => b.dia.localeCompare(a.dia)), [rows]);

  const escopo = fVeiculo !== "todos" ? (vMap.get(fVeiculo)?.placa ?? "veículo") : "frota";
  const periodoLabel = ini && fim
    ? `${ini.split("-").reverse().join("/")} a ${fim.split("-").reverse().join("/")}`
    : meses.length ? `${meses[0].slice(5)}/${meses[0].slice(0, 4)} a ${meses[meses.length - 1].slice(5)}/${meses[meses.length - 1].slice(0, 4)}` : "todo o período";

  function selecionarVeiculo(id: string) {
    if (id && id !== "sem") { setFVeiculo(id); setTab("diario"); }
  }

  function exportPivot() {
    const cols = [{ key: "placa", label: "Veículo" }, ...meses.map((m) => ({ key: m, label: `${m.slice(5)}/${m.slice(0, 4)}` })), { key: "total", label: "Total (km)" }];
    const data = pivot.map((p) => {
      const row: Record<string, unknown> = { placa: p.placa, total: Math.round(p.total) };
      for (const m of meses) row[m] = Math.round(p.por[m] ?? 0);
      return row;
    });
    exportToCsv("km-mes-por-veiculo", data, cols);
  }

  function abrirRelatorio() {
    const ok = abrirRelatorioKm({
      empresa: config?.empresa_nome ?? "VIP CARS", escopo, periodo: periodoLabel, franquia,
      kpi: { kmTotal: kpi.kmTotal, diasRodados: kpi.diasRodados, diasParados: kpi.diasParados, kmMediaDia: kpi.kmMediaDia, minManut: kpi.minManut, diasManut: kpi.diasManut, excedenteTotal, mesesExcedidos, veiculos: porVeiculo.length },
      porVeiculo: porVeiculo.map((v) => ({ placa: v.placa, modelo: v.modelo, km: v.km, kmMes: v.kmMes, diasRodados: v.diasRodados, dias: v.dias, minManut: v.minManut })),
      meses, pivot: pivot.map((p) => ({ placa: p.placa, total: p.total, por: p.por })), totMes,
      manutRows: manutRows.map((m) => ({ placa: m.placa, diasN: m.diasN, horas: m.horas })),
    });
    if (!ok) toast.error("Permita pop-ups para visualizar o relatório.");
  }

  function buildRelatorio(): RelatorioTabelaData {
    const colunas: RelColuna[] = [
      { label: "Placa" }, { label: "Modelo" }, { label: "Status veículo" }, { label: "KM total", align: "right" }, { label: "KM/mês médio", align: "right" },
      { label: "Dias rodados", align: "right" }, { label: "Dias c/ leitura", align: "right" }, { label: "Manutenção (min)", align: "right" },
    ];
    const linhas = porVeiculo.map((v) => [
      v.placa, v.modelo, statusVeiculoLabel(vMap.get(v.vehicle_id)?.status), km0(v.km), km0(v.kmMes), v.diasRodados, v.dias, v.minManut,
    ]);
    return {
      empresa: config?.empresa_nome, titulo: "Apuração de KM por veículo", subtitulo: escopo,
      filtros: [{ label: "Escopo", valor: escopo }, { label: "Período", valor: periodoLabel }, { label: "Franquia", valor: `${formatNumber(franquia)} km/mês` }],
      colunas, linhas,
    };
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Apuração de KM"
        description={`KM rodado por ${escopo} — via relatório de ociosidade do Ituran`}
        actions={
          <>
            <RelatorioExport build={buildRelatorio} nomeArquivo="apuracao-km-por-veiculo" disabled={!porVeiculo.length} />
            <Button variant="outline" size="sm" onClick={abrirRelatorio} disabled={!rows.length}>
              <FileText className="h-4 w-4" /> Gerencial
            </Button>
            {podeEscrever && (
              <Button size="sm" onClick={() => setShowImport(true)}>
                <Upload className="h-4 w-4" /> Importar Ituran
              </Button>
            )}
          </>
        }
      />

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border p-3 sm:p-4">
        <div className="w-full sm:w-auto">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Veículo</label>
          <Select value={fVeiculo} onValueChange={setFVeiculo}>
            <SelectTrigger className="w-full sm:w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Frota toda</SelectItem>
              {veiculos.map((v) => <SelectItem key={v.id} value={v.id}>{v.placa} — {v.modelo}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Mês</label>
          <Input type="month" value={mes} onChange={(e) => aplicarMes(e.target.value)} className="w-full sm:w-40" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">De</label>
          <Input type="date" value={ini} onChange={(e) => { setIni(e.target.value); setMes(""); }} className="w-full sm:w-40" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Até</label>
          <Input type="date" value={fim} onChange={(e) => { setFim(e.target.value); setMes(""); }} className="w-full sm:w-40" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Agrupar por</label>
          <Select value={gran} onValueChange={(v) => setGran(v as Gran)}>
            <SelectTrigger className="w-full sm:w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="dia">Dia</SelectItem>
              <SelectItem value="semana">Semana</SelectItem>
              <SelectItem value="mes">Mês</SelectItem>
              <SelectItem value="ano">Ano</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {(ini || fim || mes || fVeiculo !== "todos") && (
          <Button variant="ghost" size="sm" onClick={() => { setIni(""); setFim(""); setMes(""); setFVeiculo("todos"); }}>Limpar</Button>
        )}
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Carregando apuração...</div>
      ) : rows.length === 0 ? (
        <EmptyState
          message="Nenhuma leitura de KM. Importe um relatório de ociosidade do Ituran."
          icon={<Gauge className="h-6 w-6" />}
          action={podeEscrever ? <Button onClick={() => setShowImport(true)}><Upload className="h-4 w-4" /> Importar Ituran</Button> : undefined}
        />
      ) : (
        <>
          {/* KPIs clicáveis */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <button type="button" onClick={() => setTab("porveiculo")} className="text-left">
              <StatCard title="KM total no período" value={km0(kpi.kmTotal)} hint={`${kpi.dias} dia(s) com leitura`} icon={<Route className="h-5 w-5" />} />
            </button>
            <button type="button" onClick={() => setTab("geral")} className="text-left">
              <StatCard title="Média por dia rodado" value={km0(kpi.kmMediaDia)} hint={`${kpi.diasRodados} dia(s) rodado(s)`} tone="success" icon={<TrendingUp className="h-5 w-5" />} />
            </button>
            <button type="button" onClick={() => setTab("geral")} className="text-left">
              <StatCard title="Dias parados (sem rodar)" value={formatNumber(kpi.diasParados)} hint="dias com leitura e KM zero" tone="warning" icon={<ParkingCircle className="h-5 w-5" />} />
            </button>
            <button type="button" onClick={() => setTab("franquia")} className="text-left">
              <StatCard title="KM excedente da franquia" value={km0(excedenteTotal)} hint={`acima de ${formatNumber(franquia)} km/mês · ${mesesExcedidos} mês(es)`} tone={excedenteTotal > 0 ? "destructive" : "default"} icon={<AlertTriangle className="h-5 w-5" />} />
            </button>
            <button type="button" onClick={() => setTab("manutencao")} className="text-left">
              <StatCard title="Tempo em manutenção" value={`${formatNumber(Math.round(kpi.minManut / 60))} h`} hint={`${kpi.diasManut} dia(s) parado(s) na oficina`} tone="warning" icon={<Wrench className="h-5 w-5" />} />
            </button>
            <button type="button" onClick={() => setTab("porveiculo")} className="text-left">
              <StatCard title="Veículos apurados" value={formatNumber(porVeiculo.length)} hint="clique para detalhar" icon={<Gauge className="h-5 w-5" />} />
            </button>
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="flex-wrap">
              <TabsTrigger value="geral">Visão geral</TabsTrigger>
              <TabsTrigger value="porveiculo">Por veículo</TabsTrigger>
              <TabsTrigger value="mesveiculo">KM mês × veículo</TabsTrigger>
              <TabsTrigger value="franquia">Franquia mensal</TabsTrigger>
              <TabsTrigger value="manutencao">Paralisação/Manutenção</TabsTrigger>
              <TabsTrigger value="diario">Detalhe diário</TabsTrigger>
            </TabsList>

            {/* Visão geral: série temporal clicável */}
            <TabsContent value="geral" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>KM por {gran === "dia" ? "dia" : gran === "semana" ? "semana" : gran === "ano" ? "ano" : "mês"}</CardTitle>
                  <CardDescription>Clique em uma barra para agrupar por dia dentro dela · escopo: {escopo}</CardDescription>
                </CardHeader>
                <CardContent>
                  {serie.length === 0 ? <EmptyState message="Sem dados" /> : (
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={serie} onClick={(s) => { if (gran !== "dia" && s?.activeLabel) setGran(gran === "ano" ? "mes" : gran === "mes" ? "semana" : "dia"); }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="label" fontSize={11} />
                        <YAxis fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                        <Tooltip formatter={(v: number) => km0(v)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                        <Bar dataKey="km" name="KM" radius={[4, 4, 0, 0]} className="cursor-pointer">
                          {serie.map((s, i) => <Cell key={i} fill={s.km > franquia && gran === "mes" ? "hsl(0 72% 51%)" : "hsl(221 83% 53%)"} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                  {gran !== "dia" && <p className="mt-2 text-center text-xs text-muted-foreground">No mês, barras vermelhas ultrapassam a franquia de {formatNumber(franquia)} km</p>}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Por veículo */}
            <TabsContent value="porveiculo" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>KM por veículo</CardTitle>
                  <CardDescription>Clique em uma barra ou linha para ver o detalhe diário</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={Math.max(200, porVeiculo.length * 32)}>
                    <BarChart data={porVeiculo.slice(0, 20).map((v) => ({ ...v, km: Math.round(v.km) }))} layout="vertical" onClick={(s) => { const p = (s?.activePayload?.[0]?.payload as { vehicle_id?: string }); if (p?.vehicle_id) selecionarVeiculo(p.vehicle_id); }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="placa" fontSize={11} width={72} />
                      <Tooltip formatter={(v: number) => km0(v)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="km" name="KM" fill="hsl(221 83% 53%)" radius={[0, 4, 4, 0]} className="cursor-pointer" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-0">
                  <div className="max-h-[28rem] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Veículo</TableHead>
                          <TableHead>Status veículo</TableHead>
                          <TableHead className="text-right">KM total</TableHead>
                          <TableHead className="text-right">KM/mês médio</TableHead>
                          <TableHead className="text-right">Dias rodados</TableHead>
                          <TableHead className="text-right">Manutenção</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {porVeiculo.map((v) => (
                          <TableRow key={v.vehicle_id} className="cursor-pointer" onClick={() => selecionarVeiculo(v.vehicle_id)}>
                            <TableCell><span className="font-mono font-medium">{v.placa}</span> <span className="text-xs text-muted-foreground">{v.modelo}</span></TableCell>
                            <TableCell><VehicleStatusBadge status={vMap.get(v.vehicle_id)?.status} /></TableCell>
                            <TableCell className="text-right font-semibold">{km0(v.km)}</TableCell>
                            <TableCell className="text-right"><span className={v.kmMes > franquia ? "font-semibold text-destructive" : ""}>{km0(v.kmMes)}</span></TableCell>
                            <TableCell className="text-right">{v.diasRodados}/{v.dias}</TableCell>
                            <TableCell className="text-right">{v.minManut > 0 ? `${formatNumber(Math.round(v.minManut / 60))} h` : "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* KM por mês × veículo (pivô) */}
            <TabsContent value="mesveiculo" className="space-y-4">
              <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle>KM rodado por mês por veículo</CardTitle>
                    <CardDescription>Clique numa célula para abrir o veículo naquele mês · vermelho ultrapassa {formatNumber(franquia)} km/mês</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={exportPivot} disabled={!pivot.length}><FileDown className="h-4 w-4" /> CSV</Button>
                </CardHeader>
                <CardContent className="p-0">
                  {pivot.length === 0 ? <EmptyState message="Sem dados" /> : (
                    <div className="max-h-[32rem] overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="sticky left-0 bg-card">Veículo</TableHead>
                            {meses.map((m) => <TableHead key={m} className="whitespace-nowrap text-right">{m.slice(5)}/{m.slice(2, 4)}</TableHead>)}
                            <TableHead className="text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pivot.map((p) => (
                            <TableRow key={p.vehicle_id}>
                              <TableCell className="sticky left-0 bg-card"><span className="font-mono font-medium">{p.placa}</span></TableCell>
                              {meses.map((m) => {
                                const val = p.por[m] ?? 0;
                                return (
                                  <TableCell key={m}
                                    className={`text-right ${val > 0 && p.vehicle_id !== "sem" ? "cursor-pointer hover:bg-accent" : "text-muted-foreground"} ${val > franquia ? "font-semibold text-destructive" : ""}`}
                                    onClick={() => { if (val > 0 && p.vehicle_id !== "sem") { setFVeiculo(p.vehicle_id); aplicarMes(m); setTab("diario"); } }}>
                                    {val > 0 ? formatNumber(Math.round(val)) : "—"}
                                  </TableCell>
                                );
                              })}
                              <TableCell className="text-right font-semibold">{km0(p.total)}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="border-t-2">
                            <TableCell className="sticky left-0 bg-card font-semibold">Total frota</TableCell>
                            {meses.map((m) => <TableCell key={m} className="text-right font-semibold">{formatNumber(Math.round(totMes[m] ?? 0))}</TableCell>)}
                            <TableCell className="text-right font-bold">{km0(pivot.reduce((s, p) => s + p.total, 0))}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Franquia mensal */}
            <TabsContent value="franquia" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Excedente da franquia mensal</CardTitle>
                  <CardDescription>KM acima de {formatNumber(franquia)} km/mês por veículo · clique para o detalhe do veículo</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {franquiaRows.length === 0 ? <EmptyState message="Sem dados" /> : (
                    <div className="max-h-[28rem] overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Veículo</TableHead>
                            <TableHead>Mês</TableHead>
                            <TableHead className="text-right">KM no mês</TableHead>
                            <TableHead className="text-right">Franquia</TableHead>
                            <TableHead className="text-right">Excedente</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {franquiaRows.map((r) => (
                            <TableRow key={`${r.vehicle_id}|${r.ym}`} className="cursor-pointer" onClick={() => selecionarVeiculo(r.vehicle_id)}>
                              <TableCell className="font-mono font-medium">{r.placa}</TableCell>
                              <TableCell>{r.ym.slice(5)}/{r.ym.slice(0, 4)}</TableCell>
                              <TableCell className="text-right">{km0(r.km)}</TableCell>
                              <TableCell className="text-right text-muted-foreground">{formatNumber(franquia)} km</TableCell>
                              <TableCell className="text-right">
                                {r.excedente > 0 ? <Badge variant="outline" className="border-destructive font-semibold text-destructive">+{km0(r.excedente)}</Badge> : <span className="text-muted-foreground">—</span>}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Paralisação / manutenção */}
            <TabsContent value="manutencao" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Paralisação por manutenção</CardTitle>
                  <CardDescription>Tempo parado na oficina ({config?.endereco_manutencao ?? "—"}) — passível de desconto na locação · clique para o detalhe</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {manutRows.length === 0 ? <EmptyState message="Nenhuma parada de manutenção no período" icon={<Wrench className="h-6 w-6" />} /> : (
                    <div className="max-h-[28rem] overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Veículo</TableHead>
                            <TableHead className="text-right">Dias parados</TableHead>
                            <TableHead className="text-right">Tempo total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {manutRows.map((v) => (
                            <TableRow key={v.vehicle_id} className="cursor-pointer" onClick={() => selecionarVeiculo(v.vehicle_id)}>
                              <TableCell className="font-mono font-medium">{v.placa}</TableCell>
                              <TableCell className="text-right">{v.diasN}</TableCell>
                              <TableCell className="text-right font-semibold">{v.horas >= 1 ? `${formatNumber(Math.round(v.horas))} h` : `${formatNumber(Math.round(v.min))} min`}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Detalhe diário */}
            <TabsContent value="diario" className="space-y-4">
              {fVeiculo === "todos" && (
                <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                  <ChevronLeft className="h-4 w-4" /> Selecione um veículo no filtro (ou clique em uma linha em "Por veículo") para ver o detalhe diário.
                </div>
              )}
              <Card>
                <CardHeader>
                  <CardTitle>Leituras diárias</CardTitle>
                  <CardDescription>{escopo} · KM apurado por dia (odômetro), com dias parados e manutenção</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="max-h-[32rem] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Dia</TableHead>
                          {fVeiculo === "todos" && <TableHead>Veículo</TableHead>}
                          <TableHead className="text-right">Odôm. início</TableHead>
                          <TableHead className="text-right">Odôm. fim</TableHead>
                          <TableHead className="text-right">KM</TableHead>
                          <TableHead className="text-right">Registros</TableHead>
                          <TableHead className="text-right">Manutenção</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {diario.map((r: KmDiaRow, i) => (
                          <TableRow key={`${r.vehicle_id}|${r.dia}|${i}`} className={r.vehicle_id ? "cursor-pointer" : ""} onClick={() => r.vehicle_id && setFVeiculo(r.vehicle_id)}>
                            <TableCell className="whitespace-nowrap">{r.dia.split("-").reverse().join("/")}</TableCell>
                            {fVeiculo === "todos" && <TableCell className="font-mono">{r.placa}</TableCell>}
                            <TableCell className="text-right text-muted-foreground">{r.odom_inicio != null ? formatNumber(r.odom_inicio) : "—"}</TableCell>
                            <TableCell className="text-right text-muted-foreground">{r.odom_fim != null ? formatNumber(r.odom_fim) : "—"}</TableCell>
                            <TableCell className={`text-right font-semibold ${r.km > 0.05 ? "" : "text-muted-foreground"}`}>{km0(r.km)}</TableCell>
                            <TableCell className="text-right text-muted-foreground">{r.registros}</TableCell>
                            <TableCell className="text-right">{r.min_ocioso_manut > 0 ? <Badge variant="outline" className="border-warning text-warning">{formatNumber(Math.round(r.min_ocioso_manut))} min</Badge> : "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}

      <ImportarIturanDialog open={showImport} onOpenChange={setShowImport} />
    </div>
  );
}
