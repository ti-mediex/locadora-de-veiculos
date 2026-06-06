import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2, Search, Users } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
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
import { RENTER_STATUS } from "@/lib/options";
import { maskCpf, formatDate } from "@/lib/format";
import type { Renter } from "@/types/database";

const schema = z.object({
  nome: z.string().min(2, "Informe o nome"),
  cpf: z.string().min(11, "CPF inválido"),
  rg: z.string().optional(),
  cnh: z.string().optional(),
  categoria_cnh: z.string().optional(),
  validade_cnh: z.string().optional(),
  data_nascimento: z.string().optional(),
  telefone: z.string().optional(),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  cidade: z.string().optional(),
  estado: z.string().optional(),
  endereco: z.string().optional(),
  chave_pix: z.string().optional(),
  contato_emergencia_nome: z.string().optional(),
  contato_emergencia_telefone: z.string().optional(),
  status: z.string().default("ativo"),
  observacoes: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export default function RentersPage() {
  const { data: renters = [], isLoading } = useList<Renter>("renters");
  const create = useCreate<Renter>("renters", "Locatário");
  const update = useUpdate<Renter>("renters", "Locatário");
  const remove = useDelete("renters", "Locatário");
  const canWrite = useCanWrite("renters");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Renter | null>(null);
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
    return renters.filter(
      (r) => r.nome.toLowerCase().includes(q) || r.cpf.includes(q)
    );
  }, [renters, search]);

  function openNew() {
    setEditing(null);
    reset({ status: "ativo" });
    setOpen(true);
  }

  function openEdit(r: Renter) {
    setEditing(r);
    reset({
      nome: r.nome,
      cpf: r.cpf,
      rg: r.rg ?? "",
      cnh: r.cnh ?? "",
      categoria_cnh: r.categoria_cnh ?? "",
      validade_cnh: r.validade_cnh ?? "",
      data_nascimento: r.data_nascimento ?? "",
      telefone: r.telefone ?? "",
      email: r.email ?? "",
      cidade: r.cidade ?? "",
      estado: r.estado ?? "",
      endereco: r.endereco ?? "",
      chave_pix: r.chave_pix ?? "",
      contato_emergencia_nome: r.contato_emergencia_nome ?? "",
      contato_emergencia_telefone: r.contato_emergencia_telefone ?? "",
      status: r.status,
      observacoes: r.observacoes ?? "",
    });
    setOpen(true);
  }

  function onSubmit(data: FormData) {
    const payload = {
      ...data,
      cpf: data.cpf.replace(/\D/g, ""),
      email: data.email || null,
      validade_cnh: data.validade_cnh || null,
      data_nascimento: data.data_nascimento || null,
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
        title="Locatários"
        description="Motoristas cadastrados na operação"
        actions={
          canWrite && (
            <Button onClick={openNew}>
              <Plus className="h-4 w-4" /> Novo locatário
            </Button>
          )
        }
      />

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center gap-2 border-b p-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou CPF..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border-0 focus-visible:ring-0"
            />
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <EmptyState message="Nenhum locatário cadastrado" icon={<Users className="h-6 w-6" />} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>CNH</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium">{r.nome}</div>
                      <div className="text-xs text-muted-foreground">{r.cidade}{r.estado ? `/${r.estado}` : ""}</div>
                    </TableCell>
                    <TableCell className="font-mono">{maskCpf(r.cpf)}</TableCell>
                    <TableCell>
                      {r.cnh ? (
                        <span className="text-sm">
                          {r.cnh} <span className="text-muted-foreground">({r.categoria_cnh})</span>
                          <div className="text-xs text-muted-foreground">val. {formatDate(r.validade_cnh)}</div>
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell>{r.telefone ?? "—"}</TableCell>
                    <TableCell><StatusBadge status={r.status} /></TableCell>
                    <TableCell>
                      {canWrite && (
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(r)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm(`Remover ${r.nome}?`)) remove.mutate(r.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      )}
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
            <DialogTitle>{editing ? "Editar locatário" : "Novo locatário"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Nome completo" error={errors.nome?.message} className="space-y-1.5 sm:col-span-2">
                <Input {...register("nome")} />
              </Field>
              <Field label="CPF" error={errors.cpf?.message}>
                <Input {...register("cpf")} placeholder="000.000.000-00" />
              </Field>
              <Field label="RG">
                <Input {...register("rg")} />
              </Field>
              <Field label="Data de nascimento">
                <Input type="date" {...register("data_nascimento")} />
              </Field>
              <Field label="Telefone">
                <Input {...register("telefone")} placeholder="(00) 00000-0000" />
              </Field>
              <Field label="CNH">
                <Input {...register("cnh")} />
              </Field>
              <Field label="Categoria CNH">
                <Input {...register("categoria_cnh")} placeholder="B" />
              </Field>
              <Field label="Validade CNH">
                <Input type="date" {...register("validade_cnh")} />
              </Field>
              <Field label="E-mail" error={errors.email?.message} className="space-y-1.5 sm:col-span-2">
                <Input {...register("email")} />
              </Field>
              <Field label="Chave PIX">
                <Input {...register("chave_pix")} />
              </Field>
              <Field label="Endereço" className="space-y-1.5 sm:col-span-2">
                <Input {...register("endereco")} />
              </Field>
              <Field label="Cidade">
                <Input {...register("cidade")} />
              </Field>
              <Field label="Estado">
                <Input {...register("estado")} placeholder="UF" maxLength={2} />
              </Field>
              <Field label="Contato emergência (nome)">
                <Input {...register("contato_emergencia_nome")} />
              </Field>
              <Field label="Contato emergência (tel.)">
                <Input {...register("contato_emergencia_telefone")} />
              </Field>
              <Field label="Status">
                <Select value={watch("status") || "ativo"} onValueChange={(v) => setValue("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RENTER_STATUS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Observações">
              <Input {...register("observacoes")} />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={create.isPending || update.isPending}>
                {editing ? "Salvar alterações" : "Cadastrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
