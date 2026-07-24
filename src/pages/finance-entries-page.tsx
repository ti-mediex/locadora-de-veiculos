import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2, Search, FileDown, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { SelectVeiculo } from "@/components/shared/select-veiculo";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Field } from "@/components/shared/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { supabase } from "@/lib/supabase";
import { useList, useCreate, useUpdate, useDelete } from "@/hooks/use-crud";
import { useCanWrite } from "@/hooks/use-can-write";
import { RECEITA_CATEGORIA, DESPESA_CATEGORIA, FORMA_PAGAMENTO } from "@/lib/options";
import { formatCurrency, formatDate } from "@/lib/format";
import { exportToCsv } from "@/lib/csv";
import type { FinanceEntry, Vehicle } from "@/types/database";

type Row = FinanceEntry & { vehicles: { placa: string } | null };

const schema = z.object({
  data: z.string().min(1, "Informe a data"),
  vehicle_id: z.string().optional(),
  categoria: z.string().optional(),
  descricao: z.string().min(1, "Informe a descrição"),
  valor: z.coerce.number().min(0.01, "Informe o valor"),
  forma_pagamento: z.string().optional(),
  observacoes: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export function FinanceEntriesPage({ tipo }: { tipo: "receita" | "despesa" }) {
  const qc = useQueryClient();
  const isReceita = tipo === "receita";
  const label = isReceita ? "Receita" : "Despesa";
  const categorias = isReceita ? RECEITA_CATEGORIA : DESPESA_CATEGORIA;
  const canWrite = useCanWrite("finance");

  const { data: rows = [], isLoading } = useQuery<Row[]>({
    queryKey: ["finance_entries", tipo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_entries")
        .select("*, vehicles(placa)")
        .eq("tipo", tipo)
        .order("data", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as never;
    },
  });
  const { data: vehicles = [] } = useList<Vehicle>("vehicles");
  const create = useCreate("finance_entries", label);
  const update = useUpdate("finance_entries", label);
  const remove = useDelete("finance_entries", label);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [search, setSearch] = useState("");

  const {
    register, handleSubmit, reset, setValue, watch, formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const vehicleLabel = (id: string | null) =>
    id ? vehicles.find((v) => v.id === id)?.placa ?? "—" : "Frota (geral)";

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter(
      (r) =>
        r.descricao.toLowerCase().includes(q) ||
        (r.categoria ?? "").toLowerCase().includes(q) ||
        vehicleLabel(r.vehicle_id).toLowerCase().includes(q)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, search, vehicles]);

  const totalMes = useMemo(() => {
    const now = new Date();
    return rows
      .filter((r) => {
        const d = new Date(r.data);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((s, r) => s + r.valor, 0);
  }, [rows]);
  const total = useMemo(() => rows.reduce((s, r) => s + r.valor, 0), [rows]);

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["finance_entries", tipo] });
    qc.invalidateQueries({ queryKey: ["finance"] });
  }

  function openNew() {
    setEditing(null);
    reset({ data: new Date().toISOString().slice(0, 10), categoria: categorias[0].value });
    setOpen(true);
  }
  function openEdit(r: Row) {
    setEditing(r);
    reset({
      data: r.data,
      vehicle_id: r.vehicle_id ?? "",
      categoria: r.categoria ?? "",
      descricao: r.descricao,
      valor: r.valor,
      forma_pagamento: r.forma_pagamento ?? "",
      observacoes: r.observacoes ?? "",
    });
    setOpen(true);
  }
  function onSubmit(data: FormData) {
    const payload = { ...data, tipo, vehicle_id: data.vehicle_id || null };
    if (editing) {
      update.mutate({ id: editing.id, ...payload }, { onSuccess: () => { setOpen(false); invalidate(); } });
    } else {
      create.mutate(payload, { onSuccess: () => { setOpen(false); invalidate(); } });
    }
  }
  function del(r: Row) {
    if (confirm(`Remover ${label.toLowerCase()} "${r.descricao}"?`))
      remove.mutate(r.id, { onSuccess: invalidate });
  }
  function exportCsv() {
    exportToCsv(
      isReceita ? "receitas" : "despesas",
      filtered.map((r) => ({
        data: r.data, veiculo: vehicleLabel(r.vehicle_id), categoria: r.categoria ?? "",
        descricao: r.descricao, valor: r.valor,
      })),
      [
        { key: "data", label: "Data" }, { key: "veiculo", label: "Veículo" },
        { key: "categoria", label: "Categoria" }, { key: "descricao", label: "Descrição" },
        { key: "valor", label: "Valor" },
      ]
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={isReceita ? "Receitas" : "Despesas"}
        description={isReceita ? "Entradas da frota, por veículo" : "Saídas da frota, por veículo"}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportCsv}><FileDown className="h-4 w-4" /> CSV</Button>
            {canWrite && <Button onClick={openNew}><Plus className="h-4 w-4" /> Nova {label.toLowerCase()}</Button>}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title={`${label}s no mês`} value={formatCurrency(totalMes)} tone={isReceita ? "success" : "warning"} icon={isReceita ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />} />
        <StatCard title={`Total de ${label.toLowerCase()}s`} value={formatCurrency(total)} />
        <StatCard title="Lançamentos" value={rows.length} />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center gap-2 border-b p-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por descrição, categoria ou placa..." value={search} onChange={(e) => setSearch(e.target.value)} className="border-0 focus-visible:ring-0" />
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <EmptyState message={`Nenhuma ${label.toLowerCase()} lançada`} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  {canWrite && <TableHead className="w-24"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow
                    key={r.id}
                    className={canWrite ? "cursor-pointer" : undefined}
                    onClick={canWrite ? () => openEdit(r) : undefined}
                  >
                    <TableCell>{formatDate(r.data)}</TableCell>
                    <TableCell>{r.vehicles?.placa ?? vehicleLabel(r.vehicle_id)}</TableCell>
                    <TableCell>{r.categoria ?? "—"}</TableCell>
                    <TableCell>{r.descricao}</TableCell>
                    <TableCell className={`text-right font-medium ${isReceita ? "text-success" : "text-destructive"}`}>
                      {isReceita ? "+" : "−"} {formatCurrency(r.valor)}
                    </TableCell>
                    {canWrite && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => del(r)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? `Editar ${label.toLowerCase()}` : `Nova ${label.toLowerCase()}`}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Data" error={errors.data?.message}>
                <Input type="date" {...register("data")} />
              </Field>
              <Field label="Valor (R$)" error={errors.valor?.message}>
                <Input type="number" step="0.01" {...register("valor")} />
              </Field>
              <Field label="Veículo (opcional)">
                <SelectVeiculo value={watch("vehicle_id") || ""} onChange={(v) => setValue("vehicle_id", v)} vehicles={vehicles} noneLabel="Frota (geral)" />
              </Field>
              <Field label="Categoria">
                <Select value={watch("categoria") || ""} onValueChange={(v) => setValue("categoria", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {categorias.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Descrição" error={errors.descricao?.message} className="space-y-1.5 sm:col-span-2">
                <Input {...register("descricao")} />
              </Field>
              <Field label="Forma de pagamento">
                <Select value={watch("forma_pagamento") || ""} onValueChange={(v) => setValue("forma_pagamento", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {FORMA_PAGAMENTO.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Observações">
              <Textarea {...register("observacoes")} />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={create.isPending || update.isPending}>
                {editing ? "Salvar" : "Lançar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
