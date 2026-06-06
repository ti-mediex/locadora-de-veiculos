import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2, Wrench } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Field } from "@/components/shared/field";
import { Button } from "@/components/ui/button";
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
import { MAINTENANCE_TYPE, MAINTENANCE_STATUS } from "@/lib/options";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import type { Maintenance, Vehicle } from "@/types/database";

const schema = z.object({
  vehicle_id: z.string().min(1, "Selecione o veículo"),
  tipo: z.string().default("preventiva"),
  descricao: z.string().min(1, "Informe a descrição"),
  data: z.string().min(1, "Informe a data"),
  km: z.coerce.number().int().optional().or(z.literal("")),
  valor: z.coerce.number().min(0).default(0),
  oficina: z.string().optional(),
  status: z.string().default("concluida"),
});
type FormData = z.infer<typeof schema>;

export default function MaintenancesPage() {
  const { data: items = [], isLoading } = useList<Maintenance>("maintenances", {
    orderBy: { column: "data", ascending: false },
  });
  const { data: vehicles = [] } = useList<Vehicle>("vehicles");
  const create = useCreate<Maintenance>("maintenances", "Manutenção");
  const update = useUpdate<Maintenance>("maintenances", "Manutenção");
  const remove = useDelete("maintenances", "Manutenção");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Maintenance | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const totalMes = useMemo(() => {
    const now = new Date();
    return items
      .filter((m) => {
        const d = new Date(m.data);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && m.status !== "cancelada";
      })
      .reduce((s, m) => s + m.valor, 0);
  }, [items]);

  const pendentes = items.filter((m) => m.status === "agendada" || m.status === "em_andamento").length;
  const vehicleLabel = (id: string) => vehicles.find((v) => v.id === id)?.placa ?? "—";

  function openNew() {
    setEditing(null);
    reset({ tipo: "preventiva", status: "concluida", valor: 0, data: new Date().toISOString().slice(0, 10) });
    setOpen(true);
  }

  function openEdit(m: Maintenance) {
    setEditing(m);
    reset({
      vehicle_id: m.vehicle_id,
      tipo: m.tipo,
      descricao: m.descricao,
      data: m.data,
      km: m.km ?? undefined,
      valor: m.valor,
      oficina: m.oficina ?? "",
      status: m.status,
    });
    setOpen(true);
  }

  function onSubmit(data: FormData) {
    const payload = { ...data, km: data.km || null };
    if (editing) {
      update.mutate({ id: editing.id, ...payload }, { onSuccess: () => setOpen(false) });
    } else {
      create.mutate(payload, { onSuccess: () => setOpen(false) });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manutenções"
        description="Histórico de manutenção e custos da frota"
        actions={<Button onClick={openNew}><Plus className="h-4 w-4" /> Nova manutenção</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Custo no mês" value={formatCurrency(totalMes)} tone="warning" icon={<Wrench className="h-5 w-5" />} />
        <StatCard title="Pendentes / em andamento" value={pendentes} />
        <StatCard title="Total de registros" value={items.length} />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : items.length === 0 ? (
            <EmptyState message="Nenhuma manutenção registrada" icon={<Wrench className="h-6 w-6" />} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">KM</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>{formatDate(m.data)}</TableCell>
                    <TableCell className="font-medium">{vehicleLabel(m.vehicle_id)}</TableCell>
                    <TableCell><StatusBadge status={m.tipo} /></TableCell>
                    <TableCell>{m.descricao}</TableCell>
                    <TableCell className="text-right">{m.km ? formatNumber(m.km) : "—"}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(m.valor)}</TableCell>
                    <TableCell><StatusBadge status={m.status} /></TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(m)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => confirm("Remover manutenção?") && remove.mutate(m.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar manutenção" : "Nova manutenção"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Veículo" error={errors.vehicle_id?.message}>
                <Select value={watch("vehicle_id") || ""} onValueChange={(v) => setValue("vehicle_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {vehicles.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.placa} — {v.modelo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Tipo">
                <Select value={watch("tipo") || "preventiva"} onValueChange={(v) => setValue("tipo", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MAINTENANCE_TYPE.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Descrição" error={errors.descricao?.message} className="space-y-1.5 sm:col-span-2">
                <Input {...register("descricao")} />
              </Field>
              <Field label="Data" error={errors.data?.message}>
                <Input type="date" {...register("data")} />
              </Field>
              <Field label="KM">
                <Input type="number" {...register("km")} />
              </Field>
              <Field label="Valor (R$)">
                <Input type="number" step="0.01" {...register("valor")} />
              </Field>
              <Field label="Oficina">
                <Input {...register("oficina")} />
              </Field>
              <Field label="Status" className="space-y-1.5 sm:col-span-2">
                <Select value={watch("status") || "concluida"} onValueChange={(v) => setValue("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MAINTENANCE_STATUS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
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
