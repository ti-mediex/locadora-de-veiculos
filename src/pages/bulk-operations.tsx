import { useMemo, useState } from "react";
import { Percent, RefreshCw, Layers3 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Field } from "@/components/shared/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useContracts, useBulkAdjustRent, useBulkRenew } from "@/hooks/use-contracts";
import { useCanWrite } from "@/hooks/use-can-write";
import { formatCurrency } from "@/lib/format";

export default function BulkOperationsPage() {
  const { data: contracts = [] } = useContracts();
  const adjust = useBulkAdjustRent();
  const renew = useBulkRenew();
  const canWrite = useCanWrite("contracts");

  const ativos = useMemo(
    () => contracts.filter((c) => c.status === "ativo" || c.status === "inadimplente"),
    [contracts]
  );

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modo, setModo] = useState<"percentual" | "valor">("percentual");
  const [valor, setValor] = useState("");
  const [qtdFaturas, setQtdFaturas] = useState("4");

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const toggleAll = () =>
    setSelected((s) => (s.size === ativos.length ? new Set() : new Set(ativos.map((c) => c.id))));

  function doAdjust() {
    if (selected.size === 0) return toast.error("Selecione ao menos um contrato");
    const v = Number(valor);
    if (!v) return toast.error("Informe o valor do reajuste");
    adjust.mutate(
      modo === "percentual"
        ? { ids: [...selected], percentual: v }
        : { ids: [...selected], novoValor: v },
      { onSuccess: () => setSelected(new Set()) }
    );
  }

  function doRenew() {
    if (selected.size === 0) return toast.error("Selecione ao menos um contrato");
    renew.mutate({ ids: [...selected], qtd: Number(qtdFaturas) || 1 });
  }

  if (!canWrite) {
    return (
      <div className="space-y-6">
        <PageHeader title="Operações em lote" />
        <EmptyState message="Apenas perfis financeiro/admin podem executar operações em lote." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operações em lote"
        description="Reajuste de aluguel e renovação (geração de faturas) em massa"
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Percent className="h-5 w-5" /> Reajuste em lote</CardTitle>
            <CardDescription>Aplica aos contratos selecionados abaixo</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field label="Tipo de reajuste">
              <Select value={modo} onValueChange={(v) => setModo(v as "percentual" | "valor")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentual">Percentual (%)</SelectItem>
                  <SelectItem value="valor">Novo valor fixo (R$)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label={modo === "percentual" ? "Percentual (ex.: 10 = +10%)" : "Novo valor (R$)"}>
              <Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} />
            </Field>
            <Button onClick={doAdjust} disabled={adjust.isPending}>
              <Percent className="h-4 w-4" /> Aplicar reajuste ({selected.size})
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><RefreshCw className="h-5 w-5" /> Renovação em lote</CardTitle>
            <CardDescription>Gera novas faturas para os contratos selecionados</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field label="Quantidade de faturas a gerar">
              <Input type="number" value={qtdFaturas} onChange={(e) => setQtdFaturas(e.target.value)} />
            </Field>
            <Button onClick={doRenew} disabled={renew.isPending}>
              <RefreshCw className="h-4 w-4" /> Renovar selecionados ({selected.size})
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Layers3 className="h-5 w-5" /> Contratos ativos</CardTitle>
          <CardDescription>Selecione os contratos para aplicar as operações</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {ativos.length === 0 ? (
            <EmptyState message="Nenhum contrato ativo" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input type="checkbox" className="h-4 w-4" checked={selected.size === ativos.length} onChange={toggleAll} />
                  </TableHead>
                  <TableHead>Contrato</TableHead>
                  <TableHead>Locatário</TableHead>
                  <TableHead>Veículo</TableHead>
                  <TableHead className="text-right">Aluguel</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ativos.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <input type="checkbox" className="h-4 w-4" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
                    </TableCell>
                    <TableCell className="font-medium">{c.numero}</TableCell>
                    <TableCell>{c.renters?.nome}</TableCell>
                    <TableCell>{c.vehicles?.placa}</TableCell>
                    <TableCell className="text-right">{formatCurrency(c.valor_aluguel)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
