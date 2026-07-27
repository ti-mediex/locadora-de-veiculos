import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CalendarClock, Gauge, Clock, Wrench, TrendingDown, Percent, CarFront, Wallet, AlertOctagon } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { SelectVeiculo } from "@/components/shared/select-veiculo";
import { SortableHead } from "@/components/shared/sortable-head";
import { RelatorioExport } from "@/components/shared/relatorio-export";
import { VehicleStatusBadge } from "@/components/shared/vehicle-status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useSort } from "@/hooks/use-sort";
import { useList } from "@/hooks/use-crud";
import { useContratos } from "@/hooks/use-contratos";
import { useOcorrencias, construirLinhaTempo } from "@/hooks/use-ocorrencias";
import { useParalisacoes, type ParalVeiculo } from "@/hooks/use-paralisacoes";
import { OCORRENCIA_TIPO } from "@/lib/options";
import { formatCurrency, formatNumber, formatDate, formatDateTime, maskPlaca } from "@/lib/format";
import type { Vehicle } from "@/types/database";
import type { RelatorioTabelaData, RelColuna } from "@/lib/relatorio-tabela";

const TIPO = Object.fromEntries(OCORRENCIA_TIPO.map((t) => [t.value, t]));
const tipoLabel = (t: string) => TIPO[t]?.label ?? t;
const tipoCor = (t: string) => TIPO[t]?.color ?? "hsl(215 16% 55%)";
const pct = (n: number) => `${Math.round(n * 100)}%`;
const h1 = (n: number) => `${formatNumber(Math.round(n * 10) / 10)} h`;

