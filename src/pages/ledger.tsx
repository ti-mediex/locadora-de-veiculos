import { useMemo, useState } from "react";
import { Plus, ArrowLeftRight, CheckCircle2, Undo2, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Field } from "@/components/shared/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useList } from "@/hooks/use-crud";
import { useCanWrite } from "@/hooks/use-can-write";
import { useCreateLedger, useTransfer, useSettleLedger, useUndoLedger } from "@/hooks/use-ledger";
import { LEDGER_TIPO, LEDGER_STATUS, LEDGER_MODO, LEDGER_CATEGORIA, FORMA_PAGAMENTO } from "@/lib/options";
import { formatCurrency, formatDate } from "@/lib/format";
import type { LedgerEntry, BankAccount } from "@/types/database";

const FILTERS = [
  { value: "todos", label: "Todos" },
  { value: "entrada", label: "Contas a receber" },
  { value: "saida", label: "Contas a pagar" },
  { value: "previsto", label: "Previstos" },
  { value: "baixado", label: "Baixados" },
];

export default function LedgerPage() {
  const { data: entries = [], isLoading } = useList<LedgerEntry>("ledger_entries", {
    orderBy: { column: "data", ascending: false },
  });
  const { data: accounts = [] } = useList<BankAccount>("bank_accounts");
  const createLedger = useCreateLedger();
  const transfer = useTransfer();
  const settle = useSettleLedger();
  const undo = useUndoLedger();
  const canWrite = useCanWrite("lancamentos");

  const [open, setOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [settleFor, setSettleFor] = useState<LedgerEntry | null>(null);
  const [filter, setFilter] = useState("todos");

  // form lançamento
  const [modo, setModo] = useState("unico");
  const [tipo, setTipo] = useState("saida");
  const [form, setForm] = useState<Record<string, string>>({
    categoria: "Outros", descricao: "", valor: "", data: new Date().toISOString().slice(0, 10), conta_id: "",
  });
  const [parcelas, setParcelas] = useState("2");
  const set = (k: string, v: string) => setForm((s) => ({ ...s, [k]: v }));

  // transferência
  const [tf, setTf] = useState({ origem: "", destino: "", valor: "", descricao: "Transferência entre contas", data: new Date().toISOString().slice(0, 10) });
  // baixa
  const [valorBaixa, setValorBaixa] = useState("");
  const [formaBaixa, setFormaBaixa] = useState("pix");

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (filter === "todos") return true;
      if (filter === "entrada" || filter === "saida") return e.tipo === filter;
      return e.status === filter;
    });
  }, [entries, filter]);

  const totals = useMemo(() => {
    const aReceber = entries.filter((e) => e.tipo === "entrada" && e.status !== "baixado" && e.status !== "cancelado").reduce((s, e) => s + (e.valor - e.valor_pago), 0);
    const aPagar = entries.filter((e) => e.tipo === "saida" && e.status !== "baixado" && e.status !== "cancelado").reduce((s, e) => s + (e.valor - e.valor_pago), 0);
    const saldo = entries.filter((e) => e.status === "baixado" || e.status === "parcial").reduce((s, e) => s + (e.tipo === "entrada" ? e.valor_pago : -e.valor_pago), 0);
    return { aReceber, aPagar, saldo };
  }, [entries]);

  const accName = (id: string | null) => accounts.find((a) => a.id === id)?.nome ?? "—";

  function openNew() {
    setModo("unico"); setTipo("saida");
    setForm({ categoria: "Outros", descricao: "", valor: "", data: new Date().toISOString().slice(0, 10), conta_id: "" });
    setParcelas("2");
    setOpen(true);
  }

  function submitLedger(e: React.FormEvent) {
    e.preventDefault();
    if (!form.descricao || !form.valor) return toast.error("Informe descrição e valor");
    const base = {
      tipo, categoria: form.categoria, descricao: form.descricao, valor: Number(form.valor),
      data: form.data, vencimento: form.data, conta_id: form.conta_id || null, status: "previsto",
    };
    createLedger.mutate(
      { modo: modo as "unico" | "parcelado" | "recorrente", base, parcelas: Number(parcelas) || 1 },
      { onSuccess: () => setOpen(false) }
    );
  }

  function submitTransfer(e: React.FormEvent) {
    e.preventDefault();
    if (!tf.origem || !tf.destino || !tf.valor) return toast.error("Preencha contas e valor");
    if (tf.origem === tf.destino) return toast.error("Contas devem ser diferentes");
    transfer.mutate(
      { origem: tf.origem, destino: tf.destino, valor: Number(tf.valor), data: tf.data, descricao: tf.descricao },
      { onSuccess: () => setTransferOpen(false) }
    );
  }

  function openSettle(en: LedgerEntry) {
    setSettleFor(en);
    setValorBaixa(String(en.valor - en.valor_pago));
    setFormaBaixa("pix");
  }
  function confirmSettle() {
    if (!settleFor) return;
    settle.mutate(
      { id: settleFor.id, valor: Number(valorBaixa), data: new Date().toISOString().slice(0, 10), forma: formaBaixa },
      { onSuccess: () => setSettleFor(null) }
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financeiro — Lançamentos"
        description="Contas a pagar e a receber, lançamentos avulsos e transferências"
        actions={canWrite && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setTransferOpen(true)}><ArrowLeftRight className="h-4 w-4" /> Transferência</Button>
            <Button onClick={openNew}><Plus className="h-4 w-4" /> Novo lançamento</Button>
          </div>
        )}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="A receber" value={formatCurrency(totals.aReceber)} tone="success" icon={<TrendingUp className="h-5 w-5" />} />
        <StatCard title="A pagar" value={formatCurrency(totals.aPagar)} tone="destructive" icon={<TrendingDown className="h-5 w-5" />} />
        <StatCard title="Saldo realizado" value={formatCurrency(totals.saldo)} icon={<Wallet className="h-5 w-5" />} />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center gap-2 border-b p-4">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FILTERS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <EmptyState message="Nenhum lançamento" icon={<Wallet className="h-6 w-6" />} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Conta</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  {canWrite && <TableHead className="w-28"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{formatDate(e.data)}</TableCell>
                    <TableCell>
                      <div className="font-medium">{e.descricao}</div>
                      {e.parcela_total && <div className="text-xs text-muted-foreground">Parcela {e.parcela_num}/{e.parcela_total}</div>}
                    </TableCell>
                    <TableCell>{e.categoria}</TableCell>
                    <TableCell>{accName(e.conta_id)}</TableCell>
                    <TableCell className={`text-right font-medium ${e.tipo === "entrada" ? "text-success" : "text-destructive"}`}>
                      {e.tipo === "entrada" ? "+" : "−"} {formatCurrency(e.valor)}
                    </TableCell>
                    <TableCell><StatusBadge status={e.status} /></TableCell>
                    {canWrite && (
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {e.status !== "baixado" && e.status !== "cancelado" && (
                            <Button size="sm" variant="outline" onClick={() => openSettle(e)}>Baixar</Button>
                          )}
                          {(e.status === "baixado" || e.status === "parcial") && (
                            <Button size="icon" variant="ghost" title="Desfazer baixa" onClick={() => undo.mutate(e.id)}>
                              <Undo2 className="h-4 w-4" />
                            </Button>
                          )}
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

      {/* Novo lançamento */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo lançamento</DialogTitle></DialogHeader>
          <form onSubmit={submitLedger} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tipo">
                <Select value={tipo} onValueChange={setTipo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LEDGER_TIPO.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Modo">
                <Select value={modo} onValueChange={setModo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LEDGER_MODO.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Descrição" className="space-y-1.5 sm:col-span-2">
                <Input value={form.descricao} onChange={(e) => set("descricao", e.target.value)} />
              </Field>
              <Field label="Categoria">
                <Select value={form.categoria} onValueChange={(v) => set("categoria", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LEDGER_CATEGORIA.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Conta">
                <Select value={form.conta_id} onValueChange={(v) => set("conta_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label={modo === "parcelado" ? "Valor total (R$)" : "Valor (R$)"}>
                <Input type="number" step="0.01" value={form.valor} onChange={(e) => set("valor", e.target.value)} />
              </Field>
              <Field label="Data / 1º vencimento">
                <Input type="date" value={form.data} onChange={(e) => set("data", e.target.value)} />
              </Field>
              {(modo === "parcelado" || modo === "recorrente") && (
                <Field label={modo === "parcelado" ? "Nº de parcelas" : "Nº de meses"}>
                  <Input type="number" value={parcelas} onChange={(e) => setParcelas(e.target.value)} />
                </Field>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createLedger.isPending}>Lançar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Transferência */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Transferência bancária</DialogTitle></DialogHeader>
          <form onSubmit={submitTransfer} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Conta de origem">
                <Select value={tf.origem} onValueChange={(v) => setTf((s) => ({ ...s, origem: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Conta de destino">
                <Select value={tf.destino} onValueChange={(v) => setTf((s) => ({ ...s, destino: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Valor (R$)">
                <Input type="number" step="0.01" value={tf.valor} onChange={(e) => setTf((s) => ({ ...s, valor: e.target.value }))} />
              </Field>
              <Field label="Data">
                <Input type="date" value={tf.data} onChange={(e) => setTf((s) => ({ ...s, data: e.target.value }))} />
              </Field>
              <Field label="Descrição" className="space-y-1.5 sm:col-span-2">
                <Input value={tf.descricao} onChange={(e) => setTf((s) => ({ ...s, descricao: e.target.value }))} />
              </Field>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTransferOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={transfer.isPending}>Transferir</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Baixa */}
      <Dialog open={!!settleFor} onOpenChange={(o) => !o && setSettleFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Baixar lançamento</DialogTitle></DialogHeader>
          {settleFor && (
            <div className="space-y-4">
              <div className="rounded-md bg-muted p-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Descrição</span><span className="font-medium">{settleFor.descricao}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Valor</span><span>{formatCurrency(settleFor.valor)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Já pago</span><span>{formatCurrency(settleFor.valor_pago)}</span></div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Valor da baixa (R$)">
                  <Input type="number" step="0.01" value={valorBaixa} onChange={(e) => setValorBaixa(e.target.value)} />
                </Field>
                <Field label="Forma">
                  <Select value={formaBaixa} onValueChange={setFormaBaixa}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{FORMA_PAGAMENTO.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              </div>
              <p className="text-xs text-muted-foreground">Baixa parcial permitida — informe um valor menor que o total.</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettleFor(null)}>Cancelar</Button>
            <Button variant="success" onClick={confirmSettle} disabled={settle.isPending}>
              <CheckCircle2 className="h-4 w-4" /> Confirmar baixa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
