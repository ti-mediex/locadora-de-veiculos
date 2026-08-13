import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, ArrowLeftRight, CheckCircle2, Car } from "lucide-react";
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
import { SelectVeiculo } from "@/components/shared/select-veiculo";
import { PeriodoFilter } from "@/components/shared/period-filter";
import { RelatorioExport } from "@/components/shared/relatorio-export";
import { useList } from "@/hooks/use-crud";
import { useCanWrite } from "@/hooks/use-can-write";
import { useContratos } from "@/hooks/use-contratos";
import {
  useTrocas, useCreateTroca, useUpdateTroca, useEncerrarTroca, useDeleteTroca,
  TROCA_MOTIVO, motivoLabel, type TrocaRow,
} from "@/hooks/use-trocas";
import { EnviarAditivoDialog, type AditivoContexto } from "@/components/aditivos/enviar-aditivo-dialog";
import { FileSignature } from "lucide-react";
import { formatDate, maskPlaca } from "@/lib/format";
import { noPeriodo } from "@/lib/date";
import { useSort } from "@/hooks/use-sort";
import { SortableHead } from "@/components/shared/sortable-head";
import type { Vehicle } from "@/types/database";
import type { RelatorioTabelaData } from "@/lib/relatorio-tabela";

const hojeStr = () => new Date().toISOString().slice(0, 10);
type Form = Record<string, string>;

