import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2, Search, FileDown, TrendingUp, TrendingDown, Upload, FileText, CheckCircle2, CircleDollarSign, Paperclip, Landmark } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { SelectVeiculo } from "@/components/shared/select-veiculo";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Field } from "@/components/shared/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { useList, useCreate, useUpdate, useDelete } from "@/hooks/use-crud";
import { useCanWrite } from "@/hooks/use-can-write";
import { useContratos } from "@/hooks/use-contratos";
import { parseBoletosBanco } from "@/lib/boletos-banco-parse";
import { conciliarBoletos, useAplicarBaixa, useMarcarRecebido, useUploadArquivoFinanceiro, abrirArquivoFinanceiro, type ConciliacaoItem } from "@/hooks/use-recebimentos";
import { RECEITA_CATEGORIA, DESPESA_CATEGORIA, FORMA_PAGAMENTO } from "@/lib/options";
import { formatCurrency, formatDate, maskPlaca } from "@/lib/format";
import { noPeriodo } from "@/lib/date";
import { PeriodoFilter } from "@/components/shared/period-filter";
import { exportToCsv } from "@/lib/csv";
import type { FinanceEntry, Vehicle } from "@/types/database";

const ehAluguel = (cat?: string | null) => /alug|loca[çc]/i.test(cat ?? "");
const addDias = (iso: string, n: number): string | null => {
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return null; // data inválida não pode derrubar a tela
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const CONC_LABEL: Record<string, { label: string; variant: "success" | "muted" | "warning" | "destructive" }> = {
  match: { label: "Baixar", variant: "success" },
  ja_baixado: { label: "Já baixado", variant: "muted" },
  sem_contrato: { label: "Sem contrato", variant: "destructive" },
  sem_lancamento: { label: "Sem boleto em aberto", variant: "warning" },
};

type Row = FinanceEntry & { vehicles: { placa: string } | null };

const schema = z.object({
  data: z.string().min(1, "Informe a data"),
  vehicle_id: z.string().optional(),
  categoria: z.string().optional(),
  descricao: z.string().min(1, "Informe a descrição"),
  valor: z.coerce.number().min(0.01, "Informe o valor"),
  forma_pagamento: z.string().optional(),
  observacoes: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export function FinanceEntriesPage({ tipo }: { tipo: "receita" | "despesa" }) {
  const qc = useQueryClient();
  const isReceita = tipo === "receita";
  const label = isReceita ? "Receita" : "Despesa";
  const categorias = isReceita ? RECEITA_CATEGORIA : DESPESA_CATEGORIA;
  const canWrite = useCanWrite("finance");

  const { data: rows = [], isLoading } = useQuery<Row[]>({
    queryKey: ["finance_entries", tipo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_entries")
        .select("*, vehicles(placa)")
        .eq("tipo", tipo)
        .order("data", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as never;
    },
  });
  const { data: vehicles = [] } = useList<Vehicle>("vehicles");
  const { data: contratos = [] } = useContratos();
  const create = useCreate("finance_entries", label);
  const update = useUpdate("finance_entries", label);
  const remove = useDelete("finance_entries", label);
  const marcarRecebido = useMarcarRecebido();
  const uploadArquivo = useUploadArquivoFinanceiro();
  const aplicarBaixa = useAplicarBaixa();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [search, setSearch] = useState("");
  const [pIni, setPIni] = useState("");
  const [pFim, setPFim] = useState("");

  // Conciliação de boletos pagos (relatório do banco).
  const [concOpen, setConcOpen] = useState(false);
  const [concItens, setConcItens] = useState<ConciliacaoItem[] | null>(null);
  const [concArquivo, setConcArquivo] = useState<string>("");
  const [concProcessando, setConcProcessando] = useState(false);

  async function onConcFile(file: File) {
    setConcProcessando(true); setConcArquivo(file.name);
    try {
      const boletos = await parseBoletosBanco(file);
      const contratosConc = contratos.map((c) => ({ id: c.id, cliente_nome: c.cliente_nome ?? "", cliente_cpf: c.cliente_cpf, vehicle_id: c.vehicle_id, placa: c.vehicles?.placa ?? c.placa ?? null }));
      const entradas = rows.filter((r) => r.categoria && /alug|loca[çc]/i.test(r.categoria)).map((r) => ({ id: r.id, contrato_id: r.contrato_id, vehicle_id: r.vehicle_id, data: r.data, valor: r.valor, recebido: r.recebido, nosso_numero: r.nosso_numero }));
      setConcItens(conciliarBoletos(boletos, contratosConc, entradas));
    } catch (e) { toast.error("Erro ao ler o relatório: " + (e as Error).message); setConcItens(null); }
    finally { setConcProcessando(false); }
  }
  function aplicarConciliacao() {
    if (!concItens) return;
    aplicarBaixa.mutate(concItens, { onSuccess: () => { setConcOpen(false); setConcItens(null); setConcArquivo(""); invalidate(); } });
  }
  async function enviarArquivo(campo: "comprovante_path" | "boleto_path", file: File) {
    if (!editing) return;
    const path = await uploadArquivo.mutateAsync({ entryId: editing.id, file, campo });
    setEditing({ ...editing, [campo]: path });
  }
  function toggleRecebido() {
    if (!editing) return;
    const novo = !editing.recebido;
    marcarRecebido.mutate({ id: editing.id, recebido: novo, forma: editing.forma_pagamento ?? undefined }, { onSuccess: () => { setEditing({ ...editing, recebido: novo, recebido_em: novo ? new Date().toISOString().slice(0, 10) : null }); invalidate(); } });
  }
  const concResumo = useMemo(() => {
    const m = { match: 0, ja_baixado: 0, sem_contrato: 0, sem_lancamento: 0 } as Record<string, number>;
    for (const i of concItens ?? []) m[i.status] = (m[i.status] ?? 0) + 1;
    return m;
  }, [concItens]);

  const {
    register, handleSubmit, reset, setValue, watch, formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const vehicleLabel = (id: string | null) =>
    id ? vehicles.find((v) => v.id === id)?.placa ?? "—" : "Frota (geral)";

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter(
      (r) =>
        (r.descricao.toLowerCase().includes(q) ||
        (r.categoria ?? "").toLowerCase().includes(q) ||
        vehicleLabel(r.vehicle_id).toLowerCase().includes(q)) &&
        noPeriodo(r.data, pIni, pFim)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, search, vehicles, pIni, pFim]);

  // Total do período selecionado; sem período, mês corrente.
  const totalPeriodo = useMemo(() => {
    if (pIni || pFim) return filtered.reduce((s, r) => s + r.valor, 0);
    const now = new Date();
    return rows.filter((r) => { const d = new Date(r.data); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }).reduce((s, r) => s + r.valor, 0);
  }, [rows, filtered, pIni, pFim]);
  const total = useMemo(() => rows.reduce((s, r) => s + r.valor, 0), [rows]);

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["finance_entries", tipo] });
    qc.invalidateQueries({ queryKey: ["finance"] });
  }

  function openNew() {
    setEditing(null);
    reset({ data: new Date().toISOString().slice(0, 10), categoria: categorias[0].value });
    setOpen(true);
  }
  function openEdit(r: Row) {
    setEditing(r);
    reset({
      data: r.data,
      vehicle_id: r.vehicle_id ?? "",
      categoria: r.categoria ?? "",
      descricao: r.descricao,
      valor: r.valor,
      forma_pagamento: r.forma_pagamento ?? "",
      observacoes: r.observacoes ?? "",
    });
    setOpen(true);
  }
  function onSubmit(data: FormData) {
    const payload = { ...data, tipo, vehicle_id: data.vehicle_id || null };
    if (editing) {
      update.mutate({ id: editing.id, ...payload }, { onSuccess: () => { setOpen(false); invalidate(); } });
    } else {
      create.mutate(payload, { onSuccess: () => { setOpen(false); invalidate(); } });
    }
  }
  function del(r: Row) {
    if (confirm(`Remover ${label.toLowerCase()} "${r.descricao}"?`))
      remove.mutate(r.id, { onSuccess: invalidate });
  }
  function exportCsv() {
    type Col = { key: "data" | "semana" | "veiculo" | "categoria" | "descricao" | "valor" | "recebido" | "recebido_em"; label: string };
    const cols: Col[] = [
      { key: "data", label: isReceita ? "Vencimento" : "Data" },
      ...(isReceita ? [{ key: "semana", label: "Semana de locação" } as Col] : []),
      { key: "veiculo", label: "Veículo" },
      { key: "categoria", label: "Categoria" }, { key: "descricao", label: "Descrição" }, { key: "valor", label: "Valor" },
      ...(isReceita ? [{ key: "recebido", label: "Recebido" } as Col, { key: "recebido_em", label: "Recebido em" } as Col] : []),
    ];
    exportToCsv(
      isReceita ? "receitas" : "despesas",
      filtered.map((r) => ({
        data: r.data,
        semana: isReceita && ehAluguel(r.categoria) && r.data && addDias(r.data, 6) ? `${r.data} a ${addDias(r.data, 6)}` : "",
        veiculo: vehicleLabel(r.vehicle_id), categoria: r.categoria ?? "",
        descricao: r.descricao, valor: r.valor,
        recebido: r.recebido ? "Sim" : "Não", recebido_em: r.recebido_em ?? "",
      })),
      cols
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={isReceita ? "Receitas" : "Despesas"}
        description={isReceita ? "Entradas da frota, por veículo" : "Saídas da frota, por veículo"}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportCsv}><FileDown className="h-4 w-4" /> CSV</Button>
            {isReceita && canWrite && <Button variant="outline" onClick={() => { setConcItens(null); setConcArquivo(""); setConcOpen(true); }}><Landmark className="h-4 w-4" /> Conciliar boletos (banco)</Button>}
            {canWrite && <Button onClick={openNew}><Plus className="h-4 w-4" /> Nova {label.toLowerCase()}</Button>}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title={`${label}s ${pIni || pFim ? "no período" : "no mês"}`} value={formatCurrency(totalPeriodo)} tone={isReceita ? "success" : "warning"} icon={isReceita ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />} />
        <StatCard title={`Total de ${label.toLowerCase()}s`} value={formatCurrency(total)} />
        <StatCard title="Lançamentos" value={filtered.length} />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flex flex-col gap-2 border-b p-4 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="flex flex-1 items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por descrição, categoria ou placa..." value={search} onChange={(e) => setSearch(e.target.value)} className="border-0 focus-visible:ring-0" />
            </div>
            <PeriodoFilter ini={pIni} fim={pFim} onChange={(i, f) => { setPIni(i); setPFim(f); }} />
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <EmptyState message={`Nenhuma ${label.toLowerCase()} lançada`} />
          ) : (
            <div className="overflow-x-auto">
            <Table className="text-xs [&_th]:h-9 [&_th]:whitespace-nowrap [&_th]:px-2 [&_th]:text-[11px] [&_td]:px-2 [&_td]:py-2">
              <TableHeader>
                <TableRow>
                  <TableHead>{isReceita ? "Vencimento" : "Data"}</TableHead>
                  {isReceita && <TableHead>Semana de locação</TableHead>}
                  <TableHead>Veículo</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  {isReceita && <TableHead>Receb.</TableHead>}
                  {canWrite && <TableHead className="w-20"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow
                    key={r.id}
                    className={canWrite ? "cursor-pointer" : undefined}
                    onClick={canWrite ? () => openEdit(r) : undefined}
                  >
                    <TableCell className="whitespace-nowrap">{formatDate(r.data)}</TableCell>
                    {isReceita && (
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {ehAluguel(r.categoria) && r.data ? `${formatDate(r.data)} – ${formatDate(addDias(r.data, 6))}` : "—"}
                      </TableCell>
                    )}
                    <TableCell className="whitespace-nowrap font-mono">{r.vehicles?.placa ?? vehicleLabel(r.vehicle_id)}</TableCell>
                    <TableCell className="whitespace-nowrap">{r.categoria ?? "—"}</TableCell>
                    <TableCell className="max-w-[300px]">
                      <div className="flex items-center gap-1">
                        <span className="truncate" title={r.descricao}>{r.descricao}</span>
                        {!isReceita && r.comprovante_path && <button type="button" title="Ver comprovante" className="shrink-0" onClick={(e) => { e.stopPropagation(); abrirArquivoFinanceiro(r.comprovante_path!); }}><Paperclip className="h-3.5 w-3.5 text-primary" /></button>}
                        {!isReceita && r.boleto_path && <button type="button" title="Ver boleto" className="shrink-0" onClick={(e) => { e.stopPropagation(); abrirArquivoFinanceiro(r.boleto_path!); }}><FileText className="h-3.5 w-3.5 text-muted-foreground" /></button>}
                      </div>
                    </TableCell>
                    <TableCell className={`whitespace-nowrap text-right font-medium tabular-nums ${isReceita ? "text-success" : "text-destructive"}`}>
                      {isReceita ? "+" : "−"} {formatCurrency(r.valor)}
                    </TableCell>
                    {isReceita && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          {r.recebido
                            ? <Badge variant="success" className="gap-1 whitespace-nowrap px-1.5 py-0 text-[10px]"><CheckCircle2 className="h-3 w-3" /> {r.recebido_em ? formatDate(r.recebido_em) : "Recebido"}</Badge>
                            : <Badge variant="warning" className="px-1.5 py-0 text-[10px]">A receber</Badge>}
                          {r.comprovante_path && <button type="button" title="Ver comprovante" onClick={() => abrirArquivoFinanceiro(r.comprovante_path!)}><Paperclip className="h-3.5 w-3.5 text-primary" /></button>}
                          {r.boleto_path && <button type="button" title="Ver boleto emitido" onClick={() => abrirArquivoFinanceiro(r.boleto_path!)}><FileText className="h-3.5 w-3.5 text-muted-foreground" /></button>}
                        </div>
                      </TableCell>
                    )}
                    {canWrite && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-0.5">
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar" aria-label="Editar" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Remover" aria-label="Remover" onClick={() => del(r)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? `Editar ${label.toLowerCase()}` : `Nova ${label.toLowerCase()}`}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Data" error={errors.data?.message}>
                <Input type="date" {...register("data")} />
              </Field>
              <Field label="Valor (R$)" error={errors.valor?.message}>
                <Input type="number" step="0.01" {...register("valor")} />
              </Field>
              <Field label="Veículo (opcional)">
                <SelectVeiculo value={watch("vehicle_id") || ""} onChange={(v) => setValue("vehicle_id", v)} vehicles={vehicles} noneLabel="Frota (geral)" />
              </Field>
              <Field label="Categoria">
                <Select value={watch("categoria") || ""} onValueChange={(v) => setValue("categoria", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {categorias.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Descrição" error={errors.descricao?.message} className="space-y-1.5 sm:col-span-2">
                <Input {...register("descricao")} />
              </Field>
              <Field label="Forma de pagamento">
                <Select value={watch("forma_pagamento") || ""} onValueChange={(v) => setValue("forma_pagamento", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {FORMA_PAGAMENTO.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Observações">
              <Textarea {...register("observacoes")} />
            </Field>

            {isReceita && editing && (
              <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Recebimento / baixa</span>
                  <Button type="button" size="sm" variant={editing.recebido ? "outline" : "default"} onClick={toggleRecebido} disabled={marcarRecebido.isPending}>
                    {editing.recebido
                      ? <><CircleDollarSign className="h-4 w-4" /> Marcar como não recebido</>
                      : <><CheckCircle2 className="h-4 w-4" /> Marcar como recebido</>}
                  </Button>
                </div>
                {editing.recebido && <p className="text-xs text-success">Recebido{editing.recebido_em ? ` em ${formatDate(editing.recebido_em)}` : ""}{editing.forma_recebimento ? ` · ${editing.forma_recebimento}` : ""}{editing.nosso_numero ? ` · nosso nº ${editing.nosso_numero}` : ""}</p>}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Comprovante (pix/boleto)</label>
                    <div className="flex items-center gap-2">
                      <Input type="file" accept="image/*,application/pdf" className="h-9 text-xs" onChange={(e) => { const f = e.target.files?.[0]; if (f) enviarArquivo("comprovante_path", f); }} disabled={uploadArquivo.isPending} />
                      {editing.comprovante_path && <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" title="Ver comprovante" onClick={() => abrirArquivoFinanceiro(editing.comprovante_path!)}><Paperclip className="h-4 w-4 text-primary" /></Button>}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Boleto emitido</label>
                    <div className="flex items-center gap-2">
                      <Input type="file" accept="image/*,application/pdf" className="h-9 text-xs" onChange={(e) => { const f = e.target.files?.[0]; if (f) enviarArquivo("boleto_path", f); }} disabled={uploadArquivo.isPending} />
                      {editing.boleto_path && <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" title="Ver boleto" onClick={() => abrirArquivoFinanceiro(editing.boleto_path!)}><FileText className="h-4 w-4" /></Button>}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!isReceita && editing && (
              <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
                <span className="text-sm font-medium">Anexos</span>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Comprovante de pagamento</label>
                    <div className="flex items-center gap-2">
                      <Input type="file" accept="image/*,application/pdf" className="h-9 text-xs" onChange={(e) => { const f = e.target.files?.[0]; if (f) enviarArquivo("comprovante_path", f); }} disabled={uploadArquivo.isPending} />
                      {editing.comprovante_path && <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" title="Ver comprovante" onClick={() => abrirArquivoFinanceiro(editing.comprovante_path!)}><Paperclip className="h-4 w-4 text-primary" /></Button>}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Boleto</label>
                    <div className="flex items-center gap-2">
                      <Input type="file" accept="image/*,application/pdf" className="h-9 text-xs" onChange={(e) => { const f = e.target.files?.[0]; if (f) enviarArquivo("boleto_path", f); }} disabled={uploadArquivo.isPending} />
                      {editing.boleto_path && <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" title="Ver boleto" onClick={() => abrirArquivoFinanceiro(editing.boleto_path!)}><FileText className="h-4 w-4" /></Button>}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={create.isPending || update.isPending}>
                {editing ? "Salvar" : "Lançar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Conciliação de boletos pagos (relatório do banco) */}
      <Dialog open={concOpen} onOpenChange={setConcOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Conciliar boletos pagos (relatório do banco)</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Envie o relatório de consulta de boletos do banco (.xlsx/.csv). O app casa pelo CPF/CNPJ e nome do pagador com o locatário do contrato e propõe a baixa dos aluguéis em aberto pelo vencimento.</p>
            <Input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) onConcFile(f); }} />
            {concProcessando && <p className="text-sm text-muted-foreground">Processando {concArquivo}...</p>}
            {concItens && (
              <>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="success">{concResumo.match} a baixar</Badge>
                  <Badge variant="muted">{concResumo.ja_baixado} já baixados</Badge>
                  <Badge variant="warning">{concResumo.sem_lancamento} sem boleto em aberto</Badge>
                  <Badge variant="destructive">{concResumo.sem_contrato} sem contrato</Badge>
                </div>
                <div className="max-h-80 overflow-auto rounded-lg border">
                  <Table className="text-xs [&_th]:h-9 [&_th]:px-2 [&_td]:px-2 [&_td]:py-1.5">
                    <TableHeader><TableRow>
                      <TableHead>Pagador</TableHead><TableHead>CPF/CNPJ</TableHead><TableHead>Contrato</TableHead>
                      <TableHead>Vencimento</TableHead><TableHead className="text-right">Valor pago</TableHead><TableHead>Situação</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {concItens.map((i, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="max-w-[160px] truncate" title={i.boleto.pagador}>{i.boleto.pagador}</TableCell>
                          <TableCell className="whitespace-nowrap font-mono">{i.boleto.cpfCnpj || "—"}</TableCell>
                          <TableCell className="whitespace-nowrap">{i.contrato ? `${i.contrato.placa ? maskPlaca(i.contrato.placa) + " · " : ""}${i.contrato.cliente_nome}` : "—"}</TableCell>
                          <TableCell className="whitespace-nowrap">{i.boleto.vencimento ? formatDate(i.boleto.vencimento) : "—"}</TableCell>
                          <TableCell className="whitespace-nowrap text-right tabular-nums">{formatCurrency(i.boleto.valorPago)}</TableCell>
                          <TableCell><Badge variant={CONC_LABEL[i.status].variant} className="px-1.5 py-0 text-[10px]">{CONC_LABEL[i.status].label}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConcOpen(false)}>Fechar</Button>
            <Button type="button" onClick={aplicarConciliacao} disabled={!concItens || concResumo.match === 0 || aplicarBaixa.isPending}>
              <CheckCircle2 className="h-4 w-4" /> Dar baixa em {concResumo.match} boleto(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
