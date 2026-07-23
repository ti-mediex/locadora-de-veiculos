import { useMemo, useState } from "react";
import { Plus, Search, Trash2, Users, UserCheck, Car, Pencil } from "lucide-react";
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
import { useCanWrite } from "@/hooks/use-can-write";
import { useLocatarios, useSaveLocatario, useDeleteLocatario } from "@/hooks/use-locatarios";
import { useContratos } from "@/hooks/use-contratos";
import { formatDate, maskCpf } from "@/lib/format";
import type { Locatario } from "@/types/database";
import { useSort } from "@/hooks/use-sort";
import { SortableHead } from "@/components/shared/sortable-head";

type Form = Record<string, string>;

const CAMPOS = ["nome", "cpf", "rg", "cnh", "categoria_cnh", "validade_cnh", "data_nascimento", "telefone", "email", "cep", "endereco", "numero", "complemento", "bairro", "cidade", "estado", "chave_pix", "contato_emergencia_nome", "contato_emergencia_telefone", "observacoes", "status"] as const;

export default function LocatariosPage() {
  const { data: rows = [], isLoading } = useLocatarios();
  const { data: contratos = [] } = useContratos();
  const canWrite = useCanWrite("locatarios");
  const save = useSaveLocatario();
  const remove = useDeleteLocatario();

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [fStatus, setFStatus] = useState("todos");
  const [form, setForm] = useState<Form>({});
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Veículo atual de cada locatário: contrato ativo vinculado.
  const veicPorLocatario = useMemo(() => {
    const m = new Map<string, { placa: string; numero: string }>();
    for (const c of contratos) {
      if (c.status === "ativo" && c.locatario_id && !m.has(c.locatario_id)) {
        m.set(c.locatario_id, { placa: c.vehicles?.placa ?? c.placa ?? "—", numero: c.numero });
      }
    }
    return m;
  }, [contratos]);

  function abrirNovo() {
    setForm({ status: "ativo", categoria_cnh: "B" });
    setOpen(true);
  }
  function abrirEdicao(l: Locatario) {
    const f: Form = {};
    for (const c of CAMPOS) { const v = (l as unknown as Record<string, unknown>)[c]; f[c] = v == null ? "" : String(v); }
    f.id = l.id;
    setForm(f);
    setOpen(true);
  }

  function salvar() {
    const s = (k: string) => (form[k]?.trim() ? form[k].trim() : null);
    save.mutate({
      id: form.id || undefined,
      nome: form.nome?.trim() || "—",
      cpf: s("cpf"), rg: s("rg"), cnh: s("cnh"), categoria_cnh: s("categoria_cnh"),
      validade_cnh: s("validade_cnh"), data_nascimento: s("data_nascimento"),
      telefone: s("telefone"), email: s("email"), cep: s("cep"), endereco: s("endereco"),
      numero: s("numero"), complemento: s("complemento"), bairro: s("bairro"), cidade: s("cidade"), estado: s("estado"),
      chave_pix: s("chave_pix"), contato_emergencia_nome: s("contato_emergencia_nome"), contato_emergencia_telefone: s("contato_emergencia_telefone"),
      observacoes: s("observacoes"), status: (form.status as "ativo" | "inativo") || "ativo",
    }, { onSuccess: () => setOpen(false) });
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((l) => {
      const mS = fStatus === "todos" || l.status === fStatus;
      const mQ = !q || l.nome.toLowerCase().includes(q) || (l.cpf ?? "").includes(q) || (l.telefone ?? "").includes(q) || (l.email ?? "").toLowerCase().includes(q);
      return mS && mQ;
    });
  }, [rows, search, fStatus]);

  const { sortKey, sortDir, toggle, useSorted } = useSort<Locatario>("nome", "asc");
  const sorted = useSorted(filtered, (l, k) => {
    switch (k) {
      case "nome": return l.nome;
      case "cpf": return l.cpf;
      case "cnh": return l.cnh;
      case "telefone": return l.telefone;
      case "veiculo": return veicPorLocatario.get(l.id)?.placa;
      case "status": return l.status;
      default: return null;
    }
  });

  const ativos = rows.filter((l) => l.status === "ativo").length;
  const comVeiculo = rows.filter((l) => veicPorLocatario.has(l.id)).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Locatários"
        description="Cadastro de locatários — integrado aos contratos e ao veículo locado"
        actions={canWrite && <Button onClick={abrirNovo}><Plus className="h-4 w-4" /> Novo locatário</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Total de locatários" value={rows.length} icon={<Users className="h-5 w-5" />} />
        <StatCard title="Ativos" value={ativos} tone="success" icon={<UserCheck className="h-5 w-5" />} />
        <StatCard title="Com veículo (contrato ativo)" value={comVeiculo} icon={<Car className="h-5 w-5" />} />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flex flex-col gap-2 border-b p-3 sm:flex-row sm:items-center sm:p-4">
            <div className="flex flex-1 items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por nome, CPF, telefone ou e-mail..." value={search} onChange={(e) => setSearch(e.target.value)} className="border-0 focus-visible:ring-0" />
            </div>
            <Select value={fStatus} onValueChange={setFStatus}>
              <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="ativo">Ativos</SelectItem>
                <SelectItem value="inativo">Inativos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <EmptyState message="Nenhum locatário cadastrado" icon={<Users className="h-6 w-6" />} action={canWrite ? <Button onClick={abrirNovo}><Plus className="h-4 w-4" /> Novo locatário</Button> : undefined} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead sortKey="nome" activeKey={sortKey} dir={sortDir} onSort={toggle}>Nome</SortableHead>
                  <SortableHead sortKey="cpf" activeKey={sortKey} dir={sortDir} onSort={toggle}>CPF</SortableHead>
                  <SortableHead sortKey="cnh" activeKey={sortKey} dir={sortDir} onSort={toggle}>CNH</SortableHead>
                  <SortableHead sortKey="telefone" activeKey={sortKey} dir={sortDir} onSort={toggle}>Telefone</SortableHead>
                  <SortableHead sortKey="veiculo" activeKey={sortKey} dir={sortDir} onSort={toggle}>Veículo atual</SortableHead>
                  <SortableHead sortKey="status" activeKey={sortKey} dir={sortDir} onSort={toggle}>Status</SortableHead>
                  {canWrite && <TableHead className="w-20"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((l) => {
                  const veic = veicPorLocatario.get(l.id);
                  return (
                    <TableRow key={l.id} className="cursor-pointer" onClick={() => abrirEdicao(l)}>
                      <TableCell className="font-medium">{l.nome}</TableCell>
                      <TableCell className="font-mono text-sm">{l.cpf ? maskCpf(l.cpf) : "—"}</TableCell>
                      <TableCell className="text-sm">{l.cnh ? `${l.cnh}${l.categoria_cnh ? ` (${l.categoria_cnh})` : ""}` : "—"}</TableCell>
                      <TableCell className="text-sm">{l.telefone ?? "—"}</TableCell>
                      <TableCell>{veic ? <span className="font-mono text-sm">{veic.placa} <span className="text-xs text-muted-foreground">{veic.numero}</span></span> : <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell><Badge variant={l.status === "ativo" ? "success" : "muted"}>{l.status}</Badge></TableCell>
                      {canWrite && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" title="Editar" onClick={() => abrirEdicao(l)}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" title="Remover" onClick={() => confirm(`Remover o locatário ${l.nome}?`) && remove.mutate(l.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? "Editar locatário" : "Novo locatário"}</DialogTitle></DialogHeader>
          <div className="space-y-5">
            <section>
              <h4 className="mb-2 text-sm font-semibold">Dados pessoais</h4>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Nome completo" className="sm:col-span-2"><Input value={form.nome ?? ""} onChange={(e) => set("nome", e.target.value)} /></Field>
                <Field label="Status">
                  <Select value={form.status ?? "ativo"} onValueChange={(v) => set("status", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="ativo">Ativo</SelectItem><SelectItem value="inativo">Inativo</SelectItem></SelectContent>
                  </Select>
                </Field>
                <Field label="CPF"><Input value={form.cpf ?? ""} onChange={(e) => set("cpf", e.target.value)} /></Field>
                <Field label="RG"><Input value={form.rg ?? ""} onChange={(e) => set("rg", e.target.value)} /></Field>
                <Field label="Data de nascimento"><Input type="date" value={form.data_nascimento ?? ""} onChange={(e) => set("data_nascimento", e.target.value)} /></Field>
              </div>
            </section>

            <section>
              <h4 className="mb-2 text-sm font-semibold">Habilitação (CNH)</h4>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Número da CNH"><Input value={form.cnh ?? ""} onChange={(e) => set("cnh", e.target.value)} /></Field>
                <Field label="Categoria"><Input value={form.categoria_cnh ?? ""} onChange={(e) => set("categoria_cnh", e.target.value)} placeholder="B" /></Field>
                <Field label="Validade"><Input type="date" value={form.validade_cnh ?? ""} onChange={(e) => set("validade_cnh", e.target.value)} /></Field>
              </div>
            </section>

            <section>
              <h4 className="mb-2 text-sm font-semibold">Contato</h4>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Telefone"><Input value={form.telefone ?? ""} onChange={(e) => set("telefone", e.target.value)} /></Field>
                <Field label="E-mail" className="sm:col-span-2"><Input type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} /></Field>
                <Field label="Chave PIX" className="sm:col-span-2"><Input value={form.chave_pix ?? ""} onChange={(e) => set("chave_pix", e.target.value)} /></Field>
              </div>
            </section>

            <section>
              <h4 className="mb-2 text-sm font-semibold">Endereço</h4>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="CEP"><Input value={form.cep ?? ""} onChange={(e) => set("cep", e.target.value)} /></Field>
                <Field label="Logradouro" className="sm:col-span-2"><Input value={form.endereco ?? ""} onChange={(e) => set("endereco", e.target.value)} /></Field>
                <Field label="Número"><Input value={form.numero ?? ""} onChange={(e) => set("numero", e.target.value)} /></Field>
                <Field label="Complemento"><Input value={form.complemento ?? ""} onChange={(e) => set("complemento", e.target.value)} /></Field>
                <Field label="Bairro"><Input value={form.bairro ?? ""} onChange={(e) => set("bairro", e.target.value)} /></Field>
                <Field label="Cidade"><Input value={form.cidade ?? ""} onChange={(e) => set("cidade", e.target.value)} /></Field>
                <Field label="Estado (UF)"><Input value={form.estado ?? ""} onChange={(e) => set("estado", e.target.value)} maxLength={2} placeholder="PE" /></Field>
              </div>
            </section>

            <section>
              <h4 className="mb-2 text-sm font-semibold">Contato de emergência</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nome"><Input value={form.contato_emergencia_nome ?? ""} onChange={(e) => set("contato_emergencia_nome", e.target.value)} /></Field>
                <Field label="Telefone"><Input value={form.contato_emergencia_telefone ?? ""} onChange={(e) => set("contato_emergencia_telefone", e.target.value)} /></Field>
              </div>
            </section>

            <Field label="Observações"><Textarea rows={3} value={form.observacoes ?? ""} onChange={(e) => set("observacoes", e.target.value)} /></Field>
            {form.id && form.validade_cnh && (
              <p className="text-xs text-muted-foreground">CNH válida até {formatDate(form.validade_cnh)}.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={!form.nome?.trim() || save.isPending}>{save.isPending ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
