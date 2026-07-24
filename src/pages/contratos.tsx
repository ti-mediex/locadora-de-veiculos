import { useMemo, useState } from "react";
import { Plus, Trash2, FileText, RefreshCw, FileSignature, XCircle, Pencil } from "lucide-react";
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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useList } from "@/hooks/use-crud";
import { useCanWrite } from "@/hooks/use-can-write";
import { useAppConfig } from "@/hooks/use-app-config";
import { useLocatarios, useSaveLocatario, acharPorCpf } from "@/hooks/use-locatarios";
import { useLocatarioPorVeiculo } from "@/hooks/use-contratos";
import {
  useContratos, useCreateContrato, useUpdateContrato, useRenovarContrato, useDeleteContrato, type ContratoRow,
} from "@/hooks/use-contratos";
import { gerarContratoHtml } from "@/lib/contrato-doc";
import { formatCurrency, formatDate, soAlfa } from "@/lib/format";
import type { Vehicle } from "@/types/database";
import { useSort } from "@/hooks/use-sort";
import { SortableHead } from "@/components/shared/sortable-head";
import { BuscaPlaca } from "@/components/shared/busca-placa";
import { SelectVeiculo } from "@/components/shared/select-veiculo";
import { RelatorioExport } from "@/components/shared/relatorio-export";
import { VehicleStatusBadge, statusVeiculoLabel } from "@/components/shared/vehicle-status-badge";
import type { RelatorioTabelaData, RelColuna } from "@/lib/relatorio-tabela";

const STATUS_BADGE: Record<string, "success" | "muted" | "warning" | "destructive"> = {
  ativo: "success", encerrado: "muted", renovado: "warning", cancelado: "destructive",
};
const hojeStr = () => new Date().toISOString().slice(0, 10);
type Form = Record<string, string>;

