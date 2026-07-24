import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2, CheckCircle2, AlertOctagon, Wrench, CarFront, ListTodo, CalendarClock } from "lucide-react";
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
import { useList, useCreate, useUpdate, useDelete } from "@/hooks/use-crud";
import { useCanWrite } from "@/hooks/use-can-write";
import { useContratos } from "@/hooks/use-contratos";
import { useOcorrencias, construirLinhaTempo, type OcorrenciaRow } from "@/hooks/use-ocorrencias";
import { useAbrirOSAuto } from "@/hooks/use-ordens-servico";
import { OCORRENCIA_TIPO, OCORRENCIA_STATUS, OCORRENCIA_GRAVIDADE } from "@/lib/options";
import { formatCurrency, formatDate, soAlfa } from "@/lib/format";
import type { Vehicle } from "@/types/database";
import { useSort } from "@/hooks/use-sort";
import { SortableHead } from "@/components/shared/sortable-head";
import { BuscaPlaca } from "@/components/shared/busca-placa";
import { RelatorioExport } from "@/components/shared/relatorio-export";
import { VehicleStatusBadge, statusVeiculoLabel } from "@/components/shared/vehicle-status-badge";
import type { RelatorioTabelaData, RelColuna } from "@/lib/relatorio-tabela";

const TIPO = Object.fromEntries(OCORRENCIA_TIPO.map((t) => [t.value, t]));
const tipoLabel = (t: string) => TIPO[t]?.label ?? t;
const tipoCor = (t: string) => TIPO[t]?.color ?? "hsl(215 16% 55%)";
const ehServico = (t: string) => !!TIPO[t]?.servico;
const statusLabel = (s: string) => OCORRENCIA_STATUS.find((x) => x.value === s)?.label ?? s;
const fmtDataHora = (iso: string | null) => {
  if (!iso) return "—";
  const d = formatDate(iso.slice(0, 10));
  const hm = iso.length > 10 && iso.slice(11, 16) !== "00:00" ? ` ${iso.slice(11, 16)}` : "";
  return d + hm;
};

const schema = z.object({
  vehicle_id: z.string().min(1, "Selecione o veículo"),
  tipo: z.string().default("manutencao"),
  gravidade: z.string().default("media"),
  titulo: z.string().optional(),
  descricao: z.string().optional(),
  local: z.string().optional(),
  km: z.coerce.number().optional().or(z.literal("")),
  inicio: z.string().min(1, "Informe o início"),
  fim: z.string().optional(),
  status: z.string().default("aberta"),
  custo: z.coerce.number().optional().or(z.literal("")),
  responsavel: z.string().optional(),
  contrato_id: z.string().optional(),
  locatario_id: z.string().optional(),
}).refine((d) => d.tipo !== "carro_reserva" || !!d.contrato_id, { message: "Contrato obrigatório para carro reserva", path: ["contrato_id"] });
type FormData = z.infer<typeof schema>;

const nowLocal = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const STATUS_VARIANT: Record<string, "warning" | "secondary" | "success" | "muted"> = { aberta: "warning", em_andamento: "secondary", resolvida: "success", cancelada: "muted" };

