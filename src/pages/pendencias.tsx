import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus, Pencil, Trash2, Search, CheckCircle2, AlertTriangle, Clock, Radio, ListTodo, ReceiptText, X, FileUp,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Field } from "@/components/shared/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useList, useCreate, useUpdate, useDelete } from "@/hooks/use-crud";
import { useCanWrite } from "@/hooks/use-can-write";
import { ImportarDetranDialog } from "@/components/pendencias/importar-detran-dialog";
import {
  usePendencias, usePendenciasSummary,
  usePendenciaMultasItens, useSavePendenciaMultasItens, parseValor,
  vencimentoStatus, type PendenciaRow, type MultaLinha,
} from "@/hooks/use-pendencias";
import {
  PENDENCIA_CATEGORIA, PENDENCIA_STATUS, PENDENCIA_PRIORIDADE,
} from "@/lib/options";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Vehicle } from "@/types/database";
import { useSort } from "@/hooks/use-sort";
import { SortableHead } from "@/components/shared/sortable-head";
import { RelatorioExport } from "@/components/shared/relatorio-export";
import { VehicleStatusBadge, statusVeiculoLabel } from "@/components/shared/vehicle-status-badge";
import type { RelatorioTabelaData, RelColuna } from "@/lib/relatorio-tabela";

const RANK_PRIO: Record<string, number> = { critica: 0, alta: 1, media: 2, baixa: 3 };
const soAlfa = (s: string) => (s ?? "").replace(/[^a-z0-9]/gi, "").toLowerCase();
// Restrição de natureza judicial (bloqueio/penhora/busca e apreensão/RENAJUD).
const ehJudicial = (titulo: string) => /judicial|renajud|busca e apreens|penhor|bloqueio/i.test(titulo ?? "");

// Atalhos de recorte por tipo de restrição (categoria "Restrição").
type RestrKey = "off" | "todas" | "judicial" | "alienacao" | "csv" | "ipva";
const RESTR_ATALHOS: { key: Exclude<RestrKey, "off">; label: string; judicial?: boolean; match: (t: string) => boolean }[] = [
  { key: "todas", label: "Restrições", match: () => true },
  { key: "judicial", label: "Restrição judicial / RENAJUD", judicial: true, match: ehJudicial },
  { key: "alienacao", label: "Alienação fiduciária", match: (t) => /aliena/i.test(t ?? "") },
  { key: "csv", label: "CSV vencido", match: (t) => /csv/i.test(t ?? "") },
  { key: "ipva", label: "Restrição IPVA", match: (t) => /ipva/i.test(t ?? "") },
];

