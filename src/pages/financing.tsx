import { useMemo, useState } from "react";
import { Plus, Trash2, Banknote, Eye, Calculator } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
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
  useFinancingContracts,
  useCreateFinancing,
  useDeleteFinancing,
  useInstallments,
  calcPriceSchedule,
  type Installment,
} from "@/hooks/use-financing";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Vehicle } from "@/types/database";

const empty = {
  numero: "",
  instituicao: "",
  vehicle_id: "",
  tipo: "CDC",
  valor_principal: "",
  valor_entrada: "",
  taxa_juros_mensal: "",
  qtd_parcelas: "",
  primeiro_vencimento: new Date().toISOString().slice(0, 10),
  data_inicio: new Date().toISOString().slice(0, 10),
  observacoes: "",
};

export default function FinancingPage() {
  const { data: contracts = [], isLoading } = useFinancingContracts();
  const { data: vehicles = [] } = useList<Vehicle>("vehicles");
  const create = useCreateFinancing();
  const remove = useDeleteFinancing();
  const canWrite = useCanWrite("financing");

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({ ...empty });
  const [preview, setPreview] = useState<Installment[]>([]);
  const [viewId, setViewId] = useState<string | null>(null);
  const { data: installments = [] } = useInstallments(viewId);

  const set = (k: string, v: string) => setForm((s) => ({ ...s, [k]: v }));
  const vehicleLabel = (id: string | null) => vehicles.find((v) => v.id === id)?.placa ?? "—";

  const calc = useMemo(() => {
    const principal = Number(form.valor_principal) - Number(form.valor_entrada || 0);
    const n = Number(form.qtd_parcelas);
    const taxa = Number(form.taxa_juros_mensal);
    if (principal > 0 && n > 0) {
      return calcPriceSchedule(principal, taxa, n, form.primeiro_vencimento);
    }
    return null;
  }, [form.valor_principal, form.valor_entrada, form.qtd_parcelas, form.taxa_juros_mensal, form.primeiro_vencimento]);

  function openNew() {
    setForm({ ...empty });
    setPreview([]);
    setOpen(true);
  }

  function doCalc() {
    if (!calc) {
      toast.error("Preencha valor, parcelas e taxa para calcular");
      return;
    }
    setPreview(calc.schedule);
    toast.success(`Parcela: ${formatCurrency(calc.parcela)}`);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.valor_principal || !form.qtd_parcelas) {
      toast.error("Informe valor principal e quantidade de parcelas");
      return;
    }
    const schedule = preview.length > 0 ? preview : calc?.schedule ?? [];
    const contract = {
      numero: form.numero || null,
      instituicao: form.instituicao || null,
      vehicle_id: form.vehicle_id || null,
      tipo: form.tipo || "CDC",
      tabela: "PRICE",
      valor_principal: Number(form.valor_principal),
      valor_entrada: Number(form.valor_entrada || 0),
      valor_parcela: calc?.parcela ?? null,
      qtd_parcelas: Number(form.qtd_parcelas),
      taxa_juros_mensal: Number(form.taxa_juros_mensal || 0),
      data_inicio: form.data_inicio,
      primeiro_vencimento: form.primeiro_vencimento || null,
      status: "ativo",
      observacoes: form.observacoes || null,
    };
    create.mutate({ contract, schedule }, { onSuccess: () => setOpen(false) });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financiamentos"
        description="Contratos de alienação / financiamento da frota (tabela PRICE)"
        actions={canWrite && <Button onClick={openNew}><Plus className="h-4 w-4" /> Novo financiamento</Button>}
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : contracts.length === 0 ? (
            <EmptyState message="Nenhum financiamento cadastrado" icon={<Banknote className="h-6 w-6" />} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Instituição</TableHead>
                  <TableHead>Veículo</TableHead>
                  <TableHead className="text-right">Principal</TableHead>
                  <TableHead className="text-right">Parcela</TableHead>
                  <TableHead className="text-right">Parcelas</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.numero ?? "—"}</TableCell>
                    <TableCell>{c.instituicao ?? "—"}</TableCell>
                    <TableCell>{c.vehicles?.placa ?? vehicleLabel(c.vehicle_id)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(c.valor_principal)}</TableCell>
                    <TableCell className="text-right">{c.valor_parcela ? formatCurrency(c.valor_parcela) : "—"}</TableCell>
                    <TableCell className="text-right">{c.qtd_parcelas}x</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" title="Ver parcelas" onClick={() => setViewId(c.id)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {canWrite && (
                          <Button variant="ghost" size="icon" onClick={() => confirm("Remover financiamento?") && remove.mutate(c.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
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

      {/* Novo financiamento */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Novo financiamento</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Número"><Input value={form.numero} onChange={(e) => set("numero", e.target.value)} /></Field>
              <Field label="Instituição"><Input value={form.instituicao} onChange={(e) => set("instituicao", e.target.value)} /></Field>
              <Field label="Veículo">
                <Select value={form.vehicle_id} onValueChange={(v) => set("vehicle_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {vehicles.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.placa} — {v.modelo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Valor principal (R$) *"><Input type="number" step="0.01" value={form.valor_principal} onChange={(e) => set("valor_principal", e.target.value)} /></Field>
              <Field label="Entrada (R$)"><Input type="number" step="0.01" value={form.valor_entrada} onChange={(e) => set("valor_entrada", e.target.value)} /></Field>
              <Field label="Taxa juros mensal (%)"><Input type="number" step="0.0001" value={form.taxa_juros_mensal} onChange={(e) => set("taxa_juros_mensal", e.target.value)} /></Field>
              <Field label="Qtd. parcelas *"><Input type="number" value={form.qtd_parcelas} onChange={(e) => set("qtd_parcelas", e.target.value)} /></Field>
              <Field label="1º vencimento"><Input type="date" value={form.primeiro_vencimento} onChange={(e) => set("primeiro_vencimento", e.target.value)} /></Field>
              <Field label="Data de início"><Input type="date" value={form.data_inicio} onChange={(e) => set("data_inicio", e.target.value)} /></Field>
            </div>

            <div className="flex items-center justify-between rounded-md bg-muted p-3">
              <div className="text-sm">
                {calc ? (
                  <>Parcela estimada: <strong>{formatCurrency(calc.parcela)}</strong> · Financiado: {formatCurrency(Number(form.valor_principal) - Number(form.valor_entrada || 0))}</>
                ) : (
                  <span className="text-muted-foreground">Informe valor, parcelas e taxa</span>
                )}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={doCalc}>
                <Calculator className="h-4 w-4" /> Calcular parcelas
              </Button>
            </div>

            {preview.length > 0 && (
              <div className="max-h-60 overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead className="text-right">Juros</TableHead>
                      <TableHead className="text-right">Amortização</TableHead>
                      <TableHead className="text-right">Parcela</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((p) => (
                      <TableRow key={p.numero}>
                        <TableCell>{p.numero}</TableCell>
                        <TableCell>{formatDate(p.vencimento)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(p.juros)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(p.amortizacao)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(p.parcela)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(p.saldo_final)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={create.isPending}>Salvar financiamento</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Ver parcelas */}
      <Dialog open={!!viewId} onOpenChange={(o) => !o && setViewId(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Parcelas do financiamento</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Saldo inicial</TableHead>
                  <TableHead className="text-right">Juros</TableHead>
                  <TableHead className="text-right">Amortização</TableHead>
                  <TableHead className="text-right">Parcela</TableHead>
                  <TableHead className="text-right">Saldo final</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {installments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.numero}</TableCell>
                    <TableCell>{formatDate(p.vencimento)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(p.saldo_inicial)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(p.juros)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(p.amortizacao)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(p.parcela)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(p.saldo_final)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
