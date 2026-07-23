import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2, Car, Power, RotateCcw, AlertTriangle, RefreshCw, FileUp, X } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Field } from "@/components/shared/field";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useList, useCreate, useUpdate, useDelete } from "@/hooks/use-crud";
import { usePendenciasPorVeiculo, useRestricoesPorVeiculo } from "@/hooks/use-pendencias";
import { useLocatarioPorVeiculo } from "@/hooks/use-contratos";
import { useKmMesPorVeiculo } from "@/hooks/use-km";
import { useUpdateFipe } from "@/hooks/use-fipe";
import { useCanWrite } from "@/hooks/use-can-write";
import { useVehicleStatuses, useCreateVehicleStatus } from "@/hooks/use-vehicle-statuses";
import { useSort } from "@/hooks/use-sort";
import { SortableHead } from "@/components/shared/sortable-head";
import { BuscaPlaca } from "@/components/shared/busca-placa";
import { RelatorioExport } from "@/components/shared/relatorio-export";
import type { RelatorioTabelaData, RelColuna } from "@/lib/relatorio-tabela";
import { ImportarConsultaPlacaDialog } from "@/components/vehicles/importar-consulta-placa-dialog";
import { VEHICLE_STATUS, VEHICLE_CATEGORIA } from "@/lib/options";
import { formatCurrency, formatNumber, formatDate, maskPlaca, soAlfa } from "@/lib/format";
import type { Vehicle, Alienante } from "@/types/database";