const schema = z.object({
  vehicle_id: z.string().min(1, "Selecione o veículo"),
  categoria: z.string().min(1, "Selecione a categoria"),
  titulo: z.string().min(1, "Informe o título"),
  descricao: z.string().optional(),
  prioridade: z.string().default("media"),
  status: z.string().default("aberta"),
  vencimento: z.string().optional(),
  valor: z.coerce.number().optional().or(z.literal("")),
  pago: z.boolean().default(false),
  ativo: z.boolean().optional(),
  responsavel: z.string().optional(),
  observacoes: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

const controleDe = (cat: string) => PENDENCIA_CATEGORIA.find((c) => c.value === cat)?.controle ?? "livre";

function VencBadge({ venc, status }: { venc: string | null; status: string }) {
  const v = vencimentoStatus(venc, status);
  if (v === "sem") return <span className="text-muted-foreground">{venc ? formatDate(venc) : "—"}</span>;
  const map: Record<string, { cls: string; label: string }> = {
    vencida: { cls: "bg-destructive/15 text-destructive", label: "Vencida" },
    vence7: { cls: "bg-warning/20 text-warning", label: "≤ 7 dias" },
    vence30: { cls: "bg-warning/10 text-warning", label: "≤ 30 dias" },
    em_dia: { cls: "bg-success/15 text-success", label: "Em dia" },
  };
  const c = map[v];
  return (
    <div className="flex flex-col gap-0.5">
      <span>{formatDate(venc)}</span>
      <span className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-medium ${c.cls}`}>{c.label}</span>
    </div>
  );
}

const PRIO: Record<string, { variant: "muted" | "secondary" | "warning" | "destructive"; label: string }> = {
  baixa: { variant: "muted", label: "Baixa" },
  media: { variant: "secondary", label: "Média" },
  alta: { variant: "warning", label: "Alta" },
  critica: { variant: "destructive", label: "Crítica" },
};

export default function PendenciasPage() {
  const { data: rows = [], isLoading } = usePendencias();
  const { data: summary } = usePendenciasSummary();
  const { data: vehicles = [] } = useList<Vehicle>("vehicles");
  const create = useCreate("vehicle_pendencias", "Pendência");
  const update = useUpdate("vehicle_pendencias", "Pendência");
  const remove = useDelete("vehicle_pendencias", "Pendência");
  const saveMultas = useSavePendenciaMultasItens();
  const canWrite = useCanWrite("pendencias");

  const [searchParams, setSearchParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PendenciaRow | null>(null);
  const [search, setSearch] = useState(searchParams.get("veiculo") ?? "");
  const [fCategoria, setFCategoria] = useState("todas");
  const [fStatus, setFStatus] = useState(searchParams.get("veiculo") ? "todas" : "ativas");
  // Atalho de restrições: "off" (sem recorte) ou um dos tipos em RESTR_ATALHOS.
  const [fRestricao, setFRestricao] = useState<RestrKey>("off");

  const [importOpen, setImportOpen] = useState(false);
  const [sugAberta, setSugAberta] = useState(false);

  // Itens de multa da pendência (várias multas numa mesma pendência)
  const emptyMulta = (): MultaLinha => ({ documento: "", infracao: "", data_ocorrencia: "", vencimento: "", valor: "", local: "" });
  const [itensMulta, setItensMulta] = useState<MultaLinha[]>([emptyMulta()]);
  const setItemMulta = (i: number, campo: keyof MultaLinha, val: string) =>
    setItensMulta((ls) => ls.map((l, idx) => (idx === i ? { ...l, [campo]: val } : l)));
  const totalItensMulta = itensMulta.reduce((s, l) => s + parseValor(l.valor), 0);

  // Carrega os itens ao editar uma pendência de multa.
  const editandoMulta = open && editing?.categoria === "Multa";
  const { data: itensCarregados } = usePendenciaMultasItens(editandoMulta ? editing?.id : undefined);
  useEffect(() => {
    if (editandoMulta && itensCarregados) {
      setItensMulta(itensCarregados.length ? itensCarregados : [emptyMulta()]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editandoMulta, itensCarregados]);

  // Soma automática do valor total das multas cadastradas (não canceladas).
  const totalMultas = useMemo(
    () => rows.filter((r) => r.categoria.toLowerCase().includes("multa") && r.status !== "cancelada")
      .reduce((s, r) => s + (r.valor ?? 0), 0),
    [rows]
  );
  const totalMultasAbertas = useMemo(
    () => rows.filter((r) => r.categoria.toLowerCase().includes("multa") && (r.status === "aberta" || r.status === "em_andamento"))
      .reduce((s, r) => s + (r.valor ?? 0), 0),
    [rows]
  );

  // Pré-filtra pela placa vinda por link (ex.: da tela de Veículos) ou pelo
  // recorte de restrição vindo do Dashboard (?restr=judicial, etc.).
  useEffect(() => {
    const v = searchParams.get("veiculo");
    const r = searchParams.get("restr");
    if (v) {
      setSearch(v);
      setFStatus("todas");
    }
    if (r && RESTR_ATALHOS.some((a) => a.key === r)) {
      setFRestricao(r as RestrKey);
      setFCategoria("Restrição");
      setFStatus("todas");
    }
    if (v || r) {
      searchParams.delete("veiculo");
      searchParams.delete("restr");
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } =
    useForm<FormData>({ resolver: zodResolver(schema) });
  const categoriaSel = watch("categoria") || "";
  const controle = controleDe(categoriaSel);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((r) => {
      const placaVeic = r.vehicles?.placa ?? vehicles.find((v) => v.id === r.vehicle_id)?.placa ?? "";
      const modeloVeic = r.vehicles?.modelo ?? vehicles.find((v) => v.id === r.vehicle_id)?.modelo ?? "";
      const matchSearch = !q || r.titulo.toLowerCase().includes(q) ||
        (r.responsavel ?? "").toLowerCase().includes(q) || modeloVeic.toLowerCase().includes(q) ||
        (soAlfa(search) !== "" && soAlfa(placaVeic).includes(soAlfa(search)));
      const matchCat = fCategoria === "todas" || r.categoria === fCategoria;
      const atalho = RESTR_ATALHOS.find((a) => a.key === fRestricao);
      const matchRestr =
        fRestricao === "off" || !atalho ? true :
        r.categoria === "Restrição" && atalho.match(r.titulo);
      const matchStatus =
        fStatus === "todas" ? true :
        fStatus === "ativas" ? (r.status === "aberta" || r.status === "em_andamento") :
        fStatus === "atrasadas" ? vencimentoStatus(r.vencimento, r.status) === "vencida" :
        r.status === fStatus;
      return matchSearch && matchCat && matchRestr && matchStatus;
    });
  }, [rows, search, fCategoria, fRestricao, fStatus, vehicles]);

  // Nº de veículos afetados por cada atalho de restrição (badge dos botões).
  const restrCount = useMemo(() => {
    const sets: Record<string, Set<string>> = {};
    for (const a of RESTR_ATALHOS) sets[a.key] = new Set<string>();
    for (const r of rows) {
      if (r.categoria !== "Restrição") continue;
      for (const a of RESTR_ATALHOS) if (a.match(r.titulo)) sets[a.key].add(r.vehicle_id);
    }
    return Object.fromEntries(Object.entries(sets).map(([k, s]) => [k, s.size])) as Record<string, number>;
  }, [rows]);

  // Sugestões de veículos cadastrados ao digitar (qualquer parte da placa/modelo).
  const sugestoes = useMemo(() => {
    const q = soAlfa(search);
    if (!q) return [];
    const abertasPorVeic = new Map<string, number>();
    for (const r of rows) if (r.status === "aberta" || r.status === "em_andamento") abertasPorVeic.set(r.vehicle_id, (abertasPorVeic.get(r.vehicle_id) ?? 0) + 1);
    return vehicles
      .filter((v) => soAlfa(v.placa).includes(q) || `${v.marca} ${v.modelo}`.toLowerCase().includes(search.toLowerCase()))
      .map((v) => ({ v, abertas: abertasPorVeic.get(v.id) ?? 0 }))
      .sort((a, b) => b.abertas - a.abertas)
      .slice(0, 8);
  }, [vehicles, search, rows]);

  const { sortKey, sortDir, toggle, useSorted } = useSort<PendenciaRow>("vencimento", "asc");
  const sorted = useSorted(filtered, (r, k) => {
    switch (k) {
      case "veiculo": return r.vehicles?.placa ?? vehicles.find((v) => v.id === r.vehicle_id)?.placa ?? "";
      case "statusv": return vehicles.find((v) => v.id === r.vehicle_id)?.status ?? "";
      case "categoria": return r.categoria;
      case "titulo": return r.titulo;
      case "responsavel": return r.responsavel;
      case "vencimento": return r.vencimento;
      case "prioridade": return RANK_PRIO[r.prioridade] ?? 9;
      case "status": return r.status;
      default: return null;
    }
  });

  function buildRelatorio(): RelatorioTabelaData {
    const catLabel = fCategoria === "todas" ? "Todas" : (PENDENCIA_CATEGORIA.find((c) => c.value === fCategoria)?.label ?? fCategoria);
    const statusLabel = fStatus === "todas" ? "Todas" : fStatus === "ativas" ? "Ativas (abertas)" : fStatus === "atrasadas" ? "Atrasadas" : (PENDENCIA_STATUS.find((s) => s.value === fStatus)?.label ?? fStatus);
    const colunas: RelColuna[] = [
      { label: "Veículo" }, { label: "Status veículo" }, { label: "Categoria" }, { label: "Título" }, { label: "Responsável" },
      { label: "Vencimento" }, { label: "Valor", align: "right" }, { label: "Prioridade" }, { label: "Status" },
    ];
    const linhas = sorted.map((r) => [
      r.vehicles?.placa ?? vehicles.find((v) => v.id === r.vehicle_id)?.placa ?? "—",
      statusVeiculoLabel(vehicles.find((v) => v.id === r.vehicle_id)?.status),
      r.categoria, r.titulo, r.responsavel ?? "—",
      r.vencimento ? formatDate(r.vencimento) : "—",
      r.valor != null ? formatCurrency(r.valor) : "—",
      PRIO[r.prioridade]?.label ?? r.prioridade,
      PENDENCIA_STATUS.find((s) => s.value === r.status)?.label ?? r.status,
    ]);
    const total = sorted.reduce((s, r) => s + (r.valor ?? 0), 0);
    const atalhoAtivo = RESTR_ATALHOS.find((a) => a.key === fRestricao);
    const restrLabel = atalhoAtivo ? atalhoAtivo.label : "—";
    const tituloRel = atalhoAtivo ? `${atalhoAtivo.label} por veículo` : "Pendências por veículo";
    return {
      titulo: tituloRel, subtitulo: `${sorted.length} registro(s)`,
      filtros: [{ label: "Busca", valor: search }, { label: "Categoria", valor: catLabel }, { label: "Recorte", valor: restrLabel }, { label: "Situação", valor: statusLabel }],
      colunas, linhas, rodape: ["", "", "", "", "", "Total", formatCurrency(total), "", ""],
    };
  }

  // Subtotais por categoria das pendências filtradas (com valor).
  const subtotais = useMemo(() => {
    const map = new Map<string, number>();
    let total = 0;
    for (const r of filtered) {
      if (r.valor && r.status !== "cancelada") {
        map.set(r.categoria, (map.get(r.categoria) ?? 0) + r.valor);
        total += r.valor;
      }
    }
    return { itens: [...map.entries()].sort((a, b) => b[1] - a[1]), total };
  }, [filtered]);

  function openNew() {
    setEditing(null);
    setItensMulta([emptyMulta()]);
    reset({ categoria: "IPVA", prioridade: "media", status: "aberta", pago: false });
    setOpen(true);
  }
  function openEdit(r: PendenciaRow) {
    setEditing(r);
    if (r.categoria !== "Multa") setItensMulta([emptyMulta()]);
    reset({
      vehicle_id: r.vehicle_id, categoria: r.categoria, titulo: r.titulo, descricao: r.descricao ?? "",
      prioridade: r.prioridade, status: r.status, vencimento: r.vencimento ?? "",
      valor: r.valor ?? undefined, pago: r.pago, ativo: r.ativo ?? undefined,
      responsavel: r.responsavel ?? "", observacoes: r.observacoes ?? "",
    });
    setOpen(true);
  }
  async function onSubmit(data: FormData) {
    const isMulta = controle === "multa";
    const payload = {
      ...data,
      vencimento: data.vencimento || null,
      // Para multa, o valor é a soma automática dos itens.
      valor: isMulta ? totalItensMulta : data.valor === "" ? null : data.valor,
      ativo: controle === "ativo" ? !!data.ativo : null,
      resolvido_em: data.status === "resolvida" ? new Date().toISOString().slice(0, 10) : null,
    };
    const persistIdItens = async (saved: { id?: string } | undefined) => {
      if (isMulta && saved?.id) {
        await saveMultas.mutateAsync({ pendenciaId: saved.id, itens: itensMulta });
      }
      setOpen(false);
    };
    if (editing) {
      update.mutate({ id: editing.id, ...payload }, { onSuccess: (d) => persistIdItens(d as { id?: string }) });
    } else {
      create.mutate(payload, { onSuccess: (d) => persistIdItens(d as { id?: string }) });
    }
  }
  function resolver(r: PendenciaRow) {
    update.mutate({ id: r.id, status: "resolvida", resolvido_em: new Date().toISOString().slice(0, 10) });
  }

  const vehicleLabel = (id: string) => vehicles.find((v) => v.id === id)?.placa ?? "—";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pendências por veículo"
        description="Controle de rastreador, documentos, vencimentos e multas da frota"
        actions={
          <div className="flex flex-wrap gap-2">
            <RelatorioExport build={buildRelatorio} nomeArquivo="pendencias" disabled={!sorted.length} />
            {canWrite && (
              <>
                <Button variant="outline" onClick={() => setImportOpen(true)}>
                  <FileUp className="h-4 w-4" /> Importar débitos (Detran)
                </Button>
                <Button onClick={openNew}><Plus className="h-4 w-4" /> Nova pendência</Button>
              </>
            )}
          </div>
        }
      />

      {/* Painel de alertas */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Vencidas" value={summary?.vencidas ?? 0} tone="destructive" icon={<AlertTriangle className="h-5 w-5" />} />
        <StatCard title="Vence em 7 dias" value={summary?.a_vencer_7 ?? 0} tone="warning" icon={<Clock className="h-5 w-5" />} />
        <StatCard title="Vence em 30 dias" value={summary?.a_vencer_30 ?? 0} tone="warning" icon={<Clock className="h-5 w-5" />} />
        <StatCard title="Abertas críticas" value={summary?.criticas ?? 0} tone="destructive" icon={<ListTodo className="h-5 w-5" />} />
        <StatCard title="Ituran inativos" value={summary?.ituran_inativos ?? 0} tone="warning" icon={<Radio className="h-5 w-5" />} />
      </div>

      {/* Total de multas (soma automática) */}
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          title="Valor total de multas"
          value={formatCurrency(totalMultas)}
          hint="Todas as multas cadastradas (exceto canceladas)"
          tone="warning"
          icon={<ReceiptText className="h-5 w-5" />}
        />
        <StatCard
          title="Multas em aberto"
          value={formatCurrency(totalMultasAbertas)}
          hint="Multas ainda não resolvidas"
          tone="destructive"
          icon={<ReceiptText className="h-5 w-5" />}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flex flex-col gap-2 border-b p-4 sm:flex-row sm:items-center">
            <div className="relative flex flex-1 items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por placa (ex.: 8451), título ou responsável..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setSugAberta(true); }}
                onFocus={() => setSugAberta(true)}
                onBlur={() => setTimeout(() => setSugAberta(false), 150)}
                className="border-0 focus-visible:ring-0"
              />
              {sugAberta && sugestoes.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-auto rounded-lg border bg-popover p-1 shadow-md">
                  <div className="px-2 py-1 text-[11px] uppercase text-muted-foreground">Veículos cadastrados</div>
                  {sugestoes.map(({ v, abertas }) => (
                    <button
                      key={v.id}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); setSearch(v.placa); setSugAberta(false); }}
                      className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                    >
                      <span><span className="font-mono font-medium">{v.placa}</span> <span className="text-xs text-muted-foreground">{v.marca} {v.modelo}</span></span>
                      {abertas > 0 && <Badge variant="secondary">{abertas} aberta{abertas > 1 ? "s" : ""}</Badge>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Select value={fCategoria} onValueChange={setFCategoria}>
              <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as categorias</SelectItem>
                {PENDENCIA_CATEGORIA.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={fStatus} onValueChange={setFStatus}>
              <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ativas">Ativas (abertas)</SelectItem>
                <SelectItem value="atrasadas">Somente vencidas</SelectItem>
                <SelectItem value="resolvida">Resolvidas</SelectItem>
                <SelectItem value="todas">Todas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {/* Atalhos rápidos por tipo de restrição */}
          <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2 text-sm">
            <span className="text-muted-foreground">Atalhos:</span>
            {RESTR_ATALHOS.map((a) => (
              <Button
                key={a.key}
                type="button"
                variant={fRestricao === a.key ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  if (fRestricao === a.key) { setFRestricao("off"); setFCategoria("todas"); }
                  else { setFRestricao(a.key); setFCategoria("Restrição"); setFStatus("todas"); }
                }}
              >
                <AlertTriangle className={`h-4 w-4 ${a.judicial ? "text-destructive" : ""}`} /> {a.label}
                <Badge variant="secondary" className="ml-1">{restrCount[a.key] ?? 0}</Badge>
              </Button>
            ))}
            {fRestricao !== "off" && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => { setFRestricao("off"); setFCategoria("todas"); setFStatus("ativas"); }}
              >
                <X className="h-4 w-4" /> Limpar
              </Button>
            )}
          </div>
          {subtotais.total > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-4 py-2 text-sm">
              <span className="text-muted-foreground">Subtotais:</span>
              {subtotais.itens.map(([cat, val]) => (
                <span key={cat} className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-0.5">
                  <span className="font-medium">{cat}</span> {formatCurrency(val)}
                </span>
              ))}
              <span className="ml-auto font-semibold">Total: {formatCurrency(subtotais.total)}</span>
            </div>
          )}
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <EmptyState message="Nenhuma pendência" icon={<ListTodo className="h-6 w-6" />} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead sortKey="veiculo" activeKey={sortKey} dir={sortDir} onSort={toggle}>Veículo</SortableHead>
                  <SortableHead sortKey="statusv" activeKey={sortKey} dir={sortDir} onSort={toggle}>Status veículo</SortableHead>
                  <SortableHead sortKey="categoria" activeKey={sortKey} dir={sortDir} onSort={toggle}>Categoria</SortableHead>
                  <SortableHead sortKey="titulo" activeKey={sortKey} dir={sortDir} onSort={toggle}>Título</SortableHead>
                  <SortableHead sortKey="responsavel" activeKey={sortKey} dir={sortDir} onSort={toggle}>Responsável</SortableHead>
                  <SortableHead sortKey="vencimento" activeKey={sortKey} dir={sortDir} onSort={toggle}>Vencimento</SortableHead>
                  <SortableHead sortKey="prioridade" activeKey={sortKey} dir={sortDir} onSort={toggle}>Prioridade</SortableHead>
                  <SortableHead sortKey="status" activeKey={sortKey} dir={sortDir} onSort={toggle}>Status</SortableHead>
                  {canWrite && <TableHead className="w-28"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((r) => (
                  <TableRow
                    key={r.id}
                    className={canWrite ? "cursor-pointer" : undefined}
                    onClick={canWrite ? () => openEdit(r) : undefined}
                  >
                    <TableCell className="font-mono font-medium">{r.vehicles?.placa ?? vehicleLabel(r.vehicle_id)}</TableCell>
                    <TableCell><VehicleStatusBadge status={vehicles.find((v) => v.id === r.vehicle_id)?.status} /></TableCell>
                    <TableCell><Badge variant="secondary">{r.categoria}</Badge></TableCell>
                    <TableCell>
                      <div>{r.titulo}</div>
                      {r.categoria.toLowerCase().includes("ituran") && (
                        <span className={`text-xs ${r.ativo ? "text-success" : "text-destructive"}`}>
                          {r.ativo ? "Ativo" : "Inativo"}
                        </span>
                      )}
                      {r.valor != null && <span className="text-xs text-muted-foreground"> · {formatCurrency(r.valor)}{r.pago ? " (pago)" : ""}</span>}
                      {(r.documento || r.local || r.data_ocorrencia) && (
                        <div className="text-[11px] text-muted-foreground">
                          {r.documento && <span>Auto {r.documento}</span>}
                          {r.data_ocorrencia && <span>{r.documento ? " · " : ""}Infração {formatDate(r.data_ocorrencia)}</span>}
                          {r.local && <span className="block truncate max-w-[240px]">{r.local}</span>}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{r.responsavel ?? "—"}</TableCell>
                    <TableCell><VencBadge venc={r.vencimento} status={r.status} /></TableCell>
                    <TableCell><Badge variant={PRIO[r.prioridade].variant}>{PRIO[r.prioridade].label}</Badge></TableCell>
                    <TableCell>
                      <Badge variant={r.status === "resolvida" ? "success" : r.status === "cancelada" ? "muted" : "warning"}>
                        {PENDENCIA_STATUS.find((s) => s.value === r.status)?.label}
                      </Badge>
                    </TableCell>
                    {canWrite && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          {r.status !== "resolvida" && (
                            <Button variant="ghost" size="icon" title="Resolver" onClick={() => resolver(r)}>
                              <CheckCircle2 className="h-4 w-4 text-success" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => confirm("Remover pendência?") && remove.mutate(r.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className={controle === "multa" ? "max-w-4xl" : "max-w-xl"}>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar pendência" : "Nova pendência"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Veículo" error={errors.vehicle_id?.message}>
                <Select value={watch("vehicle_id") || ""} onValueChange={(v) => setValue("vehicle_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {vehicles.map((v) => <SelectItem key={v.id} value={v.id}>{v.placa} — {v.modelo}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Categoria" error={errors.categoria?.message}>
                <Select value={categoriaSel} onValueChange={(v) => {
                  setValue("categoria", v);
                  const c = PENDENCIA_CATEGORIA.find((x) => x.value === v);
                  if (c) setValue("titulo", watch("titulo") || c.label);
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PENDENCIA_CATEGORIA.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Título" error={errors.titulo?.message} className="space-y-1.5 sm:col-span-2">
                <Input {...register("titulo")} />
              </Field>

              {controle === "vencimento" && (
                <Field label="Vencimento">
                  <Input type="date" {...register("vencimento")} />
                </Field>
              )}
              {controle === "vencimento" && (
                <Field label="Valor (R$)">
                  <Input type="number" step="0.01" {...register("valor")} />
                </Field>
              )}
              {(controle === "multa" || controle === "solicitante") && (
                <Field
                  label={controle === "solicitante" ? "Quem solicitou?" : "Responsável / Locatário"}
                  className="space-y-1.5 sm:col-span-2"
                >
                  <Input
                    {...register("responsavel")}
                    placeholder={controle === "solicitante" ? "Nome de quem solicitou" : "Nome do condutor responsável"}
                  />
                </Field>
              )}

              <Field label="Prioridade">
                <Select value={watch("prioridade") || "media"} onValueChange={(v) => setValue("prioridade", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PENDENCIA_PRIORIDADE.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Status">
                <Select value={watch("status") || "aberta"} onValueChange={(v) => setValue("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PENDENCIA_STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            {controle === "multa" && (
              <div className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">Multas desta pendência</h4>
                  <div className="text-sm">Total: <span className="font-semibold">{formatCurrency(totalItensMulta)}</span></div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="p-1 font-medium">Nº do auto</th>
                        <th className="p-1 font-medium">Infração</th>
                        <th className="p-1 font-medium">Data</th>
                        <th className="p-1 font-medium">Vencimento</th>
                        <th className="p-1 font-medium">Valor</th>
                        <th className="p-1 font-medium">Local</th>
                        <th className="w-6"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {itensMulta.map((l, i) => (
                        <tr key={i} className="border-b">
                          <td className="p-1"><Input value={l.documento} onChange={(e) => setItemMulta(i, "documento", e.target.value)} className="min-w-24" placeholder="000014325-1" /></td>
                          <td className="p-1"><Input value={l.infracao} onChange={(e) => setItemMulta(i, "infracao", e.target.value)} className="min-w-44" placeholder="Ex.: 5002-0 Não identificação" /></td>
                          <td className="p-1"><Input type="date" value={l.data_ocorrencia} onChange={(e) => setItemMulta(i, "data_ocorrencia", e.target.value)} /></td>
                          <td className="p-1"><Input type="date" value={l.vencimento} onChange={(e) => setItemMulta(i, "vencimento", e.target.value)} /></td>
                          <td className="p-1"><Input value={l.valor} onChange={(e) => setItemMulta(i, "valor", e.target.value)} className="min-w-20" placeholder="262,92" /></td>
                          <td className="p-1"><Input value={l.local} onChange={(e) => setItemMulta(i, "local", e.target.value)} className="min-w-32" placeholder="Local" /></td>
                          <td className="p-1 text-center">
                            {itensMulta.length > 1 && (
                              <button type="button" onClick={() => setItensMulta((ls) => ls.filter((_, idx) => idx !== i))} title="Remover">
                                <X className="h-4 w-4 text-destructive" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => setItensMulta((ls) => [...ls, emptyMulta()])}>
                  <Plus className="h-4 w-4" /> Adicionar multa
                </Button>
              </div>
            )}

            {controle === "ativo" && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4" checked={!!watch("ativo")} onChange={(e) => setValue("ativo", e.target.checked)} />
                Rastreador ativo
              </label>
            )}
            {controle === "vencimento" && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4" {...register("pago")} />
                Pago / quitado
              </label>
            )}

            <Field label="Descrição / observações">
              <Textarea {...register("descricao")} />
            </Field>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={create.isPending || update.isPending}>
                {editing ? "Salvar" : "Cadastrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ImportarDetranDialog open={importOpen} onOpenChange={setImportOpen} vehicles={vehicles} />
    </div>
  );
}
