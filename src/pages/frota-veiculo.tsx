import { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, TrendingUp, Wallet, Wrench, Gauge, AlertTriangle, Satellite, FileSignature, CalendarClock, Wifi, WifiOff } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { VehicleStatusBadge } from "@/components/shared/vehicle-status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useList } from "@/hooks/use-crud";
import { useContratos } from "@/hooks/use-contratos";
import { useFinanceEntries } from "@/hooks/use-finance";
import { useKmDiario } from "@/hooks/use-km";
import { usePendencias, vencimentoStatus, type VencStatus } from "@/hooks/use-pendencias";
import { useRastreamento, useRastreamentoStatusPorVeiculo } from "@/hooks/use-rastreamento";
import { useOcorrencias, construirLinhaTempo } from "@/hooks/use-ocorrencias";
import { useOrdensServico } from "@/hooks/use-ordens-servico";
import { useVehicleStatuses } from "@/hooks/use-vehicle-statuses";
import { semanasNoMes, grupoFrota } from "@/hooks/use-frota-ativa";
import { OCORRENCIA_TIPO, OS_STATUS } from "@/lib/options";
import { formatCurrency, formatNumber, formatDate, formatDateTime, maskPlaca } from "@/lib/format";
import type { Vehicle } from "@/types/database";

const TIPO = Object.fromEntries(OCORRENCIA_TIPO.map((t) => [t.value, t]));
const tipoLabel = (t: string) => TIPO[t]?.label ?? t;
const tipoCor = (t: string) => TIPO[t]?.color ?? "hsl(215 16% 55%)";
const osLabel = (s: string) => OS_STATUS.find((o) => o.value === s)?.label ?? s;

const VENC_BADGE: Record<VencStatus, { variant: "destructive" | "warning" | "secondary" | "success" | "muted"; label: string }> = {
  vencida: { variant: "destructive", label: "Vencida" },
  vence7: { variant: "warning", label: "Vence ≤7d" },
  vence30: { variant: "secondary", label: "Vence ≤30d" },
  em_dia: { variant: "success", label: "Em dia" },
  sem: { variant: "muted", label: "—" },
};

