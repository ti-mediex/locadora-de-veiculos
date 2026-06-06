import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Field } from "@/components/shared/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { FINE_STATUS } from "@/lib/options";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Fine, Vehicle, Renter } from "@/types/database";

const schema = z.object({
  vehicle_id: z.string().min(1, "Selecione o veículo"),
  renter_id: z.string().optional(),
  data_infracao: z.string().min(1, "Informe a data"),
  codigo_infracao: z.string().optional(),
  descricao: z.string().min(1, "Informe a descrição"),
  orgao_autuador: z.string().optional(),
  valor: z.coerce.number().min(0, "Informe o valor"),
  pontos: z.coerce.number().int().min(0).default(0),
  vencimento: z.string().optional(),
  repassar_locatario: z.boolean().default(true),
  status: z.string().default("lancada"),
});
type FormData = z.infer<typeof schema>;

export default function FinesPage() {
  const { data: fines = [], isLoading } = useList<Fine>("fines", {
    orderBy: { column: "data_infracao", ascending: false },
  });
  const { data: vehicles = [] } = useList<Vehicle>("vehicles");
  const { data: renters = [] } = useList<Renter>("renters");
  const create = useCreate<Fine>("fines", "Multa");
  const update = useUpdate<Fine>("fines", "Multa");
  const remove = useDelete("fines", "Multa");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Fine | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const totais = useMemo(() => {
    const total = fines.filter((f) => f.status !== "cancelada").reduce((s, f) => s + f.valor, 0);
    const aRepassar = fines.filter((f) => f.repassar_locatario && !f.repassado && f.status !== "cancelada").reduce((s, f) => s + f.valor, 0);
    const empresa = fines.filter((f) => !f.repassar_locatario && f.status !== "cancelada").reduce((s, f) => s + f.valor, 0);
    return { total, aRepassar, empresa };
  }, [fines]);

  const vehicleLabel = (id: string) => vehicles.find((v) => v.id === id)?.placa ?? "—";
  const renterLabel = (id: string | null) => (id ? renters.find((r) => r.id === id)?.nome ?? "—" : "—");

  function openNew() {
    setEditing(null);
    reset({ status: "lancada", repassar_locatario: true, pontos: 0, data_infracao: new Date().toISOString().slice(0, 10) });
    setOpen(true);
  }

  function openEdit(f: Fine) {
    setEditing(f);
    reset({
      vehicle_id: f.vehicle_id,
      renter_id: f.renter_id ?? "",
      data_infracao: f.data_infracao,
      codigo_infracao: f.codigo_infracao ?? "",
      descricao: f.descricao,
      orgao_autuador: f.orgao_autuador ?? "",
      valor: f.valor,
      pontos: f.pontos ?? 0,
      vencimento: f.vencimento ?? "",
      repassar_locatario: f.repassar_locatario,
      status: f.status,
    });
    setOpen(true);
  }

  function onSubmit(data: FormData) {
    const payload = {
      ...data,
      renter_id: data.renter_id || null,
      vencimento: data.vencimento || null,
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
        title="Multas e infrações"
        description="Controle de multas e repasse ao locatário"
        actions={<Button onClick={openNew}><Plus className="h-4 w-4" /> Nova multa</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Total de multas" value={formatCurrency(totais.total)} icon={<AlertTriangle className="h-5 w-5" />} />
        <StatCard title="A repassar ao locatário" value={formatCurrency(totais.aRepassar)} tone="warning" />
        <StatCard title="Custo da empresa" value={formatCurrency(totais.empresa)} tone="destructive" />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : fines.length === 0 ? (
            <EmptyState message="Nenhuma multa registrada" icon={<AlertTriangle className="h-6 w-6" />} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Repasse</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fines.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell>{formatDate(f.data_infracao)}</TableCell>
                    <TableCell className="font-medium">{vehicleLabel(f.vehicle_id)}</TableCell>
                    <TableCell>{renterLabel(f.renter_id)}</TableCell>
                    <TableCell>{f.descricao}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(f.valor)}</TableCell>
                    <TableCell>
                      {f.repassar_locatario ? (
                        <Badge variant="warning">Locatário</Badge>
                      ) : (
                        <Badge variant="destructive">Empresa</Badge>
                      )}
                    </TableCell>
                    <TableCell><StatusBadge status={f.status} /></TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(f)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => confirm("Remover multa?") && remove.mutate(f.id)}>
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
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar multa" : "Nova multa"}</DialogTitle>
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
              <Field label="Locatário responsável">
                <Select value={watch("renter_id") || ""} onValueChange={(v) => setValue("renter_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {renters.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Descrição" error={errors.descricao?.message} className="space-y-1.5 sm:col-span-2">
                <Input {...register("descricao")} />
              </Field>
              <Field label="Código da infração">
                <Input {...register("codigo_infracao")} />
              </Field>
              <Field label="Órgão autuador">
                <Input {...register("orgao_autuador")} />
              </Field>
              <Field label="Data da infração" error={errors.data_infracao?.message}>
                <Input type="date" {...register("data_infracao")} />
              </Field>
              <Field label="Vencimento">
                <Input type="date" {...register("vencimento")} />
              </Field>
              <Field label="Valor (R$)" error={errors.valor?.message}>
                <Input type="number" step="0.01" {...register("valor")} />
              </Field>
              <Field label="Pontos">
                <Input type="number" {...register("pontos")} />
              </Field>
              <Field label="Status" className="space-y-1.5 sm:col-span-2">
                <Select value={watch("status") || "lancada"} onValueChange={(v) => setValue("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FINE_STATUS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...register("repassar_locatario")} className="h-4 w-4" />
              Repassar custo ao locatário
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
    </div>
  );
}