export default function TrocasVeiculoPage() {
  const navigate = useNavigate();
  const { data: rows = [], isLoading } = useTrocas();
  const { data: vehicles = [] } = useList<Vehicle>("vehicles");
  const { data: contratos = [] } = useContratos();
  const create = useCreateTroca();
  const update = useUpdateTroca();
  const encerrar = useEncerrarTroca();
  const remove = useDeleteTroca();
  const canWrite = useCanWrite("contratos");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TrocaRow | null>(null);
  const [form, setForm] = useState<Form>({});
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const [search, setSearch] = useState("");
  const [fStatus, setFStatus] = useState("ativa");
  const [pIni, setPIni] = useState("");
  const [pFim, setPFim] = useState("");

  const [aditivoCtx, setAditivoCtx] = useState<AditivoContexto | null>(null);
  function abrirAditivo(t: TrocaRow) {
    const c = contratos.find((x) => x.id === t.contrato_id);
    setAditivoCtx({
      contratoId: t.contrato_id ?? "",
      contratoNumero: t.contratos?.numero ?? c?.numero ?? "—",
      locatarioId: t.locatario_id,
      clienteNome: t.locatario_nome ?? c?.cliente_nome,
      clienteCpf: c?.cliente_cpf, clienteTelefone: c?.cliente_telefone, clienteEmail: c?.cliente_email,
      vehicleId: t.veiculo_reserva_id, placa: t.placa_reserva, veiculoDesc: veicById.get(t.veiculo_reserva_id ?? "")?.modelo ?? null,
      placaAnterior: t.placa_origem, motivo: motivoLabel(t.motivo).toLowerCase(), trocaId: t.id,
    });
  }

  const [encAlvo, setEncAlvo] = useState<TrocaRow | null>(null);
  const [encData, setEncData] = useState(hojeStr());
  const [encKm, setEncKm] = useState("");

  const contratosAtivos = useMemo(
    () => contratos.filter((c) => c.status === "ativo"),
    [contratos],
  );
  const veicById = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles]);

  function abrirNovo() {
    setEditing(null);
    setForm({ data_troca: hojeStr(), motivo: "manutencao" });
    setOpen(true);
  }
  function abrirEdicao(t: TrocaRow) {
    setEditing(t);
    setForm({
      contrato_id: t.contrato_id ?? "",
      veiculo_reserva_id: t.veiculo_reserva_id ?? "",
      motivo: t.motivo ?? "manutencao",
      data_troca: t.data_troca ?? hojeStr(),
      hora_troca: t.hora_troca ?? "",
      km_origem: t.km_origem != null ? String(t.km_origem) : "",
      km_reserva: t.km_reserva != null ? String(t.km_reserva) : "",
      observacoes: t.observacoes ?? "",
    });
    setOpen(true);
  }

  // Autopreenche origem/locatário a partir do contrato escolhido.
  const contratoSel = contratos.find((c) => c.id === form.contrato_id);

  function salvar() {
    if (!form.contrato_id) return;
    if (!form.veiculo_reserva_id) return;
    const reserva = veicById.get(form.veiculo_reserva_id);
    const payload = {
      contrato_id: form.contrato_id,
      locatario_id: contratoSel?.locatario_id ?? null,
      locatario_nome: contratoSel?.cliente_nome ?? null,
      veiculo_origem_id: contratoSel?.vehicle_id ?? null,
      placa_origem: contratoSel?.vehicles?.placa ?? contratoSel?.placa ?? null,
      veiculo_reserva_id: form.veiculo_reserva_id,
      placa_reserva: reserva?.placa ?? null,
      motivo: form.motivo || "manutencao",
      data_troca: form.data_troca || hojeStr(),
      hora_troca: form.hora_troca || null,
      km_origem: form.km_origem ? Number(form.km_origem) : null,
      km_reserva: form.km_reserva ? Number(form.km_reserva) : null,
      observacoes: form.observacoes || null,
    };
    if (editing) update.mutate({ id: editing.id, ...payload }, { onSuccess: () => setOpen(false) });
    else create.mutate({ ...payload, status: "ativa" }, { onSuccess: () => setOpen(false) });
  }

  function confirmarEncerrar() {
    if (!encAlvo) return;
    encerrar.mutate(
      { id: encAlvo.id, data_retorno: encData || hojeStr(), km_retorno: encKm ? Number(encKm) : null },
      { onSuccess: () => { setEncAlvo(null); setEncKm(""); } },
    );
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((t) => {
      const mS = fStatus === "todos" || t.status === fStatus;
      const mQ = !q || [t.locatario_nome, t.placa_origem, t.placa_reserva, t.contratos?.numero, motivoLabel(t.motivo)]
        .some((x) => (x ?? "").toLowerCase().includes(q));
      return mS && mQ && noPeriodo(t.data_troca, pIni, pFim);
    });
  }, [rows, search, fStatus, pIni, pFim]);

  const { sortKey, sortDir, toggle, useSorted } = useSort<TrocaRow>("data", "desc");
  const sorted = useSorted(filtered, (t, k) => {
    switch (k) {
      case "data": return t.data_troca ?? "";
      case "locatario": return (t.locatario_nome ?? "").toLowerCase();
      case "contrato": return t.contratos?.numero ?? "";
      case "origem": return t.placa_origem ?? "";
      case "reserva": return t.placa_reserva ?? "";
      case "motivo": return motivoLabel(t.motivo);
      case "status": return t.status;
      default: return "";
    }
  });

  const ativas = rows.filter((t) => t.status === "ativa").length;

  const buildRelatorio = (): RelatorioTabelaData => ({
    titulo: "Trocas de veículo",
    filtros: [
      { label: "Busca", valor: search },
      { label: "Status", valor: fStatus === "todos" ? "Todas" : fStatus === "ativa" ? "Ativas" : "Encerradas" },
      { label: "Período", valor: pIni || pFim ? `${pIni || "…"} a ${pFim || "…"}` : "" },
    ],
    colunas: [
      { label: "Data" }, { label: "Locatário" }, { label: "Contrato" },
      { label: "Veículo (manutenção)" }, { label: "Reserva" }, { label: "Motivo" },
      { label: "Retorno" }, { label: "Status" },
    ],
    linhas: sorted.map((t) => [
      formatDate(t.data_troca), t.locatario_nome ?? "—", t.contratos?.numero ?? "—",
      t.placa_origem ? maskPlaca(t.placa_origem) : "—", t.placa_reserva ? maskPlaca(t.placa_reserva) : "—",
      motivoLabel(t.motivo), t.data_retorno ? formatDate(t.data_retorno) : "—",
      t.status === "ativa" ? "Ativa" : "Encerrada",
    ]),
  });

  if (isLoading) return <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Trocas de veículo"
        description="Veículo reserva por locatário quando o carro do contrato entra em manutenção"
        actions={canWrite && <Button onClick={abrirNovo}><Plus className="h-4 w-4" /> Registrar troca</Button>}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard title="Trocas ativas" value={String(ativas)} icon={<ArrowLeftRight className="h-5 w-5" />} />
        <StatCard title="Total no período" value={String(filtered.length)} icon={<Car className="h-5 w-5" />} />
        <StatCard title="Encerradas" value={String(rows.filter((t) => t.status === "encerrada").length)} icon={<CheckCircle2 className="h-5 w-5" />} />
      </div>

      <Card>
        <CardContent className="space-y-3 p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Input placeholder="Buscar por locatário, placa, contrato…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 w-full sm:max-w-xs" />
            <Select value={fStatus} onValueChange={setFStatus}>
              <SelectTrigger className="h-9 w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ativa">Ativas</SelectItem>
                <SelectItem value="encerrada">Encerradas</SelectItem>
                <SelectItem value="todos">Todas</SelectItem>
              </SelectContent>
            </Select>
            <PeriodoFilter ini={pIni} fim={pFim} onChange={(i, f) => { setPIni(i); setPFim(f); }} />
            <div className="ml-auto">
              <RelatorioExport build={buildRelatorio} nomeArquivo="trocas-veiculo" />
            </div>
          </div>

          {sorted.length === 0 ? (
            <EmptyState message="Nenhuma troca registrada" />
          ) : (
            <div className="overflow-x-auto">
              <Table className="text-xs [&_th]:h-9 [&_th]:whitespace-nowrap [&_th]:px-1 [&_th]:text-[11px] [&_td]:px-1 [&_td]:py-2">
                <TableHeader>
                  <TableRow>
                    <SortableHead sortKey="data" activeKey={sortKey} dir={sortDir} onSort={toggle}>Data</SortableHead>
                    <SortableHead sortKey="locatario" activeKey={sortKey} dir={sortDir} onSort={toggle}>Locatário</SortableHead>
                    <SortableHead sortKey="contrato" activeKey={sortKey} dir={sortDir} onSort={toggle}>Contrato</SortableHead>
                    <SortableHead sortKey="origem" activeKey={sortKey} dir={sortDir} onSort={toggle}>Veíc. manut.</SortableHead>
                    <SortableHead sortKey="reserva" activeKey={sortKey} dir={sortDir} onSort={toggle}>Reserva</SortableHead>
                    <SortableHead sortKey="motivo" activeKey={sortKey} dir={sortDir} onSort={toggle}>Motivo</SortableHead>
                    <SortableHead sortKey="status" activeKey={sortKey} dir={sortDir} onSort={toggle}>Status</SortableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((t) => (
                    <TableRow key={t.id} className="cursor-pointer" onClick={() => abrirEdicao(t)}>
                      <TableCell className="whitespace-nowrap tabular-nums">{formatDate(t.data_troca)}</TableCell>
                      <TableCell className="max-w-[130px] truncate" title={t.locatario_nome ?? ""}>{t.locatario_nome ?? "—"}</TableCell>
                      <TableCell>
                        {t.contratos?.numero ? (
                          <button className="font-mono text-primary hover:underline" onClick={(e) => { e.stopPropagation(); navigate("/contratos"); }}>{t.contratos.numero}</button>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        {t.placa_origem ? (
                          <button className="font-mono text-primary hover:underline" onClick={(e) => { e.stopPropagation(); if (t.veiculo_origem_id) navigate(`/frota-ativa/${t.veiculo_origem_id}`); }}>{maskPlaca(t.placa_origem)}</button>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        {t.placa_reserva ? (
                          <button className="font-mono text-primary hover:underline" onClick={(e) => { e.stopPropagation(); if (t.veiculo_reserva_id) navigate(`/frota-ativa/${t.veiculo_reserva_id}`); }}>{maskPlaca(t.placa_reserva)}</button>
                        ) : "—"}
                      </TableCell>
                      <TableCell><Badge variant="secondary" className="px-1.5 py-0 text-[10px]">{motivoLabel(t.motivo)}</Badge></TableCell>
                      <TableCell>
                        {t.status === "ativa"
                          ? <Badge variant="warning" className="px-1.5 py-0 text-[10px]">Ativa</Badge>
                          : <Badge variant="muted" className="px-1.5 py-0 text-[10px]">Encerrada · {formatDate(t.data_retorno)}</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          {canWrite && t.contrato_id && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Aditivo de troca p/ assinatura"
                              onClick={() => abrirAditivo(t)}>
                              <FileSignature className="h-4 w-4 text-primary" />
                            </Button>
                          )}
                          {canWrite && t.status === "ativa" && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Encerrar troca (veículo retornou)"
                              onClick={() => { setEncAlvo(t); setEncData(hojeStr()); setEncKm(""); }}>
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            </Button>
                          )}
                          {canWrite && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Remover"
                              onClick={() => { if (confirm("Remover esta troca?")) remove.mutate(t.id); }}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diálogo registrar/editar troca */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Editar troca" : "Registrar troca de veículo"}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <Field label="Contrato / locatário">
              <Select value={form.contrato_id || ""} onValueChange={(v) => set("contrato_id", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione o contrato ativo" /></SelectTrigger>
                <SelectContent>
                  {contratosAtivos.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.numero} · {c.cliente_nome ?? "—"} · {maskPlaca(c.vehicles?.placa ?? c.placa ?? "")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {contratoSel && (
              <div className="rounded-md border bg-muted/40 p-2 text-xs text-muted-foreground">
                Veículo do contrato (vai p/ manutenção): <span className="font-mono font-medium text-foreground">{maskPlaca(contratoSel.vehicles?.placa ?? contratoSel.placa ?? "—")}</span>
              </div>
            )}
            <Field label="Veículo reserva entregue">
              <SelectVeiculo
                value={form.veiculo_reserva_id || ""}
                onChange={(id) => set("veiculo_reserva_id", id)}
                vehicles={vehicles.filter((v) => v.id !== contratoSel?.vehicle_id)}
                placeholder="Selecione o veículo reserva"
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Motivo">
                <Select value={form.motivo || "manutencao"} onValueChange={(v) => set("motivo", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TROCA_MOTIVO.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Data da troca">
                <Input type="date" value={form.data_troca || ""} onChange={(e) => set("data_troca", e.target.value)} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="KM do veículo (manut.)">
                <Input type="number" inputMode="numeric" value={form.km_origem || ""} onChange={(e) => set("km_origem", e.target.value)} placeholder="opcional" />
              </Field>
              <Field label="KM do reserva">
                <Input type="number" inputMode="numeric" value={form.km_reserva || ""} onChange={(e) => set("km_reserva", e.target.value)} placeholder="opcional" />
              </Field>
            </div>
            <Field label="Observações">
              <Textarea value={form.observacoes || ""} onChange={(e) => set("observacoes", e.target.value)} rows={2} placeholder="opcional" />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={!form.contrato_id || !form.veiculo_reserva_id || create.isPending || update.isPending}>
              {editing ? "Salvar" : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo encerrar troca */}
      <Dialog open={!!encAlvo} onOpenChange={(o) => !o && setEncAlvo(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Encerrar troca</DialogTitle></DialogHeader>
          {encAlvo && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                O locatário <b>{encAlvo.locatario_nome ?? "—"}</b> devolveu o reserva <span className="font-mono">{maskPlaca(encAlvo.placa_reserva ?? "")}</span> e retomou o veículo <span className="font-mono">{maskPlaca(encAlvo.placa_origem ?? "")}</span>.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Data do retorno"><Input type="date" value={encData} onChange={(e) => setEncData(e.target.value)} /></Field>
                <Field label="KM no retorno"><Input type="number" inputMode="numeric" value={encKm} onChange={(e) => setEncKm(e.target.value)} placeholder="opcional" /></Field>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEncAlvo(null)}>Cancelar</Button>
            <Button onClick={confirmarEncerrar} disabled={encerrar.isPending}>Confirmar retorno</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {aditivoCtx && (
        <EnviarAditivoDialog open={!!aditivoCtx} onOpenChange={(v) => !v && setAditivoCtx(null)} contexto={aditivoCtx} tipoInicial="troca_veiculo" />
      )}
    </div>
  );
}
