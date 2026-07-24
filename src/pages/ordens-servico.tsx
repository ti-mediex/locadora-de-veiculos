import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2, Wrench, ClipboardList, CheckCircle2, Clock } from "lucide-react";
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
import { useOrdensServico, useSalvarOrdemServico, useDeleteOrdemServico, type OrdemServicoRow } from "@/hooks/use-ordens-servico";
import { OS_STATUS } from "@/lib/options";
import { formatCurrency, formatDate, soAlfa } from "@/lib/format";
import type { Vehicle, OrdemServicoStatus } from "@/types/database";
import { useSort } from "@/hooks/use-sort";
import { SortableHead } from "@/components/shared/sortable-head";
import { BuscaPlaca } from "@/components/shared/busca-placa";
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
  tipo_servico: z.string().optional(),
  oficina: z.string().optional(),
  responsavel: z.string().optional(),
  descricao: z.string().optional(),
  valor_mao_obra: z.coerce.number().min(0).default(0),
  valor_pecas: z.coerce.number().min(0).default(0),
  status: z.string().default("aberta"),
  data_abertura: z.string().optional(),
  previsao: z.string().optional(),
  data_conclusao: z.string().optional(),
});
type FormData = z.infer<typeof schema>;
const hoje = () => new Date().toISOString().slice(0, 10);

