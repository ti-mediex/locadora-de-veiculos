import { useMemo, useState, ReactNode } from "react";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
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
import { useCanWrite, type WriteModule } from "@/hooks/use-can-write";

type FieldType = "text" | "number" | "textarea" | "select";

export interface RegField {
  name: string;
  label: string;
  type?: FieldType;
  options?: { value: string; label: string }[];
  required?: boolean;
  full?: boolean;
  placeholder?: string;
}
export interface RegColumn {
  key: string;
  label: string;
  align?: "left" | "right";
  render?: (row: Record<string, unknown>) => ReactNode;
}

interface Props {
  title: string;
  description?: string;
  table:
    | "vehicle_groups"
    | "yards"
    | "buyers"
    | "parts_services";
  module: WriteModule;
  icon?: ReactNode;
  fields: RegField[];
  columns: RegColumn[];
  searchKeys: string[];
  orderBy?: { column: string; ascending?: boolean };
  defaults?: Record<string, unknown>;
  newLabel?: string;
}

type Row = Record<string, unknown> & { id: string };

export function GenericRegistry({
  title,
  description,
  table,
  module,
  icon,
  fields,
  columns,
  searchKeys,
  orderBy,
  defaults = {},
  newLabel = "Novo",
}: Props) {
  const { data: items = [], isLoading } = useList<Row>(table, { orderBy });
  const create = useCreate(table, title);
  const update = useUpdate(table, title);
  const remove = useDelete(table, title);
  const canWrite = useCanWrite(module);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<Record<string, unknown>>({});

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return items;
    return items.filter((r) =>
      searchKeys.some((k) => String(r[k] ?? "").toLowerCase().includes(q))
    );
  }, [items, search, searchKeys]);

  function openNew() {
    setEditing(null);
    setForm({ ...defaults });
    setOpen(true);
  }
  function openEdit(r: Row) {
    setEditing(r);
    const f: Record<string, unknown> = {};
    for (const fl of fields) f[fl.name] = r[fl.name] ?? "";
    setForm(f);
    setOpen(true);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload: Record<string, unknown> = {};
    for (const fl of fields) {
      let v = form[fl.name];
      if (fl.type === "number") v = v === "" || v == null ? null : Number(v);
      if (v === "") v = null;
      payload[fl.name] = v;
    }
    // required
    for (const fl of fields) {
      if (fl.required && (payload[fl.name] === null || payload[fl.name] === undefined)) {
        return;
      }
    }
    if (editing) {
      update.mutate({ id: editing.id, ...payload }, { onSuccess: () => setOpen(false) });
    } else {
      create.mutate(payload, { onSuccess: () => setOpen(false) });
    }
  }

  const set = (name: string, value: unknown) => setForm((s) => ({ ...s, [name]: value }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={description}
        actions={canWrite && <Button onClick={openNew}><Plus className="h-4 w-4" /> {newLabel}</Button>}
      />

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center gap-2 border-b p-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border-0 focus-visible:ring-0"
            />
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <EmptyState message="Nenhum registro" icon={icon} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((c) => (
                    <TableHead key={c.key} className={c.align === "right" ? "text-right" : ""}>{c.label}</TableHead>
                  ))}
                  {canWrite && <TableHead className="w-24"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    {columns.map((c) => (
                      <TableCell key={c.key} className={c.align === "right" ? "text-right" : ""}>
                        {c.render ? c.render(r) : String(r[c.key] ?? "—")}
                      </TableCell>
                    ))}
                    {canWrite && (
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => confirm("Remover registro?") && remove.mutate(r.id)}>
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
            <DialogTitle>{editing ? `Editar — ${title}` : newLabel}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {fields.map((fl) => (
                <Field
                  key={fl.name}
                  label={fl.label + (fl.required ? " *" : "")}
                  className={fl.full ? "space-y-1.5 sm:col-span-2" : "space-y-1.5"}
                >
                  {fl.type === "textarea" ? (
                    <Textarea
                      value={String(form[fl.name] ?? "")}
                      onChange={(e) => set(fl.name, e.target.value)}
                    />
                  ) : fl.type === "select" ? (
                    <Select value={String(form[fl.name] ?? "")} onValueChange={(v) => set(fl.name, v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {(fl.options ?? []).map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      type={fl.type === "number" ? "number" : "text"}
                      step={fl.type === "number" ? "0.01" : undefined}
                      placeholder={fl.placeholder}
                      value={String(form[fl.name] ?? "")}
                      onChange={(e) => set(fl.name, e.target.value)}
                    />
                  )}
                </Field>
              ))}
            </div>
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
