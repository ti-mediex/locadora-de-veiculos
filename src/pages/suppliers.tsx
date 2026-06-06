import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2, Search, Building2 } from "lucide-react";
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
import { SUPPLIER_TIPO, SUPPLIER_STATUS } from "@/lib/options";
import type { Supplier } from "@/types/database";

const schema = z.object({
  nome_fantasia: z.string().min(1, "Informe o nome"),
  razao_social: z.string().optional(),
  tipo: z.string().optional(),
  cnpj: z.string().optional(),
  categoria: z.string().optional(),
  codigo: z.string().optional(),
  telefone: z.string().optional(),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  site: z.string().optional(),
  endereco: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional(),
  inscricao_estadual: z.string().optional(),
  prazo_pagamento: z.coerce.number().int().optional().or(z.literal("")),
  banco: z.string().optional(),
  agencia: z.string().optional(),
  conta: z.string().optional(),
  chave_pix: z.string().optional(),
  status: z.string().default("ativo"),
  observacoes: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export default function SuppliersPage() {
  const { data: suppliers = [], isLoading } = useList<Supplier>("suppliers", {
    orderBy: { column: "nome_fantasia", ascending: true },
  });
  const create = useCreate("suppliers", "Fornecedor");
  const update = useUpdate("suppliers", "Fornecedor");
  const remove = useDelete("suppliers", "Fornecedor");
  const canWrite = useCanWrite("suppliers");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [search, setSearch] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return suppliers.filter(
      (s) =>
        s.nome_fantasia.toLowerCase().includes(q) ||
        (s.razao_social ?? "").toLowerCase().includes(q) ||
        (s.cnpj ?? "").includes(q)
    );
  }, [suppliers, search]);

  function openNew() {
    setEditing(null);
    reset({ status: "ativo", tipo: "Frota" });
    setOpen(true);
  }

  function openEdit(s: Supplier) {
    setEditing(s);
    reset({
      nome_fantasia: s.nome_fantasia,
      razao_social: s.razao_social ?? "",
      tipo: s.tipo ?? "",
      cnpj: s.cnpj ?? "",
      categoria: s.categoria ?? "",
      codigo: s.codigo ?? "",
      telefone: s.telefone ?? "",
      email: s.email ?? "",
      site: s.site ?? "",
      endereco: s.endereco ?? "",
      cidade: s.cidade ?? "",
      estado: s.estado ?? "",
      inscricao_estadual: s.inscricao_estadual ?? "",
      prazo_pagamento: s.prazo_pagamento ?? undefined,
      banco: s.banco ?? "",
      agencia: s.agencia ?? "",
      conta: s.conta ?? "",
      chave_pix: s.chave_pix ?? "",
      status: s.status,
      observacoes: s.observacoes ?? "",
    });
    setOpen(true);
  }

  function onSubmit(data: FormData) {
    const payload = { ...data, email: data.email || null, prazo_pagamento: data.prazo_pagamento || null };
    if (editing) {
      update.mutate({ id: editing.id, ...payload }, { onSuccess: () => setOpen(false) });
    } else {
      create.mutate(payload, { onSuccess: () => setOpen(false) });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fornecedores"
        description="Oficinas, seguradoras e parceiros da operação"
        actions={canWrite && <Button onClick={openNew}><Plus className="h-4 w-4" /> Novo fornecedor</Button>}
      />

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center gap-2 border-b p-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, razão social ou CNPJ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border-0 focus-visible:ring-0"
            />
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <EmptyState message="Nenhum fornecedor cadastrado" icon={<Building2 className="h-6 w-6" />} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Cidade</TableHead>
                  <TableHead>Status</TableHead>
                  {canWrite && <TableHead className="w-24"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="font-medium">{s.nome_fantasia}</div>
                      <div className="text-xs text-muted-foreground">{s.razao_social}</div>
                    </TableCell>
                    <TableCell>{s.tipo ? <Badge variant="secondary">{s.tipo}</Badge> : "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{s.cnpj ?? "—"}</TableCell>
                    <TableCell>{s.telefone ?? "—"}</TableCell>
                    <TableCell>{s.cidade}{s.estado ? `/${s.estado}` : ""}</TableCell>
                    <TableCell><StatusBadge status={s.status} /></TableCell>
                    {canWrite && (
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => confirm(`Remover ${s.nome_fantasia}?`) && remove.mutate(s.id)}>
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
            <DialogTitle>{editing ? "Editar fornecedor" : "Novo fornecedor"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <p className="text-xs font-semibold uppercase text-primary">Dados gerais</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome fantasia" error={errors.nome_fantasia?.message}>
                <Input {...register("nome_fantasia")} />
              </Field>
              <Field label="Razão social">
                <Input {...register("razao_social")} />
              </Field>
              <Field label="Tipo">
                <Select value={watch("tipo") || ""} onValueChange={(v) => setValue("tipo", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {SUPPLIER_TIPO.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Categoria">
                <Input {...register("categoria")} placeholder="Manutenção, Pneus, Seguro..." />
              </Field>
              <Field label="CNPJ">
                <Input {...register("cnpj")} placeholder="00.000.000/0000-00" />
              </Field>
              <Field label="Inscrição estadual">
                <Input {...register("inscricao_estadual")} />
              </Field>
            </div>

            <p className="text-xs font-semibold uppercase text-primary">Contato</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Telefone">
                <Input {...register("telefone")} />
              </Field>
              <Field label="E-mail" error={errors.email?.message}>
                <Input {...register("email")} />
              </Field>
              <Field label="Site">
                <Input {...register("site")} />
              </Field>
              <Field label="Endereço">
                <Input {...register("endereco")} />
              </Field>
              <Field label="Cidade">
                <Input {...register("cidade")} />
              </Field>
              <Field label="Estado">
                <Input {...register("estado")} maxLength={2} placeholder="UF" />
              </Field>
            </div>

            <p className="text-xs font-semibold uppercase text-primary">Financeiro</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Prazo de pagamento (dias)">
                <Input type="number" {...register("prazo_pagamento")} />
              </Field>
              <Field label="Chave PIX">
                <Input {...register("chave_pix")} />
              </Field>
              <Field label="Banco">
                <Input {...register("banco")} />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Agência">
                  <Input {...register("agencia")} />
                </Field>
                <Field label="Conta">
                  <Input {...register("conta")} />
                </Field>
              </div>
              <Field label="Código interno">
                <Input {...register("codigo")} />
              </Field>
              <Field label="Status">
                <Select value={watch("status") || "ativo"} onValueChange={(v) => setValue("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SUPPLIER_STATUS.map((o) => (
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
