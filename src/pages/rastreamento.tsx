import { useMemo, useState } from "react";
import {
  Satellite, Wifi, WifiOff, AlertTriangle, Upload, FileText, BadgeCheck, ShoppingCart, Bell, MapPin,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { formatNumber } from "@/lib/format";
import { useRastreamento, useConvocar, type RastreioRow } from "@/hooks/use-rastreamento";
import { useAppConfig } from "@/hooks/use-app-config";
import { useCanWrite } from "@/hooks/use-can-write";
import { ImportarGridDialog } from "@/components/rastreamento/importar-grid-dialog";
import { abrirRelatorioRastreio } from "@/lib/relatorio-rastreamento";

const AGORA = Date.now();

/** Classifica a conectividade de um veículo a partir da última comunicação. */
function classificar(r: RastreioRow, limiarH: number) {
  const vendido = r.vehicles?.status === "vendido";
  if (!r.ultima_comunicacao) return { dias: null as number | null, semCom: true, tier: "semdata", vendido };
  const dias = (AGORA - new Date(r.ultima_comunicacao).getTime()) / 86400000;
  const semCom = dias * 24 >= limiarH;
  const tier = !semCom ? "ok" : dias < 2 ? "1a2" : dias < 7 ? "2a7" : dias < 30 ? "7a30" : "30";
  return { dias, semCom, tier, vendido };
}
const fmtData = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)} ${iso.slice(11, 16)}` : "—");
const fmtDias = (d: number | null) => (d == null ? "sem data" : d < 1 ? "hoje" : `${formatNumber(Math.floor(d))} dia(s)`);

export default function RastreamentoPage() {
  const { data: rows = [], isLoading } = useRastreamento();
  const { data: config } = useAppConfig();
  const convocar = useConvocar();
  const podeEscrever = useCanWrite("rastreamento");

  const [showImport, setShowImport] = useState(false);
  const [search, setSearch] = useState("");
  const [fStatus, setFStatus] = useState("todos");
  const [fGrupo, setFGrupo] = useState("todos");

  const limiarH = Number(config?.rastreamento_limiar_horas ?? 24) || 24;
  const referencia = rows.find((r) => r.referencia)?.referencia ?? null;

  const dados = useMemo(() => rows.map((r) => ({ r, c: classificar(r, limiarH) })), [rows, limiarH]);
  const grupos = useMemo(() => [...new Set(rows.map((r) => r.grupo).filter(Boolean) as string[])].sort(), [rows]);

  const kpi = useMemo(() => {
    let comunicando = 0, semCom = 0, vendidos = 0, convocados = 0, t1a2 = 0, t2a7 = 0, t7a30 = 0, t30 = 0;
    for (const { r, c } of dados) {
      if (c.semCom) semCom++; else comunicando++;
      if (c.vendido) vendidos++;
      if (r.convocado) convocados++;
      if (c.tier === "1a2") t1a2++; else if (c.tier === "2a7") t2a7++; else if (c.tier === "7a30") t7a30++; else if (c.tier === "30" || c.tier === "semdata") t30++;
    }
    return { total: dados.length, comunicando, semCom, vendidos, convocados, t1a2, t2a7, t7a30, t30 };
  }, [dados]);

  const filtrados = useMemo(() => {
    const q = search.toLowerCase();
    return dados.filter(({ r, c }) => {
      const mG = fGrupo === "todos" || r.grupo === fGrupo;
      const mQ = !q || r.placa.toLowerCase().includes(q) || (r.vehicles?.modelo ?? "").toLowerCase().includes(q);
      const mS =
        fStatus === "todos" ? true :
        fStatus === "comunicando" ? !c.semCom :
        fStatus === "sem_comunicacao" ? c.semCom :
        fStatus === "vendido" ? c.vendido :
        fStatus === "convocado" ? r.convocado : true;
      return mG && mQ && mS;
    });
  }, [dados, search, fStatus, fGrupo]);

  function gerarRelatorio() {
    const linhas = (arr: typeof dados) => arr.map(({ r, c }) => ({
      placa: r.vehicles?.placa ?? r.placa, modelo: r.vehicles?.modelo ?? "", ultima: r.ultima_comunicacao,
      dias: c.dias, status: r.vehicles?.status ?? "", endereco: r.endereco ?? "", estados: r.estados ?? "", convocado: r.convocado,
    }));
    const ok = abrirRelatorioRastreio({
      empresa: config?.empresa_nome ?? "VIP CARS", referencia: referencia ?? "", limiarHoras: limiarH,
      kpi: { total: kpi.total, comunicando: kpi.comunicando, semCom: kpi.semCom, convocados: kpi.convocados, vendidos: kpi.vendidos, t1a2: kpi.t1a2, t2a7: kpi.t2a7, t7a30: kpi.t7a30, t30: kpi.t30 },
      semComunicacao: linhas(dados.filter(({ c }) => c.semCom)),
      vendidos: linhas(dados.filter(({ c }) => c.vendido)),
    });
    if (!ok) toast.error("Permita pop-ups para visualizar o relatório.");
  }

  const badgeDias = ({ dias, semCom, tier }: { dias: number | null; semCom: boolean; tier: string }) => {
    if (!semCom) return <Badge variant="success">{fmtDias(dias)}</Badge>;
    const cor = tier === "30" || tier === "semdata" || tier === "7a30" ? "border-destructive text-destructive" : "border-warning text-warning";
    return <Badge variant="outline" className={cor}>{fmtDias(dias)}</Badge>;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rastreamento Ituran"
        description="Conectividade da frota com a central — última comunicação por veículo"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={gerarRelatorio} disabled={!rows.length}><FileText className="h-4 w-4" /> Relatório</Button>
            {podeEscrever && <Button size="sm" onClick={() => setShowImport(true)}><Upload className="h-4 w-4" /> Importar Ituran</Button>}
          </>
        }
      />

      {referencia && <p className="text-xs text-muted-foreground">Referência do relatório: {fmtData(referencia)} · sem comunicação = última atualização há mais de {limiarH}h</p>}

      {/* Alertas */}
      {(kpi.vendidos > 0 || kpi.semCom > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {kpi.vendidos > 0 && (
            <button type="button" onClick={() => setFStatus("vendido")} className="flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-left transition-colors hover:bg-destructive/20">
              <ShoppingCart className="h-5 w-5 shrink-0 text-destructive" />
              <div className="text-sm"><span className="font-semibold">{kpi.vendidos} veículo(s) vendido(s)</span> ainda na base de rastreamento — <span className="font-medium">retirar o rastreador</span>.</div>
            </button>
          )}
          {kpi.semCom > 0 && (
            <button type="button" onClick={() => setFStatus("sem_comunicacao")} className="flex items-center gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-left transition-colors hover:bg-warning/20">
              <WifiOff className="h-5 w-5 shrink-0 text-warning" />
              <div className="text-sm"><span className="font-semibold">{kpi.semCom} veículo(s) sem comunicação</span> — convocar para ajuste do rastreamento.</div>
            </button>
          )}
        </div>
      )}

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <button type="button" onClick={() => setFStatus("todos")} className="text-left"><StatCard title="Veículos na base" value={formatNumber(kpi.total)} hint="rastreados pelo Ituran" icon={<Satellite className="h-5 w-5" />} /></button>
        <button type="button" onClick={() => setFStatus("comunicando")} className="text-left"><StatCard title="Comunicando" value={formatNumber(kpi.comunicando)} hint={`última atualização < ${limiarH}h`} tone="success" icon={<Wifi className="h-5 w-5" />} /></button>
        <button type="button" onClick={() => setFStatus("sem_comunicacao")} className="text-left"><StatCard title="Sem comunicação" value={formatNumber(kpi.semCom)} hint="convocar para ajuste" tone="warning" icon={<WifiOff className="h-5 w-5" />} /></button>
        <button type="button" onClick={() => setFStatus("vendido")} className="text-left"><StatCard title="Vendidos c/ rastreador" value={formatNumber(kpi.vendidos)} hint="retirar rastreador" tone={kpi.vendidos > 0 ? "destructive" : "default"} icon={<ShoppingCart className="h-5 w-5" />} /></button>
        <button type="button" onClick={() => setFStatus("convocado")} className="text-left"><StatCard title="Convocados" value={formatNumber(kpi.convocados)} hint="marcados para ação" icon={<Bell className="h-5 w-5" />} /></button>
        <StatCard title="+ de 30 dias offline" value={formatNumber(kpi.t30)} hint="prioridade crítica" tone={kpi.t30 > 0 ? "destructive" : "default"} icon={<AlertTriangle className="h-5 w-5" />} />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flex flex-col gap-2 border-b p-3 sm:flex-row sm:items-center sm:p-4">
            <Input placeholder="Buscar por placa ou modelo..." value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 border-0 focus-visible:ring-0" />
            <Select value={fStatus} onValueChange={setFStatus}>
              <SelectTrigger className="w-full sm:w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="comunicando">Comunicando</SelectItem>
                <SelectItem value="sem_comunicacao">Sem comunicação</SelectItem>
                <SelectItem value="vendido">Vendidos c/ rastreador</SelectItem>
                <SelectItem value="convocado">Convocados</SelectItem>
              </SelectContent>
            </Select>
            {grupos.length > 1 && (
              <Select value={fGrupo} onValueChange={setFGrupo}>
                <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os grupos</SelectItem>
                  {grupos.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : filtrados.length === 0 ? (
            <EmptyState
              message={rows.length === 0 ? "Nenhum rastreamento. Importe o relatório 'Grade de veículos' do Ituran." : "Nenhum veículo neste filtro"}
              icon={<Satellite className="h-6 w-6" />}
              action={rows.length === 0 && podeEscrever ? <Button onClick={() => setShowImport(true)}><Upload className="h-4 w-4" /> Importar Ituran</Button> : undefined}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Placa</TableHead>
                    <TableHead>Última comunicação</TableHead>
                    <TableHead>Tempo</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead>Localização</TableHead>
                    {podeEscrever && <TableHead className="text-right">Ação</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.map(({ r, c }) => (
                    <TableRow key={r.id} className={c.vendido ? "bg-destructive/5" : ""}>
                      <TableCell>
                        <span className="font-mono font-medium">{r.vehicles?.placa ?? r.placa}</span>
                        {r.vehicles?.modelo && r.vehicles.modelo !== "(a definir)" && <div className="text-xs text-muted-foreground">{r.vehicles.modelo}</div>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{fmtData(r.ultima_comunicacao)}</TableCell>
                      <TableCell>{badgeDias(c)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1">
                          {c.vendido && <Badge variant="outline" className="border-destructive text-destructive">Vendido · retirar rastreador</Badge>}
                          {!c.semCom && !c.vendido && <Badge variant="success" className="gap-1"><BadgeCheck className="h-3 w-3" /> OK</Badge>}
                          {c.semCom && !c.vendido && <Badge variant="outline" className="border-warning text-warning">Sem comunicação</Badge>}
                          {r.convocado && <Badge variant="secondary" className="gap-1"><Bell className="h-3 w-3" /> Convocado</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[16rem] truncate text-xs text-muted-foreground">
                        {r.endereco ? <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3 shrink-0" />{r.endereco}</span> : "—"}
                      </TableCell>
                      {podeEscrever && (
                        <TableCell className="text-right">
                          <Button variant={r.convocado ? "secondary" : "outline"} size="sm" disabled={convocar.isPending}
                            onClick={() => convocar.mutate({ id: r.id, convocado: !r.convocado })}>
                            {r.convocado ? "Desmarcar" : c.vendido ? "Convocar retirada" : "Convocar"}
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ImportarGridDialog open={showImport} onOpenChange={setShowImport} />
    </div>
  );
}
