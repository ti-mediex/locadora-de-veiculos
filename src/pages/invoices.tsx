import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2, Search, FileText } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Field } from "@/components/shared/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { NF_TIPO, NF_STATUS } from "@/lib/options";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Invoice, Supplier } from "@/types/database";

const schema = z.object({
  fornecedor: z.string().optional(),
  supplier_id: z.string().optional(),
  documento: z.string().default("NF"),
  numero: z.string().optional(),
  serie: z.string().optional(),
  tipo: z.string().optional(),
  data_emissao: z.string().optional(),
  data_entrada: z.string().optional(),
  valor_total: z.coerce.number().min(0, "Informe o valor"),
  desconto: z.coerce.number().min(0).optional().or(z.literal("")),
  cfop: z.string().optional(),
  status: z.string().default("em_cadastro"),
  observacoes: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export default function InvoicesPage() {
  const { data: invoices = [], isLoading } = useList<Invoice>("invoices", {
    orderBy: { column: "data_emissao", ascending: false },
  });
  const { data: suppliers = [] } = useList<Supplier>("suppliers");
  const create = useCreate("invoices", "Nota fiscal");
  const update = useUpdate("invoices", "Nota fiscal");
  const remove = useDelete("invoices", "Nota fiscal");
  const canWrite = useCanWrite("invoices");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [search, setSearch] = useState("");

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } =
    useForm<FormData>({ resolver: zodResolver(schema) });

  const supplierName = (id: string | null, fallback: string | null) =>
    suppliers.find((s) => s.id === id)?.nome_fantasia ?? fallback ?? "—";

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return invoices.filter(
      (n) => (n.numero ?? "").toLowerCase().includes(q) || (n.fornecedor ?? "").toLowerCase().includes(q)
    );
  }, [invoices, search]);

  const totalMes = useMemo(() => {
    const now = new Date();
    return invoices
      .filter((n) => {
        if (!n.data_emissao) return false;
        const d = new Date(n.data_emissao);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && n.status !== "cancelada";
      })
      .reduce((s, n) => s + (n.valor_total - (n.desconto ?? 0)), 0);
  }, [invoices]);

  function openNew() {
    setEditing(null);
    reset({ documento: "NF", status: "em_cadastro", tipo: "Produto", data_emissao: new Date().toISOString().slice(0, 10) });
    setOpen(true);
  }
  function openEdit(n: Invoice) {
    setEditing(n);
    reset({
      fornecedor: n.fornecedor ?? "",
      supplier_id: n.supplier_id ?? "",
      documento: n.documento ?? "NF",
      numero: n.numero ?? "",
      serie: n.serie ?? "",
      tipo: n.tipo ?? "",
      data_emissao: n.data_emissao ?? "",
      data_entrada: n.data_entrada ?? "",
      valor_total: n.valor_total,
      desconto: n.desconto ?? undefined,
      cfop: n.cfop ?? "",
      status: n.status,
      observacoes: n.observacoes ?? "",
    });
    setOpen(true);
  }
  function onSubmit(data: FormData) {
    const payload = {
      ...data,
      supplier_id: data.supplier_id || null,
      desconto: data.desconto || 0,
      data_emissao: data.data_emissao || null,
      data_entrada: data.data_entrada || null,
    };
    if (editing) update.mutate({ id: editing.id, ...payload }, { onSuccess: () => setOpen(false) });
    else create.mutate(payload, { onSuccess: () => setOpen(false) });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notas Fiscais"
        description="Entrada de NFs de fornecedores (peças, serviços, manutenção)"
        actions={canWrite && <Button onClick={openNew}><Plus className="h-4 w-4" /> Nova nota fiscal</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="NFs no mês" value={formatCurrency(totalMes)} tone="warning" icon={<FileText className="h-5 w-5" />} />
        <StatCard title="Total de notas" value={invoices.length} />
        <StatCard title="Em cadastro" value={invoices.filter((n) => n.status === "em_cadastro").length} />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center gap-2 border-b p-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por número ou fornecedor..." value={search} onChange={(e) => setSearch(e.target.value)} className="border-0 focus-visible:ring-0" />
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <EmptyState message="Nenhuma nota fiscal" icon={<FileText className="h-6 w-6" />} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Emissão</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  {canWrite && <TableHead className="w-24"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((n) => (
                  <TableRow key={n.id}>
                    <TableCell className="font-medium">{n.documento} {n.numero}{n.serie ? `/${n.serie}` : ""}</TableCell>
                    <TableCell>{supplierName(n.supplier_id, n.fornecedor)}</TableCell>
                    <TableCell>{n.tipo ?? "—"}</TableCell>
                    <TableCell>{formatDate(n.data_emissao)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(n.valor_total - (n.desconto ?? 0))}</TableCell>
                    <TableCell><StatusBadge status={n.status} /></TableCell>
                    {canWrite && (
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(n)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => confirm("Remover nota fiscal?") && remove.mutate(n.id)}>
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar nota fiscal" : "Nova nota fiscal"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Fornecedor" className="space-y-1.5 sm:col-span-2">
                <Select value={watch("supplier_id") || ""} onValueChange={(v) => setValue("supplier_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.nome_fantasia}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Documento">
                <Input {...register("documento")} />
              </Field>
              <Field label="Número">
                <Input {...register("numero")} />
              </Field>
              <Field label="Série">
                <Input {...register("serie")} />
              </Field>
              <Field label="Tipo">
                <Select value={watch("tipo") || ""} onValueChange={(v) => setValue("tipo", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {NF_TIPO.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Data de emissão">
                <Input type="date" {...register("data_emissao")} />
              </Field>
              <Field label="Data de entrada">
                <Input type="date" {...register("data_entrada")} />
              </Field>
              <Field label="Valor total (R$)" error={errors.valor_total?.message}>
                <Input type="number" step="0.01" {...register("valor_total")} />
              </Field>
              <Field label="Desconto (R$)">
                <Input type="number" step="0.01" {...register("desconto")} />
              </Field>
              <Field label="CFOP">
                <Input {...register("cfop")} />
              </Field>
              <Field label="Status">
                <Select value={watch("status") || "em_cadastro"} onValueChange={(v) => setValue("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {NF_STATUS.map((o) => (
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
                {editing ? "Salvar" : "Cadastrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
