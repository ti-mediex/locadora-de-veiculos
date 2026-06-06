import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, ClipboardCheck, Search } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
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
import { useList, useCreate, useDelete } from "@/hooks/use-crud";
import { useCanWrite } from "@/hooks/use-can-write";
import { INSPECTION_TYPE, INSPECTION_ITEMS } from "@/lib/options";
import { formatDate, formatNumber } from "@/lib/format";
import type { Inspection, Vehicle, Contract } from "@/types/database";

const schema = z.object({
  vehicle_id: z.string().min(1, "Selecione o veículo"),
  contract_id: z.string().optional(),
  tipo: z.string().default("entrega"),
  data: z.string().min(1, "Informe a data"),
  km: z.coerce.number().int().optional().or(z.literal("")),
  nivel_combustivel: z.coerce.number().int().min(0).max(100).optional().or(z.literal("")),
  avarias: z.string().optional(),
  observacoes: z.string().optional(),
  responsavel: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export default function InspectionsPage() {
  const { data: items = [], isLoading } = useList<Inspection>("inspections", {
    orderBy: { column: "data", ascending: false },
  });
  const { data: vehicles = [] } = useList<Vehicle>("vehicles");
  const { data: contracts = [] } = useList<Contract>("contracts");
  const create = useCreate("inspections", "Vistoria");
  const remove = useDelete("inspections", "Vistoria");
  const canWrite = useCanWrite("inspections");

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [itens, setItens] = useState<Record<string, boolean>>({});

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const vehicleLabel = (id: string) => vehicles.find((v) => v.id === id)?.placa ?? "—";

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter((i) => !q || vehicleLabel(i.vehicle_id).toLowerCase().includes(q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, search, vehicles]);

  function openNew() {
    reset({ tipo: "entrega", data: new Date().toISOString().slice(0, 10) });
    setItens({});
    setOpen(true);
  }

  function onSubmit(data: FormData) {
    const payload = {
      ...data,
      contract_id: data.contract_id || null,
      km: data.km || null,
      nivel_combustivel: data.nivel_combustivel === "" ? null : data.nivel_combustivel,
      itens,
    };
    create.mutate(payload, { onSuccess: () => setOpen(false) });
  }

  const countOk = (i: Inspection) =>
    Object.values(i.itens ?? {}).filter(Boolean).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vistorias"
        description="Checklist digital de entrega e devolução de veículos"
        actions={
          canWrite && (
            <Button onClick={openNew}>
              <Plus className="h-4 w-4" /> Nova vistoria
            </Button>
          )
        }
      />

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center gap-2 border-b p-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por placa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border-0 focus-visible:ring-0"
            />
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <EmptyState message="Nenhuma vistoria registrada" icon={<ClipboardCheck className="h-6 w-6" />} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">KM</TableHead>
                  <TableHead className="text-right">Combustível</TableHead>
                  <TableHead className="text-right">Itens OK</TableHead>
                  <TableHead>Responsável</TableHead>
                  {canWrite && <TableHead className="w-12"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell>{formatDate(i.data)}</TableCell>
                    <TableCell className="font-medium">{vehicleLabel(i.vehicle_id)}</TableCell>
                    <TableCell><StatusBadge status={i.tipo} /></TableCell>
                    <TableCell className="text-right">{i.km ? formatNumber(i.km) : "—"}</TableCell>
                    <TableCell className="text-right">{i.nivel_combustivel != null ? `${i.nivel_combustivel}%` : "—"}</TableCell>
                    <TableCell className="text-right">{countOk(i)}/{INSPECTION_ITEMS.length}</TableCell>
                    <TableCell>{i.responsavel ?? "—"}</TableCell>
                    {canWrite && (
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => confirm("Remover vistoria?") && remove.mutate(i.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
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
            <DialogTitle>Nova vistoria</DialogTitle>
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
                <Select value={watch("tipo") || "entrega"} onValueChange={(v) => setValue("tipo", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INSPECTION_TYPE.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Contrato (opcional)">
                <Select value={watch("contract_id") || ""} onValueChange={(v) => setValue("contract_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {contracts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.numero}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Data" error={errors.data?.message}>
                <Input type="date" {...register("data")} />
              </Field>
              <Field label="KM">
                <Input type="number" {...register("km")} />
              </Field>
              <Field label="Nível de combustível (%)">
                <Input type="number" min={0} max={100} {...register("nivel_combustivel")} />
              </Field>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Checklist</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {INSPECTION_ITEMS.map((item) => (
                  <label key={item.key} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={!!itens[item.key]}
                      onChange={(e) => setItens((s) => ({ ...s, [item.key]: e.target.checked }))}
                    />
                    {item.label}
                  </label>
                ))}
              </div>
            </div>

            <Field label="Avarias / observações de danos">
              <Textarea {...register("avarias")} placeholder="Ex.: arranhão na porta dianteira direita" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Responsável pela vistoria">
                <Input {...register("responsavel")} />
              </Field>
              <Field label="Observações gerais">
                <Input {...register("observacoes")} />
              </Field>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={create.isPending}>Salvar vistoria</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
