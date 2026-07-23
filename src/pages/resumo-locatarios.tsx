import { useMemo, useState } from "react";
import {
  Users, Wallet, AlertTriangle, ShieldCheck, TrendingDown, FileText, Plus, Trash2, RotateCcw, Search, Undo2,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Field } from "@/components/shared/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatCurrency, formatDate } from "@/lib/format";
import { useCanWrite } from "@/hooks/use-can-write";
import { useLocatarios } from "@/hooks/use-locatarios";
import { useContratos } from "@/hooks/use-contratos";
import { useAppConfig } from "@/hooks/use-app-config";
import {
  useDebitos, useCaucoes, useSaveDebito, useDeleteDebito, useSaveCaucao, useDeleteCaucao, useDevolverCaucao,
} from "@/hooks/use-financeiro-locatario";
import type { DebitoCategoria, Locatario } from "@/types/database";
import { useSort } from "@/hooks/use-sort";
import { SortableHead } from "@/components/shared/sortable-head";
import { RelatorioExport } from "@/components/shared/relatorio-export";
import type { RelatorioTabelaData, RelColuna } from "@/lib/relatorio-tabela";

const CAT: { value: DebitoCategoria; label: string }[] = [
  { value: "locacao", label: "Locação" }, { value: "multa", label: "Multa" }, { value: "juros", label: "Juros" },
  { value: "avaria", label: "Avaria" }, { value: "km_excedente", label: "KM excedente" }, { value: "outros", label: "Outros" },
];
const catLabel = (c: string) => CAT.find((x) => x.value === c)?.label ?? c;
const pct = (n: number) => `${Math.round(n * 100)}%`;
const addDias = (iso: string, dias: number) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + dias); return d.toISOString().slice(0, 10); };

