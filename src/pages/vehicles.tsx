import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2, Search, Car, Power, RotateCcw, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Field } from "@/components/shared/field";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { usePendenciasPorVeiculo } from "@/hooks/use-pendencias";
import { useCanWrite } from "@/hooks/use-can-write";
import { VEHICLE_STATUS, VEHICLE_CATEGORIA } from "@/lib/options";
import { formatCurrency, formatNumber, maskPlaca } from "@/lib/format";
import type { Vehicle } from "@/types/database";

const schema = z.object({
  placa: z.string().min(7, "Placa inválida").max(8),
  marca: z.string().min(1, "Informe a marca"),
  modelo: z.string().min(1, "Informe o modelo"),
  ano_fabricacao: z.coerce.number().int().optional().or(z.literal("")),
  ano_modelo: z.coerce.number().int().optional().or(z.literal("")),
  cor: z.string().optional(),
  categoria: z.string().optional(),
  renavam: z.string().optional(),
  chassi: z.string().optional(),
  km_atual: z.coerce.number().int().min(0).default(0),
  status: z.string().default("disponivel"),
  valor_aquisicao: z.coerce.number().optional().or(z.literal("")),
  valor_fipe: z.coerce.number().optional().or(z.literal("")),
  fornecedor: z.string().optional(),
  observacoes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function VehiclesPage() {
  const navigate = useNavigate();
  const { data: vehicles = [], isLoading } = useList<Vehicle>("vehicles");
  const { data: pendMap = {} } = usePendenciasPorVeiculo();
  const create = useCreate<Vehicle>("vehicles", "Veículo");
  const update = useUpdate<Vehicle>("vehicles", "Veículo");
  const remove = useDelete("vehicles", "Veículo");
  const canWrite = useCanWrite("vehicles");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
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
    return vehicles.filter(
      (v) =>
        v.placa.toLowerCase().includes(q) ||
        v.modelo.toLowerCase().includes(q) ||
        v.marca.toLowerCase().includes(q)
    );
  }, [vehicles, search]);

  function openNew() {
    setEditing(null);
    reset({ status: "disponivel", km_atual: 0 });
    setOpen(true);
  }

  function openEdit(v: Vehicle) {
    setEditing(v);
    reset({
      placa: v.placa,
      marca: v.marca,
      modelo: v.modelo,
      ano_fabricacao: v.ano_fabricacao ?? undefined,
      ano_modelo: v.ano_modelo ?? undefined,
      cor: v.cor ?? "",
      categoria: v.categoria ?? "",
      renavam: v.renavam ?? "",
      chassi: v.chassi ?? "",
      km_atual: v.km_atual,
      status: v.status,
      valor_aquisicao: v.valor_aquisicao ?? undefined,
      valor_fipe: v.valor_fipe ?? undefined,
      fornecedor: v.fornecedor ?? "",
      observacoes: v.observacoes ?? "",
    });
    setOpen(true);
  }

  function onSubmit(data: FormData) {
    const payload = {
      ...data,
      placa: data.placa.toUpperCase().replace(/\s/g, ""),
      ano_fabricacao: data.ano_fabricacao || null,
      ano_modelo: data.ano_modelo || null,
      valor_aquisicao: data.valor_aquisicao || null,
      valor_fipe: data.valor_fipe || null,
    };
    if (editing) {
      update.mutate(
        { id: editing.id, ...payload },
        { onSuccess: () => setOpen(false) }
      );
    } else {
      create.mutate(payload, { onSuccess: () => setOpen(false) });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Veículos"
        description="Cadastro e gestão da frota"
        actions={
          canWrite && (
            <Button onClick={openNew}>
              <Plus className="h-4 w-4" /> Novo veículo
            </Button>
          )
        }
      />

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center gap-2 border-b p-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por placa, marca ou modelo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border-0 focus-visible:ring-0"
            />
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <EmptyState
              message="Nenhum veículo cadastrado"
              icon={<Car className="h-6 w-6" />}
              action={
                canWrite && (
                  <Button variant="outline" onClick={openNew}>
                    <Plus className="h-4 w-4" /> Cadastrar primeiro veículo
                  </Button>
                )
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Placa</TableHead>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Ano</TableHead>
                  <TableHead className="text-right">KM</TableHead>
                  <TableHead className="text-right">FIPE</TableHead>
                  <TableHead>Pendências</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((v) => {
                  const pend = pendMap[v.id];
                  return (
                  <TableRow
                    key={v.id}
                    className="cursor-pointer"
                    onClick={() => (canWrite ? openEdit(v) : navigate(`/pendencias?veiculo=${encodeURIComponent(v.placa)}`))}
                  >
                    <TableCell className="font-mono font-medium">{maskPlaca(v.placa)}</TableCell>
                    <TableCell>
                      <div className="font-medium">{v.marca} {v.modelo}</div>
                      <div className="text-xs text-muted-foreground">{v.cor} · {v.categoria}</div>
                    </TableCell>
                    <TableCell>{v.ano_fabricacao}/{v.ano_modelo}</TableCell>
                    <TableCell className="text-right">{formatNumber(v.km_atual)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(v.valor_fipe)}</TableCell>
                    <TableCell>
                      <button
                        type="button"
                        title="Ver pendências do veículo"
                        onClick={(e) => { e.stopPropagation(); navigate(`/pendencias?veiculo=${encodeURIComponent(v.placa)}`); }}
                        className="inline-flex items-center gap-1"
                      >
                        {pend && pend.vencidas > 0 && (
                          <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />{pend.vencidas}</Badge>
                        )}
                        {pend && pend.abertas > 0 ? (
                          <Badge variant={pend.vencidas > 0 ? "warning" : "secondary"}>{pend.abertas} aberta{pend.abertas > 1 ? "s" : ""}</Badge>
                        ) : (
                          !pend?.vencidas && <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </button>
                    </TableCell>
                    <TableCell><StatusBadge status={v.status} /></TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {canWrite && (
                        <div className="flex justify-end gap-1">
                          {v.status === "inativo" ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Reativar (disponível)"
                              onClick={() => update.mutate({ id: v.id, status: "disponivel" })}
                            >
                              <RotateCcw className="h-4 w-4 text-success" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Inativar veículo"
                              onClick={() => update.mutate({ id: v.id, status: "inativo" })}
                            >
                              <Power className="h-4 w-4 text-warning" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => openEdit(v)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm(`Remover o veículo ${v.placa}?`)) remove.mutate(v.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar veículo" : "Novo veículo"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Placa" error={errors.placa?.message}>
                <Input {...register("placa")} placeholder="ABC1D23" />
              </Field>
              <Field label="Marca" error={errors.marca?.message}>
                <Input {...register("marca")} />
              </Field>
              <Field label="Modelo" error={errors.modelo?.message}>
                <Input {...register("modelo")} />
              </Field>
              <Field label="Ano fabricação">
                <Input type="number" {...register("ano_fabricacao")} />
              </Field>
              <Field label="Ano modelo">
                <Input type="number" {...register("ano_modelo")} />
              </Field>
              <Field label="Cor">
                <Input {...register("cor")} />
              </Field>
              <Field label="Categoria">
                <Select
                  value={watch("categoria") || ""}
                  onValueChange={(v) => setValue("categoria", v)}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {VEHICLE_CATEGORIA.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="KM atual" error={errors.km_atual?.message}>
                <Input type="number" {...register("km_atual")} />
              </Field>
              <Field label="Status">
                <Select
                  value={watch("status") || "disponivel"}
                  onValueChange={(v) => setValue("status", v)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {VEHICLE_STATUS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Renavam">
                <Input {...register("renavam")} />
              </Field>
              <Field label="Chassi">
                <Input {...register("chassi")} />
              </Field>
              <Field label="Fornecedor">
                <Input {...register("fornecedor")} />
              </Field>
              <Field label="Valor de aquisição (R$)">
                <Input type="number" step="0.01" {...register("valor_aquisicao")} />
              </Field>
              <Field label="Valor FIPE (R$)">
                <Input type="number" step="0.01" {...register("valor_fipe")} />
              </Field>
            </div>
            <Field label="Observações">
              <Input {...register("observacoes")} />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
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