export default function LinhaDoTempoPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { linhas, porVeiculo, descontosSemana, totais, franquiaH, isLoading } = useParalisacoes();
  const { data: vehicles = [] } = useList<Vehicle>("vehicles");
  const { data: contratos = [] } = useContratos();
  const { data: ocorrencias = [] } = useOcorrencias();

  const [tab, setTab] = useState("frota");
  const [veic, setVeic] = useState<string>(params.get("veiculo") ?? "");

  const mesLabel = useMemo(() => { const s = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" }); return s.charAt(0).toUpperCase() + s.slice(1); }, []);

  const abrirVeiculo = (id: string) => { setVeic(id); setTab("veiculo"); };

  // Rankings (frota).
  const comOcorr = useMemo(() => porVeiculo.filter((p) => p.nOcorr > 0), [porVeiculo]);
  const rankParada = useMemo(() => [...comOcorr].sort((a, b) => b.horas - a.horas).slice(0, 15), [comOcorr]);

  // Por veículo selecionado.
  const pv = useMemo<ParalVeiculo | undefined>(() => porVeiculo.find((p) => p.vehicle_id === veic), [porVeiculo, veic]);
  const linhasVeic = useMemo(() => linhas.filter((l) => l.vehicle_id === veic).sort((a, b) => b.inicio.localeCompare(a.inicio)), [linhas, veic]);
  const timeline = useMemo(() => (veic ? construirLinhaTempo(veic, contratos, ocorrencias, tipoLabel, tipoCor) : []), [veic, contratos, ocorrencias]);
  const veicSel = vehicles.find((v) => v.id === veic);

  const { sortKey, sortDir, toggle, useSorted } = useSort<ParalVeiculo>("horas", "desc");
  const porVeicOrdenado = useSorted(porVeiculo, (p, k) => {
    switch (k) {
      case "placa": return p.placa;
      case "tipo": return p.modelo || p.categoria;
      case "locatario": return p.locatario;
      case "contrato": return p.contratoNumero;
      case "status": return p.statusLabel;
      case "ocorr": return p.nOcorr;
      case "horas": return p.horas;
      case "desc": return p.desconto;
      case "custo": return p.custo;
      case "disp": return p.dispMes;
      case "perda": return p.perdaMes;
      default: return "";
    }
  });

  function buildRelatorioFrota(): RelatorioTabelaData {
    const colunas: RelColuna[] = [
      { label: "Placa" }, { label: "Status" }, { label: "Ocorr.", align: "right" }, { label: "Paralisação", align: "right" },
      { label: "Disp. mês", align: "right" }, { label: "Desconto", align: "right" }, { label: "Custo", align: "right" }, { label: "Perda receita (mês)", align: "right" },
    ];
    const linhasRel = porVeicOrdenado.filter((p) => p.nOcorr > 0 || p.dispMes < 1).map((p) => [
      maskPlaca(p.placa), p.statusLabel, String(p.nOcorr), h1(p.horas), pct(p.dispMes),
      formatCurrency(p.desconto), formatCurrency(p.custo), formatCurrency(p.perdaMes),
    ]);
    return {
      titulo: "Linha do tempo — paralisações e disponibilidade", subtitulo: `${mesLabel} · franquia ${franquiaH}h`,
      colunas, linhas: linhasRel,
      rodape: ["", "Total", "", h1(totais.horas), pct(totais.dispMedia), formatCurrency(totais.desconto), formatCurrency(totais.custo), formatCurrency(totais.perdaParalisacao)],
    };
  }

  function buildRelatorioDescontos(): RelatorioTabelaData {
    const colunas: RelColuna[] = [
      { label: "Placa" }, { label: "Contrato" }, { label: "Semana" }, { label: "Horas desc.", align: "right" }, { label: "Desconto no boleto", align: "right" },
    ];
    const linhasRel = descontosSemana.map((d) => [maskPlaca(d.placa), d.contratoNumero, d.semanaLabel, h1(d.horasDesc), formatCurrency(d.desconto)]);
    return {
      titulo: "Descontos por semana (abater no próximo boleto)", subtitulo: `Regra: até ${franquiaH}h sem desconto`,
      colunas, linhas: linhasRel,
      rodape: ["", "", "Total", "", formatCurrency(descontosSemana.reduce((s, d) => s + d.desconto, 0))],
    };
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Linha do Tempo por Veículo"
        description={`Disponibilidade, paralisações, descontos e perda de receita · ${mesLabel} · franquia de ${franquiaH}h`}
        actions={<RelatorioExport build={tab === "frota" ? buildRelatorioFrota : buildRelatorioDescontos} nomeArquivo="linha-do-tempo" disabled={!porVeiculo.length} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Disponibilidade média" value={pct(totais.dispMedia)} hint={`${mesLabel}`} tone={totais.dispMedia >= 0.95 ? "success" : "warning"} icon={<Gauge className="h-5 w-5" />} />
        <StatCard title="Horas paralisadas" value={h1(totais.horas)} hint={`${h1(totais.horasDesc)} descontáveis`} tone="warning" icon={<Clock className="h-5 w-5" />} onClick={() => navigate("/ocorrencias")} />
        <StatCard title="Desconto a conceder" value={formatCurrency(totais.desconto)} hint="a abater nos boletos" tone="destructive" icon={<TrendingDown className="h-5 w-5" />} />
        <StatCard title="Custo de manutenção" value={formatCurrency(totais.custo)} hint="ocorrências que paralisam" tone="destructive" icon={<Wrench className="h-5 w-5" />} onClick={() => navigate("/ordens-servico")} />
        <StatCard title={`Receita projetada · ${mesLabel}`} value={formatCurrency(totais.receitaProjMes)} icon={<Percent className="h-5 w-5" />} onClick={() => navigate("/contratos")} />
        <StatCard title={`Receita realizada · ${mesLabel}`} value={formatCurrency(totais.receitaRealMes)} tone="success" icon={<Wallet className="h-5 w-5" />} onClick={() => navigate("/receitas")} />
        <StatCard title="Perda por paralisação (mês)" value={formatCurrency(totais.perdaParalisacao)} tone="destructive" icon={<AlertOctagon className="h-5 w-5" />} />
        <StatCard title="Receita ociosa (semana)" value={formatCurrency(totais.receitaOciosaSemana)} hint={`${totais.veiculosOciosos} disponível(is) sem locar`} tone="warning" icon={<CarFront className="h-5 w-5" />} onClick={() => navigate("/frota-ativa")} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Tabs value={tab} onValueChange={setTab}>
            <div className="flex flex-col gap-2 border-b p-3 sm:flex-row sm:items-center sm:justify-between">
              <TabsList>
                <TabsTrigger value="frota">Frota</TabsTrigger>
                <TabsTrigger value="descontos">Descontos por semana</TabsTrigger>
                <TabsTrigger value="veiculo">Por veículo</TabsTrigger>
              </TabsList>
              {tab === "veiculo" && (
                <div className="w-full sm:w-80"><SelectVeiculo value={veic} onChange={setVeic} vehicles={vehicles} placeholder="Escolha o veículo" /></div>
              )}
            </div>

            {/* FROTA: ranking por veículo */}
            <TabsContent value="frota" className="m-0">
              {isLoading ? <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div> : porVeiculo.length === 0 ? (
                <EmptyState message="Sem dados de paralisação ainda" icon={<CalendarClock className="h-6 w-6" />} />
              ) : (
                <div className="overflow-x-auto">
                  <Table className="text-xs [&_th]:h-9 [&_th]:whitespace-nowrap [&_th]:px-1 [&_th]:text-[11px] [&_td]:px-1 [&_td]:py-2">
                    <TableHeader>
                      <TableRow>
                        <SortableHead sortKey="placa" activeKey={sortKey} dir={sortDir} onSort={toggle}>Placa</SortableHead>
                        <SortableHead sortKey="tipo" activeKey={sortKey} dir={sortDir} onSort={toggle}>Tipo</SortableHead>
                        <SortableHead sortKey="locatario" activeKey={sortKey} dir={sortDir} onSort={toggle}>Locatário</SortableHead>
                        <SortableHead sortKey="contrato" activeKey={sortKey} dir={sortDir} onSort={toggle}>Contrato</SortableHead>
                        <SortableHead sortKey="status" activeKey={sortKey} dir={sortDir} onSort={toggle}>Status</SortableHead>
                        <SortableHead sortKey="ocorr" activeKey={sortKey} dir={sortDir} onSort={toggle} align="right">Ocorr.</SortableHead>
                        <SortableHead sortKey="horas" activeKey={sortKey} dir={sortDir} onSort={toggle} align="right">Paralisação</SortableHead>
                        <SortableHead sortKey="disp" activeKey={sortKey} dir={sortDir} onSort={toggle} align="right">Disp. mês</SortableHead>
                        <SortableHead sortKey="desc" activeKey={sortKey} dir={sortDir} onSort={toggle} align="right">Desconto</SortableHead>
                        <SortableHead sortKey="custo" activeKey={sortKey} dir={sortDir} onSort={toggle} align="right">Custo</SortableHead>
                        <SortableHead sortKey="perda" activeKey={sortKey} dir={sortDir} onSort={toggle} align="right">Perda mês</SortableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {porVeicOrdenado.filter((p) => p.nOcorr > 0 || p.dispMes < 1).map((p) => (
                        <TableRow key={p.vehicle_id} className="cursor-pointer" onClick={() => abrirVeiculo(p.vehicle_id)}>
                          <TableCell className="whitespace-nowrap font-mono font-medium">{maskPlaca(p.placa)}</TableCell>
                          <TableCell className="max-w-[110px] truncate" title={`${p.modelo}${p.categoria && p.categoria !== "—" ? ` · ${p.categoria}` : ""}`}>{p.modelo || p.categoria}</TableCell>
                          <TableCell className="max-w-[120px] truncate" title={p.locatario || undefined}>{p.locatario || <span className="text-muted-foreground">—</span>}</TableCell>
                          <TableCell className="whitespace-nowrap font-mono">{p.contratoNumero || <span className="text-muted-foreground">—</span>}</TableCell>
                          <TableCell><VehicleStatusBadge status={p.status} /></TableCell>
                          <TableCell className="text-right tabular-nums">{p.nOcorr || <span className="text-muted-foreground">—</span>}</TableCell>
                          <TableCell className="whitespace-nowrap text-right tabular-nums">{p.horas > 0 ? h1(p.horas) : <span className="text-muted-foreground">—</span>}</TableCell>
                          <TableCell className={`text-right tabular-nums ${p.dispMes < 0.9 ? "font-semibold text-destructive" : ""}`}>{pct(p.dispMes)}</TableCell>
                          <TableCell className="whitespace-nowrap text-right tabular-nums">{p.desconto > 0 ? formatCurrency(p.desconto) : <span className="text-muted-foreground">—</span>}</TableCell>
                          <TableCell className="whitespace-nowrap text-right tabular-nums">{p.custo > 0 ? formatCurrency(p.custo) : <span className="text-muted-foreground">—</span>}</TableCell>
                          <TableCell className="whitespace-nowrap text-right tabular-nums">{p.perdaMes > 0 ? formatCurrency(p.perdaMes) : <span className="text-muted-foreground">—</span>}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            {/* DESCONTOS por semana (financeiro) */}
            <TabsContent value="descontos" className="m-0">
              {descontosSemana.length === 0 ? (
                <EmptyState message="Nenhum desconto a conceder (nenhuma paralisação acima da franquia)" icon={<TrendingDown className="h-6 w-6" />} />
              ) : (
                <div className="overflow-x-auto">
                  <Table className="text-xs [&_th]:h-9 [&_th]:whitespace-nowrap [&_th]:px-2 [&_th]:text-[11px] [&_td]:px-2 [&_td]:py-2">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Placa</TableHead><TableHead>Contrato</TableHead><TableHead>Semana</TableHead>
                        <TableHead className="text-right">Horas descontáveis</TableHead><TableHead className="text-right">Desconto no boleto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {descontosSemana.map((d) => (
                        <TableRow key={`${d.vehicle_id}-${d.semanaIni}`} className="cursor-pointer" onClick={() => abrirVeiculo(d.vehicle_id)}>
                          <TableCell className="whitespace-nowrap font-mono font-medium">{maskPlaca(d.placa)}</TableCell>
                          <TableCell className="whitespace-nowrap font-mono">{d.contratoNumero}</TableCell>
                          <TableCell className="whitespace-nowrap">{d.semanaLabel}</TableCell>
                          <TableCell className="text-right tabular-nums">{h1(d.horasDesc)}</TableCell>
                          <TableCell className="whitespace-nowrap text-right font-semibold tabular-nums text-destructive">{formatCurrency(d.desconto)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            {/* POR VEÍCULO */}
            <TabsContent value="veiculo" className="m-0 space-y-4 p-3 sm:p-4">
              {!veic || !veicSel ? (
                <EmptyState message="Escolha um veículo para ver a linha do tempo, disponibilidade e descontos" icon={<CarFront className="h-6 w-6" />} />
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard title="Disponibilidade (mês)" value={pct(pv?.dispMes ?? 1)} hint={`${h1(pv?.horasParadasMes ?? 0)} paradas`} tone={(pv?.dispMes ?? 1) >= 0.95 ? "success" : "warning"} icon={<Gauge className="h-5 w-5" />} />
                    <StatCard title="Paralisação total" value={h1(pv?.horas ?? 0)} hint={`${pv?.nOcorr ?? 0} ocorrência(s)`} tone="warning" icon={<Clock className="h-5 w-5" />} onClick={() => navigate(`/ocorrencias?veiculo=${encodeURIComponent(veicSel.placa)}`)} />
                    <StatCard title="Desconto acumulado" value={formatCurrency(pv?.desconto ?? 0)} tone="destructive" icon={<TrendingDown className="h-5 w-5" />} />
                    <StatCard title="Receita proj. × real. (mês)" value={formatCurrency(pv?.receitaRealMes ?? 0)} hint={`Projetada ${formatCurrency(pv?.receitaProjMes ?? 0)}`} icon={<Wallet className="h-5 w-5" />} onClick={() => navigate("/receitas")} />
                  </div>

                  <Card>
                    <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-base">Paralisações — {maskPlaca(veicSel.placa)} {veicSel.modelo}</CardTitle>
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/ocorrencias?veiculo=${encodeURIComponent(veicSel.placa)}`)}><AlertOctagon className="h-4 w-4" /> Ocorrências</Button>
                    </CardHeader>
                    <CardContent className="p-0">
                      {linhasVeic.length === 0 ? <EmptyState message="Nenhuma paralisação registrada para este veículo" /> : (
                        <div className="overflow-x-auto">
                          <Table className="text-xs [&_th]:h-9 [&_th]:px-2 [&_td]:px-2 [&_td]:py-2">
                            <TableHeader><TableRow>
                              <TableHead>Tipo</TableHead><TableHead>Início</TableHead><TableHead>Fim</TableHead>
                              <TableHead className="text-right">Horas</TableHead><TableHead className="text-right">Descontáveis</TableHead>
                              <TableHead className="text-right">Desconto</TableHead><TableHead className="text-right">Custo</TableHead>
                            </TableRow></TableHeader>
                            <TableBody>
                              {linhasVeic.map((l, i) => (
                                <TableRow key={i} className="cursor-pointer" onClick={() => navigate(`/ocorrencias?veiculo=${encodeURIComponent(veicSel.placa)}`)}>
                                  <TableCell><Badge variant="secondary" className="gap-1 px-1.5 py-0 text-[10px]"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: tipoCor(l.tipo) }} />{tipoLabel(l.tipo)}</Badge></TableCell>
                                  <TableCell className="whitespace-nowrap">{formatDateTime(l.inicio)}</TableCell>
                                  <TableCell className="whitespace-nowrap">{l.fim ? formatDateTime(l.fim) : <Badge variant="warning" className="px-1.5 py-0 text-[10px]">em aberto</Badge>}</TableCell>
                                  <TableCell className="text-right tabular-nums">{h1(l.horas)}</TableCell>
                                  <TableCell className="text-right tabular-nums">{l.horasDesc > 0 ? h1(l.horasDesc) : "—"}</TableCell>
                                  <TableCell className="whitespace-nowrap text-right tabular-nums text-destructive">{l.desconto > 0 ? formatCurrency(l.desconto) : "—"}</TableCell>
                                  <TableCell className="text-right tabular-nums">{l.custo > 0 ? formatCurrency(l.custo) : "—"}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Custo/tempo por tipo */}
                  {pv && Object.keys(pv.porTipo).length > 0 && (
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-base">Tempo e custo por tipo de ocorrência</CardTitle></CardHeader>
                      <CardContent className="p-0">
                        <div className="overflow-x-auto">
                          <Table className="text-xs [&_th]:h-9 [&_th]:px-2 [&_td]:px-2 [&_td]:py-2">
                            <TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead className="text-right">Ocorr.</TableHead><TableHead className="text-right">Horas</TableHead><TableHead className="text-right">Custo</TableHead></TableRow></TableHeader>
                            <TableBody>
                              {Object.entries(pv.porTipo).sort((a, b) => b[1].horas - a[1].horas).map(([t, x]) => (
                                <TableRow key={t}>
                                  <TableCell><Badge variant="secondary" className="gap-1 px-1.5 py-0 text-[10px]"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: tipoCor(t) }} />{tipoLabel(t)}</Badge></TableCell>
                                  <TableCell className="text-right tabular-nums">{x.n}</TableCell>
                                  <TableCell className="text-right tabular-nums">{h1(x.horas)}</TableCell>
                                  <TableCell className="text-right tabular-nums">{formatCurrency(x.custo)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Linha do tempo (estado dia a dia) */}
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><CalendarClock className="h-4 w-4" /> Linha do tempo</CardTitle></CardHeader>
                    <CardContent>
                      {timeline.length === 0 ? <EmptyState message="Sem histórico para este veículo" /> : (
                        <ol className="space-y-2">
                          {timeline.slice().reverse().slice(0, 60).map((s, i) => (
                            <li key={i} className="flex gap-3 text-sm">
                              <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.cor ?? "hsl(215 16% 55%)" }} />
                              <div className="min-w-0">
                                <div className="font-medium">{formatDate(s.inicioISO.slice(0, 10))}{s.fimISO && s.fimISO.slice(0, 10) !== s.inicioISO.slice(0, 10) ? ` – ${formatDate(s.fimISO.slice(0, 10))}` : ""} · {s.estado}</div>
                                <div className="text-muted-foreground">{s.detalhe}</div>
                              </div>
                            </li>
                          ))}
                        </ol>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Ranking rápido de paralisação (frota) */}
      {rankParada.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Ranking — maior tempo de paralisação</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="text-xs [&_th]:h-9 [&_th]:px-2 [&_td]:px-2 [&_td]:py-2">
                <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Placa</TableHead><TableHead className="text-right">Paralisação</TableHead><TableHead className="text-right">Ocorr.</TableHead><TableHead className="text-right">Desconto</TableHead></TableRow></TableHeader>
                <TableBody>
                  {rankParada.map((p, i) => (
                    <TableRow key={p.vehicle_id} className="cursor-pointer" onClick={() => abrirVeiculo(p.vehicle_id)}>
                      <TableCell className="tabular-nums text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="whitespace-nowrap font-mono font-medium">{maskPlaca(p.placa)}</TableCell>
                      <TableCell className="text-right tabular-nums">{h1(p.horas)}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.nOcorr}</TableCell>
                      <TableCell className="text-right tabular-nums text-destructive">{formatCurrency(p.desconto)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