export default function FrotaVeiculoPage() {
  const { vehicleId = "" } = useParams();
  const navigate = useNavigate();

  const { data: vehicles = [], isLoading } = useList<Vehicle>("vehicles");
  const { data: contratos = [] } = useContratos();
  const { data: entries = [] } = useFinanceEntries();
  const { data: kmDiario = [] } = useKmDiario(undefined, undefined, vehicleId);
  const { data: pendencias = [] } = usePendencias();
  const { data: rastreios = [] } = useRastreamento();
  const rastMap = useRastreamentoStatusPorVeiculo();
  const { data: ocorrencias = [] } = useOcorrencias();
  const { data: ordens = [] } = useOrdensServico();
  const { data: statuses = [] } = useVehicleStatuses();

  const v = useMemo(() => vehicles.find((x) => x.id === vehicleId), [vehicles, vehicleId]);
  const statusLabel = useMemo(() => statuses.find((s) => s.value === v?.status)?.label ?? v?.status ?? "—", [statuses, v]);

  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const mesLabel = useMemo(() => { const s = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }); return s.charAt(0).toUpperCase() + s.slice(1); }, []);

  const contratoAtivo = useMemo(() => contratos.find((c) => c.vehicle_id === vehicleId && c.status === "ativo"), [contratos, vehicleId]);

  const fin = useMemo(() => {
    const doVeiculo = entries.filter((e) => e.vehicle_id === vehicleId);
    const noMes = doVeiculo.filter((e) => (e.data ?? "").slice(0, 7) === ym);
    const soma = (arr: typeof doVeiculo, tipo: "receita" | "despesa") => arr.filter((e) => e.tipo === tipo).reduce((s, e) => s + e.valor, 0);
    return {
      lancamentos: doVeiculo.slice(0, 40),
      recMes: soma(noMes, "receita"), despMes: soma(noMes, "despesa"),
      recTot: soma(doVeiculo, "receita"), despTot: soma(doVeiculo, "despesa"),
      manutMes: noMes.filter((e) => e.tipo === "despesa" && /manuten/i.test(e.categoria ?? "")).reduce((s, e) => s + e.valor, 0),
    };
  }, [entries, vehicleId, ym]);

  const receitaProjMes = contratoAtivo ? Number(contratoAtivo.valor_locacao ?? 0) * semanasNoMes(now) : 0;

  const kmPorMes = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of kmDiario) m.set(r.dia.slice(0, 7), (m.get(r.dia.slice(0, 7)) ?? 0) + (r.km || 0));
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12);
  }, [kmDiario]);
  const kmMes = kmPorMes.find(([mes]) => mes === ym)?.[1] ?? 0;

  const pendVeic = useMemo(() => pendencias.filter((p) => p.vehicle_id === vehicleId), [pendencias, vehicleId]);
  const pendAbertas = pendVeic.filter((p) => p.status === "aberta" || p.status === "em_andamento");
  const pendVencidas = pendAbertas.filter((p) => vencimentoStatus(p.vencimento, p.status) === "vencida");

  const rast = rastreios.find((r) => r.vehicle_id === vehicleId);
  const rastStatus = rastMap.get(vehicleId);

  const ocorrVeic = useMemo(() => ocorrencias.filter((o) => o.vehicle_id === vehicleId), [ocorrencias, vehicleId]);
  const ocorrAbertas = ocorrVeic.filter((o) => o.status === "aberta" || o.status === "em_andamento");
  const ordensVeic = useMemo(() => ordens.filter((o) => o.vehicle_id === vehicleId), [ordens, vehicleId]);
  const timeline = useMemo(() => (v ? construirLinhaTempo(vehicleId, contratos, ocorrencias, tipoLabel, tipoCor) : []), [v, vehicleId, contratos, ocorrencias]);

  if (isLoading) return <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>;
  if (!v) return <EmptyState message="Veículo não encontrado" action={<Button variant="outline" onClick={() => navigate("/frota-ativa")}><ArrowLeft className="h-4 w-4" /> Voltar</Button>} />;

  const naFrota = grupoFrota(v.status) !== null;
  const placaEnc = encodeURIComponent(v.placa);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${maskPlaca(v.placa)} — ${v.marca} ${v.modelo}`}
        description={`${v.ano_fabricacao ?? ""}/${v.ano_modelo ?? ""} · ${v.categoria ?? "—"} · KM atual ${formatNumber(v.km_atual)}${v.proprietario_nome ? ` · Proprietário: ${v.proprietario_nome}` : ""}`}
        actions={
          <div className="flex items-center gap-2">
            <VehicleStatusBadge status={v.status} />
            <Button variant="outline" size="sm" onClick={() => navigate("/frota-ativa")}><ArrowLeft className="h-4 w-4" /> Frota</Button>
          </div>
        }
      />

      {!naFrota && (
        <Card className="border-warning/40"><CardContent className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
          <AlertTriangle className="h-4 w-4 text-warning" /> Este veículo está com status <b className="mx-1">{statusLabel}</b>, fora da frota ativa. As informações abaixo continuam disponíveis.
        </CardContent></Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title={`Receita proj. × real. · ${mesLabel}`} value={formatCurrency(fin.recMes)} hint={`Projetada ${formatCurrency(receitaProjMes)}`} tone={receitaProjMes > 0 && fin.recMes >= receitaProjMes * 0.9 ? "success" : "warning"} icon={<TrendingUp className="h-5 w-5" />} />
        <StatCard title={`Despesas · ${mesLabel}`} value={formatCurrency(fin.despMes)} hint={`Manutenção ${formatCurrency(fin.manutMes)} · total ${formatCurrency(fin.despTot)}`} tone="destructive" icon={<Wrench className="h-5 w-5" />} />
        <StatCard title={`KM · ${mesLabel}`} value={`${formatNumber(Math.round(kmMes))} km`} hint={`KM atual ${formatNumber(v.km_atual)}`} icon={<Gauge className="h-5 w-5" />} />
        <StatCard title="Pendências" value={pendAbertas.length} hint={pendVencidas.length > 0 ? `${pendVencidas.length} vencida(s)` : "nenhuma vencida"} tone={pendVencidas.length > 0 ? "destructive" : "default"} icon={<AlertTriangle className="h-5 w-5" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Contrato & locatário */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Contrato & locatário</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate("/contratos")}><FileSignature className="h-4 w-4" /> Contratos</Button>
          </CardHeader>
          <CardContent className="text-sm">
            {contratoAtivo ? (
              <div className="space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Contrato</span><span className="font-mono font-medium">{contratoAtivo.numero}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Locatário</span><span className="font-medium">{contratoAtivo.cliente_nome}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Valor semanal</span><span>{formatCurrency(contratoAtivo.valor_locacao)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Semanas</span><span>{contratoAtivo.semanas ?? "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Receita projetada ({mesLabel})</span><span className="font-semibold">{formatCurrency(receitaProjMes)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Entrega</span><span>{formatDate(contratoAtivo.data_entrega)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Devolução prevista</span><span>{formatDate(contratoAtivo.devolucao_prevista)}</span></div>
                {contratoAtivo.pre_autorizacao != null && <div className="flex justify-between"><span className="text-muted-foreground">Pré-autorização</span><span>{formatCurrency(contratoAtivo.pre_autorizacao)}</span></div>}
              </div>
            ) : (
              <p className="text-muted-foreground">Sem contrato ativo{v.status === "locado" ? " — veículo locado sem locatário designado." : "."}</p>
            )}
          </CardContent>
        </Card>

        {/* Rastreamento */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Rastreamento</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate("/rastreamento")}><Satellite className="h-4 w-4" /> Rastreamento</Button>
          </CardHeader>
          <CardContent className="text-sm">
            {rast ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Situação</span>
                  {rastStatus?.comunicando ? <Badge variant="success" className="gap-1"><Wifi className="h-3 w-3" /> Comunicando</Badge> : <Badge variant="destructive" className="gap-1"><WifiOff className="h-3 w-3" /> Sem comunicação</Badge>}
                </div>
                <div className="flex justify-between"><span className="text-muted-foreground">Última comunicação</span><span>{formatDateTime(rast.ultima_comunicacao)}</span></div>
                {rastStatus?.dias != null && <div className="flex justify-between"><span className="text-muted-foreground">Há</span><span>{Math.floor(rastStatus.dias)} dia(s)</span></div>}
                {rast.endereco && <div className="flex justify-between gap-2"><span className="text-muted-foreground">Localização</span><span className="max-w-[60%] truncate text-right" title={rast.endereco}>{rast.endereco}</span></div>}
                {rast.convocado && <Badge variant="warning">Convocado</Badge>}
              </div>
            ) : (
              <p className="text-muted-foreground">Sem dados de rastreamento para este veículo.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Financeiro */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base">Financeiro do veículo</CardTitle>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => navigate("/receitas")}><Wallet className="h-4 w-4" /> Receitas</Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/despesas")}><Wallet className="h-4 w-4" /> Despesas</Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {fin.lancamentos.length === 0 ? <EmptyState message="Nenhum lançamento para este veículo" /> : (
            <div className="overflow-x-auto">
              <Table className="text-xs [&_th]:h-9 [&_th]:px-2 [&_td]:px-2 [&_td]:py-2">
                <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Tipo</TableHead><TableHead>Categoria</TableHead><TableHead>Descrição</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
                <TableBody>
                  {fin.lancamentos.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="whitespace-nowrap">{formatDate(e.data)}</TableCell>
                      <TableCell><Badge variant={e.tipo === "receita" ? "success" : "destructive"} className="px-1.5 py-0 text-[10px]">{e.tipo === "receita" ? "Receita" : "Despesa"}</Badge></TableCell>
                      <TableCell className="whitespace-nowrap">{e.categoria ?? "—"}</TableCell>
                      <TableCell className="max-w-[280px] truncate" title={e.descricao}>{e.descricao}</TableCell>
                      <TableCell className={`whitespace-nowrap text-right tabular-nums ${e.tipo === "receita" ? "text-success" : "text-destructive"}`}>{formatCurrency(e.valor)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Custos de manutenção: ocorrências + OS */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Ocorrências ({ocorrAbertas.length} abertas)</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate(`/ocorrencias?veiculo=${placaEnc}`)}>Ver</Button>
          </CardHeader>
          <CardContent className="p-0">
            {ocorrVeic.length === 0 ? <EmptyState message="Nenhuma ocorrência" /> : (
              <div className="overflow-x-auto">
                <Table className="text-xs [&_th]:h-9 [&_th]:px-2 [&_td]:px-2 [&_td]:py-2">
                  <TableHeader><TableRow><TableHead>Início</TableHead><TableHead>Tipo</TableHead><TableHead>Título</TableHead><TableHead className="text-right">Custo</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {ocorrVeic.slice(0, 15).map((o) => (
                      <TableRow key={o.id}>
                        <TableCell className="whitespace-nowrap">{formatDate(o.inicio)}</TableCell>
                        <TableCell><Badge variant="secondary" className="gap-1 px-1.5 py-0 text-[10px]"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: tipoCor(o.tipo) }} />{tipoLabel(o.tipo)}</Badge></TableCell>
                        <TableCell className="max-w-[160px] truncate" title={o.titulo ?? undefined}>{o.titulo ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{o.custo != null ? formatCurrency(o.custo) : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Ordens de serviço</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate("/ordens-servico")}><Wrench className="h-4 w-4" /> Ver</Button>
          </CardHeader>
          <CardContent className="p-0">
            {ordensVeic.length === 0 ? <EmptyState message="Nenhuma OS" /> : (
              <div className="overflow-x-auto">
                <Table className="text-xs [&_th]:h-9 [&_th]:px-2 [&_td]:px-2 [&_td]:py-2">
                  <TableHeader><TableRow><TableHead>Nº</TableHead><TableHead>Abertura</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {ordensVeic.slice(0, 15).map((o) => (
                      <TableRow key={o.id}>
                        <TableCell className="whitespace-nowrap font-mono">{o.numero}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatDate(o.data_abertura)}</TableCell>
                        <TableCell><Badge variant="secondary" className="px-1.5 py-0 text-[10px]">{osLabel(o.status)}</Badge></TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(o.valor_total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* KM por mês + Pendências */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">KM por mês</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate("/apuracao-km")}><Gauge className="h-4 w-4" /> Apuração</Button>
          </CardHeader>
          <CardContent className="p-0">
            {kmPorMes.length === 0 ? <EmptyState message="Sem leituras de KM" /> : (
              <div className="overflow-x-auto">
                <Table className="text-xs [&_th]:h-9 [&_th]:px-2 [&_td]:px-2 [&_td]:py-2">
                  <TableHeader><TableRow><TableHead>Mês</TableHead><TableHead className="text-right">KM rodado</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {kmPorMes.map(([mes, km]) => (
                      <TableRow key={mes}><TableCell className="whitespace-nowrap">{mes}</TableCell><TableCell className="text-right tabular-nums">{formatNumber(Math.round(km))} km</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Pendências ({pendAbertas.length})</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate(`/pendencias?veiculo=${placaEnc}`)}><AlertTriangle className="h-4 w-4" /> Ver</Button>
          </CardHeader>
          <CardContent className="p-0">
            {pendVeic.length === 0 ? <EmptyState message="Nenhuma pendência" /> : (
              <div className="overflow-x-auto">
                <Table className="text-xs [&_th]:h-9 [&_th]:px-2 [&_td]:px-2 [&_td]:py-2">
                  <TableHeader><TableRow><TableHead>Categoria</TableHead><TableHead>Título</TableHead><TableHead>Vencimento</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {pendVeic.slice(0, 15).map((p) => {
                      const vb = VENC_BADGE[vencimentoStatus(p.vencimento, p.status)];
                      return (
                        <TableRow key={p.id}>
                          <TableCell><Badge variant="secondary" className="px-1.5 py-0 text-[10px]">{p.categoria}</Badge></TableCell>
                          <TableCell className="max-w-[150px] truncate" title={p.titulo}>{p.titulo}</TableCell>
                          <TableCell className="whitespace-nowrap">{p.vencimento ? <Badge variant={vb.variant} className="px-1.5 py-0 text-[10px]">{formatDate(p.vencimento)}</Badge> : "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">{p.valor != null ? formatCurrency(p.valor) : "—"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Linha do tempo */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><CalendarClock className="h-4 w-4" /> Linha do tempo</CardTitle></CardHeader>
        <CardContent>
          {timeline.length === 0 ? <EmptyState message="Sem histórico para montar a linha do tempo" /> : (
            <ol className="space-y-2">
              {timeline.slice().reverse().slice(0, 40).map((s, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.cor ?? "hsl(215 16% 55%)" }} />
                  <div className="min-w-0">
                    <div className="font-medium">
                      {formatDate(s.inicioISO.slice(0, 10))}{s.fimISO && s.fimISO.slice(0, 10) !== s.inicioISO.slice(0, 10) ? ` – ${formatDate(s.fimISO.slice(0, 10))}` : ""} · {s.estado}
                    </div>
                    <div className="text-muted-foreground">{s.detalhe}</div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