export default function ContratosPage() {
  const { data: rows = [], isLoading } = useContratos();
  const { data: vehicles = [] } = useList<Vehicle>("vehicles");
  const { data: locatarios = [] } = useLocatarios();
  const locatarioMap = useLocatarioPorVeiculo();
  const { data: config } = useAppConfig();
  const saveLoc = useSaveLocatario();
  const create = useCreateContrato();
  const update = useUpdateContrato();
  const renovar = useRenovarContrato();
  const remove = useDeleteContrato();
  const canWrite = useCanWrite("contratos");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ContratoRow | null>(null);
  const [search, setSearch] = useState("");
  const [fStatus, setFStatus] = useState("todos");
  const [form, setForm] = useState<Form>({});
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const empresa = {
    nome: config?.empresa_nome ?? "VIP CARS",
    cnpj: config?.empresa_cnpj ?? "",
    endereco: config?.empresa_endereco ?? "",
  };

  function abrirNovo() {
    setEditing(null);
    setForm({
      data_entrega: hojeStr(), local_entrega: empresa.nome, local_devolucao: empresa.nome,
      semanas: "1", atendente: "",
    });
    setOpen(true);
  }

  function abrirEditar(c: ContratoRow) {
    setEditing(c);
    const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));
    setForm({
      vehicle_id: s(c.vehicle_id), placa: s(c.placa), locatario_id: s(c.locatario_id),
      cliente_nome: s(c.cliente_nome === "—" ? "" : c.cliente_nome), cliente_cpf: s(c.cliente_cpf), cliente_cnh: s(c.cliente_cnh),
      cliente_cnh_cat: s(c.cliente_cnh_cat), cliente_email: s(c.cliente_email), cliente_telefone: s(c.cliente_telefone),
      cliente_endereco: s(c.cliente_endereco), atendente: s(c.atendente), local_entrega: s(c.local_entrega),
      data_entrega: s(c.data_entrega), hora_entrega: s(c.hora_entrega), local_devolucao: s(c.local_devolucao),
      devolucao_prevista: s(c.devolucao_prevista), grupo: s(c.grupo), km_entrega: s(c.km_entrega),
      valor_locacao: s(c.valor_locacao), semanas: s(c.semanas), pre_autorizacao: s(c.pre_autorizacao),
      informacoes_adicionais: s(c.informacoes_adicionais), status: s(c.status),
    });
    setOpen(true);
  }

  function selVeiculo(id: string) {
    const v = vehicles.find((x) => x.id === id);
    setForm((f) => ({ ...f, vehicle_id: id, placa: v?.placa ?? "", grupo: v?.categoria ?? f.grupo ?? "", km_entrega: v ? String(v.km_atual) : f.km_entrega ?? "" }));
  }

  // Preenche automaticamente os dados do cliente a partir do cadastro de locatários.
  function selLocatario(id: string) {
    if (id === "novo") { setForm((f) => ({ ...f, locatario_id: "" })); return; }
    const l = locatarios.find((x) => x.id === id);
    if (!l) return;
    setForm((f) => ({
      ...f, locatario_id: l.id,
      cliente_nome: l.nome ?? "", cliente_cpf: l.cpf ?? "", cliente_cnh: l.cnh ?? "",
      cliente_cnh_cat: l.categoria_cnh ?? "", cliente_email: l.email ?? "", cliente_telefone: l.telefone ?? "",
      cliente_endereco: [l.endereco, l.numero, l.bairro, l.cidade, l.estado].filter(Boolean).join(", "),
    }));
  }

  const totalCalc = (() => {
    const vl = parseFloat((form.valor_locacao ?? "").replace(",", ".")) || 0;
    const sem = parseInt(form.semanas ?? "0", 10) || 0;
    return vl * sem;
  })();

  async function salvar() {
    const num = (s?: string) => (s && s !== "" ? Number(s.replace(",", ".")) : null);
    const int = (s?: string) => (s && s !== "" ? parseInt(s, 10) : null);

    // Vincula (e, se novo, cadastra) o locatário — mantém o cadastro sempre populado.
    let locatarioId = form.locatario_id || null;
    if (!locatarioId && form.cliente_nome && form.cliente_nome !== "—") {
      try {
        const existente = acharPorCpf(locatarios, form.cliente_cpf);
        if (existente) locatarioId = existente.id;
        else {
          const r = await saveLoc.mutateAsync({
            nome: form.cliente_nome, cpf: form.cliente_cpf || null, cnh: form.cliente_cnh || null,
            categoria_cnh: form.cliente_cnh_cat || null, email: form.cliente_email || null,
            telefone: form.cliente_telefone || null, endereco: form.cliente_endereco || null, status: "ativo",
          });
          locatarioId = r.id;
        }
      } catch { /* não bloqueia a criação do contrato */ }
    }

    const payload = {
      vehicle_id: form.vehicle_id || null, placa: form.placa || null, locatario_id: locatarioId,
      cliente_nome: form.cliente_nome || "—", cliente_cpf: form.cliente_cpf || null, cliente_cnh: form.cliente_cnh || null,
      cliente_cnh_cat: form.cliente_cnh_cat || null, cliente_email: form.cliente_email || null,
      cliente_telefone: form.cliente_telefone || null, cliente_endereco: form.cliente_endereco || null,
      atendente: form.atendente || null, local_entrega: form.local_entrega || null, data_entrega: form.data_entrega || null,
      hora_entrega: form.hora_entrega || null, local_devolucao: form.local_devolucao || null, devolucao_prevista: form.devolucao_prevista || null,
      grupo: form.grupo || null, km_entrega: int(form.km_entrega), valor_locacao: num(form.valor_locacao),
      semanas: int(form.semanas), valor_total: totalCalc || null, pre_autorizacao: num(form.pre_autorizacao),
      informacoes_adicionais: form.informacoes_adicionais || null,
    };
    if (editing) {
      const novoStatus = form.status as ContratoRow["status"] | undefined;
      const encerrou = novoStatus && novoStatus !== "ativo" && editing.status === "ativo";
      const patch = novoStatus
        ? { ...payload, status: novoStatus, ...(encerrou ? { data_encerramento: new Date().toISOString().slice(0, 10) } : {}) }
        : payload;
      update.mutate({ id: editing.id, ...patch }, { onSuccess: () => setOpen(false) });
    } else {
      create.mutate(payload, { onSuccess: () => setOpen(false) });
    }
  }

  function emitir(c: ContratoRow) {
    const html = gerarContratoHtml(c, empresa);
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.document.title = `Contrato ${c.numero}`; setTimeout(() => w.print(), 500); }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((r) => {
      const mS = fStatus === "todos" || r.status === fStatus;
      const qa = soAlfa(search);
      const placa = r.vehicles?.placa ?? r.placa ?? "";
      const mQ = !q || r.numero.toLowerCase().includes(q) || r.cliente_nome.toLowerCase().includes(q) ||
        placa.toLowerCase().includes(q) || (qa !== "" && soAlfa(placa).includes(qa));
      return mS && mQ;
    });
  }, [rows, search, fStatus]);

  const { sortKey, sortDir, toggle, useSorted } = useSort<ContratoRow>("numero", "asc");
  const sorted = useSorted(filtered, (c, k) => {
    switch (k) {
      case "numero": return c.numero;
      case "cliente": return c.cliente_nome;
      case "veiculo": return c.vehicles?.placa ?? c.placa;
      case "statusv": return vehicles.find((v) => v.id === c.vehicle_id)?.status ?? "";
      case "locatario": return c.vehicle_id ? locatarioMap.get(c.vehicle_id) ?? "" : "";
      case "entrega": return c.data_entrega;
      case "semanal": return c.valor_locacao;
      case "status": return c.status;
      default: return null;
    }
  });

  function buildRelatorio(): RelatorioTabelaData {
    const colunas: RelColuna[] = [
      { label: "Nº" }, { label: "Cliente" }, { label: "Veículo" }, { label: "Status veículo" }, { label: "Locatário" }, { label: "Entrega" }, { label: "Semanal", align: "right" }, { label: "Status" },
    ];
    const linhas = sorted.map((c) => [
      c.numero, c.cliente_nome, c.vehicles?.placa ?? c.placa ?? "—",
      statusVeiculoLabel(vehicles.find((v) => v.id === c.vehicle_id)?.status),
      (c.vehicle_id && locatarioMap.get(c.vehicle_id)) || "—",
      c.data_entrega ? formatDate(c.data_entrega) : "—", formatCurrency(c.valor_locacao), c.status,
    ]);
    const total = sorted.reduce((s, c) => s + (c.valor_locacao ?? 0), 0);
    return {
      titulo: "Contratos de locação", subtitulo: `${sorted.length} contrato(s)`,
      filtros: [{ label: "Busca", valor: search }, { label: "Status", valor: fStatus === "todos" ? "Todos" : fStatus }],
      colunas, linhas, rodape: ["", "", "", "", "", "Total semanal", formatCurrency(total), ""],
    };
  }

  const ativos = rows.filter((r) => r.status === "ativo").length;
  const receitaAtiva = rows.filter((r) => r.status === "ativo").reduce((s, r) => s + (r.valor_locacao ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contratos"
        description="Emissão de contratos de locação por locatário — novos e renovações"
        actions={
          <div className="flex flex-wrap gap-2">
            <RelatorioExport build={buildRelatorio} nomeArquivo="contratos" disabled={!sorted.length} />
            {canWrite && <Button onClick={abrirNovo}><Plus className="h-4 w-4" /> Novo contrato</Button>}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Total de contratos" value={rows.length} icon={<FileSignature className="h-5 w-5" />} />
        <StatCard title="Contratos ativos" value={ativos} tone="success" icon={<FileText className="h-5 w-5" />} />
        <StatCard title="Locação semanal (ativos)" value={formatCurrency(receitaAtiva)} icon={<FileText className="h-5 w-5" />} />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flex flex-col gap-2 border-b p-3 sm:flex-row sm:items-center sm:p-4">
            <BuscaPlaca
              value={search}
              onChange={setSearch}
              vehicles={vehicles}
              placeholder="Buscar por placa (ex.: 8451), nº do contrato ou cliente..."
            />
            <Select value={fStatus} onValueChange={setFStatus}>
              <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="ativo">Ativos</SelectItem>
                <SelectItem value="renovado">Renovados</SelectItem>
                <SelectItem value="encerrado">Encerrados</SelectItem>
                <SelectItem value="cancelado">Cancelados</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <EmptyState message="Nenhum contrato" icon={<FileSignature className="h-6 w-6" />} />
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead sortKey="numero" activeKey={sortKey} dir={sortDir} onSort={toggle}>Nº</SortableHead>
                  <SortableHead sortKey="cliente" activeKey={sortKey} dir={sortDir} onSort={toggle}>Cliente</SortableHead>
                  <SortableHead sortKey="veiculo" activeKey={sortKey} dir={sortDir} onSort={toggle}>Veículo</SortableHead>
                  <SortableHead sortKey="statusv" activeKey={sortKey} dir={sortDir} onSort={toggle}>Status veículo</SortableHead>
                  <SortableHead sortKey="locatario" activeKey={sortKey} dir={sortDir} onSort={toggle}>Locatário</SortableHead>
                  <SortableHead sortKey="entrega" activeKey={sortKey} dir={sortDir} onSort={toggle}>Entrega</SortableHead>
                  <SortableHead sortKey="semanal" activeKey={sortKey} dir={sortDir} onSort={toggle} align="right">Semanal</SortableHead>
                  <SortableHead sortKey="status" activeKey={sortKey} dir={sortDir} onSort={toggle}>Status</SortableHead>
                  {canWrite && <TableHead className="w-32"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((c) => (
                  <TableRow key={c.id} className={canWrite ? "cursor-pointer" : undefined} onClick={canWrite ? () => abrirEditar(c) : undefined}>
                    <TableCell className="font-mono font-medium">{c.numero}</TableCell>
                    <TableCell>{c.cliente_nome}</TableCell>
                    <TableCell className="font-mono">{c.vehicles?.placa ?? c.placa ?? "—"}</TableCell>
                    <TableCell><VehicleStatusBadge status={vehicles.find((v) => v.id === c.vehicle_id)?.status} /></TableCell>
                    <TableCell className="text-sm">{(c.vehicle_id && locatarioMap.get(c.vehicle_id)) || <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{c.data_entrega ? formatDate(c.data_entrega) : "—"}</TableCell>
                    <TableCell className="text-right">{formatCurrency(c.valor_locacao)}</TableCell>
                    <TableCell><Badge variant={STATUS_BADGE[c.status]}>{c.status}</Badge></TableCell>
                    {canWrite && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" title="Editar" aria-label={`Editar contrato ${c.numero}`} onClick={() => abrirEditar(c)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" title="Emitir/imprimir" aria-label="Emitir contrato" onClick={() => emitir(c)}><FileText className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" title="Renovar" aria-label="Renovar contrato" onClick={() => confirm(`Renovar o contrato ${c.numero}?`) && renovar.mutate(c)}><RefreshCw className="h-4 w-4 text-primary" /></Button>
                          {c.status === "ativo" && (
                            <Button variant="ghost" size="icon" title="Encerrar" aria-label="Encerrar contrato" onClick={() => update.mutate({ id: c.id, status: "encerrado", data_encerramento: new Date().toISOString().slice(0, 10) })}><XCircle className="h-4 w-4 text-warning" /></Button>
                          )}
                          <Button variant="ghost" size="icon" title="Remover" aria-label="Remover contrato" onClick={() => confirm("Remover contrato?") && remove.mutate(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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

      {/* Novo / editar contrato */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? `Editar contrato ${editing.numero}` : "Novo contrato de locação"}</DialogTitle></DialogHeader>
          <div className="space-y-5">
            <section>
              <h4 className="mb-2 text-sm font-semibold">Abertura</h4>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Atendente"><Input value={form.atendente ?? ""} onChange={(e) => set("atendente", e.target.value)} /></Field>
                <Field label="Local de entrega"><Input value={form.local_entrega ?? ""} onChange={(e) => set("local_entrega", e.target.value)} /></Field>
                <Field label="Local de devolução"><Input value={form.local_devolucao ?? ""} onChange={(e) => set("local_devolucao", e.target.value)} /></Field>
                <Field label="Data de entrega"><Input type="date" value={form.data_entrega ?? ""} onChange={(e) => set("data_entrega", e.target.value)} /></Field>
                <Field label="Hora de entrega"><Input type="time" value={form.hora_entrega ?? ""} onChange={(e) => set("hora_entrega", e.target.value)} /></Field>
                <Field label="Devolução prevista"><Input type="date" value={form.devolucao_prevista ?? ""} onChange={(e) => set("devolucao_prevista", e.target.value)} /></Field>
                {editing && (
                  <Field label="Status do contrato">
                    <Select value={form.status || "ativo"} onValueChange={(v) => set("status", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ativo">Ativo</SelectItem>
                        <SelectItem value="renovado">Renovado</SelectItem>
                        <SelectItem value="encerrado">Encerrado</SelectItem>
                        <SelectItem value="cancelado">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              </div>
            </section>

            <section>
              <h4 className="mb-2 text-sm font-semibold">Cliente / locatário</h4>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Selecionar do cadastro" className="sm:col-span-3">
                  <Select value={form.locatario_id || "novo"} onValueChange={selLocatario}>
                    <SelectTrigger><SelectValue placeholder="Novo — preencher manualmente" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="novo">Novo — preencher manualmente</SelectItem>
                      {locatarios.map((l) => <SelectItem key={l.id} value={l.id}>{l.nome}{l.cpf ? ` — ${l.cpf}` : ""}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Nome" className="sm:col-span-2"><Input value={form.cliente_nome ?? ""} onChange={(e) => set("cliente_nome", e.target.value)} /></Field>
                <Field label="CPF"><Input value={form.cliente_cpf ?? ""} onChange={(e) => set("cliente_cpf", e.target.value)} /></Field>
                <Field label="CNH"><Input value={form.cliente_cnh ?? ""} onChange={(e) => set("cliente_cnh", e.target.value)} /></Field>
                <Field label="Categoria CNH"><Input value={form.cliente_cnh_cat ?? ""} onChange={(e) => set("cliente_cnh_cat", e.target.value)} placeholder="B" /></Field>
                <Field label="Telefone"><Input value={form.cliente_telefone ?? ""} onChange={(e) => set("cliente_telefone", e.target.value)} /></Field>
                <Field label="E-mail" className="sm:col-span-2"><Input type="email" value={form.cliente_email ?? ""} onChange={(e) => set("cliente_email", e.target.value)} /></Field>
                <Field label="Endereço" className="sm:col-span-3"><Input value={form.cliente_endereco ?? ""} onChange={(e) => set("cliente_endereco", e.target.value)} /></Field>
              </div>
            </section>

            <section>
              <h4 className="mb-2 text-sm font-semibold">Veículo e pagamento</h4>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Veículo" className="sm:col-span-2">
                  <SelectVeiculo value={form.vehicle_id ?? ""} onChange={selVeiculo} vehicles={vehicles} placeholder="Selecione" />
                </Field>
                <Field label="Grupo"><Input value={form.grupo ?? ""} onChange={(e) => set("grupo", e.target.value)} placeholder="PADRÃO" /></Field>
                <Field label="KM de entrega"><Input type="number" value={form.km_entrega ?? ""} onChange={(e) => set("km_entrega", e.target.value)} /></Field>
                <Field label="Valor da locação (semanal)"><Input value={form.valor_locacao ?? ""} onChange={(e) => set("valor_locacao", e.target.value)} placeholder="699,84" /></Field>
                <Field label="Semanas"><Input type="number" value={form.semanas ?? ""} onChange={(e) => set("semanas", e.target.value)} /></Field>
                <Field label="Total (calculado)"><Input readOnly value={formatCurrency(totalCalc)} className="bg-muted" /></Field>
                <Field label="Pré-autorização"><Input value={form.pre_autorizacao ?? ""} onChange={(e) => set("pre_autorizacao", e.target.value)} placeholder="1.649,00" /></Field>
              </div>
            </section>

            <Field label="Informações adicionais / observações">
              <Textarea rows={4} value={form.informacoes_adicionais ?? ""} onChange={(e) => set("informacoes_adicionais", e.target.value)} placeholder="Multas, franquia, participação em avarias, taxas, etc." />
            </Field>
            <p className="text-xs text-muted-foreground">As cláusulas gerais do contrato são incluídas automaticamente na emissão.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={!form.cliente_nome || create.isPending || update.isPending}>
              {editing ? (update.isPending ? "Salvando..." : "Salvar alterações") : (create.isPending ? "Salvando..." : "Criar contrato")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
