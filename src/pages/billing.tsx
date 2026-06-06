import { useMemo, useState } from "react";
import { Plus, Receipt, Ban, Eye } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Field } from "@/components/shared/field";
import { Button } from "@/components/ui/button";
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
import { useCanWrite } from "@/hooks/use-can-write";
import { useContracts } from "@/hooks/use-contracts";
import {
  useBillings, useBillableItems, useCreateBilling, useCancelBilling, useBillingItems,
} from "@/hooks/use-billing";
import { formatCurrency, formatDate } from "@/lib/format";

type SelItem = { key: string; tipo: string; descricao: string; valor: number; ref_id?: string };

export default function BillingPage() {
  const { data: billings = [], isLoading } = useBillings();
  const { data: contracts = [] } = useContracts();
  const create = useCreateBilling();
  const cancel = useCancelBilling();
  const canWrite = useCanWrite("billing");

  const [open, setOpen] = useState(false);
  const [contractId, setContractId] = useState<string>("");
  const [selected, setSelected] = useState<Record<string, SelItem>>({});
  const [viewId, setViewId] = useState<string | null>(null);
  const { data: viewItems = [] } = useBillingItems(viewId);

  const contract = contracts.find((c) => c.id === contractId);
  const { data: billable } = useBillableItems(contractId || null, contract?.renter_id ?? null);

  const candidates: SelItem[] = useMemo(() => {
    if (!billable) return [];
    const out: SelItem[] = [];
    for (const r of billable.receivables)
      out.push({ key: "r" + r.id, tipo: "aluguel", descricao: `Aluguel ${r.competencia ?? formatDate(r.vencimento)}`, valor: r.valor - r.valor_pago, ref_id: r.id });
    for (const f of billable.fines)
      out.push({ key: "f" + f.id, tipo: "multa", descricao: `Multa: ${f.descricao}`, valor: f.valor, ref_id: f.id });
    for (const o of billable.occurrences)
      out.push({ key: "o" + o.id, tipo: "reembolsavel", descricao: `${o.tipo}: ${o.descricao}`, valor: o.valor, ref_id: o.id });
    return out;
  }, [billable]);

  const total = Object.values(selected).reduce((s, i) => s + i.valor, 0);

  function openNew() {
    setContractId(""); setSelected({}); setOpen(true);
  }
  function toggle(it: SelItem) {
    setSelected((s) => {
      const n = { ...s };
      if (n[it.key]) delete n[it.key]; else n[it.key] = it;
      return n;
    });
  }
  function submit() {
    if (!contractId) return toast.error("Selecione um contrato");
    const items = Object.values(selected);
    if (items.length === 0) return toast.error("Selecione ao menos um item");
    create.mutate(
      {
        billing: {
          contract_id: contractId,
          renter_id: contract?.renter_id ?? null,
          descricao: `Fatura ${contract?.numero ?? ""}`,
          data_emissao: new Date().toISOString().slice(0, 10),
        },
        items: items.map(({ tipo, descricao, valor, ref_id }) => ({ tipo, descricao, valor, ref_id })),
      },
      { onSuccess: () => setOpen(false) }
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Faturamento"
        description="Geração de faturas: aluguel, reembolsáveis e multas"
        actions={canWrite && <Button onClick={openNew}><Plus className="h-4 w-4" /> Nova fatura</Button>}
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : billings.length === 0 ? (
            <EmptyState message="Nenhuma fatura gerada" icon={<Receipt className="h-6 w-6" />} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Emissão</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Contrato</TableHead>
                  <TableHead>Locatário</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {billings.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>{formatDate(b.data_emissao)}</TableCell>
                    <TableCell className="font-medium">{b.descricao}</TableCell>
                    <TableCell>{b.contracts?.numero ?? "—"}</TableCell>
                    <TableCell>{b.renters?.nome ?? "—"}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(b.valor_total)}</TableCell>
                    <TableCell><StatusBadge status={b.status} /></TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" title="Ver itens" onClick={() => setViewId(b.id)}><Eye className="h-4 w-4" /></Button>
                        {canWrite && b.status !== "cancelada" && (
                          <Button variant="ghost" size="icon" title="Cancelar" onClick={() => confirm("Cancelar fatura?") && cancel.mutate(b.id)}>
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

      {/* Nova fatura */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Nova fatura</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Field label="Contrato">
              <Select value={contractId} onValueChange={(v) => { setContractId(v); setSelected({}); }}>
                <SelectTrigger><SelectValue placeholder="Selecione o contrato" /></SelectTrigger>
                <SelectContent>
                  {contracts.filter((c) => c.status === "ativo" || c.status === "inadimplente").map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.numero} — {c.renters?.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {contractId && (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {candidates.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground">Nenhum item em aberto para faturar</TableCell></TableRow>
                    ) : candidates.map((it) => (
                      <TableRow key={it.key}>
                        <TableCell><input type="checkbox" className="h-4 w-4" checked={!!selected[it.key]} onChange={() => toggle(it)} /></TableCell>
                        <TableCell>{it.descricao}</TableCell>
                        <TableCell className="capitalize">{it.tipo}</TableCell>
                        <TableCell className="text-right">{formatCurrency(it.valor)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <div className="flex justify-end text-sm font-semibold">Total da fatura: {formatCurrency(total)}</div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={create.isPending}>Gerar fatura</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ver itens */}
      <Dialog open={!!viewId} onOpenChange={(o) => !o && setViewId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Itens da fatura</DialogTitle></DialogHeader>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Item</TableHead><TableHead>Tipo</TableHead><TableHead className="text-right">Valor</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {viewItems.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell>{i.descricao}</TableCell>
                    <TableCell className="capitalize">{i.tipo}</TableCell>
                    <TableCell className="text-right">{formatCurrency(i.valor)}</TableCell>
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
