import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus, Pencil, Trash2, Search, CheckCircle2, AlertTriangle, Clock, Radio, ListTodo, Wand2,
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
import {
  usePendencias, usePendenciasSummary, useGenerateDefaultPendencias, vencimentoStatus, type PendenciaRow,
} from "@/hooks/use-pendencias";
import {
  PENDENCIA_CATEGORIA, PENDENCIA_STATUS, PENDENCIA_PRIORIDADE,
} from "@/lib/options";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Vehicle } from "@/types/database";

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
  const genDefaults = useGenerateDefaultPendencias();
  const canWrite = useCanWrite("pendencias");

  const [searchParams, setSearchParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PendenciaRow | null>(null);
  const [search, setSearch] = useState(searchParams.get("veiculo") ?? "");
  const [fCategoria, setFCategoria] = useState("todas");
  const [fStatus, setFStatus] = useState(searchParams.get("veiculo") ? "todas" : "ativas");

  // Pré-filtra pela placa vinda por link (ex.: da tela de Veículos).
  useEffect(() => {
    const v = searchParams.get("veiculo");
    if (v) {
      setSearch(v);
      setFStatus("todas");
      searchParams.delete("veiculo");
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
      const matchSearch = !q || r.titulo.toLowerCase().includes(q) ||
        (r.responsavel ?? "").toLowerCase().includes(q) || (r.vehicles?.placa ?? "").toLowerCase().includes(q);
      const matchCat = fCategoria === "todas" || r.categoria === fCategoria;
      const matchStatus =
        fStatus === "todas" ? true :
        fStatus === "ativas" ? (r.status === "aberta" || r.status === "em_andamento") :
        fStatus === "atrasadas" ? vencimentoStatus(r.vencimento, r.status) === "vencida" :
        r.status === fStatus;
      return matchSearch && matchCat && matchStatus;
    });
  }, [rows, search, fCategoria, fStatus]);

  function openNew() {
    setEditing(null);
    reset({ categoria: "IPVA", prioridade: "media", status: "aberta", pago: false });
    setOpen(true);
  }
  function openEdit(r: PendenciaRow) {
    setEditing(r);
    reset({
      vehicle_id: r.vehicle_id, categoria: r.categoria, titulo: r.titulo, descricao: r.descricao ?? "",
      prioridade: r.prioridade, status: r.status, vencimento: r.vencimento ?? "",
      valor: r.valor ?? undefined, pago: r.pago, ativo: r.ativo ?? undefined,
      responsavel: r.responsavel ?? "", observacoes: r.observacoes ?? "",
    });
    setOpen(true);
  }
  function onSubmit(data: FormData) {
    const payload = {
      ...data,
      vencimento: data.vencimento || null,
      valor: data.valor === "" ? null : data.valor,
      ativo: controle === "ativo" ? !!data.ativo : null,
      resolvido_em: data.status === "resolvida" ? new Date().toISOString().slice(0, 10) : null,
    };
    if (editing) update.mutate({ id: editing.id, ...payload }, { onSuccess: () => setOpen(false) });
    else create.mutate(payload, { onSuccess: () => setOpen(false) });
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
          canWrite && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => genDefaults.mutate()} disabled={genDefaults.isPending}>
                <Wand2 className="h-4 w-4" /> Itens de controle padrão
              </Button>
              <Button onClick={openNew}><Plus className="h-4 w-4" /> Nova pendência</Button>
            </div>
          )
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

      <Card>
        <CardContent className="p-0">
          <div className="flex flex-col gap-2 border-b p-4 sm:flex-row sm:items-center">
            <div className="flex flex-1 items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por título, placa ou responsável..." value={search} onChange={(e) => setSearch(e.target.value)} className="border-0 focus-visible:ring-0" />
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
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <EmptyState message="Nenhuma pendência" icon={<ListTodo className="h-6 w-6" />} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Status</TableHead>
                  {canWrite && <TableHead className="w-28"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow
                    key={r.id}
                    className={canWrite ? "cursor-pointer" : undefined}
                    onClick={canWrite ? () => openEdit(r) : undefined}
                  >
                    <TableCell className="font-mono font-medium">{r.vehicles?.placa ?? vehicleLabel(r.vehicle_id)}</TableCell>
                    <TableCell><Badge variant="secondary">{r.categoria}</Badge></TableCell>
                    <TableCell>
                      <div>{r.titulo}</div>
                      {r.categoria.toLowerCase().includes("ituran") && (
                        <span className={`text-xs ${r.ativo ? "text-success" : "text-destructive"}`}>
                          {r.ativo ? "Ativo" : "Inativo"}
                        </span>
                      )}
                      {r.valor != null && <span className="text-xs text-muted-foreground"> · {formatCurrency(r.valor)}{r.pago ? " (pago)" : ""}</span>}
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
        <DialogContent className="max-w-xl">
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

              {(controle === "vencimento" || controle === "multa") && (
                <Field label="Vencimento">
                  <Input type="date" {...register("vencimento")} />
                </Field>
              )}
              {(controle === "multa" || controle === "vencimento") && (
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

            {controle === "ativo" && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4" checked={!!watch("ativo")} onChange={(e) => setValue("ativo", e.target.checked)} />
                Rastreador ativo
              </label>
            )}
            {(controle === "vencimento" || controle === "multa") && (
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
    </div>
  );
}
