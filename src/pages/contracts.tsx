import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus,
  Search,
  FileText,
  FileDown,
  Ban,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
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
import { useList } from "@/hooks/use-crud";
import { useCanWrite } from "@/hooks/use-can-write";
import {
  useContracts,
  useCreateContract,
  useUpdateContract,
  useGenerateReceivables,
} from "@/hooks/use-contracts";
import { BILLING_CYCLE } from "@/lib/options";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Vehicle, Renter } from "@/types/database";

const schema = z.object({
  vehicle_id: z.string().min(1, "Selecione o veículo"),
  renter_id: z.string().min(1, "Selecione o locatário"),
  data_inicio: z.string().min(1, "Informe a data de início"),
  data_fim: z.string().optional(),
  ciclo_cobranca: z.string().default("semanal"),
  valor_aluguel: z.coerce.number().min(0.01, "Informe o valor"),
  valor_caucao: z.coerce.number().min(0).default(0),
  km_inicial: z.coerce.number().int().optional().or(z.literal("")),
  observacoes: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export default function ContractsPage() {
  const { data: contracts = [], isLoading } = useContracts();
  const { data: vehicles = [] } = useList<Vehicle>("vehicles");
  const { data: renters = [] } = useList<Renter>("renters");
  const create = useCreateContract();
  const updateContract = useUpdateContract();
  const generate = useGenerateReceivables();
  const canWrite = useCanWrite("contracts");

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { ciclo_cobranca: "semanal", valor_caucao: 0 },
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return contracts.filter(
      (c) =>
        c.numero.toLowerCase().includes(q) ||
        c.renters?.nome.toLowerCase().includes(q) ||
        c.vehicles?.placa.toLowerCase().includes(q)
    );
  }, [contracts, search]);

  const veiculosDisponiveis = vehicles.filter(
    (v) => v.status === "disponivel" || v.status === "locado"
  );

  function openNew() {
    reset({ ciclo_cobranca: "semanal", valor_caucao: 0, data_inicio: new Date().toISOString().slice(0, 10) });
    setOpen(true);
  }

  function onSubmit(data: FormData) {
    const payload = {
      ...data,
      data_fim: data.data_fim || null,
      km_inicial: data.km_inicial || null,
      status: "ativo" as const,
    };
    create.mutate(payload, { onSuccess: () => setOpen(false) });
  }

  async function handlePdf(contractId: string) {
    const contract = contracts.find((c) => c.id === contractId);
    if (!contract) return;
    const vehicle = vehicles.find((v) => v.id === contract.vehicle_id);
    const renter = renters.find((r) => r.id === contract.renter_id);
    if (!vehicle || !renter) {
      toast.error("Dados do veículo ou locatário não encontrados");
      return;
    }
    try {
      const { generateContractPdf } = await import(
        "@/components/contracts/contract-pdf"
      );
      await generateContractPdf({ contract, vehicle, renter });
      toast.success("Contrato PDF gerado");
    } catch (e) {
      toast.error("Erro ao gerar PDF: " + (e as Error).message);
    }
  }

  function encerrar(id: string, numero: string) {
    if (confirm(`Encerrar o contrato ${numero}? O veículo voltará a ficar disponível.`)) {
      updateContract.mutate({ id, status: "encerrado", data_fim: new Date().toISOString().slice(0, 10) });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contratos"
        description="Locações ativas e histórico"
        actions={
          canWrite && (
            <Button onClick={openNew}>
              <Plus className="h-4 w-4" /> Novo contrato
            </Button>
          )
        }
      />

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center gap-2 border-b p-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por número, locatário ou placa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border-0 focus-visible:ring-0"
            />
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <EmptyState message="Nenhum contrato cadastrado" icon={<FileText className="h-6 w-6" />} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contrato</TableHead>
                  <TableHead>Locatário</TableHead>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead className="text-right">Aluguel</TableHead>
                  <TableHead>Ciclo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-32"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.numero}</TableCell>
                    <TableCell>{c.renters?.nome ?? "—"}</TableCell>
                    <TableCell>
                      <div className="font-medium">{c.vehicles?.placa}</div>
                      <div className="text-xs text-muted-foreground">{c.vehicles?.marca} {c.vehicles?.modelo}</div>
                    </TableCell>
                    <TableCell>{formatDate(c.data_inicio)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(c.valor_aluguel)}</TableCell>
                    <TableCell className="capitalize">{c.ciclo_cobranca}</TableCell>
                    <TableCell><StatusBadge status={c.status} /></TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" title="Gerar PDF" onClick={() => handlePdf(c.id)}>
                          <FileDown className="h-4 w-4" />
                        </Button>
                        {canWrite && (
                          <Button variant="ghost" size="icon" title="Gerar cobranças" onClick={() => generate.mutate(c.id)}>
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        )}
                        {canWrite && c.status !== "encerrado" && (
                          <Button variant="ghost" size="icon" title="Encerrar" onClick={() => encerrar(c.id, c.numero)}>
                            <Ban className="h-4 w-4 text-destructive" />
                          </Button>
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
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Novo contrato</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Field label="Veículo" error={errors.vehicle_id?.message}>
              <Select value={watch("vehicle_id") || ""} onValueChange={(v) => setValue("vehicle_id", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione o veículo" /></SelectTrigger>
                <SelectContent>
                  {veiculosDisponiveis.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.placa} — {v.marca} {v.modelo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Locatário" error={errors.renter_id?.message}>
              <Select value={watch("renter_id") || ""} onValueChange={(v) => setValue("renter_id", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione o locatário" /></SelectTrigger>
                <SelectContent>
                  {renters.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Data de início" error={errors.data_inicio?.message}>
                <Input type="date" {...register("data_inicio")} />
              </Field>
              <Field label="Data de término (opcional)">
                <Input type="date" {...register("data_fim")} />
              </Field>
              <Field label="Ciclo de cobrança">
                <Select value={watch("ciclo_cobranca") || "semanal"} onValueChange={(v) => setValue("ciclo_cobranca", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BILLING_CYCLE.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Valor do aluguel (R$)" error={errors.valor_aluguel?.message}>
                <Input type="number" step="0.01" {...register("valor_aluguel")} />
              </Field>
              <Field label="Caução (R$)">
                <Input type="number" step="0.01" {...register("valor_caucao")} />
              </Field>
              <Field label="KM inicial">
                <Input type="number" {...register("km_inicial")} />
              </Field>
            </div>
            <Field label="Observações">
              <Input {...register("observacoes")} />
            </Field>
            <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
              Ao salvar, as cobranças do período serão geradas automaticamente conforme o ciclo escolhido.
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={create.isPending}>Criar contrato</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