export default function OrdensServicoPage() {
  const { data: rows = [], isLoading } = useOrdensServico();
  const { data: vehicles = [] } = useList<Vehicle>("vehicles");
  const { data: ocorrencias = [] } = useOcorrencias();
  const salvar = useSalvarOrdemServico();
  const remove = useDeleteOrdemServico();
  const canWrite = useCanWrite("ordens_servico");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<OrdemServicoRow | null>(null);
  const [search, setSearch] = useState("");
  const [fStatus, setFStatus] = useState("ativas");

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) });
  const vMap = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles]);
  const totalForm = (Number(watch("valor_mao_obra")) || 0) + (Number(watch("valor_pecas")) || 0);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const qa = soAlfa(search);
    return rows.filter((r) => {
      const placa = r.vehicles?.placa ?? r.placa ?? "";
      const mQ = !q || placa.toLowerCase().includes(q) || r.numero.toLowerCase().includes(q) ||
        (r.oficina ?? "").toLowerCase().includes(q) || (qa !== "" && soAlfa(placa).includes(qa));
      const mS = fStatus === "todas" ? true : fStatus === "ativas" ? (r.status !== "concluida" && r.status !== "cancelada") : r.status === fStatus;
      return mQ && mS;
    });
  }, [rows, search, fStatus]);

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
      { label: "Abertura" }, { label: "Status" }, { label: "Mão de obra", align: "right" }, { label: "Peças", align: "right" }, { label: "Total", align: "right" },
    ];
    const linhas = sorted.map((r) => [
      r.numero, r.vehicles?.placa ?? r.placa ?? "—", statusVeiculoLabel(vMap.get(r.vehicle_id ?? "")?.status),
      r.oficina ?? "—", formatDate(r.data_abertura), statusLabel(r.status),
      formatCurrency(r.valor_mao_obra), formatCurrency(r.valor_pecas), formatCurrency(r.valor_total),
    ]);
    const total = sorted.reduce((s, r) => s + Number(r.valor_total ?? 0), 0);
    return {
      titulo: "Ordens de serviço", subtitulo: `${sorted.length} OS`,
      filtros: [{ label: "Busca", valor: search }, { label: "Situação", valor: fStatus }],
      colunas, linhas, rodape: ["", "", "", "", "", "", "", "Total", formatCurrency(total)],
    };
  }

  function openNew() {
    setEditing(null);
    reset({ status: "aberta", valor_mao_obra: 0, valor_pecas: 0, data_abertura: hoje() });
    setOpen(true);
  }
  function openEdit(r: OrdemServicoRow) {
    setEditing(r);
    reset({
      ocorrencia_id: r.ocorrencia_id ?? "", vehicle_id: r.vehicle_id ?? "", tipo_servico: r.tipo_servico ?? "",
      oficina: r.oficina ?? "", responsavel: r.responsavel ?? "", descricao: r.descricao ?? "",
      valor_mao_obra: r.valor_mao_obra ?? 0, valor_pecas: r.valor_pecas ?? 0, status: r.status,
      data_abertura: r.data_abertura ?? "", previsao: r.previsao ?? "", data_conclusao: r.data_conclusao ?? "",
    });
    setOpen(true);
  }
  function onSubmit(data: FormData) {
    const v = data.vehicle_id ? vMap.get(data.vehicle_id) : undefined;
    const conclui = data.status === "concluida";
    const payload = {
      ocorrencia_id: data.ocorrencia_id || null, vehicle_id: data.vehicle_id || null, placa: v?.placa ?? null,
      tipo_servico: data.tipo_servico || null, oficina: data.oficina || null, responsavel: data.responsavel || null,
      descricao: data.descricao || null, valor_mao_obra: data.valor_mao_obra, valor_pecas: data.valor_pecas,
      status: data.status as OrdemServicoStatus, data_abertura: data.data_abertura || hoje(), previsao: data.previsao || null,
      data_conclusao: data.data_conclusao || (conclui ? hoje() : null),
    };
    salvar.mutate(editing ? { id: editing.id, ...payload } : payload, { onSuccess: () => setOpen(false) });
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
        <StatCard title="OS abertas" value={kpi.abertas} tone="warning" icon={<ClipboardList className="h-5 w-5" />} />
        <StatCard title="Em andamento" value={kpi.andamento} icon={<Wrench className="h-5 w-5" />} />
        <StatCard title="Concluídas (mês)" value={kpi.concluidasMes} tone="success" icon={<CheckCircle2 className="h-5 w-5" />} />
        <StatCard title="Custo concluído (mês)" value={formatCurrency(kpi.custoMes)} tone="destructive" icon={<Clock className="h-5 w-5" />} />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flex flex-col gap-2 border-b p-3 sm:flex-row sm:items-center sm:p-4">
            <BuscaPlaca value={search} onChange={setSearch} vehicles={vehicles} placeholder="Buscar por placa, nº da OS ou oficina..." />
            <Select value={fStatus} onValueChange={setFStatus}>
              <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ativas">Em aberto</SelectItem>
                {OS_STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                <SelectItem value="todas">Todas</SelectItem>
              </SelectContent>
            </Select>
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
                      <TableCell className="whitespace-nowrap font-mono font-medium">{r.numero}</TableCell>
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
          <DialogHeader><DialogTitle>{editing ? `Editar ${editing.numero}` : "Nova ordem de serviço"}</DialogTitle></DialogHeader>
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
                <Select value={watch("vehicle_id") || ""} onValueChange={(v) => setValue("vehicle_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{vehicles.map((v) => <SelectItem key={v.id} value={v.id}>{v.placa} — {v.modelo}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Status">
                <Select value={watch("status") || "aberta"} onValueChange={(v) => setValue("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{OS_STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Tipo de serviço"><Input {...register("tipo_servico")} placeholder="Ex.: Troca de óleo, Funilaria" /></Field>
              <Field label="Oficina / fornecedor"><Input {...register("oficina")} /></Field>
              <Field label="Responsável"><Input {...register("responsavel")} /></Field>
              <Field label="Abertura"><Input type="date" {...register("data_abertura")} /></Field>
              <Field label="Previsão"><Input type="date" {...register("previsao")} /></Field>
              <Field label="Conclusão"><Input type="date" {...register("data_conclusao")} /></Field>
              <Field label="Mão de obra (R$)" error={errors.valor_mao_obra?.message}><Input type="number" step="0.01" {...register("valor_mao_obra")} /></Field>
              <Field label="Peças (R$)" error={errors.valor_pecas?.message}><Input type="number" step="0.01" {...register("valor_pecas")} /></Field>
              <Field label="Total (calculado)"><Input readOnly value={formatCurrency(totalForm)} className="bg-muted" /></Field>
              <Field label="Descrição / observações" className="space-y-1.5 sm:col-span-2"><Textarea {...register("descricao")} /></Field>
            </div>
            <p className="text-xs text-muted-foreground">Ao salvar como <b>Concluída</b> com total maior que zero, uma despesa é lançada/atualizada automaticamente no módulo Despesas.</p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={salvar.isPending}>{salvar.isPending ? "Salvando..." : editing ? "Salvar" : "Criar OS"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