export default function OcorrenciasPage() {
  const { data: rows = [], isLoading } = useOcorrencias();
  const { data: vehicles = [] } = useList<Vehicle>("vehicles");
  const { data: contratos = [] } = useContratos();
  const create = useCreate("ocorrencias", "Ocorrência");
  const update = useUpdate("ocorrencias", "Ocorrência");
  const remove = useDelete("ocorrencias", "Ocorrência");
  const abrirOS = useAbrirOSAuto();
  const canWrite = useCanWrite("ocorrencias");

  const [aba, setAba] = useState<"lista" | "timeline">("lista");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<OcorrenciaRow | null>(null);
  const [search, setSearch] = useState("");
  const [fTipo, setFTipo] = useState("todos");
  const [fStatus, setFStatus] = useState("ativas");

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) });
  const tipoSel = watch("tipo");
  const contratoSel = watch("contrato_id");

  const vMap = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles]);
  const contratosAtivos = useMemo(() => contratos.filter((c) => c.status === "ativo"), [contratos]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const qa = soAlfa(search);
    return rows.filter((r) => {
      const placa = r.vehicles?.placa ?? r.placa ?? "";
      const mQ = !q || placa.toLowerCase().includes(q) || (r.titulo ?? "").toLowerCase().includes(q) ||
        (r.responsavel ?? "").toLowerCase().includes(q) || (qa !== "" && soAlfa(placa).includes(qa));
      const mT = fTipo === "todos" || r.tipo === fTipo;
      const mS = fStatus === "todas" ? true : fStatus === "ativas" ? (r.status === "aberta" || r.status === "em_andamento") : r.status === fStatus;
      return mQ && mT && mS;
    });
  }, [rows, search, fTipo, fStatus]);

  const { sortKey, sortDir, toggle, useSorted } = useSort<OcorrenciaRow>("inicio", "desc");
  const sorted = useSorted(filtered, (r, k) => {
    switch (k) {
      case "veiculo": return r.vehicles?.placa ?? r.placa ?? "";
      case "statusv": return vMap.get(r.vehicle_id ?? "")?.status ?? "";
      case "tipo": return tipoLabel(r.tipo);
      case "gravidade": return r.gravidade;
      case "inicio": return r.inicio;
      case "fim": return r.fim ?? "";
      case "status": return r.status;
      case "custo": return r.custo ?? -1;
      default: return null;
    }
  });

  const kpi = useMemo(() => {
    let abertas = 0, andamento = 0, reserva = 0, custo = 0;
    for (const r of rows) {
      if (r.status === "aberta") abertas++;
      if (r.status === "em_andamento") andamento++;
      if (r.tipo === "carro_reserva" && (r.status === "aberta" || r.status === "em_andamento")) reserva++;
      if (r.custo && r.status !== "cancelada") custo += r.custo;
    }
    return { abertas, andamento, reserva, custo };
  }, [rows]);

  // Linha do tempo do veículo pesquisado.
  const veicTimeline = useMemo(() => {
    const qa = soAlfa(search);
    if (!qa) return null;
    return vehicles.find((v) => soAlfa(v.placa).includes(qa)) ?? null;
  }, [vehicles, search]);
  const timeline = useMemo(() => {
    if (!veicTimeline) return [];
    return construirLinhaTempo(veicTimeline.id, contratos, rows, tipoLabel, tipoCor);
  }, [veicTimeline, contratos, rows]);

  function buildRelatorio(): RelatorioTabelaData {
    const colunas: RelColuna[] = [
      { label: "Veículo" }, { label: "Status veículo" }, { label: "Tipo" }, { label: "Gravidade" },
      { label: "Início" }, { label: "Fim" }, { label: "Status" }, { label: "Custo", align: "right" },
    ];
    const linhas = sorted.map((r) => [
      r.vehicles?.placa ?? r.placa ?? "—", statusVeiculoLabel(vMap.get(r.vehicle_id ?? "")?.status),
      tipoLabel(r.tipo), r.gravidade, fmtDataHora(r.inicio), fmtDataHora(r.fim), statusLabel(r.status),
      r.custo != null ? formatCurrency(r.custo) : "—",
    ]);
    const total = sorted.reduce((s, r) => s + (r.custo ?? 0), 0);
    return {
      titulo: "Ocorrências", subtitulo: `${sorted.length} registro(s)`,
      filtros: [{ label: "Busca", valor: search }, { label: "Tipo", valor: fTipo === "todos" ? "Todos" : tipoLabel(fTipo) }, { label: "Situação", valor: fStatus }],
      colunas, linhas, rodape: ["", "", "", "", "", "", "Total", formatCurrency(total)],
    };
  }

  function openNew() {
    setEditing(null);
    reset({ tipo: "manutencao", gravidade: "media", status: "aberta", inicio: nowLocal() });
    setOpen(true);
  }
  function openEdit(r: OcorrenciaRow) {
    setEditing(r);
    reset({
      vehicle_id: r.vehicle_id ?? "", tipo: r.tipo, gravidade: r.gravidade, titulo: r.titulo ?? "",
      descricao: r.descricao ?? "", local: r.local ?? "", km: r.km ?? undefined,
      inicio: (r.inicio ?? "").slice(0, 16), fim: (r.fim ?? "").slice(0, 16), status: r.status,
      custo: r.custo ?? undefined, responsavel: r.responsavel ?? "",
      contrato_id: r.contrato_id ?? "", locatario_id: r.locatario_id ?? "",
    });
    setOpen(true);
  }
  function onSubmit(data: FormData) {
    const v = vMap.get(data.vehicle_id);
    const payload = {
      vehicle_id: data.vehicle_id, placa: v?.placa ?? null, tipo: data.tipo, gravidade: data.gravidade,
      titulo: data.titulo || null, descricao: data.descricao || null, local: data.local || null,
      km: data.km === "" ? null : data.km,
      inicio: data.inicio ? `${data.inicio}:00` : new Date().toISOString(),
      fim: data.fim ? `${data.fim}:00` : null,
      status: data.status, custo: data.custo === "" ? null : data.custo, responsavel: data.responsavel || null,
      contrato_id: data.contrato_id || null, locatario_id: data.locatario_id || null,
    };
    if (editing) {
      update.mutate({ id: editing.id, ...payload }, { onSuccess: () => setOpen(false) });
    } else {
      create.mutate(payload, {
        onSuccess: (nova: { id?: string } | undefined) => {
          setOpen(false);
          // Abre OS automaticamente para tipos de serviço.
          if (nova?.id && ehServico(data.tipo)) abrirOS.mutate({ id: nova.id, vehicle_id: data.vehicle_id, placa: v?.placa ?? null, tipo: data.tipo, titulo: data.titulo || null });
        },
      });
    }
  }
  function resolver(r: OcorrenciaRow) {
    update.mutate({ id: r.id, status: "resolvida", fim: r.fim ?? new Date().toISOString() });
  }

  const contadorOc = (id: string) => { const n = rows.filter((r) => r.vehicle_id === id && (r.status === "aberta" || r.status === "em_andamento")).length; return n ? `${n} aberta${n > 1 ? "s" : ""}` : null; };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ocorrências"
        description="Registro de manutenções, colisões, avarias, carro reserva e o histórico dia a dia dos veículos"
        actions={
          <div className="flex flex-wrap gap-2">
            <RelatorioExport build={buildRelatorio} nomeArquivo="ocorrencias" disabled={!sorted.length} />
            {canWrite && <Button onClick={openNew}><Plus className="h-4 w-4" /> Nova ocorrência</Button>}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Abertas" value={kpi.abertas} tone="warning" icon={<AlertOctagon className="h-5 w-5" />} />
        <StatCard title="Em andamento" value={kpi.andamento} icon={<Wrench className="h-5 w-5" />} />
        <StatCard title="Carros reserva ativos" value={kpi.reserva} icon={<CarFront className="h-5 w-5" />} />
        <StatCard title="Custo registrado" value={formatCurrency(kpi.custo)} hint="soma dos custos das ocorrências" tone="destructive" icon={<ListTodo className="h-5 w-5" />} />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flex flex-col gap-2 border-b p-3 sm:flex-row sm:items-center sm:p-4">
            <BuscaPlaca value={search} onChange={setSearch} vehicles={vehicles} placeholder="Buscar por placa (ex.: 8451), título ou responsável..." contador={contadorOc} />
            <div className="flex gap-2">
              <Button type="button" variant={aba === "lista" ? "default" : "outline"} size="sm" onClick={() => setAba("lista")}><ListTodo className="h-4 w-4" /> Lista</Button>
              <Button type="button" variant={aba === "timeline" ? "default" : "outline"} size="sm" onClick={() => setAba("timeline")}><CalendarClock className="h-4 w-4" /> Linha do tempo</Button>
            </div>
          </div>

          {aba === "lista" ? (
            <>
              <div className="flex flex-wrap gap-2 border-b p-3">
                <Select value={fTipo} onValueChange={setFTipo}>
                  <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os tipos</SelectItem>
                    {OCORRENCIA_TIPO.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={fStatus} onValueChange={setFStatus}>
                  <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativas">Ativas (abertas)</SelectItem>
                    <SelectItem value="resolvida">Resolvidas</SelectItem>
                    <SelectItem value="cancelada">Canceladas</SelectItem>
                    <SelectItem value="todas">Todas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {isLoading ? (
                <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
              ) : filtered.length === 0 ? (
                <EmptyState message="Nenhuma ocorrência" icon={<AlertOctagon className="h-6 w-6" />} />
              ) : (
                <div className="overflow-x-auto">
                  <Table className="text-xs [&_th]:h-9 [&_th]:whitespace-nowrap [&_th]:px-2 [&_td]:px-2 [&_td]:py-2">
                    <TableHeader>
                      <TableRow>
                        <SortableHead sortKey="veiculo" activeKey={sortKey} dir={sortDir} onSort={toggle}>Veículo</SortableHead>
                        <SortableHead sortKey="statusv" activeKey={sortKey} dir={sortDir} onSort={toggle}>Status veículo</SortableHead>
                        <SortableHead sortKey="tipo" activeKey={sortKey} dir={sortDir} onSort={toggle}>Tipo</SortableHead>
                        <SortableHead sortKey="gravidade" activeKey={sortKey} dir={sortDir} onSort={toggle}>Gravidade</SortableHead>
                        <SortableHead sortKey="inicio" activeKey={sortKey} dir={sortDir} onSort={toggle}>Início</SortableHead>
                        <SortableHead sortKey="fim" activeKey={sortKey} dir={sortDir} onSort={toggle}>Fim</SortableHead>
                        <SortableHead sortKey="status" activeKey={sortKey} dir={sortDir} onSort={toggle}>Status</SortableHead>
                        <SortableHead sortKey="custo" activeKey={sortKey} dir={sortDir} onSort={toggle} align="right">Custo</SortableHead>
                        {canWrite && <TableHead className="w-24"></TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sorted.map((r) => (
                        <TableRow key={r.id} className={canWrite ? "cursor-pointer" : undefined} onClick={canWrite ? () => openEdit(r) : undefined}>
                          <TableCell className="whitespace-nowrap font-mono font-medium">{r.vehicles?.placa ?? r.placa ?? "—"}</TableCell>
                          <TableCell><VehicleStatusBadge status={vMap.get(r.vehicle_id ?? "")?.status} /></TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="gap-1 px-1.5 py-0 text-[10px]"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: tipoCor(r.tipo) }} />{tipoLabel(r.tipo)}</Badge>
                            {r.titulo && <div className="text-[11px] text-muted-foreground">{r.titulo}</div>}
                          </TableCell>
                          <TableCell className="capitalize">{r.gravidade}</TableCell>
                          <TableCell className="whitespace-nowrap">{fmtDataHora(r.inicio)}</TableCell>
                          <TableCell className="whitespace-nowrap">{fmtDataHora(r.fim)}</TableCell>
                          <TableCell><Badge variant={STATUS_VARIANT[r.status]} className="px-1.5 py-0 text-[10px]">{statusLabel(r.status)}</Badge></TableCell>
                          <TableCell className="whitespace-nowrap text-right">{r.custo != null ? formatCurrency(r.custo) : "—"}</TableCell>
                          {canWrite && (
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <div className="flex justify-end gap-0.5">
                                {r.status !== "resolvida" && r.status !== "cancelada" && (
                                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Resolver" aria-label="Resolver" onClick={() => resolver(r)}><CheckCircle2 className="h-4 w-4 text-success" /></Button>
                                )}
                                <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar" aria-label="Editar" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" title="Remover" aria-label="Remover" onClick={() => confirm("Remover ocorrência?") && remove.mutate(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          ) : (
            <div className="p-4">
              {!veicTimeline ? (
                <EmptyState message="Busque um veículo pela placa para ver o histórico dia a dia" icon={<CalendarClock className="h-6 w-6" />} />
              ) : (
                <div className="space-y-1">
                  <div className="mb-3 text-sm"><span className="font-mono font-semibold">{veicTimeline.placa}</span> <span className="text-muted-foreground">{veicTimeline.marca} {veicTimeline.modelo}</span></div>
                  {timeline.length === 0 ? (
                    <EmptyState message="Sem eventos de contrato ou ocorrência para este veículo" />
                  ) : timeline.map((s, i) => (
                    <div key={i} className="flex items-start gap-3 border-l-2 py-2 pl-3" style={{ borderColor: s.cor }}>
                      <div className="min-w-[130px] shrink-0 text-xs font-medium">
                        {fmtDataHora(s.inicioISO)}{s.fimISO && s.fimISO.slice(0, 10) !== s.inicioISO.slice(0, 10) ? ` — ${fmtDataHora(s.fimISO)}` : ""}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <Badge variant="secondary" className="gap-1 px-1.5 py-0 text-[10px]"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.cor }} />{s.estado}</Badge>
                        <span className="text-muted-foreground">{s.detalhe}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar ocorrência" : "Nova ocorrência"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Veículo" error={errors.vehicle_id?.message}>
                <Select value={watch("vehicle_id") || ""} onValueChange={(v) => setValue("vehicle_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{vehicles.map((v) => <SelectItem key={v.id} value={v.id}>{v.placa} — {v.modelo}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Tipo">
                <Select value={tipoSel || "manutencao"} onValueChange={(v) => setValue("tipo", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{OCORRENCIA_TIPO.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
                {ehServico(tipoSel) && <p className="mt-1 text-[11px] text-muted-foreground">Abre uma Ordem de Serviço automaticamente.</p>}
              </Field>
              <Field label="Título" className="space-y-1.5 sm:col-span-2"><Input {...register("titulo")} placeholder="Resumo da ocorrência" /></Field>

              {tipoSel === "carro_reserva" && (
                <>
                  <Field label="Contrato (carro reserva)" error={errors.contrato_id?.message}>
                    <Select value={contratoSel || ""} onValueChange={(v) => {
                      setValue("contrato_id", v);
                      const c = contratos.find((x) => x.id === v);
                      if (c?.locatario_id) setValue("locatario_id", c.locatario_id);
                    }}>
                      <SelectTrigger><SelectValue placeholder="Selecione o contrato" /></SelectTrigger>
                      <SelectContent>{contratosAtivos.map((c) => <SelectItem key={c.id} value={c.id}>{c.numero} — {c.cliente_nome}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Locatário">
                    <Input readOnly className="bg-muted" value={contratos.find((c) => c.id === contratoSel)?.cliente_nome ?? ""} placeholder="(do contrato)" />
                  </Field>
                </>
              )}

              <Field label="Gravidade">
                <Select value={watch("gravidade") || "media"} onValueChange={(v) => setValue("gravidade", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{OCORRENCIA_GRAVIDADE.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Status">
                <Select value={watch("status") || "aberta"} onValueChange={(v) => setValue("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{OCORRENCIA_STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Início" error={errors.inicio?.message}><Input type="datetime-local" {...register("inicio")} /></Field>
              <Field label="Fim (opcional)"><Input type="datetime-local" {...register("fim")} /></Field>
              <Field label="KM no momento"><Input type="number" {...register("km")} /></Field>
              <Field label="Custo (R$)"><Input type="number" step="0.01" {...register("custo")} /></Field>
              <Field label="Local"><Input {...register("local")} /></Field>
              <Field label="Responsável"><Input {...register("responsavel")} /></Field>
              <Field label="Descrição" className="space-y-1.5 sm:col-span-2"><Textarea {...register("descricao")} /></Field>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={create.isPending || update.isPending}>{editing ? "Salvar" : "Cadastrar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