const schema = z.object({
  placa: z.string().min(7, "Placa inválida").max(8),
  marca: z.string().min(1, "Informe a marca"),
  modelo: z.string().min(1, "Informe o modelo"),
  ano_fabricacao: z.coerce.number().int().optional().or(z.literal("")),
  ano_modelo: z.coerce.number().int().optional().or(z.literal("")),
  cor: z.string().optional(),
  categoria: z.string().optional(),
  especie_tipo: z.string().optional(),
  combustivel: z.string().optional(),
  capacidade_passageiros: z.coerce.number().int().optional().or(z.literal("")),
  potencia: z.string().optional(),
  cilindrada: z.coerce.number().int().optional().or(z.literal("")),
  parcelamento_cotas: z.string().optional(),
  renavam: z.string().optional(),
  chassi: z.string().optional(),
  km_atual: z.coerce.number().int().min(0).default(0),
  status: z.string().default("disponivel"),
  valor_aquisicao: z.coerce.number().optional().or(z.literal("")),
  valor_fipe: z.coerce.number().optional().or(z.literal("")),
  fipe_manual: z.boolean().default(false),
  fornecedor: z.string().optional(),
  observacoes: z.string().optional(),
  // Situação jurídica / patrimonial
  alienacao_fiduciaria: z.boolean().default(false),
  alienante: z.string().optional(),
  proprietario_nome: z.string().optional(),
  proprietario_documento: z.string().optional(),
  quitado: z.boolean().default(false),
  valor_quitacao: z.coerce.number().optional().or(z.literal("")),
  data_quitacao: z.string().optional(),
  busca_apreensao: z.boolean().default(false),
  busca_apreensao_solicitante: z.string().optional(),
  bloqueio_judicial: z.boolean().default(false),
  bloqueio_judicial_solicitante: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const TODOS = "__todos__";

/** Select de filtro por coluna (com opção "Todos"). */
function FiltroSelect({ label, value, onChange, options, render }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; render?: (v: string) => string;
}) {
  if (options.length === 0) return null;
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={`h-8 w-auto gap-1 text-xs ${value !== TODOS ? "border-primary text-primary" : ""}`}>
        <span className="text-muted-foreground">{label}:</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        <SelectItem value={TODOS}>Todos</SelectItem>
        {options.map((o) => <SelectItem key={o} value={o}>{render ? render(o) : o}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export default function VehiclesPage() {
  const navigate = useNavigate();
  const { data: vehicles = [], isLoading } = useList<Vehicle>("vehicles");
  const { data: pendMap = {} } = usePendenciasPorVeiculo();
  const { data: restrMap = {} } = useRestricoesPorVeiculo();
  const { data: kmMesMap = {} } = useKmMesPorVeiculo();
  const locatarioMap = useLocatarioPorVeiculo();

  // Rótulos dos meses (atual e anterior) para os cabeçalhos das colunas de KM.
  const { mesAtualLabel, mesAntLabel } = useMemo(() => {
    const h = new Date();
    const cap = (d: Date) => { const s = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""); return s.charAt(0).toUpperCase() + s.slice(1); };
    return { mesAtualLabel: cap(h), mesAntLabel: cap(new Date(h.getFullYear(), h.getMonth() - 1, 1)) };
  }, []);
  const { data: alienantes = [] } = useList<Alienante>("alienantes", { orderBy: { column: "nome", ascending: true } });
  const createAlienante = useCreate("alienantes", "Alienante");
  const create = useCreate<Vehicle>("vehicles", "Veículo");
  const update = useUpdate<Vehicle>("vehicles", "Veículo");
  const remove = useDelete("vehicles", "Veículo");
  const updateFipe = useUpdateFipe();
  const canWrite = useCanWrite("vehicles");
  const { data: statuses = [] } = useVehicleStatuses();
  const criarStatus = useCreateVehicleStatus();
  const [novoStatusAberto, setNovoStatusAberto] = useState(false);
  const [novoStatus, setNovoStatus] = useState("");
  const statusMap = useMemo(() => new Map(statuses.map((s) => [s.value, s])), [statuses]);
  async function criarNovoStatus() {
    if (!novoStatus.trim()) return;
    try {
      const value = await criarStatus.mutateAsync({ label: novoStatus });
      setValue("status", value);
      setNovoStatus(""); setNovoStatusAberto(false);
    } catch { /* toast no hook */ }
  }

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [search, setSearch] = useState("");
  const [importPlacaOpen, setImportPlacaOpen] = useState(false);
  // Filtros por coluna
  const [fMarca, setFMarca] = useState(TODOS);
  const [fAno, setFAno] = useState(TODOS);
  const [fStatus, setFStatus] = useState(TODOS);
  const [fProprietario, setFProprietario] = useState(TODOS);
  const [fLocatario, setFLocatario] = useState(TODOS);
  const [fRestricao, setFRestricao] = useState(TODOS); // todos | com | sem
  const { sortKey, sortDir, toggle, useSorted } = useSort<Vehicle>("placa", "asc");

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  // Opções distintas para os filtros de coluna.
  const opcoes = useMemo(() => {
    const marcas = new Set<string>(), anos = new Set<string>(), props = new Set<string>(), locs = new Set<string>();
    for (const v of vehicles) {
      if (v.marca) marcas.add(v.marca);
      const ano = v.ano_modelo ?? v.ano_fabricacao;
      if (ano) anos.add(String(ano));
      if (v.proprietario_nome) props.add(v.proprietario_nome);
      const loc = locatarioMap.get(v.id);
      if (loc) locs.add(loc);
    }
    const statusVals = new Set(vehicles.map((v) => v.status).filter(Boolean) as string[]);
    return {
      marcas: [...marcas].sort((a, b) => a.localeCompare(b, "pt-BR")),
      anos: [...anos].sort((a, b) => Number(b) - Number(a)),
      proprietarios: [...props].sort((a, b) => a.localeCompare(b, "pt-BR")),
      locatarios: [...locs].sort((a, b) => a.localeCompare(b, "pt-BR")),
      status: [...statusVals].sort((a, b) => (statusMap.get(a)?.label ?? a).localeCompare(statusMap.get(b)?.label ?? b, "pt-BR")),
    };
  }, [vehicles, locatarioMap, statusMap]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return vehicles.filter((v) => {
      const prop = v.proprietario_nome ?? "";
      const loc = locatarioMap.get(v.id) ?? "";
      const ano = String(v.ano_modelo ?? v.ano_fabricacao ?? "");
      const temRestr = !!restrMap[v.id];
      const qa = soAlfa(search);
      const mSearch = !q || v.placa.toLowerCase().includes(q) || v.modelo.toLowerCase().includes(q) ||
        v.marca.toLowerCase().includes(q) || prop.toLowerCase().includes(q) || loc.toLowerCase().includes(q) ||
        (qa !== "" && soAlfa(v.placa).includes(qa));
      const mMarca = fMarca === TODOS || v.marca === fMarca;
      const mAno = fAno === TODOS || ano === fAno;
      const mStatus = fStatus === TODOS || v.status === fStatus;
      const mProp = fProprietario === TODOS || prop === fProprietario;
      const mLoc = fLocatario === TODOS || loc === fLocatario;
      const mRestr = fRestricao === TODOS || (fRestricao === "com" ? temRestr : !temRestr);
      return mSearch && mMarca && mAno && mStatus && mProp && mLoc && mRestr;
    });
  }, [vehicles, search, fMarca, fAno, fStatus, fProprietario, fLocatario, fRestricao, locatarioMap, restrMap]);

  const sorted = useSorted(filtered, (v, k) => {
    switch (k) {
      case "placa": return v.placa.toUpperCase();
      case "veiculo": return `${v.marca} ${v.modelo}`.toLowerCase();
      case "ano": return v.ano_modelo ?? v.ano_fabricacao ?? 0;
      case "km": return v.km_atual ?? 0;
      case "kmmes": return kmMesMap[v.id]?.mesAtual ?? -1;
      case "kmmesant": return kmMesMap[v.id]?.mesAnterior ?? -1;
      case "fipe": return v.valor_fipe ?? 0;
      case "pendencias": { const p = pendMap[v.id]; return p ? p.vencidas * 100000 + p.abertas : -1; }
      case "restricoes": { const r = restrMap[v.id]; return r ? r.judicial * 100000 + r.total : -1; }
      case "proprietario": return (v.proprietario_nome ?? "").toLowerCase();
      case "locatario": return (locatarioMap.get(v.id) ?? "").toLowerCase();
      case "status": return statusMap.get(v.status)?.label ?? v.status ?? "";
      default: return null;
    }
  });

  const filtrosAtivos = [fMarca, fAno, fStatus, fProprietario, fLocatario, fRestricao].some((f) => f !== TODOS) || !!search;
  function limparFiltros() {
    setSearch(""); setFMarca(TODOS); setFAno(TODOS); setFStatus(TODOS); setFProprietario(TODOS); setFLocatario(TODOS); setFRestricao(TODOS);
  }

  function buildRelatorio(): RelatorioTabelaData {
    const colunas: RelColuna[] = [
      { label: "Placa" }, { label: "Veículo" }, { label: "Ano" },
      { label: "KM", align: "right" }, { label: `KM ${mesAtualLabel}`, align: "right" }, { label: `KM ${mesAntLabel}`, align: "right" },
      { label: "FIPE", align: "right" }, { label: "Pendências", align: "right" },
      { label: "Restrições", align: "right" }, { label: "Proprietário" }, { label: "Locatário" }, { label: "Status" },
    ];
    const linhas = sorted.map((v) => {
      const p = pendMap[v.id];
      const r = restrMap[v.id];
      const km = kmMesMap[v.id];
      return [
        maskPlaca(v.placa), `${v.marca} ${v.modelo}`,
        `${v.ano_fabricacao ?? "—"}/${v.ano_modelo ?? "—"}`,
        formatNumber(v.km_atual),
        km ? formatNumber(Math.round(km.mesAtual)) : "—",
        km ? formatNumber(Math.round(km.mesAnterior)) : "—",
        formatCurrency(v.valor_fipe),
        p ? `${p.abertas} aberta(s)${p.vencidas ? ` · ${p.vencidas} vencida(s)` : ""}` : "—",
        r ? `${r.total}${r.judicial ? ` · ${r.judicial} judicial(is)` : ""}` : "—",
        v.proprietario_nome ?? "—", locatarioMap.get(v.id) ?? "—",
        statusMap.get(v.status)?.label ?? v.status,
      ];
    });
    const fipeTotal = sorted.reduce((s, v) => s + (v.valor_fipe ?? 0), 0);
    const kmAtualTotal = sorted.reduce((s, v) => s + (kmMesMap[v.id]?.mesAtual ?? 0), 0);
    const kmAntTotal = sorted.reduce((s, v) => s + (kmMesMap[v.id]?.mesAnterior ?? 0), 0);
    const f = (v: string) => (v === TODOS ? "Todos" : v);
    return {
      titulo: "Veículos", subtitulo: `${sorted.length} veículo(s)`,
      filtros: [
        { label: "Busca", valor: search }, { label: "Marca", valor: f(fMarca) }, { label: "Ano", valor: f(fAno) },
        { label: "Status", valor: fStatus === TODOS ? "Todos" : (statusMap.get(fStatus)?.label ?? fStatus) },
        { label: "Proprietário", valor: f(fProprietario) }, { label: "Locatário", valor: f(fLocatario) },
        { label: "Restrição", valor: fRestricao === TODOS ? "Todas" : fRestricao === "com" ? "Com restrição" : "Sem restrição" },
      ],
      colunas, linhas,
      rodape: ["", "", "", "", formatNumber(Math.round(kmAtualTotal)), formatNumber(Math.round(kmAntTotal)), formatCurrency(fipeTotal), "", "", "", "", ""],
    };
  }

  function openNew() {
    setEditing(null);
    reset({
      status: "disponivel", km_atual: 0, fipe_manual: false,
      alienacao_fiduciaria: false, quitado: false, busca_apreensao: false, bloqueio_judicial: false,
    });
    setOpen(true);
  }

  function openEdit(v: Vehicle) {
    setEditing(v);
    reset({
      placa: v.placa,
      marca: v.marca,
      modelo: v.modelo,
      ano_fabricacao: v.ano_fabricacao ?? undefined,
      ano_modelo: v.ano_modelo ?? undefined,
      cor: v.cor ?? "",
      categoria: v.categoria ?? "",
      especie_tipo: v.especie_tipo ?? "",
      combustivel: v.combustivel ?? "",
      capacidade_passageiros: v.capacidade_passageiros ?? undefined,
      potencia: v.potencia ?? "",
      cilindrada: v.cilindrada ?? undefined,
      parcelamento_cotas: v.parcelamento_cotas ?? "",
      renavam: v.renavam ?? "",
      chassi: v.chassi ?? "",
      km_atual: v.km_atual,
      status: v.status,
      valor_aquisicao: v.valor_aquisicao ?? undefined,
      valor_fipe: v.valor_fipe ?? undefined,
      fipe_manual: v.fipe_manual ?? false,
      fornecedor: v.fornecedor ?? "",
      observacoes: v.observacoes ?? "",
      alienacao_fiduciaria: v.alienacao_fiduciaria ?? false,
      alienante: v.alienante ?? "",
      proprietario_nome: v.proprietario_nome ?? "",
      proprietario_documento: v.proprietario_documento ?? "",
      quitado: v.quitado ?? false,
      valor_quitacao: v.valor_quitacao ?? undefined,
      data_quitacao: v.data_quitacao ?? "",
      busca_apreensao: v.busca_apreensao ?? false,
      busca_apreensao_solicitante: v.busca_apreensao_solicitante ?? "",
      bloqueio_judicial: v.bloqueio_judicial ?? false,
      bloqueio_judicial_solicitante: v.bloqueio_judicial_solicitante ?? "",
    });
    setOpen(true);
  }

  function onSubmit(data: FormData) {
    const payload = {
      ...data,
      placa: data.placa.toUpperCase().replace(/\s/g, ""),
      ano_fabricacao: data.ano_fabricacao || null,
      ano_modelo: data.ano_modelo || null,
      capacidade_passageiros: data.capacidade_passageiros === "" ? null : data.capacidade_passageiros,
      cilindrada: data.cilindrada === "" ? null : data.cilindrada,
      valor_aquisicao: data.valor_aquisicao || null,
      valor_fipe: data.valor_fipe || null,
      alienante: data.alienacao_fiduciaria ? data.alienante || null : null,
      valor_quitacao: data.valor_quitacao === "" ? null : data.valor_quitacao,
      data_quitacao: data.data_quitacao || null,
      busca_apreensao_solicitante: data.busca_apreensao ? data.busca_apreensao_solicitante || null : null,
      bloqueio_judicial_solicitante: data.bloqueio_judicial ? data.bloqueio_judicial_solicitante || null : null,
    };
    // Persiste um novo alienante para reuso futuro.
    const nomeAlienante = (data.alienante ?? "").trim();
    if (data.alienacao_fiduciaria && nomeAlienante && !alienantes.some((a) => a.nome.toLowerCase() === nomeAlienante.toLowerCase())) {
      createAlienante.mutate({ nome: nomeAlienante });
    }
    if (editing) {
      update.mutate(
        { id: editing.id, ...payload },
        { onSuccess: () => setOpen(false) }
      );
    } else {
      create.mutate(payload, {
        onSuccess: (novo: Vehicle) => {
          setOpen(false);
          // Busca a FIPE automaticamente só quando o valor não foi fixado manualmente.
          if (novo?.id && !data.fipe_manual && !data.valor_fipe) updateFipe.mutate({ vehicle_id: novo.id });
        },
      });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Veículos"
        description="Cadastro e gestão da frota"
        actions={
          <div className="flex flex-wrap gap-2">
            <RelatorioExport build={buildRelatorio} nomeArquivo="veiculos" disabled={!sorted.length} />
            {canWrite && (
              <>
                <Button variant="outline" onClick={() => setImportPlacaOpen(true)}>
                  <FileUp className="h-4 w-4" /> Importar Consulta Placa
                </Button>
                <Button variant="outline" onClick={() => updateFipe.mutate({ all: true })} disabled={updateFipe.isPending}>
                  <RefreshCw className={`h-4 w-4 ${updateFipe.isPending ? "animate-spin" : ""}`} /> Atualizar FIPE
                </Button>
                <Button onClick={openNew}>
                  <Plus className="h-4 w-4" /> Novo veículo
                </Button>
              </>
            )}
          </div>
        }
      />

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center gap-2 border-b p-4">
            <BuscaPlaca
              value={search}
              onChange={setSearch}
              vehicles={vehicles}
              placeholder="Buscar por placa (ex.: 8451), marca, modelo, proprietário ou locatário..."
              contador={(id) => { const p = pendMap[id]; return p && p.abertas > 0 ? `${p.abertas} pend.` : null; }}
            />
          </div>
          {/* Filtros por coluna */}
          <div className="flex flex-wrap items-center gap-2 border-b bg-muted/20 p-3">
            <FiltroSelect label="Marca" value={fMarca} onChange={setFMarca} options={opcoes.marcas} />
            <FiltroSelect label="Ano" value={fAno} onChange={setFAno} options={opcoes.anos} />
            <FiltroSelect label="Status" value={fStatus} onChange={setFStatus} options={opcoes.status} render={(s) => statusMap.get(s)?.label ?? s} />
            <FiltroSelect label="Proprietário" value={fProprietario} onChange={setFProprietario} options={opcoes.proprietarios} />
            <FiltroSelect label="Locatário" value={fLocatario} onChange={setFLocatario} options={opcoes.locatarios} />
            <Select value={fRestricao} onValueChange={setFRestricao}>
              <SelectTrigger className="h-8 w-auto gap-1 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Restrições: todas</SelectItem>
                <SelectItem value="com">Com restrição</SelectItem>
                <SelectItem value="sem">Sem restrição</SelectItem>
              </SelectContent>
            </Select>
            {filtrosAtivos && (
              <Button variant="ghost" size="sm" onClick={limparFiltros}><X className="h-4 w-4" /> Limpar</Button>
            )}
            <span className="ml-auto text-xs text-muted-foreground">{sorted.length} de {vehicles.length}</span>
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <EmptyState
              message="Nenhum veículo cadastrado"
              icon={<Car className="h-6 w-6" />}
              action={
                canWrite && (
                  <Button variant="outline" onClick={openNew}>
                    <Plus className="h-4 w-4" /> Cadastrar primeiro veículo
                  </Button>
                )
              }
            />
          ) : (
            <div className="overflow-x-auto">
            <Table className="text-xs [&_th]:h-9 [&_th]:whitespace-nowrap [&_th]:px-1.5 [&_th]:text-[11px] [&_td]:px-1.5 [&_td]:py-2">
              <TableHeader>
                <TableRow>
                  <SortableHead sortKey="placa" activeKey={sortKey} dir={sortDir} onSort={toggle}>Placa</SortableHead>
                  <SortableHead sortKey="veiculo" activeKey={sortKey} dir={sortDir} onSort={toggle}>Veículo</SortableHead>
                  <SortableHead sortKey="ano" activeKey={sortKey} dir={sortDir} onSort={toggle}>Ano</SortableHead>
                  <SortableHead sortKey="km" activeKey={sortKey} dir={sortDir} onSort={toggle} align="right">KM</SortableHead>
                  <SortableHead sortKey="kmmes" activeKey={sortKey} dir={sortDir} onSort={toggle} align="right">KM {mesAtualLabel}</SortableHead>
                  <SortableHead sortKey="kmmesant" activeKey={sortKey} dir={sortDir} onSort={toggle} align="right">KM {mesAntLabel}</SortableHead>
                  <SortableHead sortKey="fipe" activeKey={sortKey} dir={sortDir} onSort={toggle} align="right">FIPE</SortableHead>
                  <SortableHead sortKey="pendencias" activeKey={sortKey} dir={sortDir} onSort={toggle}>Pend.</SortableHead>
                  <SortableHead sortKey="restricoes" activeKey={sortKey} dir={sortDir} onSort={toggle}>Restr.</SortableHead>
                  <SortableHead sortKey="proprietario" activeKey={sortKey} dir={sortDir} onSort={toggle}>Propriet.</SortableHead>
                  <SortableHead sortKey="locatario" activeKey={sortKey} dir={sortDir} onSort={toggle}>Locatário</SortableHead>
                  <SortableHead sortKey="status" activeKey={sortKey} dir={sortDir} onSort={toggle}>Status</SortableHead>
                  <TableHead className="w-[84px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((v) => {
                  const pend = pendMap[v.id];
                  return (
                  <TableRow
                    key={v.id}
                    className="cursor-pointer"
                    onClick={() => (canWrite ? openEdit(v) : navigate(`/pendencias?veiculo=${encodeURIComponent(v.placa)}`))}
                  >
                    <TableCell className="whitespace-nowrap font-mono font-medium">{maskPlaca(v.placa)}</TableCell>
                    <TableCell className="max-w-[132px]">
                      <div className="truncate font-medium" title={`${v.marca} ${v.modelo}`}>{v.marca} {v.modelo}</div>
                      <div className="truncate text-[10px] text-muted-foreground">{v.cor} · {v.categoria}</div>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {v.busca_apreensao && <Badge variant="destructive" className="px-1.5 py-0 text-[10px]" title="Busca e apreensão">B&amp;A</Badge>}
                        {v.bloqueio_judicial && <Badge variant="destructive" className="px-1.5 py-0 text-[10px]" title="Bloqueio judicial">Bloqueio</Badge>}
                        {v.alienacao_fiduciaria && <Badge variant="warning" className="px-1.5 py-0 text-[10px]" title={v.alienante ? `Alienado: ${v.alienante}` : "Alienado"}>Alienado</Badge>}
                        {v.quitado && <Badge variant="success" className="px-1.5 py-0 text-[10px]">Quitado</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{v.ano_fabricacao}/{v.ano_modelo}</TableCell>
                    <TableCell className="whitespace-nowrap text-right">{formatNumber(v.km_atual)}</TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      {kmMesMap[v.id]?.mesAtual != null ? formatNumber(Math.round(kmMesMap[v.id].mesAtual)) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      {kmMesMap[v.id]?.mesAnterior != null ? formatNumber(Math.round(kmMesMap[v.id].mesAnterior)) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      <div>{formatCurrency(v.valor_fipe)}</div>
                      {v.fipe_mes_referencia && (
                        <div className="text-[10px] text-muted-foreground" title={v.fipe_atualizado_em ? `FIPE ${v.fipe_mes_referencia} · atualizado em ${formatDate(v.fipe_atualizado_em)}` : `FIPE ${v.fipe_mes_referencia}`}>
                          {v.fipe_mes_referencia}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        title="Ver pendências do veículo"
                        onClick={(e) => { e.stopPropagation(); navigate(`/pendencias?veiculo=${encodeURIComponent(v.placa)}`); }}
                        className="inline-flex items-center gap-1"
                      >
                        {pend && pend.vencidas > 0 && (
                          <Badge variant="destructive" className="gap-0.5 px-1.5 py-0 text-[10px]" title={`${pend.vencidas} vencida(s)`}><AlertTriangle className="h-3 w-3" />{pend.vencidas}</Badge>
                        )}
                        {pend && pend.abertas > 0 ? (
                          <Badge variant={pend.vencidas > 0 ? "warning" : "secondary"} className="px-1.5 py-0 text-[10px]" title={`${pend.abertas} aberta(s)`}>{pend.abertas}</Badge>
                        ) : (
                          !pend?.vencidas && <span className="text-muted-foreground">—</span>
                        )}
                      </button>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const r = restrMap[v.id];
                        if (!r) return <span className="text-muted-foreground">—</span>;
                        return (
                          <button
                            type="button"
                            title={`${r.total} restrição(ões)${r.judicial ? ` · ${r.judicial} judicial(is)` : ""}`}
                            onClick={(e) => { e.stopPropagation(); navigate(`/pendencias?veiculo=${encodeURIComponent(v.placa)}&restr=todas`); }}
                            className="inline-flex items-center gap-1"
                          >
                            {r.judicial > 0 && (
                              <Badge variant="destructive" className="gap-0.5 px-1.5 py-0 text-[10px]"><AlertTriangle className="h-3 w-3" />{r.judicial}</Badge>
                            )}
                            <Badge variant={r.judicial > 0 ? "warning" : "secondary"} className="px-1.5 py-0 text-[10px]">{r.total}</Badge>
                          </button>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="max-w-[92px]">
                      {v.proprietario_nome
                        ? <span className="block truncate" title={`${v.proprietario_nome}${v.proprietario_documento ? ` · ${v.proprietario_documento}` : ""}`}>{v.proprietario_nome}</span>
                        : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="max-w-[92px]">
                      {(() => {
                        const loc = locatarioMap.get(v.id);
                        if (!loc) return <span className="text-muted-foreground">—</span>;
                        return (
                          <button
                            type="button"
                            title={`Ver contratos de ${loc}`}
                            onClick={(e) => { e.stopPropagation(); navigate(`/contratos?veiculo=${encodeURIComponent(v.placa)}`); }}
                            className="block max-w-full truncate text-left hover:underline"
                          >
                            {loc}
                          </button>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {statusMap.has(v.status) ? (
                        <Badge variant="secondary" className="gap-1 px-1.5 py-0 text-[10px]">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: statusMap.get(v.status)?.cor ?? "currentColor" }} />
                          {statusMap.get(v.status)?.label}
                        </Badge>
                      ) : <StatusBadge status={v.status} />}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {canWrite && (
                        <div className="flex justify-end gap-0.5">
                          {v.status === "inativo" ? (
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Reativar (disponível)" onClick={() => update.mutate({ id: v.id, status: "disponivel" })}>
                              <RotateCcw className="h-4 w-4 text-success" />
                            </Button>
                          ) : (
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Inativar veículo" onClick={() => update.mutate({ id: v.id, status: "inativo" })}>
                              <Power className="h-4 w-4 text-warning" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar" aria-label={`Editar ${v.placa}`} onClick={() => openEdit(v)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Remover" aria-label={`Remover ${v.placa}`}
                            onClick={() => { if (confirm(`Remover o veículo ${v.placa}?`)) remove.mutate(v.id); }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar veículo" : "Novo veículo"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Placa" error={errors.placa?.message}>
                <Input {...register("placa")} placeholder="ABC1D23" />
              </Field>
              <Field label="Marca" error={errors.marca?.message}>
                <Input {...register("marca")} />
              </Field>
              <Field label="Modelo" error={errors.modelo?.message}>
                <Input {...register("modelo")} />
              </Field>
              <Field label="Ano fabricação">
                <Input type="number" {...register("ano_fabricacao")} />
              </Field>
              <Field label="Ano modelo">
                <Input type="number" {...register("ano_modelo")} />
              </Field>
              <Field label="Cor">
                <Input {...register("cor")} />
              </Field>
              <Field label="Categoria">
                <Select
                  value={watch("categoria") || ""}
                  onValueChange={(v) => setValue("categoria", v)}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {VEHICLE_CATEGORIA.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="KM atual" error={errors.km_atual?.message}>
                <Input type="number" {...register("km_atual")} />
              </Field>
              <Field label="Status">
                <Select
                  value={watch("status") || "disponivel"}
                  onValueChange={(v) => setValue("status", v)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(statuses.length ? statuses.map((s) => ({ value: s.value, label: s.label })) : VEHICLE_STATUS).map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                    {(() => { const cur = watch("status"); return cur && statuses.length && !statuses.some((s) => s.value === cur) ? <SelectItem value={cur}>{statusMap.get(cur)?.label ?? cur}</SelectItem> : null; })()}
                  </SelectContent>
                </Select>
                {canWrite && (novoStatusAberto ? (
                  <div className="mt-1.5 flex items-center gap-1">
                    <Input value={novoStatus} onChange={(e) => setNovoStatus(e.target.value)} placeholder="Nome do novo status" className="h-8"
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); criarNovoStatus(); } }} />
                    <Button type="button" size="sm" className="h-8 shrink-0" disabled={!novoStatus.trim() || criarStatus.isPending} onClick={criarNovoStatus}>Criar</Button>
                    <Button type="button" variant="ghost" size="sm" className="h-8 shrink-0 px-2" onClick={() => { setNovoStatusAberto(false); setNovoStatus(""); }}>✕</Button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setNovoStatusAberto(true)} className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    <Plus className="h-3 w-3" /> Criar novo status
                  </button>
                ))}
              </Field>
              <Field label="Renavam">
                <Input {...register("renavam")} />
              </Field>
              <Field label="Chassi">
                <Input {...register("chassi")} />
              </Field>
              <Field label="Espécie / Tipo">
                <Input {...register("especie_tipo")} placeholder="PAS / AUTOMOVEL" />
              </Field>
              <Field label="Combustível">
                <Input {...register("combustivel")} placeholder="GAS/ALC/GNV" />
              </Field>
              <Field label="Capacidade (passageiros)">
                <Input type="number" {...register("capacidade_passageiros")} />
              </Field>
              <Field label="Potência (cv)">
                <Input {...register("potencia")} />
              </Field>
              <Field label="Cilindrada (cc)">
                <Input type="number" {...register("cilindrada")} />
              </Field>
              <Field label="Parcelamento / Cotas (IPVA)">
                <Input {...register("parcelamento_cotas")} placeholder="3 X 0,00" />
              </Field>
              <Field label="Fornecedor">
                <Input {...register("fornecedor")} />
              </Field>
              <Field label="Valor de aquisição (R$)">
                <Input type="number" step="0.01" {...register("valor_aquisicao")} />
              </Field>
              <Field label="Valor FIPE (R$)">
                <Input type="number" step="0.01" {...register("valor_fipe")} />
                <label className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" className="h-3.5 w-3.5" {...register("fipe_manual")} />
                  Fixar valor manualmente (não atualizar pela FIPE automática)
                </label>
              </Field>
            </div>

            {/* Situação jurídica / patrimonial */}
            <div className="space-y-4 rounded-lg border p-4">
              <h4 className="text-sm font-semibold">Situação jurídica / patrimonial</h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Proprietário do veículo (nome)">
                  <Input {...register("proprietario_nome")} placeholder="Nome / razão social" />
                </Field>
                <Field label="CPF ou CNPJ do proprietário">
                  <Input {...register("proprietario_documento")} placeholder="000.000.000-00" />
                </Field>
              </div>

              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" className="h-4 w-4" {...register("alienacao_fiduciaria")} />
                Alienação fiduciária
              </label>
              {watch("alienacao_fiduciaria") && (
                <Field label="Alienante (consórcio / banco)">
                  <Input list="alienantes-list" {...register("alienante")} placeholder="Ex.: Consórcio BB" />
                  <datalist id="alienantes-list">
                    {alienantes.map((a) => <option key={a.id} value={a.nome} />)}
                  </datalist>
                </Field>
              )}

              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" className="h-4 w-4" {...register("quitado")} />
                Quitado
              </label>
              {watch("quitado") && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Valor de quitação (R$)">
                    <Input type="number" step="0.01" {...register("valor_quitacao")} />
                  </Field>
                  <Field label="Data do valor da quitação">
                    <Input type="date" {...register("data_quitacao")} />
                  </Field>
                </div>
              )}

              <label className="flex items-center gap-2 text-sm font-medium text-destructive">
                <input type="checkbox" className="h-4 w-4" {...register("busca_apreensao")} />
                Busca e apreensão
              </label>
              {watch("busca_apreensao") && (
                <Field label="Quem solicitou a busca e apreensão?">
                  <Input {...register("busca_apreensao_solicitante")} placeholder="Solicitante" />
                </Field>
              )}

              <label className="flex items-center gap-2 text-sm font-medium text-destructive">
                <input type="checkbox" className="h-4 w-4" {...register("bloqueio_judicial")} />
                Bloqueio judicial
              </label>
              {watch("bloqueio_judicial") && (
                <Field label="Quem solicitou o bloqueio judicial?">
                  <Input {...register("bloqueio_judicial_solicitante")} placeholder="Solicitante" />
                </Field>
              )}
            </div>

            <Field label="Observações">
              <Input {...register("observacoes")} />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={create.isPending || update.isPending}>
                {editing ? "Salvar alterações" : "Cadastrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ImportarConsultaPlacaDialog open={importPlacaOpen} onOpenChange={setImportPlacaOpen} vehicles={vehicles} />
    </div>
  );
}
