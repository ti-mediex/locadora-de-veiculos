import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Receipt, ChevronLeft, ChevronRight, CalendarClock, TrendingDown, CheckCircle2, XCircle, Paperclip, Upload } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { SortableHead } from "@/components/shared/sortable-head";
import { RelatorioExport } from "@/components/shared/relatorio-export";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSort } from "@/hooks/use-sort";
import { useList } from "@/hooks/use-crud";
import { useCanWrite } from "@/hooks/use-can-write";
import { useContratos } from "@/hooks/use-contratos";
import { useFinanceEntries } from "@/hooks/use-finance";
import { useMarcarRecebido, useUploadArquivoFinanceiro, abrirArquivoFinanceiro, useReceberKmExcedente } from "@/hooks/use-recebimentos";
import { useDebitos } from "@/hooks/use-financeiro-locatario";
import { useParalisacoes } from "@/hooks/use-paralisacoes";
import { OCORRENCIA_TIPO } from "@/lib/options";
import { formatCurrency, formatNumber, formatDate, maskPlaca } from "@/lib/format";
import type { Vehicle } from "@/types/database";
import type { RelatorioTabelaData, RelColuna } from "@/lib/relatorio-tabela";

const TIPO = Object.fromEntries(OCORRENCIA_TIPO.map((t) => [t.value, t]));
const tipoLabel = (t: string) => TIPO[t]?.label ?? t;
const isoDia = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const h1 = (n: number) => `${formatNumber(Math.round(n * 10) / 10)}h`;

/** Sexta-feira da semana que contém a data. */
function sextaDaSemana(base: Date) { const x = new Date(base); x.setDate(x.getDate() + (5 - x.getDay())); x.setHours(0, 0, 0, 0); return x; }

interface Boleto {
  contratoId: string; vehicle_id: string; placa: string; modelo: string; categoria: string;
  locatario: string; numero: string; original: number; desconto: number; acrescimo: number; liquido: number;
  motivos: string[]; acrescimoMotivos: string[]; debitoIds: string[]; pago: boolean;
  entryId: string | null; recebidoEm: string | null; comprovantePath: string | null;
}

