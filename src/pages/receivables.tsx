import { useMemo, useState } from "react";
import { Search, Receipt, CheckCircle2, AlertCircle, MessageCircle } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatCard } from "@/components/shared/stat-card";
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
import {
  useReceivables,
  useSettleReceivable,
  useMarkOverdue,
  type ReceivableWithRefs,
} from "@/hooks/use-receivables";
import { FORMA_PAGAMENTO } from "@/lib/options";
import { formatCurrency, formatDate } from "@/lib/format";
import { whatsappLink, cobrancaMessage } from "@/lib/whatsapp";

const FILTERS = [
  { value: "todos", label: "Todos" },
  { value: "pendente", label: "Pendentes" },
  { value: "atrasado", label: "Em atraso" },
  { value: "pago", label: "Pagos" },
];

export default function ReceivablesPage() {
  const { data: receivables = [], isLoading } = useReceivables();
  const settle = useSettleReceivable();
  const markOverdue = useMarkOverdue();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("todos");
  const [target, setTarget] = useState<ReceivableWithRefs | null>(null);

  const [valorPago, setValorPago] = useState("");
  const [juros, setJuros] = useState("0");
  const [multa, setMulta] = useState("0");
  const [forma, setForma] = useState("pix");
  const [dataPg, setDataPg] = useState(new Date().toISOString().slice(0, 10));

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return receivables.filter((r) => {
      const matchSearch =
        r.contracts?.numero.toLowerCase().includes(q) ||
        r.contracts?.renters?.nome.toLowerCase().includes(q) ||
        r.contracts?.vehicles?.placa.toLowerCase().includes(q);
      const matchFilter = filter === "todos" || r.status === filter;
      return (q ? matchSearch : true) && matchFilter;
    });
  }, [receivables, search, filter]);

  const totals = useMemo(() => {
    const pendente = receivables
      .filter((r) => r.status === "pendente" || r.status === "parcial")
      .reduce((s, r) => s + (r.valor - r.valor_pago), 0);
    const atrasado = receivables
      .filter((r) => r.status === "atrasado")
      .reduce((s, r) => s + (r.valor + r.juros + r.multa - r.valor_pago), 0);
    const recebido = receivables.reduce((s, r) => s + r.valor_pago, 0);
    return { pendente, atrasado, recebido };
  }, [receivables]);

  function openSettle(r: ReceivableWithRefs) {
    setTarget(r);
    setValorPago(String(r.valor - r.valor_pago));
    setJuros("0");
    setMulta("0");
    setForma("pix");
    setDataPg(new Date().toISOString().slice(0, 10));
  }

  function confirmSettle() {
    if (!target) return;
    settle.mutate(
      {
        id: target.id,
        valor_pago: Number(valorPago),
        juros: Number(juros),
        multa: Number(multa),
        forma_pagamento: forma,
        data_pagamento: dataPg,
      },
      { onSuccess: () => setTarget(null) }
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recebíveis"
        description="Cobranças de aluguel, baixas e inadimplência"
        actions={
          <Button variant="outline" onClick={() => markOverdue.mutate()}>
            <AlertCircle className="h-4 w-4" /> Atualizar atrasos
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="A receber (pendente)" value={formatCurrency(totals.pendente)} icon={<Receipt className="h-5 w-5" />} />
        <StatCard title="Em atraso" value={formatCurrency(totals.atrasado)} tone="destructive" icon={<AlertCircle className="h-5 w-5" />} />
        <StatCard title="Total recebido" value={formatCurrency(totals.recebido)} tone="success" icon={<CheckCircle2 className="h-5 w-5" />} />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flex flex-col gap-2 border-b p-4 sm:flex-row sm:items-center">
            <div className="flex flex-1 items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por contrato, locatário ou placa..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border-0 focus-visible:ring-0"
              />
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FILTERS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <EmptyState message="Nenhuma cobrança encontrada" icon={<Receipt className="h-6 w-6" />} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contrato</TableHead>
                  <TableHead>Locatário</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Pago</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.contracts?.numero}</TableCell>
                    <TableCell>
                      <div>{r.contracts?.renters?.nome}</div>
                      <div className="text-xs text-muted-foreground">{r.contracts?.vehicles?.placa}</div>
                    </TableCell>
                    <TableCell>{formatDate(r.vencimento)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(r.valor + r.juros + r.multa)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.valor_pago)}</TableCell>
                    <TableCell><StatusBadge status={r.status} /></TableCell>
                    <TableCell>
                      {r.status !== "pago" && r.status !== "cancelado" && (
                        <div className="flex justify-end gap-1">
                          {r.contracts?.renters?.telefone && (
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Cobrar via WhatsApp"
                              asChild
                            >
                              <a
                                href={whatsappLink(
                                  r.contracts.renters.telefone,
                                  cobrancaMessage({
                                    nome: r.contracts?.renters?.nome,
                                    numeroContrato: r.contracts?.numero,
                                    valor: r.valor + r.juros + r.multa - r.valor_pago,
                                    vencimento: r.vencimento,
                                    atrasado: r.status === "atrasado",
                                  })
                                )}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <MessageCircle className="h-4 w-4 text-success" />
                              </a>
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => openSettle(r)}>
                            Baixar
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

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar pagamento</DialogTitle>
          </DialogHeader>
          {target && (
            <div className="space-y-4">
              <div className="rounded-md bg-muted p-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Contrato</span><span className="font-medium">{target.contracts?.numero}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Locatário</span><span>{target.contracts?.renters?.nome}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Vencimento</span><span>{formatDate(target.vencimento)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Valor original</span><span>{formatCurrency(target.valor)}</span></div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Valor pago (R$)">
                  <Input type="number" step="0.01" value={valorPago} onChange={(e) => setValorPago(e.target.value)} />
                </Field>
                <Field label="Data do pagamento">
                  <Input type="date" value={dataPg} onChange={(e) => setDataPg(e.target.value)} />
                </Field>
                <Field label="Juros (R$)">
                  <Input type="number" step="0.01" value={juros} onChange={(e) => setJuros(e.target.value)} />
                </Field>
                <Field label="Multa (R$)">
                  <Input type="number" step="0.01" value={multa} onChange={(e) => setMulta(e.target.value)} />
                </Field>
                <Field label="Forma de pagamento" className="space-y-1.5 sm:col-span-2">
                  <Select value={forma} onValueChange={setForma}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FORMA_PAGAMENTO.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>Cancelar</Button>
            <Button variant="success" onClick={confirmSettle} disabled={settle.isPending}>
              Confirmar pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
