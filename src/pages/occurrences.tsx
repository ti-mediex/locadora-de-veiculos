import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2, Search, ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Field } from "@/components/shared/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { useCanWrite } from "@/hooks/use-can-write";
import { OCCURRENCE_TYPE, OCCURRENCE_STATUS } from "@/lib/options";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Occurrence, Vehicle, Renter } from "@/types/database";

const schema = z.object({
  tipo: z.string().min(1, "Selecione o tipo"),
  vehicle_id: z.string().optional(),
  renter_id: z.string().optional(),
  data: z.string().min(1, "Informe a data"),
  descricao: z.string().min(1, "Descreva a ocorrência"),
  valor: z.coerce.number().optional().or(z.literal("")),
  status: z.string().default("aberta"),
  observacoes: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

const typeLabel = (v: string) => OCCURRENCE_TYPE.find((o) => o.value === v)?.label ?? v;

export default function OccurrencesPage() {
  const { data: items = [], isLoading } = useList<Occurrence>("occurrences", {
    orderBy: { column: "data", ascending: false },
  });
  const { data: vehicles = [] } = useList<Vehicle>("vehicles");
  const { data: renters = [] } = useList<Renter>("renters");
  const create = useCreate("occurrences", "Ocorrência");
  const update = useUpdate("occurrences", "Ocorrência");
  const remove = useDelete("occurrences", "Ocorrência");
  const canWrite = useCanWrite("occurrences");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Occurrence | null>(null);
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState("todos");

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const vehicleLabel = (id: string | null) => vehicles.find((v) => v.id === id)?.placa ?? "—";

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter((o) => {
      const matchSearch = !q || o.descricao.toLowerCase().includes(q) || vehicleLabel(o.vehicle_id).toLowerCase().includes(q);
      const matchTipo = filterTipo === "todos" || o.tipo === filterTipo;
      return matchSearch && matchTipo;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, search, filterTipo, vehicles]);

  function openNew() {
    setEditing(null);
    reset({ tipo: "manutencao", status: "aberta", data: new Date().toISOString().slice(0, 10) });
    setOpen(true);
  }

  function openEdit(o: Occurrence) {
    setEditing(o);
    reset({
      tipo: o.tipo,
      vehicle_id: o.vehicle_id ?? "",
      renter_id: o.renter_id ?? "",
      data: o.data,
      descricao: o.descricao,
      valor: o.valor ?? undefined,
      status: o.status,
      observacoes: o.observacoes ?? "",
    });
    setOpen(true);
  }

  function onSubmit(data: FormData) {
    const payload = {
      ...data,
      vehicle_id: data.vehicle_id || null,
      renter_id: data.renter_id || null,
      valor: data.valor || null,
    };
    if (editing) {
      update.mutate({ id: editing.id, ...payload }, { onSuccess: () => setOpen(false) });
    } else {
      create.mutate(payload, { onSuccess: () => setOpen(false) });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ocorrências"
        description="Registro operacional da frota (manutenção, sinistro, infração, devolução, etc.)"
        actions={
          canWrite && (
            <Button onClick={openNew}>
              <Plus className="h-4 w-4" /> Nova ocorrência
            </Button>
          )
        }
      />

      <Card>
        <CardContent className="p-0">
          <div className="flex flex-col gap-2 border-b p-4 sm:flex-row sm:items-center">
            <div className="flex flex-1 items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por descrição ou placa..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border-0 focus-visible:ring-0"
              />
            </div>
            <Select value={filterTipo} onValueChange={setFilterTipo}>
              <SelectTrigger className="w-full sm:w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os tipos</SelectItem>
                {OCCURRENCE_TYPE.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <EmptyState message="Nenhuma ocorrência registrada" icon={<ClipboardList className="h-6 w-6" />} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  {canWrite && <TableHead className="w-24"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>{formatDate(o.data)}</TableCell>
                    <TableCell><Badge variant="secondary">{typeLabel(o.tipo)}</Badge></TableCell>
                    <TableCell className="font-medium">{vehicleLabel(o.vehicle_id)}</TableCell>
                    <TableCell>{o.descricao}</TableCell>
                    <TableCell className="text-right">{o.valor ? formatCurrency(o.valor) : "—"}</TableCell>
                    <TableCell><StatusBadge status={o.status} /></TableCell>
                    {canWrite && (
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(o)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => confirm("Remover ocorrência?") && remove.mutate(o.id)}>
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
            <DialogTitle>{editing ? "Editar ocorrência" : "Nova ocorrência"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tipo" error={errors.tipo?.message}>
                <Select value={watch("tipo") || "manutencao"} onValueChange={(v) => setValue("tipo", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OCCURRENCE_TYPE.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Status">
                <Select value={watch("status") || "aberta"} onValueChange={(v) => setValue("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OCCURRENCE_STATUS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Veículo">
                <Select value={watch("vehicle_id") || ""} onValueChange={(v) => setValue("vehicle_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {vehicles.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.placa} — {v.modelo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Locatário (opcional)">
                <Select value={watch("renter_id") || ""} onValueChange={(v) => setValue("renter_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {renters.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Data" error={errors.data?.message}>
                <Input type="date" {...register("data")} />
              </Field>
              <Field label="Valor (R$, opcional)">
                <Input type="number" step="0.01" {...register("valor")} />
              </Field>
            </div>
            <Field label="Descrição" error={errors.descricao?.message}>
              <Input {...register("descricao")} />
            </Field>
            <Field label="Observações">
              <Textarea {...register("observacoes")} />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={create.isPending || update.isPending}>
                {editing ? "Salvar" : "Registrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