export default function ResumoLocatariosPage() {
  const { data: locatarios = [] } = useLocatarios();
  const { data: contratos = [] } = useContratos();
  const { data: debitos = [] } = useDebitos();
  const { data: caucoes = [] } = useCaucoes();
  const { data: config } = useAppConfig();
  const canWrite = useCanWrite("financeiro_locatario");
  const saveDeb = useSaveDebito(); const delDeb = useDeleteDebito();
  const saveCau = useSaveCaucao(); const delCau = useDeleteCaucao(); const devolver = useDevolverCaucao();

  const prazoDev = Number(config?.caucao_devolucao_dias ?? 60) || 60;
  const [search, setSearch] = useState("");
  const [fRisco, setFRisco] = useState("todos");
  const [sel, setSel] = useState<Locatario | null>(null);
  const [tab, setTab] = useState("resumo");
  const [formDeb, setFormDeb] = useState<Record<string, string>>({});
  const [formCau, setFormCau] = useState<Record<string, string>>({});

  // ---- Agregações por locatário ----
  const porLoc = useMemo(() => {
    const m = new Map<string, {
      contratos: typeof contratos; placas: Set<string>;
      cat: Record<string, number>; debAberto: number; caucao: number; caucaoDevolvido: number;
    }>();
    const get = (id: string) => {
      let x = m.get(id);
      if (!x) { x = { contratos: [], placas: new Set(), cat: {}, debAberto: 0, caucao: 0, caucaoDevolvido: 0 }; m.set(id, x); }
      return x;
    };
    for (const c of contratos) if (c.locatario_id) { const x = get(c.locatario_id); x.contratos.push(c); const p = c.vehicles?.placa ?? c.placa; if (p) x.placas.add(p); }
    for (const d of debitos) { const x = get(d.locatario_id); if (!d.pago) { x.debAberto += Number(d.valor); x.cat[d.categoria] = (x.cat[d.categoria] ?? 0) + Number(d.valor); } }
    for (const c of caucoes) { const x = get(c.locatario_id); if (c.devolvido) x.caucaoDevolvido += Number(c.valor_devolvido ?? c.valor); else x.caucao += Number(c.valor); }
    return m;
  }, [contratos, debitos, caucoes]);

  const linhas = useMemo(() => locatarios.map((l) => {
    const a = porLoc.get(l.id);
    const caucao = a?.caucao ?? 0, debAberto = a?.debAberto ?? 0;
    const saldo = caucao - debAberto;
    const risco = caucao > 0 ? debAberto / caucao : debAberto > 0 ? 1 : 0;
    return { l, caucao, debAberto, saldo, risco, cat: a?.cat ?? {}, contratos: a?.contratos ?? [], placas: a?.placas ?? new Set<string>() };
  }), [locatarios, porLoc]);

  const filtradas = useMemo(() => {
    const q = search.toLowerCase();
    return linhas.filter((r) => {
      const mQ = !q || r.l.nome.toLowerCase().includes(q) || (r.l.cpf ?? "").includes(q);
      const mR = fRisco === "todos" ? true : fRisco === "critico" ? r.risco >= 0.5 : fRisco === "comdebito" ? r.debAberto > 0 : r.debAberto === 0;
      return mQ && mR;
    }).sort((a, b) => b.risco - a.risco || b.debAberto - a.debAberto);
  }, [linhas, search, fRisco]);

  const { sortKey, sortDir, toggle, useSorted } = useSort<(typeof linhas)[number]>("risco", "desc");
  const ordenadas = useSorted(filtradas, (r, k) => {
    switch (k) {
      case "locatario": return r.l.nome;
      case "contratos": return r.contratos.length;
      case "debito": return r.debAberto;
      case "caucao": return r.caucao;
      case "saldo": return r.saldo;
      case "risco": return r.risco;
      default: return null;
    }
  });

  const kpi = useMemo(() => {
    let debTot = 0, caucaoTot = 0, criticos = 0, comDebito = 0;
    for (const r of linhas) { debTot += r.debAberto; caucaoTot += r.caucao; if (r.risco >= 0.5) criticos++; if (r.debAberto > 0) comDebito++; }
    return { debTot, caucaoTot, saldoTot: caucaoTot - debTot, criticos, comDebito };
  }, [linhas]);

  // ---- Devoluções de caução (contratos encerrados) ----
  const devolucoes = useMemo(() => {
    const contratoById = new Map(contratos.map((c) => [c.id, c]));
    const ativoPorLoc = new Set(contratos.filter((c) => c.status === "ativo").map((c) => c.locatario_id));
    return caucoes.filter((c) => !c.devolvido).map((c) => {
      const ct = c.contrato_id ? contratoById.get(c.contrato_id) : undefined;
      const encerrado = ct ? ct.status !== "ativo" : !ativoPorLoc.has(c.locatario_id);
      const termino = ct?.devolucao_prevista ?? c.data ?? null;
      const r = linhas.find((x) => x.l.id === c.locatario_id);
      const saldo = Math.max(0, Number(c.valor) - (r?.debAberto ?? 0));
      return { c, loc: r?.l, encerrado, termino, prevista: termino ? addDias(termino, prazoDev) : null, saldo, debAberto: r?.debAberto ?? 0 };
    }).filter((d) => d.encerrado).sort((a, b) => (a.prevista ?? "").localeCompare(b.prevista ?? ""));
  }, [caucoes, contratos, linhas, prazoDev]);

  function abrir(l: Locatario) { setSel(l); setFormDeb({ categoria: "multa", pago: "nao" }); setFormCau({}); }
  function addDebito() {
    if (!sel) return;
    saveDeb.mutate({ locatario_id: sel.id, categoria: (formDeb.categoria as DebitoCategoria) || "outros", descricao: formDeb.descricao || null, valor: Number((formDeb.valor || "0").replace(",", ".")) || 0, competencia: formDeb.competencia || null, placa: formDeb.placa || null, pago: formDeb.pago === "sim" }, { onSuccess: () => setFormDeb({ categoria: "multa", pago: "nao" }) });
  }
  function addCaucao() {
    if (!sel) return;
    saveCau.mutate({ locatario_id: sel.id, valor: Number((formCau.valor || "0").replace(",", ".")) || 0, data: formCau.data || null, metodo: formCau.metodo || null, observacao: formCau.observacao || null }, { onSuccess: () => setFormCau({}) });
  }

  const detalhe = sel ? linhas.find((r) => r.l.id === sel.id) : null;
  const debSel = sel ? debitos.filter((d) => d.locatario_id === sel.id) : [];
  const cauSel = sel ? caucoes.filter((c) => c.locatario_id === sel.id) : [];

  function buildRelatorio(): RelatorioTabelaData {
    const colunas: RelColuna[] = [
      { label: "Locatário" }, { label: "CPF" }, { label: "Locação", align: "right" }, { label: "Multa", align: "right" },
      { label: "Juros", align: "right" }, { label: "Avaria", align: "right" }, { label: "KM exc.", align: "right" },
      { label: "Débito aberto", align: "right" }, { label: "Caução", align: "right" }, { label: "Saldo", align: "right" }, { label: "Risco", align: "right" },
    ];
    const linhas = ordenadas.map((r) => [
      r.l.nome, r.l.cpf ?? "—",
      formatCurrency(r.cat.locacao ?? 0), formatCurrency(r.cat.multa ?? 0), formatCurrency(r.cat.juros ?? 0),
      formatCurrency(r.cat.avaria ?? 0), formatCurrency(r.cat.km_excedente ?? 0),
      formatCurrency(r.debAberto), formatCurrency(r.caucao), formatCurrency(r.saldo), pct(r.risco),
    ]);
    const tD = ordenadas.reduce((s, r) => s + r.debAberto, 0), tC = ordenadas.reduce((s, r) => s + r.caucao, 0);
    return {
      empresa: config?.empresa_nome, titulo: "Resumo financeiro por locatário", subtitulo: `${ordenadas.length} locatário(s)`,
      filtros: [{ label: "Busca", valor: search }, { label: "Risco", valor: fRisco === "todos" ? "Todos" : fRisco }],
      colunas, linhas, rodape: ["Total", "", "", "", "", "", "", formatCurrency(tD), formatCurrency(tC), formatCurrency(tC - tD), ""],
    };
  }

  const riscoBadge = (risco: number, debAberto: number) => {
    if (debAberto === 0) return <Badge variant="success">{pct(risco)}</Badge>;
    if (risco >= 0.5) return <Badge variant="outline" className="border-destructive font-semibold text-destructive">{pct(risco)} crítico</Badge>;
    return <Badge variant="outline" className="border-warning text-warning">{pct(risco)}</Badge>;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Resumo por Locatário"
        description="Débitos, cauções e risco por locatário — histórico de contratos e veículos"
        actions={<RelatorioExport build={buildRelatorio} nomeArquivo="resumo-locatarios" disabled={!ordenadas.length} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard title="Débito em aberto (total)" value={formatCurrency(kpi.debTot)} hint={`${kpi.comDebito} locatário(s) com débito`} tone={kpi.debTot > 0 ? "warning" : "default"} icon={<TrendingDown className="h-5 w-5" />} />
        <StatCard title="Caução em custódia" value={formatCurrency(kpi.caucaoTot)} icon={<Wallet className="h-5 w-5" />} />
        <StatCard title="Saldo líquido de caução" value={formatCurrency(kpi.saldoTot)} tone={kpi.saldoTot >= 0 ? "success" : "destructive"} icon={<ShieldCheck className="h-5 w-5" />} />
        <StatCard title="Risco crítico (≥50%)" value={kpi.criticos} hint="caução comprometido por débitos" tone={kpi.criticos > 0 ? "destructive" : "default"} icon={<AlertTriangle className="h-5 w-5" />} />
        <StatCard title="Locatários" value={locatarios.length} icon={<Users className="h-5 w-5" />} />
        <StatCard title="Devoluções pendentes" value={devolucoes.length} hint={`caução a devolver após ${prazoDev} dias`} icon={<Undo2 className="h-5 w-5" />} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="devolucao">Devolução de caução ({devolucoes.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="resumo" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <div className="flex flex-col gap-2 border-b p-3 sm:flex-row sm:items-center sm:p-4">
                <div className="flex flex-1 items-center gap-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Buscar por nome ou CPF..." value={search} onChange={(e) => setSearch(e.target.value)} className="border-0 focus-visible:ring-0" />
                </div>
                <Select value={fRisco} onValueChange={setFRisco}>
                  <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="comdebito">Com débito</SelectItem>
                    <SelectItem value="critico">Risco crítico</SelectItem>
                    <SelectItem value="semdebito">Sem débito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableHead sortKey="locatario" activeKey={sortKey} dir={sortDir} onSort={toggle}>Locatário</SortableHead>
                      <SortableHead sortKey="contratos" activeKey={sortKey} dir={sortDir} onSort={toggle} align="right">Contratos</SortableHead>
                      <SortableHead sortKey="debito" activeKey={sortKey} dir={sortDir} onSort={toggle} align="right">Débito aberto</SortableHead>
                      <SortableHead sortKey="caucao" activeKey={sortKey} dir={sortDir} onSort={toggle} align="right">Caução</SortableHead>
                      <SortableHead sortKey="saldo" activeKey={sortKey} dir={sortDir} onSort={toggle} align="right">Saldo</SortableHead>
                      <SortableHead sortKey="risco" activeKey={sortKey} dir={sortDir} onSort={toggle} align="right">Risco</SortableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ordenadas.slice(0, 500).map((r) => (
                      <TableRow key={r.l.id} className="cursor-pointer" onClick={() => abrir(r.l)}>
                        <TableCell><span className="font-medium">{r.l.nome}</span> <span className="text-xs text-muted-foreground">{r.l.cpf ?? ""}</span></TableCell>
                        <TableCell className="text-right">{r.contratos.length}</TableCell>
                        <TableCell className={`text-right ${r.debAberto > 0 ? "font-semibold text-warning" : "text-muted-foreground"}`}>{formatCurrency(r.debAberto)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(r.caucao)}</TableCell>
                        <TableCell className={`text-right font-semibold ${r.saldo >= 0 ? "" : "text-destructive"}`}>{formatCurrency(r.saldo)}</TableCell>
                        <TableCell className="text-right">{riscoBadge(r.risco, r.debAberto)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {filtradas.length === 0 && <EmptyState message="Nenhum locatário" icon={<Users className="h-6 w-6" />} />}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="devolucao" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              {devolucoes.length === 0 ? <EmptyState message="Nenhuma devolução de caução pendente" icon={<Undo2 className="h-6 w-6" />} /> : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Locatário</TableHead>
                        <TableHead>Encerramento</TableHead>
                        <TableHead>Devolver até</TableHead>
                        <TableHead className="text-right">Caução</TableHead>
                        <TableHead className="text-right">Débito</TableHead>
                        <TableHead className="text-right">Saldo a devolver</TableHead>
                        {canWrite && <TableHead></TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {devolucoes.map((d) => (
                        <TableRow key={d.c.id}>
                          <TableCell className="font-medium">{d.loc?.nome ?? "—"}</TableCell>
                          <TableCell className="text-sm">{d.termino ? formatDate(d.termino) : "—"}</TableCell>
                          <TableCell className="text-sm font-medium">{d.prevista ? formatDate(d.prevista) : "—"}</TableCell>
                          <TableCell className="text-right">{formatCurrency(Number(d.c.valor))}</TableCell>
                          <TableCell className="text-right text-warning">{formatCurrency(d.debAberto)}</TableCell>
                          <TableCell className="text-right font-semibold text-success">{formatCurrency(d.saldo)}</TableCell>
                          {canWrite && <TableCell><Button size="sm" variant="outline" onClick={() => confirm(`Registrar devolução de ${formatCurrency(d.saldo)}?`) && devolver.mutate({ id: d.c.id, valor: d.saldo })}>Devolver</Button></TableCell>}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Detalhe do locatário */}
      <Dialog open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>{sel?.nome}</DialogTitle></DialogHeader>
          {detalhe && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard title="Débito aberto" value={formatCurrency(detalhe.debAberto)} tone={detalhe.debAberto > 0 ? "warning" : "default"} />
                <StatCard title="Caução" value={formatCurrency(detalhe.caucao)} />
                <StatCard title="Saldo" value={formatCurrency(detalhe.saldo)} tone={detalhe.saldo >= 0 ? "success" : "destructive"} />
                <StatCard title="Risco" value={pct(detalhe.risco)} tone={detalhe.risco >= 0.5 ? "destructive" : "default"} />
              </div>

              <section>
                <h4 className="mb-2 text-sm font-semibold">Débitos por categoria</h4>
                <div className="flex flex-wrap gap-2">
                  {CAT.map((c) => <Badge key={c.value} variant="secondary">{c.label}: {formatCurrency(detalhe.cat[c.value] ?? 0)}</Badge>)}
                </div>
              </section>

              <section>
                <h4 className="mb-2 text-sm font-semibold">Histórico de contratos e veículos ({detalhe.contratos.length})</h4>
                <div className="max-h-52 overflow-auto rounded-lg border">
                  <Table>
                    <TableHeader><TableRow><TableHead>Contrato</TableHead><TableHead>Veículo</TableHead><TableHead>Início</TableHead><TableHead>Término</TableHead><TableHead>Situação</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {detalhe.contratos.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-mono text-xs">{c.numero}</TableCell>
                          <TableCell className="font-mono text-xs">{c.vehicles?.placa ?? c.placa ?? "—"}</TableCell>
                          <TableCell className="text-xs">{c.data_entrega ? formatDate(c.data_entrega) : "—"}</TableCell>
                          <TableCell className="text-xs">{c.devolucao_prevista ? formatDate(c.devolucao_prevista) : "—"}</TableCell>
                          <TableCell><Badge variant={c.status === "ativo" ? "success" : "muted"}>{c.status}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </section>

              <section>
                <h4 className="mb-2 text-sm font-semibold">Lançamentos de débito</h4>
                {canWrite && (
                  <div className="mb-2 grid gap-2 rounded-lg border p-2 sm:grid-cols-6">
                    <Select value={formDeb.categoria ?? "multa"} onValueChange={(v) => setFormDeb((f) => ({ ...f, categoria: v }))}>
                      <SelectTrigger className="sm:col-span-2"><SelectValue /></SelectTrigger>
                      <SelectContent>{CAT.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input placeholder="Valor" value={formDeb.valor ?? ""} onChange={(e) => setFormDeb((f) => ({ ...f, valor: e.target.value }))} />
                    <Input placeholder="Descrição" className="sm:col-span-2" value={formDeb.descricao ?? ""} onChange={(e) => setFormDeb((f) => ({ ...f, descricao: e.target.value }))} />
                    <Button size="sm" onClick={addDebito} disabled={saveDeb.isPending}><Plus className="h-4 w-4" /> Add</Button>
                  </div>
                )}
                <div className="max-h-52 overflow-auto rounded-lg border">
                  <Table>
                    <TableHeader><TableRow><TableHead>Categoria</TableHead><TableHead>Descrição</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Pago</TableHead>{canWrite && <TableHead></TableHead>}</TableRow></TableHeader>
                    <TableBody>
                      {debSel.map((d) => (
                        <TableRow key={d.id}>
                          <TableCell><Badge variant="outline">{catLabel(d.categoria)}</Badge></TableCell>
                          <TableCell className="text-xs">{d.descricao ?? "—"}</TableCell>
                          <TableCell className="text-right">{formatCurrency(Number(d.valor))}</TableCell>
                          <TableCell>{d.pago ? <Badge variant="success">pago</Badge> : <Badge variant="outline" className="border-warning text-warning">aberto</Badge>}</TableCell>
                          {canWrite && <TableCell className="text-right"><div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" title={d.pago ? "Reabrir" : "Marcar pago"} onClick={() => saveDeb.mutate({ id: d.id, pago: !d.pago, pago_em: !d.pago ? new Date().toISOString().slice(0, 10) : null })}><RotateCcw className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => delDeb.mutate(d.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </div></TableCell>}
                        </TableRow>
                      ))}
                      {debSel.length === 0 && <TableRow><TableCell colSpan={canWrite ? 5 : 4} className="text-center text-sm text-muted-foreground">Sem débitos</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </div>
              </section>

              <section>
                <h4 className="mb-2 text-sm font-semibold">Cauções</h4>
                {canWrite && (
                  <div className="mb-2 grid gap-2 rounded-lg border p-2 sm:grid-cols-6">
                    <Input placeholder="Valor" value={formCau.valor ?? ""} onChange={(e) => setFormCau((f) => ({ ...f, valor: e.target.value }))} />
                    <Input type="date" value={formCau.data ?? ""} onChange={(e) => setFormCau((f) => ({ ...f, data: e.target.value }))} className="sm:col-span-2" />
                    <Input placeholder="Método (PIX...)" value={formCau.metodo ?? ""} onChange={(e) => setFormCau((f) => ({ ...f, metodo: e.target.value }))} className="sm:col-span-2" />
                    <Button size="sm" onClick={addCaucao} disabled={saveCau.isPending}><Plus className="h-4 w-4" /> Add</Button>
                  </div>
                )}
                <div className="max-h-40 overflow-auto rounded-lg border">
                  <Table>
                    <TableHeader><TableRow><TableHead className="text-right">Valor</TableHead><TableHead>Data</TableHead><TableHead>Método</TableHead><TableHead>Devolvido</TableHead>{canWrite && <TableHead></TableHead>}</TableRow></TableHeader>
                    <TableBody>
                      {cauSel.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="text-right font-medium">{formatCurrency(Number(c.valor))}</TableCell>
                          <TableCell className="text-xs">{c.data ? formatDate(c.data) : "—"}</TableCell>
                          <TableCell className="text-xs">{c.metodo ?? "—"}</TableCell>
                          <TableCell>{c.devolvido ? <Badge variant="muted">devolvido {c.devolvido_em ? formatDate(c.devolvido_em) : ""}</Badge> : "—"}</TableCell>
                          {canWrite && <TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => delCau.mutate(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>}
                        </TableRow>
                      ))}
                      {cauSel.length === 0 && <TableRow><TableCell colSpan={canWrite ? 5 : 4} className="text-center text-sm text-muted-foreground">Sem caução</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </div>
              </section>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setSel(null)}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
