import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2, Wrench, ClipboardList, CheckCircle2, Clock, Camera, X, Calculator, Upload, FileSpreadsheet } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Field } from "@/components/shared/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useList } from "@/hooks/use-crud";
import { useCanWrite } from "@/hooks/use-can-write";
import { useOcorrencias } from "@/hooks/use-ocorrencias";
import { useParalisacoes, type ParalisacaoLinha } from "@/hooks/use-paralisacoes";
import { MemoriaCalculoDesconto, MemoriaCalculoDialog } from "@/components/paralisacoes/memoria-calculo-desconto";
import { useOrdensServico, useSalvarOrdemServico, useDeleteOrdemServico, useOsFotos, useSaveOsFotos, useDeleteOsFoto, useOsItens, useUploadIturanOS, abrirArquivoOS, type OrdemServicoRow, type OsItemInput } from "@/hooks/use-ordens-servico";
import { useAppConfig } from "@/hooks/use-app-config";
import { parseIturanChegadaSaida, type IturanChegadaSaida } from "@/lib/ituran-os-parse";
import { OS_STATUS, OCORRENCIA_TIPO_SERVICO } from "@/lib/options";
import { formatCurrency, formatDate, formatDateTime, soAlfa, maskPlaca } from "@/lib/format";
import { noPeriodo } from "@/lib/date";
import { PeriodoFilter } from "@/components/shared/period-filter";
import { FrotaAtivaToggle } from "@/components/shared/frota-ativa-toggle";
import { ehFrotaAtiva } from "@/hooks/use-frota-ativa";
import type { Vehicle, OrdemServicoStatus, OsItemTipo } from "@/types/database";
import { useSort } from "@/hooks/use-sort";
import { SortableHead } from "@/components/shared/sortable-head";
import { BuscaPlaca } from "@/components/shared/busca-placa";
import { SelectVeiculo } from "@/components/shared/select-veiculo";
import { RelatorioExport } from "@/components/shared/relatorio-export";
import { VehicleStatusBadge, statusVeiculoLabel } from "@/components/shared/vehicle-status-badge";
import type { RelatorioTabelaData, RelColuna } from "@/lib/relatorio-tabela";

const statusLabel = (s: string) => OS_STATUS.find((x) => x.value === s)?.label ?? s;
const STATUS_VARIANT: Record<string, "warning" | "secondary" | "success" | "muted" | "destructive"> = {
  aberta: "warning", em_andamento: "secondary", aguardando_peca: "warning", aguardando_aprovacao: "warning", concluida: "success", cancelada: "muted",
};