export default function BoletosPage() {
  const navigate = useNavigate();
  const [offset, setOffset] = useState(0); // semanas a partir da atual
  const { linhas, descontosSemana } = useParalisacoes();
  const { data: contratos = [] } = useContratos();
  const { data: vehicles = [] } = useList<Vehicle>("vehicles");
  const canWrite = useCanWrite("finance");
  const marcarRecebido = useMarcarRecebido();
  const receberKmExc = useReceberKmExcedente();
  const uploadArquivo = useUploadArquivoFinanceiro();
  const { data: debitos = [] } = useDebitos();

  // Boleto da sexta F cobre o período [F, F+7) (pagamento antecipado).
  const sexta = useMemo(() => { const s = sextaDaSemana(new Date()); s.setDate(s.getDate() + offset * 7); return s; }, [offset]);
  const fimPeriodo = useMemo(() => { const s = new Date(sexta); s.setDate(s.getDate() + 6); return s; }, [sexta]);
  const isoSex = isoDia(sexta), isoFim = isoDia(fimPeriodo);
  const semanaLabel = `${formatDate(isoSex)} a ${formatDate(isoFim)}`;

  const { data: entriesSemana = [] } = useFinanceEntries(isoSex, isoFim);

  const vMap = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles]);

  const boletos = useMemo<Boleto[]>(() => {
    // Lançamento (receita de aluguel) da sexta de vencimento, por veículo.
    const entryPorVeic = new Map<string, { id: string; recebido: boolean; recebidoEm: string | null; comprovante: string | null }>();
    for (const e of entriesSemana) if (e.vehicle_id && e.tipo === "receita" && e.data === isoSex && /alug|loca[çc]/i.test(e.categoria ?? "")) {
      entryPorVeic.set(e.vehicle_id, { id: e.id, recebido: e.recebido, recebidoEm: e.recebido_em, comprovante: e.comprovante_path });
    }
    const descPorVeic = new Map<string, { desconto: number }>();
    for (const d of descontosSemana) if (d.semanaIni === isoSex) descPorVeic.set(d.vehicle_id, { desconto: d.desconto });

    // Acréscimos da semana: parcelas de KM excedente (débitos do locatário) com
    // semana_venc = sexta do boleto, agrupadas por contrato.
    const acrPorContrato = new Map<string, { valor: number; motivos: string[]; ids: string[] }>();
    for (const d of debitos) {
      if (d.categoria !== "km_excedente" || d.pago || d.semana_venc !== isoSex || !d.contrato_id) continue;
      const cur = acrPorContrato.get(d.contrato_id) ?? { valor: 0, motivos: [], ids: [] };
      cur.valor += Number(d.valor);
      cur.motivos.push(`${d.descricao ?? "KM excedente"} = ${formatCurrency(Number(d.valor))}`);
      cur.ids.push(d.id);
      acrPorContrato.set(d.contrato_id, cur);
    }

    return contratos.filter((c) => c.status === "ativo" && c.vehicle_id).map((c) => {
      const vid = c.vehicle_id!;
      const v = vMap.get(vid);
      const original = Number(c.valor_locacao ?? 0);
      const desconto = descPorVeic.get(vid)?.desconto ?? 0;
      const acr = acrPorContrato.get(c.id) ?? { valor: 0, motivos: [], ids: [] };
      const motivos = linhas
        .filter((l) => l.vehicle_id === vid && l.semanaIni === isoSex && l.horasDesc > 0)
        .map((l) => `${tipoLabel(l.tipo)} em ${formatDate(l.inicio.slice(0, 10))} — ${h1(l.horas)} (${h1(l.horasDesc)} desc.) = ${formatCurrency(l.desconto)}`);
      const ent = entryPorVeic.get(vid);
      return {
        contratoId: c.id, vehicle_id: vid, placa: c.vehicles?.placa ?? v?.placa ?? c.placa ?? "—",
        modelo: c.vehicles?.modelo ?? v?.modelo ?? "", categoria: v?.categoria ?? "—",
        locatario: c.cliente_nome ?? "", numero: c.numero,
        original, desconto, acrescimo: acr.valor, liquido: Math.max(0, original - desconto) + acr.valor,
        motivos, acrescimoMotivos: acr.motivos, debitoIds: acr.ids, pago: !!ent?.recebido,
        entryId: ent?.id ?? null, recebidoEm: ent?.recebidoEm ?? null, comprovantePath: ent?.comprovante ?? null,
      };
    });
  }, [contratos, vMap, linhas, descontosSemana, entriesSemana, debitos, isoSex]);

  const { sortKey, sortDir, toggle, useSorted } = useSort<Boleto>("placa", "asc");
  const sorted = useSorted(boletos, (b, k) => {
    switch (k) {
      case "placa": return b.placa;
      case "tipo": return b.modelo || b.categoria;
      case "locatario": return b.locatario;
      case "contrato": return b.numero;
      case "original": return b.original;
      case "desconto": return b.desconto;
      case "acrescimo": return b.acrescimo;
      case "liquido": return b.liquido;
      case "status": return b.pago ? 1 : 0;
      default: return "";
    }
  });

  const kpi = useMemo(() => {
    let orig = 0, desc = 0, acr = 0, liq = 0, naoPagos = 0;
    for (const b of boletos) { orig += b.original; desc += b.desconto; acr += b.acrescimo; liq += b.liquido; if (!b.pago) naoPagos += 1; }
    return { orig, desc, acr, liq, naoPagos, total: boletos.length };
  }, [boletos]);

  function buildRelatorio(): RelatorioTabelaData {
    const colunas: RelColuna[] = [
      { label: "Placa" }, { label: "Tipo" }, { label: "Locatário" }, { label: "Contrato" }, { label: "Vencimento" },
      { label: "Valor original", align: "right" }, { label: "Desconto", align: "right" }, { label: "Acréscimo km", align: "right" }, { label: "A emitir", align: "right" }, { label: "Status" },
    ];
    const linhasRel = sorted.map((b) => [
      maskPlaca(b.placa), b.modelo || b.categoria, b.locatario, b.numero, formatDate(isoSex),
      formatCurrency(b.original), b.desconto > 0 ? formatCurrency(b.desconto) : "—", b.acrescimo > 0 ? formatCurrency(b.acrescimo) : "—", formatCurrency(b.liquido), b.pago ? "Pago" : "Não pago",
    ]);
    return {
      titulo: "Boletos semanais", subtitulo: `Período ${semanaLabel} · vencimento ${formatDate(isoSex)} (sexta, antecipado) · descontos das paralisações do período anterior`,
      colunas, linhas: linhasRel,
      rodape: ["", "", "", "", "Total", formatCurrency(kpi.orig), formatCurrency(kpi.desc), formatCurrency(kpi.acr), formatCurrency(kpi.liq), `${kpi.naoPagos} não pago(s)`],
    };
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Boletos Semanais"
        description={`Pagamento antecipado · vencimento sexta ${formatDate(isoSex)} (cobre ${semanaLabel}) · locação − descontos das paralisações do período anterior`}
        actions={<RelatorioExport build={buildRelatorio} nomeArquivo="boletos-semanais" disabled={!sorted.length} />}
      />

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setOffset((o) => o - 1)}><ChevronLeft className="h-4 w-4" /> Semana anterior</Button>
        <div className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm"><CalendarClock className="h-4 w-4 text-muted-foreground" /> Período {semanaLabel} · vencimento <b>{formatDate(isoSex)}</b></div>
        <Button variant="outline" size="sm" onClick={() => setOffset((o) => o + 1)} disabled={offset >= 0}>Próxima semana <ChevronRight className="h-4 w-4" /></Button>
        {offset !== 0 && <Button variant="ghost" size="sm" onClick={() => setOffset(0)}>Semana atual</Button>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total a emitir" value={formatCurrency(kpi.liq)} hint={`${kpi.total} boleto(s)`} tone="default" icon={<Receipt className="h-5 w-5" />} />
        <StatCard title="Valor de locação (bruto)" value={formatCurrency(kpi.orig)} icon={<Receipt className="h-5 w-5" />} onClick={() => navigate("/contratos")} />
        <StatCard title="Descontos (paralisação)" value={formatCurrency(kpi.desc)} tone="warning" icon={<TrendingDown className="h-5 w-5" />} onClick={() => navigate("/linha-do-tempo")} />
        <StatCard title="Não pagos" value={kpi.naoPagos} hint="sem recebimento registrado" tone={kpi.naoPagos > 0 ? "destructive" : "success"} icon={<XCircle className="h-5 w-5" />} onClick={() => navigate("/resumo-locatarios")} />
      </div>

      <Card>
        <CardContent className="p-0">
          {sorted.length === 0 ? <EmptyState message="Nenhum contrato ativo para emitir boleto" icon={<Receipt className="h-6 w-6" />} /> : (
            <div className="overflow-x-auto">
              <Table className="text-xs [&_th]:h-9 [&_th]:whitespace-nowrap [&_th]:px-1 [&_th]:text-[11px] [&_td]:px-1 [&_td]:py-2">
                <TableHeader>
                  <TableRow>
                    <SortableHead sortKey="placa" activeKey={sortKey} dir={sortDir} onSort={toggle}>Placa</SortableHead>
                    <SortableHead sortKey="tipo" activeKey={sortKey} dir={sortDir} onSort={toggle}>Tipo</SortableHead>
                    <SortableHead sortKey="locatario" activeKey={sortKey} dir={sortDir} onSort={toggle}>Locatário</SortableHead>
                    <SortableHead sortKey="contrato" activeKey={sortKey} dir={sortDir} onSort={toggle}>Contrato</SortableHead>
                    <SortableHead sortKey="original" activeKey={sortKey} dir={sortDir} onSort={toggle} align="right">Valor original</SortableHead>
                    <SortableHead sortKey="desconto" activeKey={sortKey} dir={sortDir} onSort={toggle} align="right">Desconto</SortableHead>
                    <SortableHead sortKey="acrescimo" activeKey={sortKey} dir={sortDir} onSort={toggle} align="right">Acréscimo km</SortableHead>
                    <SortableHead sortKey="liquido" activeKey={sortKey} dir={sortDir} onSort={toggle} align="right">A emitir</SortableHead>
                    <SortableHead sortKey="status" activeKey={sortKey} dir={sortDir} onSort={toggle}>Recebimento</SortableHead>
                    {canWrite && <TableHead className="w-16"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((b) => (
                    <TableRow key={b.contratoId} className="cursor-pointer" onClick={() => navigate("/contratos")}>
                      <TableCell className="whitespace-nowrap font-mono font-medium">{maskPlaca(b.placa)}</TableCell>
                      <TableCell className="max-w-[110px] truncate" title={`${b.modelo}${b.categoria && b.categoria !== "—" ? ` · ${b.categoria}` : ""}`}>{b.modelo || b.categoria}</TableCell>
                      <TableCell className="max-w-[140px] truncate" title={b.locatario || undefined}>{b.locatario || <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="whitespace-nowrap font-mono">{b.numero}</TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums">{formatCurrency(b.original)}</TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums text-warning" title={b.motivos.join("\n") || undefined}>
                        {b.desconto > 0 ? `− ${formatCurrency(b.desconto)}` : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums text-destructive" title={b.acrescimoMotivos.join("\n") || undefined}>
                        {b.acrescimo > 0 ? `+ ${formatCurrency(b.acrescimo)}` : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right font-semibold tabular-nums">{formatCurrency(b.liquido)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          {b.pago
                            ? <Badge variant="success" className="gap-1 whitespace-nowrap px-1.5 py-0 text-[10px]"><CheckCircle2 className="h-3 w-3" /> {b.recebidoEm ? formatDate(b.recebidoEm) : "Pago"}</Badge>
                            : <Badge variant="destructive" className="gap-1 px-1.5 py-0 text-[10px]"><XCircle className="h-3 w-3" /> Não pago</Badge>}
                          {b.comprovantePath && <button type="button" title="Ver comprovante" onClick={() => abrirArquivoFinanceiro(b.comprovantePath!)}><Paperclip className="h-3.5 w-3.5 text-primary" /></button>}
                        </div>
                      </TableCell>
                      {canWrite && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-0.5">
                            {b.entryId && !b.pago && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" title="Marcar como recebido" aria-label="Marcar recebido"
                                onClick={() => {
                                  marcarRecebido.mutate({ id: b.entryId!, recebido: true, forma: "boleto" });
                                  if (b.acrescimo > 0) receberKmExc.mutate({ debitoIds: b.debitoIds, contrato_id: b.contratoId, vehicle_id: b.vehicle_id, data: isoSex, valor: b.acrescimo, forma: "boleto" });
                                }}><CheckCircle2 className="h-4 w-4 text-success" /></Button>
                            )}
                            {b.entryId && (
                              <label className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md hover:bg-accent" title="Anexar comprovante">
                                <Upload className="h-4 w-4" />
                                <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f && b.entryId) uploadArquivo.mutate({ entryId: b.entryId, file: f, campo: "comprovante_path" }); }} />
                              </label>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {sorted.some((b) => b.motivos.length > 0) && (
            <p className="border-t px-3 py-2 text-[11px] text-muted-foreground">Passe o mouse sobre o desconto para ver os motivos (paralisações da semana).</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
