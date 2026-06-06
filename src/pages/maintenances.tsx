import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2, Wrench, ListChecks } from "lucide-react";
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
import { useCanWrite } from "@/hooks/use-can-write";
import { MaintenanceItemsDialog } from "@/components/maintenance/items-dialog";
import {
  MAINTENANCE_TYPE,
  MAINTENANCE_STATUS,
  MAINTENANCE_STAGE,
  MAINTENANCE_MOTIVO,
} from "@/lib/options";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import type { Maintenance, Vehicle, Renter, Supplier } from "@/types/database";

const schema = z.object({
  vehicle_id: z.string().min(1, "Selecione o veículo"),
  tipo: z.string().default("preventiva"),
  descricao: z.string().min(1, "Informe a descrição"),
  data: z.string().min(1, "Informe a data"),
  km: z.coerce.number().int().optional().or(z.literal("")),
  valor: z.coerce.number().min(0).default(0),
  oficina: z.string().optional(),
  status: z.string().default("concluida"),
  etapa: z.string().default("pre_agendamento"),
  motivo: z.string().optional(),
  solicitante: z.string().optional(),
  supplier_id: z.string().optional(),
  renter_id: z.string().optional(),
  agendamento: z.string().optional(),
  leva_traz: z.boolean().default(false),
});
type FormData = z.infer<typeof schema>;

export default function MaintenancesPage() {
  const { data: items = [], isLoading } = useList<Maintenance>("maintenances", {
    orderBy: { column: "data", ascending: false },
  });
  const { data: vehicles = [] } = useList<Vehicle>("vehicles");
  const { data: renters = [] } = useList<Renter>("renters");
  const { data: suppliers = [] } = useList<Supplier>("suppliers");
  const create = useCreate<Maintenance>("maintenances", "Manutenção");
  const update = useUpdate<Maintenance>("maintenances", "Manutenção");
  const remove = useDelete("maintenances", "Manutenção");
  const canWrite = useCanWrite("maintenances");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Maintenance | null>(null);
  const [itemsFor, setItemsFor] = useState<string | null>(null);

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
    reset({
      tipo: "preventiva",
      status: "agendada",
      etapa: "pre_agendamento",
      leva_traz: false,
      valor: 0,
      data: new Date().toISOString().slice(0, 10),
    });
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
      etapa: m.etapa ?? "pre_agendamento",
      motivo: m.motivo ?? "",
      solicitante: m.solicitante ?? "",
      supplier_id: m.supplier_id ?? "",
      renter_id: m.renter_id ?? "",
      agendamento: m.agendamento ?? "",
      leva_traz: m.leva_traz ?? false,
    });
    setOpen(true);
  }

  function onSubmit(data: FormData) {
    const payload = {
      ...data,
      km: data.km || null,
      supplier_id: data.supplier_id || null,
      renter_id: data.renter_id || null,
      agendamento: data.agendamento || null,
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
        title="Manutenções"
        description="Histórico de manutenção e custos da frota"
        actions={canWrite && <Button onClick={openNew}><Plus className="h-4 w-4" /> Nova manutenção</Button>}
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
                        <Button variant="ghost" size="icon" title="Itens da OS" onClick={() => setItemsFor(m.id)}>
                          <ListChecks className="h-4 w-4" />
                        </Button>
                        {canWrite && (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => openEdit(m)}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => confirm("Remover manutenção?") && remove.mutate(m.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        )}
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar manutenção" : "Nova manutenção (abertura de OS)"}</DialogTitle>
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
              <Field label="Motivo">
                <Select value={watch("motivo") || ""} onValueChange={(v) => setValue("motivo", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {MAINTENANCE_MOTIVO.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Etapa (pipeline)">
                <Select value={watch("etapa") || "pre_agendamento"} onValueChange={(v) => setValue("etapa", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MAINTENANCE_STAGE.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Descrição do serviço" error={errors.descricao?.message} className="space-y-1.5 sm:col-span-2">
                <Input {...register("descricao")} />
              </Field>
              <Field label="Fornecedor / oficina">
                <Select value={watch("supplier_id") || ""} onValueChange={(v) => setValue("supplier_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.nome_fantasia}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Condutor (solicitante)">
                <Select value={watch("renter_id") || ""} onValueChange={(v) => setValue("renter_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {renters.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Solicitante">
                <Input {...register("solicitante")} />
              </Field>
              <Field label="Agendamento">
                <Input type="date" {...register("agendamento")} />
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
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4" checked={!!watch("leva_traz")} onChange={(e) => setValue("leva_traz", e.target.checked)} />
              Serviço de leva e traz
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={create.isPending || update.isPending}>
                {editing ? "Salvar" : "Registrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <MaintenanceItemsDialog maintenanceId={itemsFor} onClose={() => setItemsFor(null)} />
    </div>
  );
}