const schema = z.object({
  ocorrencia_id: z.string().optional(),
  vehicle_id: z.string().optional(),
  tipo: z.string().default("manutencao_corretiva"),
  tipo_servico: z.string().optional(),
  oficina: z.string().optional(),
  responsavel: z.string().optional(),
  descricao: z.string().optional(),
  observacao: z.string().optional(),
  inicio: z.string().optional(),
  fim: z.string().optional(),
  km: z.union([z.coerce.number(), z.literal("")]).optional(),
  status: z.string().default("aberta"),
  data_abertura: z.string().optional(),
  previsao: z.string().optional(),
  data_conclusao: z.string().optional(),
}).refine((d) => !d.inicio || !d.fim || d.fim >= d.inicio, { message: "Fim antes do início", path: ["fim"] });
type FormData = z.infer<typeof schema>;
const hoje = () => new Date().toISOString().slice(0, 10);
const tipoServLabel = (t?: string | null) => OCORRENCIA_TIPO_SERVICO.find((x) => x.value === t)?.label ?? t ?? "—";
const h1 = (n: number) => `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(Math.round(n * 10) / 10)} h`;
/** ISO/​timestamptz -> valor de <input type="datetime-local"> (YYYY-MM-DDTHH:MM). */
const toLocalInput = (v?: string | null) => {
  if (!v) return "";
  const m = String(v).match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}` : "";
};
type ItemForm = OsItemInput;
const novoItem = (tipo_item: OsItemTipo = "peca"): ItemForm => ({ tipo_item, descricao: "", quantidade: 1, custo_unitario: 0 });

export default function OrdensServicoPage() {
  const { data: rows = [], isLoading } = useOrdensServico();
  const { data: vehicles = [] } = useList<Vehicle>("vehicles");
  const { data: ocorrencias = [] } = useOcorrencias();
  const { linhas: paralLinhas, franquiaH } = useParalisacoes();
  const { data: config } = useAppConfig();
  const salvar = useSalvarOrdemServico();
  const remove = useDeleteOrdemServico();
  const saveFotos = useSaveOsFotos();
  const delFoto = useDeleteOsFoto();
  const uploadIturan = useUploadIturanOS();
  const canWrite = useCanWrite("ordens_servico");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<OrdemServicoRow | null>(null);
  const [fotosNovas, setFotosNovas] = useState<File[]>([]);
  const { data: fotos = [] } = useOsFotos(editing?.id);
  const { data: itensSalvos = [] } = useOsItens(editing?.id);
  const [itens, setItens] = useState<ItemForm[]>([]);
  const [ituranFile, setIturanFile] = useState<File | null>(null);
  const [ituranInfo, setIturanInfo] = useState<IturanChegadaSaida | null>(null);
  const [search, setSearch] = useState("");
  const [pIni, setPIni] = useState("");
  const [pFim, setPFim] = useState("");
  const [fFrota, setFFrota] = useState(false);
  const frotaVeicIds = useMemo(() => new Set(vehicles.filter((v) => ehFrotaAtiva(v.status)).map((v) => v.id)), [vehicles]);
  const [fStatus, setFStatus] = useState("ativas");
  const [memoria, setMemoria] = useState<ParalisacaoLinha | null>(null);

  // Paralisação (e desconto) vinculada a esta OS via a ocorrência de origem.
  const paralPorOcorrencia = useMemo(() => {
    const m = new Map<string, ParalisacaoLinha>();
    for (const l of paralLinhas) if (l.ocorrencia?.id) m.set(l.ocorrencia.id, l);
    return m;
  }, [paralLinhas]);
  const linhaDaOs = (os: OrdemServicoRow | null): ParalisacaoLinha | null =>
    (os?.ocorrencia_id && paralPorOcorrencia.get(os.ocorrencia_id)) || null;

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) });
  const vMap = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles]);

  // Totais derivados dos itens (peças × serviços).
  const custoItem = (i: ItemForm) => (Number(i.quantidade) || 1) * (Number(i.custo_unitario) || 0);
  const totalPecas = itens.filter((i) => i.tipo_item === "peca").reduce((s, i) => s + custoItem(i), 0);
  const totalServicos = itens.filter((i) => i.tipo_item === "servico").reduce((s, i) => s + custoItem(i), 0);
  const totalForm = totalPecas + totalServicos;

  // Tempo de paralisação a partir de início/fim do formulário.
  const iniW = watch("inicio"); const fimW = watch("fim");
  const horasParal = useMemo(() => {
    if (!iniW || !fimW) return null;
    const a = new Date(iniW).getTime(); const b = new Date(fimW).getTime();
    return isFinite(a) && isFinite(b) && b > a ? (b - a) / 3.6e6 : null;
  }, [iniW, fimW]);

  // Carrega os itens salvos ao abrir a edição.
  useEffect(() => {
    if (editing) setItens(itensSalvos.map((i) => ({ tipo_item: i.tipo_item, descricao: i.descricao ?? "", quantidade: Number(i.quantidade), custo_unitario: Number(i.custo_unitario) })));
  }, [editing, itensSalvos]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const qa = soAlfa(search);
    return rows.filter((r) => {
      const placa = r.vehicles?.placa ?? r.placa ?? "";
      const mQ = !q || placa.toLowerCase().includes(q) || r.numero.toLowerCase().includes(q) ||
        (r.oficina ?? "").toLowerCase().includes(q) || (qa !== "" && soAlfa(placa).includes(qa));
      const mS = fStatus === "todas" ? true : fStatus === "ativas" ? (r.status !== "concluida" && r.status !== "cancelada") : r.status === fStatus;
      return mQ && mS && noPeriodo(r.data_abertura, pIni, pFim) && (!fFrota || (!!r.vehicle_id && frotaVeicIds.has(r.vehicle_id)));
    });
  }, [rows, search, fStatus, pIni, pFim, fFrota, frotaVeicIds]);

  const { sortKey, sortDir, toggle, useSorted } = useSort<OrdemServicoRow>("created", "desc");
  const sorted = useSorted(filtered, (r, k) => {
    switch (k) {
      case "numero": return r.numero;
      case "veiculo": return r.vehicles?.placa ?? r.placa ?? "";
      case "statusv": return vMap.get(r.vehicle_id ?? "")?.status ?? "";
      case "oficina": return r.oficina ?? "";
      case "abertura": return r.data_abertura;
      case "status": return r.status;
      case "total": return r.valor_total ?? 0;
      case "created": return r.created_at;
      default: return null;
    }
  });

  const kpi = useMemo(() => {
    const ym = new Date().toISOString().slice(0, 7);
    let abertas = 0, andamento = 0, concluidasMes = 0, custoMes = 0;
    for (const r of rows) {
      if (r.status !== "concluida" && r.status !== "cancelada") { abertas++; if (r.status === "em_andamento") andamento++; }
      if (r.status === "concluida" && (r.data_conclusao ?? "").slice(0, 7) === ym) { concluidasMes++; custoMes += Number(r.valor_total ?? 0); }
    }
    return { abertas, andamento, concluidasMes, custoMes };
  }, [rows]);

  function buildRelatorio(): RelatorioTabelaData {
    const colunas: RelColuna[] = [
      { label: "Nº" }, { label: "Veículo" }, { label: "Status veículo" }, { label: "Oficina" },
      { label: "Abertura" }, { label: "Status" }, { label: "Total", align: "right" },
    ];
    const linhas = sorted.map((r) => [
      r.numero, r.vehicles?.placa ?? r.placa ?? "—", statusVeiculoLabel(vMap.get(r.vehicle_id ?? "")?.status),
      r.oficina ?? "—", formatDate(r.data_abertura), statusLabel(r.status),
      formatCurrency(r.valor_total),
    ]);
    const total = sorted.reduce((s, r) => s + Number(r.valor_total ?? 0), 0);
    return {
      titulo: "Ordens de serviço", subtitulo: `${sorted.length} OS`,
      filtros: [{ label: "Busca", valor: search }, { label: "Situação", valor: fStatus }],
      colunas, linhas, rodape: ["", "", "", "", "", "Total", formatCurrency(total)],
    };
  }

  function openNew() {
    setEditing(null);
    setFotosNovas([]); setItens([]); setIturanFile(null); setIturanInfo(null);
    reset({ status: "aberta", tipo: "manutencao_corretiva", data_abertura: hoje() });
    setOpen(true);
  }
  function openEdit(r: OrdemServicoRow) {
    setEditing(r);
    setFotosNovas([]); setItens([]); setIturanFile(null); setIturanInfo(null);
    reset({
      ocorrencia_id: r.ocorrencia_id ?? "", vehicle_id: r.vehicle_id ?? "",
      tipo: r.tipo ?? r.ocorrencias?.tipo ?? "manutencao_corretiva", tipo_servico: r.tipo_servico ?? "",
      oficina: r.oficina ?? "", responsavel: r.responsavel ?? "", descricao: r.descricao ?? "", observacao: r.observacao ?? "",
      inicio: toLocalInput(r.inicio), fim: toLocalInput(r.fim), km: r.km ?? "",
      status: r.status, data_abertura: r.data_abertura ?? "", previsao: r.previsao ?? "", data_conclusao: r.data_conclusao ?? "",
    });
    setOpen(true);
  }
  // Autopreenche o KM com o odômetro do veículo quando ainda vazio.
  function onVeiculo(id: string) {
    setValue("vehicle_id", id);
    if (!watch("km") && vMap.get(id)?.km_atual != null) setValue("km", Number(vMap.get(id)!.km_atual));
  }
  async function onIturanFile(file: File) {
    setIturanFile(file);
    try {
      const info = await parseIturanChegadaSaida(await file.arrayBuffer(), config?.endereco_manutencao ?? "");
      setIturanInfo(info);
      if (info.chegada) setValue("inicio", info.chegada);
      if (info.saida) setValue("fim", info.saida);
    } catch { setIturanInfo(null); }
  }
  function onSubmit(data: FormData) {
    const v = data.vehicle_id ? vMap.get(data.vehicle_id) : undefined;
    const conclui = data.status === "concluida";
    const payload = {
      ocorrencia_id: data.ocorrencia_id || null, vehicle_id: data.vehicle_id || null, placa: v?.placa ?? null,
      tipo: data.tipo || "manutencao_corretiva",
      tipo_servico: data.tipo_servico || null, oficina: data.oficina || null, responsavel: data.responsavel || null,
      descricao: data.descricao || null, observacao: data.observacao || null,
      inicio: data.inicio || null, fim: data.fim || null, km: data.km === "" || data.km == null ? null : Number(data.km),
      status: data.status as OrdemServicoStatus, data_abertura: data.data_abertura || hoje(), previsao: data.previsao || null,
      data_conclusao: data.data_conclusao || (conclui ? (data.fim ? data.fim.slice(0, 10) : hoje()) : null),
    };
    salvar.mutate(editing ? { id: editing.id, itens, ...payload } : { itens, ...payload }, {
      onSuccess: (saved) => {
        if (saved?.id && fotosNovas.length) saveFotos.mutate({ osId: saved.id, files: fotosNovas });
        if (saved?.id && ituranFile) uploadIturan.mutate({ osId: saved.id, file: ituranFile });
        setFotosNovas([]); setIturanFile(null); setIturanInfo(null); setOpen(false);
      },
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ordens de Serviço"
        description="Serviços de manutenção/reparo das ocorrências — ao concluir com custo, lança a despesa automaticamente"
        actions={
          <div className="flex flex-wrap gap-2">
            <RelatorioExport build={buildRelatorio} nomeArquivo="ordens-servico" disabled={!sorted.length} />
            {canWrite && <Button onClick={openNew}><Plus className="h-4 w-4" /> Nova OS</Button>}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="OS abertas" value={kpi.abertas} tone="warning" icon={<ClipboardList className="h-5 w-5" />} onClick={() => setFStatus("ativas")} />
        <StatCard title="Em andamento" value={kpi.andamento} icon={<Wrench className="h-5 w-5" />} onClick={() => setFStatus("em_andamento")} />
        <StatCard title="Concluídas (mês)" value={kpi.concluidasMes} tone="success" icon={<CheckCircle2 className="h-5 w-5" />} onClick={() => setFStatus("concluida")} />
        <StatCard title="Custo concluído (mês)" value={formatCurrency(kpi.custoMes)} tone="destructive" icon={<Clock className="h-5 w-5" />} onClick={() => setFStatus("concluida")} />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flex flex-col gap-2 border-b p-3 sm:flex-row sm:flex-wrap sm:items-end sm:p-4">
            <BuscaPlaca value={search} onChange={setSearch} vehicles={vehicles} placeholder="Buscar por placa, nº da OS ou oficina..." />
            <Select value={fStatus} onValueChange={setFStatus}>
              <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ativas">Em aberto</SelectItem>
                {OS_STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                <SelectItem value="todas">Todas</SelectItem>
              </SelectContent>
            </Select>
            <PeriodoFilter ini={pIni} fim={pFim} onChange={(i, f) => { setPIni(i); setPFim(f); }} />
            <FrotaAtivaToggle ativo={fFrota} onToggle={() => setFFrota((s) => !s)} count={frotaVeicIds.size} />
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <EmptyState message="Nenhuma ordem de serviço" icon={<ClipboardList className="h-6 w-6" />} />
          ) : (
            <div className="overflow-x-auto">
              <Table className="text-xs [&_th]:h-9 [&_th]:whitespace-nowrap [&_th]:px-2 [&_td]:px-2 [&_td]:py-2">
                <TableHeader>
                  <TableRow>
                    <SortableHead sortKey="numero" activeKey={sortKey} dir={sortDir} onSort={toggle}>Nº</SortableHead>
                    <SortableHead sortKey="veiculo" activeKey={sortKey} dir={sortDir} onSort={toggle}>Veículo</SortableHead>
                    <SortableHead sortKey="statusv" activeKey={sortKey} dir={sortDir} onSort={toggle}>Status veículo</SortableHead>
                    <SortableHead sortKey="oficina" activeKey={sortKey} dir={sortDir} onSort={toggle}>Oficina</SortableHead>
                    <SortableHead sortKey="abertura" activeKey={sortKey} dir={sortDir} onSort={toggle}>Abertura</SortableHead>
                    <SortableHead sortKey="status" activeKey={sortKey} dir={sortDir} onSort={toggle}>Status</SortableHead>
                    <SortableHead sortKey="total" activeKey={sortKey} dir={sortDir} onSort={toggle} align="right">Total</SortableHead>
                    {canWrite && <TableHead className="w-20"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((r) => (
                    <TableRow key={r.id} className={canWrite ? "cursor-pointer" : undefined} onClick={canWrite ? () => openEdit(r) : undefined}>
                      <TableCell className="whitespace-nowrap font-mono font-medium">
                        <span className="inline-flex items-center gap-1">
                          {r.numero}
                          {(linhaDaOs(r)?.desconto ?? 0) > 0 && (
                            <button type="button" title="Ver memória de cálculo do desconto por paralisação"
                              onClick={(e) => { e.stopPropagation(); setMemoria(linhaDaOs(r)); }}>
                              <Calculator className="h-3.5 w-3.5 text-destructive" />
                            </button>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono">{r.vehicles?.placa ?? r.placa ?? "—"}</TableCell>
                      <TableCell><VehicleStatusBadge status={vMap.get(r.vehicle_id ?? "")?.status} /></TableCell>
                      <TableCell className="max-w-[140px] truncate">{r.oficina ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(r.data_abertura)}</TableCell>
                      <TableCell><Badge variant={STATUS_VARIANT[r.status]} className="px-1.5 py-0 text-[10px]">{statusLabel(r.status)}</Badge></TableCell>
                      <TableCell className="whitespace-nowrap text-right font-semibold">{formatCurrency(r.valor_total)}</TableCell>
                      {canWrite && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-0.5">
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar" aria-label="Editar" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Remover" aria-label="Remover" onClick={() => confirm(`Remover a OS ${r.numero}?`) && remove.mutate(r)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </div>
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Editar ${editing.numero}` : "Nova ordem de serviço"}</DialogTitle>
            {editing?.ocorrencias?.numero && (
              <p className="text-xs text-muted-foreground">Ocorrência vinculada: <span className="font-mono font-medium">{editing.ocorrencias.numero}</span> · {tipoServLabel(editing.tipo ?? editing.ocorrencias.tipo)}</p>
            )}
            {!editing && <p className="text-xs text-muted-foreground">Ao salvar, uma <b>ocorrência</b> é criada automaticamente e o veículo entra <b>Em manutenção</b>.</p>}
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Ocorrência (opcional)" className="space-y-1.5 sm:col-span-2">
                <Select value={watch("ocorrencia_id") || "nenhuma"} onValueChange={(v) => {
                  if (v === "nenhuma") { setValue("ocorrencia_id", ""); return; }
                  setValue("ocorrencia_id", v);
                  const oc = ocorrencias.find((o) => o.id === v);
                  if (oc?.vehicle_id) setValue("vehicle_id", oc.vehicle_id);
                }}>
                  <SelectTrigger><SelectValue placeholder="Vincular a uma ocorrência" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhuma">— Sem ocorrência —</SelectItem>
                    {ocorrencias.filter((o) => o.status !== "cancelada").slice(0, 200).map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.vehicles?.placa ?? o.placa} · {o.titulo ?? o.tipo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Veículo">
                <SelectVeiculo value={watch("vehicle_id") || ""} onChange={onVeiculo} vehicles={vehicles} placeholder="Selecione" />
              </Field>
              <Field label="Tipo">
                <Select value={watch("tipo") || "manutencao_corretiva"} onValueChange={(v) => setValue("tipo", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{OCORRENCIA_TIPO_SERVICO.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Status">
                <Select value={watch("status") || "aberta"} onValueChange={(v) => setValue("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{OS_STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Tipo de serviço"><Input {...register("tipo_servico")} placeholder="Ex.: Troca de óleo, Funilaria" /></Field>
              <Field label="Início da paralisação"><Input type="datetime-local" {...register("inicio")} /></Field>
              <Field label="Fim da paralisação" error={errors.fim?.message}><Input type="datetime-local" {...register("fim")} /></Field>
              <Field label="KM no momento"><Input type="number" {...register("km")} placeholder="odômetro" /></Field>
              <Field label="Oficina / fornecedor"><Input {...register("oficina")} /></Field>
              <Field label="Descrição do serviço" className="space-y-1.5 sm:col-span-2"><Textarea {...register("descricao")} placeholder="Resumo do serviço realizado" /></Field>

              {/* Itens: peças substituídas e serviços realizados */}
              <div className="space-y-2 sm:col-span-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Peças e serviços</label>
                  <div className="flex gap-1">
                    <Button type="button" variant="outline" size="sm" onClick={() => setItens((xs) => [...xs, novoItem("peca")])}><Plus className="h-3.5 w-3.5" /> Peça</Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => setItens((xs) => [...xs, novoItem("servico")])}><Plus className="h-3.5 w-3.5" /> Serviço</Button>
                  </div>
                </div>
                {itens.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum item. Adicione as peças substituídas e os serviços realizados.</p>
                ) : (
                  <div className="space-y-1.5">
                    <div className="overflow-x-auto">
                      <div className="min-w-[30rem] space-y-1.5">
                    {itens.map((it, i) => (
                      <div key={i} className="grid grid-cols-[5rem_1fr_3.5rem_5.5rem_5.5rem_1.75rem] items-center gap-1.5 text-xs">
                        <Select value={it.tipo_item} onValueChange={(v) => setItens((xs) => xs.map((x, idx) => idx === i ? { ...x, tipo_item: v as OsItemTipo } : x))}>
                          <SelectTrigger className="h-8 px-2 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="peca">Peça</SelectItem><SelectItem value="servico">Serviço</SelectItem></SelectContent>
                        </Select>
                        <Input className="h-8 text-xs" placeholder="Descrição" value={it.descricao ?? ""} onChange={(e) => setItens((xs) => xs.map((x, idx) => idx === i ? { ...x, descricao: e.target.value } : x))} />
                        <Input className="h-8 px-1 text-right text-xs" type="number" step="1" title="Quantidade" value={it.quantidade} onChange={(e) => setItens((xs) => xs.map((x, idx) => idx === i ? { ...x, quantidade: Number(e.target.value) } : x))} />
                        <Input className="h-8 px-1 text-right text-xs" type="number" step="0.01" title="Custo unitário" value={it.custo_unitario} onChange={(e) => setItens((xs) => xs.map((x, idx) => idx === i ? { ...x, custo_unitario: Number(e.target.value) } : x))} />
                        <span className="text-right tabular-nums">{formatCurrency(custoItem(it))}</span>
                        <button type="button" title="Remover item" onClick={() => setItens((xs) => xs.filter((_, idx) => idx !== i))}><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                      </div>
                    ))}
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-end gap-x-4 gap-y-0.5 pt-1 text-xs tabular-nums">
                      <span className="text-muted-foreground">Peças: <b className="text-foreground">{formatCurrency(totalPecas)}</b></span>
                      <span className="text-muted-foreground">Serviços: <b className="text-foreground">{formatCurrency(totalServicos)}</b></span>
                      <span>Total: <b className="text-destructive">{formatCurrency(totalForm)}</b></span>
                    </div>
                  </div>
                )}
              </div>

              {/* Upload do relatório de ociosidade Ituran → chegada/saída */}
              <div className="space-y-2 sm:col-span-2 rounded-lg border bg-muted/20 p-3">
                <div className="flex items-center gap-2 text-sm font-medium"><FileSpreadsheet className="h-4 w-4" /> Relatório de ociosidade (Ituran)</div>
                <p className="text-xs text-muted-foreground">Envie o .xlsx para preencher automaticamente a chegada e a saída do veículo na oficina.</p>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex w-fit cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-1.5 text-sm hover:bg-accent">
                    <Upload className="h-4 w-4" /> {ituranFile ? "Trocar arquivo" : "Enviar relatório"}
                    <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onIturanFile(f); e.currentTarget.value = ""; }} />
                  </label>
                  {ituranFile && <span className="text-xs text-muted-foreground">{ituranFile.name}</span>}
                  {editing?.ituran_path && !ituranFile && <Button type="button" variant="ghost" size="sm" onClick={() => abrirArquivoOS(editing.ituran_path!)}><FileSpreadsheet className="h-4 w-4" /> Ver enviado</Button>}
                </div>
                {ituranInfo && (
                  <div className="flex flex-wrap gap-x-6 gap-y-1 rounded bg-background px-3 py-2 text-xs">
                    <span>Chegada: <b>{ituranInfo.chegada ? formatDateTime(ituranInfo.chegada) : "—"}</b></span>
                    <span>Saída: <b>{ituranInfo.saida ? formatDateTime(ituranInfo.saida) : "—"}</b></span>
                    {ituranInfo.endereco && <span className="text-muted-foreground">{ituranInfo.endereco}</span>}
                  </div>
                )}
                <Field label="Observação" className="space-y-1.5"><Textarea {...register("observacao")} placeholder="Observações sobre a chegada/saída e a paralisação" /></Field>
              </div>

              {horasParal != null && (
                <div className="sm:col-span-2 rounded-md bg-muted/40 px-3 py-2 text-xs">
                  Tempo de paralisação: <b className="tabular-nums">{h1(horasParal)}</b> (início → fim)
                </div>
              )}
              <div className="space-y-2 sm:col-span-2">
                <label className="text-sm font-medium">Anexos (nota fiscal, orçamento, fotos)</label>
                <label className="flex w-fit cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm hover:bg-accent">
                  <Camera className="h-4 w-4" /> Adicionar anexo
                  <input type="file" accept="image/*" capture="environment" multiple className="hidden"
                    onChange={(e) => { setFotosNovas((f) => [...f, ...Array.from(e.target.files ?? [])]); e.currentTarget.value = ""; }} />
                </label>
                {(fotos.length > 0 || fotosNovas.length > 0) && (
                  <div className="flex flex-wrap gap-2">
                    {fotos.map((f) => (
                      <div key={f.id} className="relative h-20 w-20 overflow-hidden rounded-md border">
                        {f.url ? <img src={f.url} alt="" className="h-full w-full cursor-zoom-in object-cover" onClick={() => window.open(f.url!, "_blank")} /> : <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground">anexo</div>}
                        <button type="button" title="Remover" onClick={() => confirm("Remover anexo?") && delFoto.mutate(f)} className="absolute right-0 top-0 bg-destructive/90 p-0.5 text-white"><X className="h-3 w-3" /></button>
                      </div>
                    ))}
                    {fotosNovas.map((file, i) => (
                      <div key={i} className="relative h-20 w-20 overflow-hidden rounded-md border">
                        <img src={URL.createObjectURL(file)} alt="" className="h-full w-full object-cover" />
                        <button type="button" title="Tirar da lista" onClick={() => setFotosNovas((fs) => fs.filter((_, idx) => idx !== i))} className="absolute right-0 top-0 bg-destructive/90 p-0.5 text-white"><X className="h-3 w-3" /></button>
                        <span className="absolute bottom-0 left-0 bg-primary/80 px-1 text-[9px] text-white">novo</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {editing && linhaDaOs(editing) && (
              <div className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center gap-2 text-sm font-medium"><Calculator className="h-4 w-4 text-destructive" /> Memória de cálculo do desconto por paralisação</div>
                <p className="text-xs text-muted-foreground">Desconto no boleto do locatário gerado pela paralisação da ocorrência vinculada a esta OS.</p>
                <MemoriaCalculoDesconto linhas={[linhaDaOs(editing)!]} franquiaH={franquiaH} />
              </div>
            )}
            <p className="text-xs text-muted-foreground">Ao salvar como <b>Concluída</b> com total maior que zero, uma despesa é lançada/atualizada automaticamente no módulo Despesas.</p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={salvar.isPending}>{salvar.isPending ? "Salvando..." : editing ? "Salvar" : "Criar OS"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <MemoriaCalculoDialog
        open={!!memoria}
        onOpenChange={(v) => !v && setMemoria(null)}
        linhas={memoria ? [memoria] : []}
        franquiaH={franquiaH}
        titulo={memoria ? maskPlaca(memoria.placa) : undefined}
      />
    </div>
  );
}
