import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2, Wallet } from "lucide-react";
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
import { EXPENSE_CATEGORIA, EXPENSE_STATUS } from "@/lib/options";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Expense, Vehicle } from "@/types/database";

const schema = z.object({
  categoria: z.string().min(1, "Selecione a categoria"),
  descricao: z.string().min(1, "Informe a descrição"),
  vehicle_id: z.string().optional(),
  data: z.string().min(1, "Informe a data"),
  valor: z.coerce.number().min(0.01, "Informe o valor"),
  recorrente: z.boolean().default(false),
  fornecedor: z.string().optional(),
  status: z.string().default("pago"),
});
type FormData = z.infer<typeof schema>;

export default function ExpensesPage() {
  const { data: expenses = [], isLoading } = useList<Expense>("expenses", {
    orderBy: { column: "data", ascending: false },
  });
  const { data: vehicles = [] } = useList<Vehicle>("vehicles");
  const create = useCreate<Expense>("expenses", "Despesa");
  const update = useUpdate<Expense>("expenses", "Despesa");
  const remove = useDelete("expenses", "Despesa");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);

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
    return expenses
      .filter((e) => {
        const d = new Date(e.data);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && e.status !== "cancelado";
      })
      .reduce((s, e) => s + e.valor, 0);
  }, [expenses]);

  const vehicleLabel = (id: string | null) => {
    if (!id) return "Frota (geral)";
    const v = vehicles.find((x) => x.id === id);
    return v ? v.placa : "—";
  };

  function openNew() {
    setEditing(null);
    reset({ status: "pago", recorrente: false, data: new Date().toISOString().slice(0, 10) });
    setOpen(true);
  }

  function openEdit(e: Expense) {
    setEditing(e);
    reset({
      categoria: e.categoria,
      descricao: e.descricao,
      vehicle_id: e.vehicle_id ?? "",
      data: e.data,
      valor: e.valor,
      recorrente: e.recorrente,
      fornecedor: e.fornecedor ?? "",
      status: e.status,
    });
    setOpen(true);
  }

  function onSubmit(data: FormData) {
    const payload = { ...data, vehicle_id: data.vehicle_id || null };
    if (editing) {
      update.mutate({ id: editing.id, ...payload }, { onSuccess: () => setOpen(false) });
    } else {
      create.mutate(payload, { onSuccess: () => setOpen(false) });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Despesas"
        description="Custos da operação e da frota"
        actions={<Button onClick={openNew}><Plus className="h-4 w-4" /> Nova despesa</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Despesas do mês" value={formatCurrency(totalMes)} tone="warning" icon={<Wallet className="h-5 w-5" />} />
        <StatCard title="Total de lançamentos" value={expenses.length} />
        <StatCard title="Recorrentes" value={expenses.filter((e) => e.recorrente).length} />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : expenses.length === 0 ? (
            <EmptyState message="Nenhuma despesa lançada" icon={<Wallet className="h-6 w-6" />} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Veículo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{formatDate(e.data)}</TableCell>
                    <TableCell><span className="font-medium">{e.categoria}</span></TableCell>
                    <TableCell>{e.descricao}</TableCell>
                    <TableCell>{vehicleLabel(e.vehicle_id)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(e.valor)}</TableCell>
                    <TableCell><StatusBadge status={e.status} /></TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(e)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => confirm("Remover despesa?") && remove.mutate(e.id)}>
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
            <DialogTitle>{editing ? "Editar despesa" : "Nova despesa"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Categoria" error={errors.categoria?.message}>
                <Select value={watch("categoria") || ""} onValueChange={(v) => setValue("categoria", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIA.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Valor (R$)" error={errors.valor?.message}>
                <Input type="number" step="0.01" {...register("valor")} />
              </Field>
              <Field label="Descrição" error={errors.descricao?.message} className="space-y-1.5 sm:col-span-2">
                <Input {...register("descricao")} />
              </Field>
              <Field label="Veículo (opcional)">
                <Select value={watch("vehicle_id") || ""} onValueChange={(v) => setValue("vehicle_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Frota (geral)" /></SelectTrigger>
                  <SelectContent>
                    {vehicles.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.placa} — {v.modelo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Data" error={errors.data?.message}>
                <Input type="date" {...register("data")} />
              </Field>
              <Field label="Fornecedor">
                <Input {...register("fornecedor")} />
              </Field>
              <Field label="Status">
                <Select value={watch("status") || "pago"} onValueChange={(v) => setValue("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EXPENSE_STATUS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...register("recorrente")} className="h-4 w-4" />
              Despesa recorrente (mensal)
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={create.isPending || update.isPending}>
                {editing ? "Salvar" : "Lançar despesa"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
