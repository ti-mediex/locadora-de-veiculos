import { useMemo, useState } from "react";
import {
  Plus, Search, Trash2, Eye, Camera, ClipboardCheck, MapPin, FileText, Loader2, AlertTriangle, X, MessageCircle, Mail, Upload, FileUp, Pencil,
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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useList } from "@/hooks/use-crud";
import { useCanWrite } from "@/hooks/use-can-write";
import { AssinaturaCanvas } from "@/components/vistorias/assinatura-canvas";
import { EditorFoto } from "@/components/vistorias/editor-foto";
import { carimbarFoto } from "@/lib/foto-carimbo";
import {
  useVistorias, useVistoriaDetalhe, useCreateVistoria, useDeleteVistoria, useCreateVistoriaExterna,
  useUpdateVistoriaContato, useAtualizarFotoVistoria, salvarLaudoPdfLink, nomeArquivoLaudo, urlToDataUrl,
  type FotoInput, type VistoriaDetalhe,
} from "@/hooks/use-vistorias";
import { gerarLaudoPdf } from "@/lib/laudo-pdf";
import { VIPCAR_LOGO } from "@/lib/laudo-logo";
import { extrairTextoPdf } from "@/lib/pdf-text";
import { parseLaudoVex } from "@/lib/laudo-vex-parse";
import { useAppConfig, aplicarTemplate } from "@/hooks/use-app-config";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { VISTORIA_TIPO, VISTORIA_COMBUSTIVEL, VISTORIA_PARTES, VISTORIA_CHECKLIST_ITENS } from "@/lib/options";
import { formatDate } from "@/lib/format";
import type { Vehicle, ChecklistItem } from "@/types/database";
import { useSort } from "@/hooks/use-sort";
import { SortableHead } from "@/components/shared/sortable-head";
import { RelatorioExport } from "@/components/shared/relatorio-export";
import { VehicleStatusBadge, statusVeiculoLabel } from "@/components/shared/vehicle-status-badge";
import type { RelatorioTabelaData, RelColuna } from "@/lib/relatorio-tabela";

const tipoLabel = (t: string) => VISTORIA_TIPO.find((x) => x.value === t)?.label ?? t;
const tipoBadge: Record<string, "success" | "warning" | "destructive"> = { liberacao: "success", devolucao: "warning", sinistro: "destructive" };

export default function VistoriasPage() {
  const { data: rows = [], isLoading } = useVistorias();
  const { data: vehicles = [] } = useList<Vehicle>("vehicles");
  const create = useCreateVistoria();
  const createExterna = useCreateVistoriaExterna();
  const remove = useDeleteVistoria();
  const canWrite = useCanWrite("vistorias");

  const [open, setOpen] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [fTipo, setFTipo] = useState("todos");
  const [fDataIni, setFDataIni] = useState("");
  const [fDataFim, setFDataFim] = useState("");
  const [fVistoriador, setFVistoriador] = useState("");

  // Anexar laudos externos em lote (PDFs de outro sistema, ex.: Vex)
  interface ItemLote { file: File; placaLida: string | null; vehicleId: string; tipo: string; data: string; locatario: string; duplicado: boolean; motivoDup: string; }
  const [extOpen, setExtOpen] = useState(false);
  const [extItens, setExtItens] = useState<ItemLote[]>([]);
  const [extLendo, setExtLendo] = useState(false);
  const [extSalvando, setExtSalvando] = useState(false);
  const hojeStr = () => new Date().toISOString().slice(0, 10);

  // Lê cada PDF, extrai placa/tipo/data/locatário e vincula o veículo.
  async function onExtFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setExtLendo(true);
    // Chaves de vistorias já anexadas (por nome de arquivo e por placa+data+tipo).
    const existentes = new Set<string>();
    for (const r of rows) {
      if (r.laudo_arquivo_nome) existentes.add("f:" + r.laudo_arquivo_nome.toLowerCase());
      const pn = (r.vehicles?.placa ?? r.placa ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
      if (pn) existentes.add("pd:" + pn + "|" + r.created_at.slice(0, 10) + "|" + r.tipo);
    }
    for (const t of extItens) {
      existentes.add("f:" + t.file.name.toLowerCase());
      if (t.placaLida) existentes.add("pd:" + t.placaLida + "|" + t.data + "|" + t.tipo);
    }
    const novos: ItemLote[] = [];
    for (const file of Array.from(files)) {
      let placa: string | null = null, tipo = "liberacao", data = hojeStr(), locatario = "", vehicleId = "";
      try {
        const p = parseLaudoVex(await extrairTextoPdf(file));
        placa = p.placa;
        if (p.tipo) tipo = p.tipo;
        if (p.data) data = p.data;
        if (p.locatario) locatario = p.locatario;
        if (p.placa) {
          const veic = vehicles.find((v) => v.placa.replace(/[^A-Za-z0-9]/g, "").toUpperCase() === p.placa);
          if (veic) vehicleId = veic.id;
        }
      } catch { /* preenche manual */ }
      let duplicado = false, motivoDup = "";
      if (existentes.has("f:" + file.name.toLowerCase())) { duplicado = true; motivoDup = "mesmo arquivo"; }
      else if (placa && existentes.has("pd:" + placa + "|" + data + "|" + tipo)) { duplicado = true; motivoDup = "placa/data já anexada"; }
      existentes.add("f:" + file.name.toLowerCase());
      if (placa) existentes.add("pd:" + placa + "|" + data + "|" + tipo);
      novos.push({ file, placaLida: placa, vehicleId, tipo, data, locatario, duplicado, motivoDup });
    }
    setExtItens((prev) => [...prev, ...novos]);
    setExtLendo(false);
    const dups = novos.filter((n) => n.duplicado).length;
    const semVeic = novos.filter((n) => !n.vehicleId && !n.duplicado).length;
    toast.success(`${novos.length} laudo(s) lido(s)` + (dups ? ` · ${dups} já anexado(s)` : "") + (semVeic ? ` · ${semVeic} sem veículo` : ""));
  }
  const setItem = (i: number, patch: Partial<ItemLote>) => setExtItens((its) => its.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));

  async function salvarLote() {
    const validos = extItens.filter((t) => t.vehicleId && !t.duplicado);
    if (validos.length === 0) { toast.error("Nenhum laudo novo para anexar (verifique veículo e duplicatas)"); return; }
    setExtSalvando(true);
    let ok = 0;
    for (const t of validos) {
      const placa = vehicles.find((v) => v.id === t.vehicleId)?.placa ?? null;
      try {
        await createExterna.mutateAsync({ vehicle_id: t.vehicleId, placa, tipo: t.tipo, data: t.data, locatario_nome: t.locatario, file: t.file });
        ok++;
      } catch { /* segue para o próximo */ }
    }
    setExtSalvando(false);
    toast.success(`${ok} laudo(s) anexado(s)`);
    setExtItens([]); setExtOpen(false);
  }

  // Estado do formulário de nova vistoria
  const emptyChecklist = (): ChecklistItem[] => VISTORIA_CHECKLIST_ITENS.map((item) => ({ item, situacao: "ok" as const, observacao: "" }));
  const emptyFotos = (): FotoInput[] => VISTORIA_PARTES.map((parte) => ({ parte, file: null, avaria: false, observacao: "" }));
  const [vehicleId, setVehicleId] = useState("");
  const [tipo, setTipo] = useState("liberacao");
  const [locNome, setLocNome] = useState("");
  const [locDoc, setLocDoc] = useState("");
  const [locTel, setLocTel] = useState("");
  const [locEmail, setLocEmail] = useState("");
  const [vistoriador, setVistoriador] = useState("");
  const [km, setKm] = useState("");
  const [combustivel, setCombustivel] = useState("1/2");
  const [checklist, setChecklist] = useState<ChecklistItem[]>(emptyChecklist());
  const [observacoes, setObservacoes] = useState("");
  const [avarias, setAvarias] = useState("");
  const [fotos, setFotos] = useState<FotoInput[]>(emptyFotos());
  const [assinatura, setAssinatura] = useState<string | null>(null);
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [editorIdx, setEditorIdx] = useState<number | null>(null);
  const [carimbando, setCarimbando] = useState<number | null>(null);

  // Ao capturar a foto, grava o local (parte) + data/hora na imagem.
  async function onFotoSelecionada(i: number, raw: File | null) {
    if (!raw) { setFoto(i, { file: null }); return; }
    setCarimbando(i);
    try {
      const carimbada = await carimbarFoto(raw, fotos[i].parte);
      setFoto(i, { file: carimbada });
    } finally { setCarimbando(null); }
  }

  function abrirNova() {
    setVehicleId(""); setTipo("liberacao"); setLocNome(""); setLocDoc(""); setLocTel(""); setLocEmail(""); setVistoriador("");
    setKm(""); setCombustivel("1/2"); setChecklist(emptyChecklist()); setObservacoes(""); setAvarias("");
    setFotos(emptyFotos()); setAssinatura(null); setGps(null);
    // GPS opcional
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (p) => setGps({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => setGps(null),
        { enableHighAccuracy: false, timeout: 5000 }
      );
    }
    setOpen(true);
  }

  const setFoto = (i: number, patch: Partial<FotoInput>) => setFotos((fs) => fs.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  const setChk = (i: number, patch: Partial<ChecklistItem>) => setChecklist((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

  function salvar() {
    const placa = vehicles.find((v) => v.id === vehicleId)?.placa ?? null;
    create.mutate(
      {
        vehicle_id: vehicleId || null, placa, tipo, locatario_nome: locNome, locatario_documento: locDoc,
        locatario_telefone: locTel, locatario_email: locEmail,
        vistoriador, km, combustivel, checklist, observacoes, avarias, fotos, assinaturaDataUrl: assinatura, gps,
      },
      { onSuccess: () => setOpen(false) }
    );
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const vq = fVistoriador.toLowerCase();
    return rows.filter((r) => {
      const matchTipo = fTipo === "todos" || r.tipo === fTipo;
      const matchSearch = !q || (r.vehicles?.placa ?? "").toLowerCase().includes(q) ||
        (r.locatario_nome ?? "").toLowerCase().includes(q) || (r.vehicles?.modelo ?? "").toLowerCase().includes(q);
      const matchVist = !vq || (r.vistoriador ?? "").toLowerCase().includes(vq);
      const dia = r.created_at.slice(0, 10);
      const matchIni = !fDataIni || dia >= fDataIni;
      const matchFim = !fDataFim || dia <= fDataFim;
      return matchTipo && matchSearch && matchVist && matchIni && matchFim;
    });
  }, [rows, search, fTipo, fVistoriador, fDataIni, fDataFim]);

  const { sortKey, sortDir, toggle, useSorted } = useSort<(typeof rows)[number]>("created_at", "desc");
  const sorted = useSorted(filtered, (r, k) => {
    switch (k) {
      case "created_at": return r.created_at;
      case "tipo": return r.tipo;
      case "placa": return r.vehicles?.placa ?? r.placa;
      case "statusv": return vehicles.find((v) => v.id === r.vehicle_id)?.status ?? "";
      case "modelo": return r.vehicles?.modelo;
      case "locatario": return r.locatario_nome;
      case "vistoriador": return r.vistoriador;
      case "km": return r.km;
      case "fotos": return r.fotos?.[0]?.count ?? 0;
      case "laudo": return r.laudo_externo_path ? 1 : 0;
      default: return null;
    }
  });

  function buildRelatorio(): RelatorioTabelaData {
    const colunas: RelColuna[] = [
      { label: "Data/Hora" }, { label: "Tipo" }, { label: "Placa" }, { label: "Status veículo" }, { label: "Modelo" }, { label: "Locatário" },
      { label: "Vistoriador" }, { label: "KM", align: "right" }, { label: "Fotos", align: "right" }, { label: "Laudo" },
    ];
    const linhas = sorted.map((r) => [
      new Date(r.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }),
      tipoLabel(r.tipo), r.vehicles?.placa ?? r.placa ?? "—", statusVeiculoLabel(vehicles.find((v) => v.id === r.vehicle_id)?.status), r.vehicles?.modelo ?? "—",
      r.locatario_nome ?? "—", r.vistoriador ?? "—", r.km ?? "—", r.fotos?.[0]?.count ?? 0, r.laudo_externo_path ? "Vex" : "—",
    ]);
    return {
      titulo: "Vistorias", subtitulo: `${sorted.length} vistoria(s)`,
      filtros: [{ label: "Busca", valor: search }, { label: "Tipo", valor: fTipo === "todos" ? "Todos" : tipoLabel(fTipo) }, { label: "Vistoriador", valor: fVistoriador }, { label: "De", valor: fDataIni }, { label: "Até", valor: fDataFim }],
      colunas, linhas,
    };
  }

  const fotosPreenchidas = fotos.filter((f) => f.file).length;
  const hoje = new Date().toISOString().slice(0, 10);
  const noMes = rows.filter((r) => r.created_at.slice(0, 7) === hoje.slice(0, 7)).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vistoria de veículos"
        description="Checklist com fotos na liberação, devolução e sinistro"
        actions={
          <div className="flex flex-wrap gap-2">
            <RelatorioExport build={buildRelatorio} nomeArquivo="vistorias" disabled={!sorted.length} />
            {canWrite && (
              <>
                <Button variant="outline" onClick={() => setExtOpen(true)}><FileUp className="h-4 w-4" /> Anexar laudos (Vex)</Button>
                <Button onClick={abrirNova}><Plus className="h-4 w-4" /> Nova vistoria</Button>
              </>
            )}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Total de vistorias" value={rows.length} icon={<ClipboardCheck className="h-5 w-5" />} />
        <StatCard title="No mês" value={noMes} icon={<Camera className="h-5 w-5" />} />
        <StatCard title="Sinistros registrados" value={rows.filter((r) => r.tipo === "sinistro").length} tone="destructive" icon={<AlertTriangle className="h-5 w-5" />} />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="space-y-2 border-b p-3 sm:p-4">
            <div className="flex items-center gap-2 rounded-md border px-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por placa, modelo ou locatário..." value={search} onChange={(e) => setSearch(e.target.value)} className="border-0 focus-visible:ring-0" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={fTipo} onValueChange={setFTipo}>
                <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os tipos</SelectItem>
                  {VISTORIA_TIPO.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input placeholder="Vistoriador" value={fVistoriador} onChange={(e) => setFVistoriador(e.target.value)} className="w-full sm:w-44" />
              <div className="flex items-center gap-1">
                <label className="text-xs text-muted-foreground">De</label>
                <Input type="date" value={fDataIni} onChange={(e) => setFDataIni(e.target.value)} className="w-[9.5rem]" />
              </div>
              <div className="flex items-center gap-1">
                <label className="text-xs text-muted-foreground">Até</label>
                <Input type="date" value={fDataFim} onChange={(e) => setFDataFim(e.target.value)} className="w-[9.5rem]" />
              </div>
            </div>
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <EmptyState message="Nenhuma vistoria registrada" icon={<ClipboardCheck className="h-6 w-6" />} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead sortKey="created_at" activeKey={sortKey} dir={sortDir} onSort={toggle} className="whitespace-nowrap">Data/Hora</SortableHead>
                  <SortableHead sortKey="tipo" activeKey={sortKey} dir={sortDir} onSort={toggle}>Tipo</SortableHead>
                  <SortableHead sortKey="placa" activeKey={sortKey} dir={sortDir} onSort={toggle}>Placa</SortableHead>
                  <SortableHead sortKey="statusv" activeKey={sortKey} dir={sortDir} onSort={toggle}>Status veículo</SortableHead>
                  <SortableHead sortKey="modelo" activeKey={sortKey} dir={sortDir} onSort={toggle}>Modelo</SortableHead>
                  <SortableHead sortKey="locatario" activeKey={sortKey} dir={sortDir} onSort={toggle}>Locatário</SortableHead>
                  <SortableHead sortKey="vistoriador" activeKey={sortKey} dir={sortDir} onSort={toggle}>Vistoriador</SortableHead>
                  <SortableHead sortKey="km" activeKey={sortKey} dir={sortDir} onSort={toggle} align="right">KM</SortableHead>
                  <SortableHead sortKey="fotos" activeKey={sortKey} dir={sortDir} onSort={toggle}>Fotos</SortableHead>
                  <SortableHead sortKey="laudo" activeKey={sortKey} dir={sortDir} onSort={toggle}>Laudo</SortableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((r) => (
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => setViewId(r.id)}>
                    <TableCell className="whitespace-nowrap text-xs">{new Date(r.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</TableCell>
                    <TableCell><Badge variant={tipoBadge[r.tipo]}>{tipoLabel(r.tipo)}</Badge></TableCell>
                    <TableCell className="font-mono font-medium">{r.vehicles?.placa ?? r.placa ?? "—"}</TableCell>
                    <TableCell><VehicleStatusBadge status={vehicles.find((v) => v.id === r.vehicle_id)?.status} /></TableCell>
                    <TableCell className="max-w-40 truncate text-xs text-muted-foreground">{r.vehicles?.modelo ?? "—"}</TableCell>
                    <TableCell>{r.locatario_nome ?? "—"}</TableCell>
                    <TableCell className="text-xs">{r.vistoriador ?? "—"}</TableCell>
                    <TableCell className="text-right">{r.km ?? "—"}</TableCell>
                    <TableCell className="text-center">{r.fotos?.[0]?.count ?? 0}</TableCell>
                    <TableCell className="text-center">
                      {r.laudo_externo_path ? <Badge variant="secondary">Vex</Badge> : <FileText className="mx-auto h-4 w-4 text-muted-foreground" />}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setViewId(r.id)}><Eye className="h-4 w-4" /></Button>
                        {canWrite && (
                          <Button variant="ghost" size="icon" onClick={() => confirm("Remover vistoria?") && remove.mutate(r.id)}>
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

      {/* Nova vistoria — mobile first */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>Nova vistoria</DialogTitle></DialogHeader>
          <div className="space-y-5">
            {/* Dados */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Veículo">
                <Select value={vehicleId} onValueChange={setVehicleId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {vehicles.map((v) => <SelectItem key={v.id} value={v.id}>{v.placa} — {v.modelo}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Tipo de operação">
                <Select value={tipo} onValueChange={setTipo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {VISTORIA_TIPO.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Locatário / responsável"><Input value={locNome} onChange={(e) => setLocNome(e.target.value)} /></Field>
              <Field label="CPF/CNPJ"><Input value={locDoc} onChange={(e) => setLocDoc(e.target.value)} /></Field>
              <Field label="WhatsApp / telefone"><Input type="tel" inputMode="tel" value={locTel} onChange={(e) => setLocTel(e.target.value)} placeholder="(81) 99999-9999" /></Field>
              <Field label="E-mail"><Input type="email" value={locEmail} onChange={(e) => setLocEmail(e.target.value)} placeholder="locatario@email.com" /></Field>
              <Field label="Vistoriador"><Input value={vistoriador} onChange={(e) => setVistoriador(e.target.value)} /></Field>
              <Field label="KM atual"><Input type="number" inputMode="numeric" value={km} onChange={(e) => setKm(e.target.value)} /></Field>
              <Field label="Nível de combustível">
                <Select value={combustivel} onValueChange={setCombustivel}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {VISTORIA_COMBUSTIVEL.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              {gps && <div className="flex items-end text-xs text-muted-foreground"><MapPin className="mr-1 h-3.5 w-3.5" /> GPS capturado</div>}
            </div>

            {/* Fotos por parte */}
            <div>
              <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold"><Camera className="h-4 w-4" /> Fotos ({fotosPreenchidas}/{fotos.length})</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                {fotos.map((f, i) => (
                  <div key={f.parte} className="rounded-lg border p-2">
                    <div className="mb-1 text-xs font-medium">{f.parte}</div>
                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded border border-dashed py-2 text-xs text-muted-foreground hover:bg-accent">
                      {carimbando === i ? (
                        <div className="flex h-20 w-full items-center justify-center"><Loader2 className="h-4 w-4 animate-spin" /></div>
                      ) : f.file ? (
                        <img src={URL.createObjectURL(f.file)} alt={f.parte} className="h-20 w-full rounded object-cover" />
                      ) : (
                        <><Camera className="h-4 w-4" /> Tirar / escolher foto</>
                      )}
                      <input type="file" accept="image/*" capture="environment" className="hidden"
                        onChange={(e) => onFotoSelecionada(i, e.target.files?.[0] ?? null)} />
                    </label>
                    {f.file && (
                      <>
                        <div className="mt-1 flex items-center justify-between gap-2 text-xs">
                          <label className="flex items-center gap-1">
                            <input type="checkbox" checked={f.avaria} onChange={(e) => setFoto(i, { avaria: e.target.checked })} /> Avaria
                          </label>
                          <div className="flex items-center gap-2">
                            <button type="button" className="inline-flex items-center gap-1 text-primary" onClick={() => setEditorIdx(i)}><Pencil className="h-3.5 w-3.5" /> Marcar</button>
                            <button type="button" onClick={() => setFoto(i, { file: null, avaria: false })}><X className="h-3.5 w-3.5 text-destructive" /></button>
                          </div>
                        </div>
                        {f.avaria && (
                          <Input className="mt-1 h-8 text-xs" placeholder="Descrição da avaria" value={f.observacao} onChange={(e) => setFoto(i, { observacao: e.target.value })} />
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Checklist */}
            <div>
              <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold"><ClipboardCheck className="h-4 w-4" /> Checklist</h4>
              <div className="grid gap-2 sm:grid-cols-2">
                {checklist.map((c, i) => (
                  <div key={c.item} className="rounded-lg border p-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{c.item}</span>
                      <div className="flex gap-1">
                        {([
                          { v: "ok", label: "OK", on: "bg-success text-white border-success", off: "border-success/40 text-success" },
                          { v: "avaria", label: "Avaria", on: "bg-destructive text-white border-destructive", off: "border-destructive/40 text-destructive" },
                          { v: "na", label: "N/A", on: "bg-muted-foreground text-white border-muted-foreground", off: "border-muted text-muted-foreground" },
                        ] as const).map((opt) => (
                          <button key={opt.v} type="button" onClick={() => setChk(i, { situacao: opt.v, ...(opt.v !== "avaria" ? { observacao: "" } : {}) })}
                            className={cn("rounded-full border px-2.5 py-1 text-xs font-medium transition", c.situacao === opt.v ? opt.on : "bg-background " + opt.off)}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {c.situacao === "avaria" && (
                      <Input className="mt-2 h-8 text-xs" placeholder="Descreva o problema observado" value={c.observacao ?? ""} onChange={(e) => setChk(i, { observacao: e.target.value })} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <Field label="Avarias / observações gerais"><Textarea value={avarias} onChange={(e) => setAvarias(e.target.value)} placeholder="Descreva riscos, amassados, faltas, etc." /></Field>
            <Field label="Observações"><Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} /></Field>

            {/* Assinatura */}
            <div>
              <h4 className="mb-2 text-sm font-semibold">Assinatura do locatário</h4>
              <AssinaturaCanvas onChange={setAssinatura} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="button" onClick={salvar} disabled={!vehicleId || create.isPending}>
              {create.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</> : "Salvar vistoria"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Anexar laudos externos em lote (PDFs do Vex ou outro sistema) */}
      <Dialog open={extOpen} onOpenChange={(o) => { setExtOpen(o); if (!o) setExtItens([]); }}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>Anexar laudos de outro sistema</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Selecione um ou vários laudos em PDF (ex.: Vex) de uma vez. A placa é lida de cada um e o veículo é vinculado automaticamente.</p>

            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-sm text-muted-foreground hover:bg-accent">
              {extLendo ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
              <span>{extLendo ? "Lendo os PDFs..." : "Selecionar laudos em PDF (vários de uma vez)"}</span>
              <input type="file" accept="application/pdf" multiple className="hidden" onChange={(e) => { onExtFiles(e.target.files); e.target.value = ""; }} />
            </label>

            {extItens.length > 0 && (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                      <th className="p-2 font-medium">Arquivo / Placa</th>
                      <th className="p-2 font-medium">Veículo</th>
                      <th className="p-2 font-medium">Tipo</th>
                      <th className="p-2 font-medium">Data</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {extItens.map((t, i) => (
                      <tr key={i} className={cn("border-b align-top", t.duplicado && "bg-destructive/5")}>
                        <td className="p-2">
                          <div className="max-w-40 truncate text-xs">{t.file.name}</div>
                          {t.placaLida ? <span className="font-mono text-xs font-medium">{t.placaLida}</span> : <span className="text-xs text-warning">placa não lida</span>}
                          {t.duplicado && <Badge variant="destructive" className="ml-1">já anexado ({t.motivoDup})</Badge>}
                        </td>
                        <td className="p-2">
                          <Select value={t.vehicleId} onValueChange={(v) => setItem(i, { vehicleId: v })}>
                            <SelectTrigger className="h-8 min-w-40 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>
                              {vehicles.map((v) => <SelectItem key={v.id} value={v.id}>{v.placa} — {v.modelo}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-2">
                          <Select value={t.tipo} onValueChange={(v) => setItem(i, { tipo: v })}>
                            <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {VISTORIA_TIPO.map((x) => <SelectItem key={x.value} value={x.value}>{x.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-2"><Input type="date" className="h-8 w-36 text-xs" value={t.data} onChange={(e) => setItem(i, { data: e.target.value })} /></td>
                        <td className="p-2 text-center">
                          <button type="button" onClick={() => setExtItens((its) => its.filter((_, idx) => idx !== i))}><X className="h-4 w-4 text-destructive" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {extItens.length > 0 && (
              <p className="text-xs text-muted-foreground">{extItens.filter((t) => t.vehicleId && !t.duplicado).length} de {extItens.length} laudo(s) prontos para anexar. Duplicados são ignorados; ajuste o veículo onde a placa não foi reconhecida.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setExtOpen(false); setExtItens([]); }}>Cancelar</Button>
            <Button onClick={salvarLote} disabled={extItens.filter((t) => t.vehicleId && !t.duplicado).length === 0 || extSalvando || extLendo}>
              {extSalvando ? <><Loader2 className="h-4 w-4 animate-spin" /> Anexando...</> : `Anexar ${extItens.filter((t) => t.vehicleId && !t.duplicado).length || ""} laudo(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EditorFoto
        file={editorIdx != null ? fotos[editorIdx].file : null}
        parte={editorIdx != null ? fotos[editorIdx].parte : ""}
        onClose={() => setEditorIdx(null)}
        onSave={(novo) => { if (editorIdx != null) setFoto(editorIdx, { file: novo, avaria: true }); }}
      />

      <VerVistoriaDialog id={viewId} onClose={() => setViewId(null)} />
    </div>
  );
}

function VerVistoriaDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data: v, isLoading } = useVistoriaDetalhe(id ?? undefined);
  const { data: config } = useAppConfig();
  const updateContato = useUpdateVistoriaContato();
  const atualizarFoto = useAtualizarFotoVistoria();
  const canWrite = useCanWrite("vistorias");
  const [editFoto, setEditFoto] = useState<{ path: string; parte: string; file: File } | null>(null);
  const [abrindoEditor, setAbrindoEditor] = useState<string | null>(null);

  // Abre o editor com a foto existente (baixa a imagem do Storage).
  async function marcarFotoExistente(f: { url: string | null; storage_path: string; parte: string }) {
    if (!f.url) return;
    setAbrindoEditor(f.storage_path);
    try {
      const blob = await (await fetch(f.url)).blob();
      setEditFoto({ path: f.storage_path, parte: f.parte, file: new File([blob], "foto.jpg", { type: blob.type || "image/jpeg" }) });
    } catch { toast.error("Não foi possível abrir a foto"); } finally { setAbrindoEditor(null); }
  }
  const [enviando, setEnviando] = useState<"whatsapp" | "email" | null>(null);
  const [contatoOpen, setContatoOpen] = useState<null | "whatsapp" | "email">(null);
  const [cTel, setCTel] = useState("");
  const [cEmail, setCEmail] = useState("");

  // Monta o HTML do laudo no padrão VIP CARS (inspirado no laudo Vex).
  function buildHtml(vv: VistoriaDetalhe, fotos: { parte: string; avaria: boolean; observacao: string | null; src: string | null }[], assinatura: string | null) {
    const empresa = config?.empresa_nome ?? "VIP CARS";
    const esc = (s: string | null | undefined) => (s ?? "").replace(/[<>&]/g, (m) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[m] as string));
    const campo = (label: string, valor: string) => `<div class="fld"><div class="lbl">${label}</div><div class="val">${valor || "—"}</div></div>`;
    const fotosHtml = fotos.map((f, i) => `<figure class="foto"><figcaption class="fcap-top">${i + 1}/${fotos.length} - ${esc(f.parte).toUpperCase()}${f.avaria ? ' <span class="av">AVARIA</span>' : ""}</figcaption>${f.src ? `<img src="${f.src}" alt="${esc(f.parte)}">` : '<div class="semfoto">sem foto</div>'}<figcaption class="fcap-bot">${esc(f.parte)}${f.avaria && f.observacao ? ` — ${esc(f.observacao)}` : ""}</figcaption></figure>`).join("");
    const chk = (vv.checklist ?? []).map((c) => {
      const cor = c.situacao === "ok" ? "#16a34a" : c.situacao === "avaria" ? "#dc2626" : "#6b7280";
      const txt = c.situacao === "ok" ? "OK" : c.situacao === "avaria" ? "AVARIA" : "N/A";
      return `<tr><td>${esc(c.item)}${c.situacao === "avaria" && c.observacao ? ` <span class="obs">(${esc(c.observacao)})</span>` : ""}</td><td style="text-align:right"><span class="pill" style="background:${cor}">${txt}</span></td></tr>`;
    }).join("");
    const header = `<div class="hd"><img class="logo" src="${VIPCAR_LOGO}"><div class="hd-r"><div>${empresa} — Laudo de Vistoria</div><div class="hd-tag">${esc(vv.vehicles?.placa ?? vv.placa ?? "")} · ${new Date(vv.created_at).toLocaleDateString("pt-BR")}</div></div></div><div class="bar"></div>`;
    const footer = `<div class="ft">${empresa} — Laudo de vistoria gerado pelo sistema · ${new Date().toLocaleString("pt-BR")}</div>`;
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${nomeArquivoLaudo(vv)}</title>
      <style>
      *{box-sizing:border-box} body{font-family:Arial,Helvetica,sans-serif;margin:0;padding:28px;color:#1a1a1a}
      .hd{display:flex;align-items:center;justify-content:space-between} .logo{height:60px;border-radius:8px}
      .hd-r{text-align:right;font-size:13px;font-weight:bold;color:#333} .hd-tag{font-weight:normal;color:#666;font-size:12px;margin-top:2px}
      .bar{height:8px;background:#c9c9c9;border-radius:4px;margin:10px 0 18px}
      h2{font-size:17px;font-weight:600;margin:18px 0 10px}
      .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px 14px;border-top:1px solid #eee;padding-top:10px}
      .fld .lbl{font-size:10px;font-weight:bold;color:#333;text-transform:none} .fld .val{font-size:12px;color:#111;margin-top:1px}
      .obsbox{margin-top:10px;font-size:12px;background:#fff5f5;border:1px solid #fdd;border-radius:6px;padding:8px}
      .leg{display:flex;flex-wrap:wrap;gap:12px;font-size:11px;color:#444;margin-bottom:10px}
      .legdot{display:inline-block;width:12px;height:12px;border-radius:50%;margin-right:4px;vertical-align:-1px}
      .fotos{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
      .foto{border:1px solid #ddd;border-radius:6px;overflow:hidden;margin:0}
      .foto img{width:100%;height:200px;object-fit:cover;display:block} .semfoto{height:200px;display:flex;align-items:center;justify-content:center;color:#aaa;background:#fafafa}
      .fcap-top{background:#333;color:#fff;font-size:10px;padding:3px 6px} .fcap-top .av{background:#dc2626;padding:0 4px;border-radius:3px;margin-left:4px}
      .fcap-bot{font-size:11px;color:#444;padding:4px 6px}
      table{border-collapse:collapse;width:100%;font-size:12px;margin-top:6px} td{border:1px solid #e5e5e5;padding:5px 8px}
      .pill{color:#fff;font-size:10px;font-weight:bold;padding:2px 8px;border-radius:10px} .obs{color:#dc2626;font-size:11px}
      .sig{margin-top:16px} .sig img{border:1px solid #ddd;max-width:300px;background:#fff}
      .ft{margin-top:24px;border-top:1px solid #eee;padding-top:8px;font-size:10px;color:#888;text-align:center}
      @media print{body{padding:0}}
      </style></head><body>
      ${header}
      <h2>Dados Principais</h2>
      <div class="grid">
        ${campo("Tipo / Operação", esc(tipoLabel(vv.tipo)))}
        ${campo("Data / Hora", esc(new Date(vv.created_at).toLocaleString("pt-BR")))}
        ${campo("Veículo", esc(`${vv.vehicles?.placa ?? vv.placa ?? ""} ${vv.vehicles?.modelo ?? ""}`))}
        ${campo("KM / Odômetro", esc(String(vv.km ?? "")))}
        ${campo("Combustível", esc(vv.combustivel ?? ""))}
        ${campo("Vistoriador", esc(vv.vistoriador ?? ""))}
        ${campo("Locatário", esc(vv.locatario_nome ?? ""))}
        ${campo("Documento", esc(vv.locatario_documento ?? ""))}
        ${campo("Telefone", esc(vv.locatario_telefone ?? ""))}
        ${campo("E-mail", esc(vv.locatario_email ?? ""))}
      </div>
      ${vv.avarias ? `<div class="obsbox"><strong>Avarias / observações:</strong> ${esc(vv.avarias)}</div>` : ""}
      ${fotos.length ? `<h2>Fotos da vistoria</h2>
      <div class="leg"><span><span class="legdot" style="background:#16a34a"></span>OK</span><span><span class="legdot" style="background:#dc2626"></span>Avaria</span></div>
      <div class="fotos">${fotosHtml}</div>` : ""}
      ${chk ? `<h2>Checklist</h2><table>${chk}</table>` : ""}
      ${assinatura ? `<div class="sig"><h2>Assinatura do locatário</h2><img src="${assinatura}"></div>` : ""}
      ${footer}
      </body></html>`;
  }

  // Abre o laudo. Se for importado de outro sistema, abre o PDF original;
  // caso contrário, gera para impressão/salvar em PDF (nome = placa-data-tipo).
  function laudo() {
    if (!v) return;
    if (v.laudo_externo_url) { window.open(v.laudo_externo_url, "_blank"); return; }
    const html = buildHtml(v, v.fotos.map((f) => ({ parte: f.parte, avaria: f.avaria, observacao: f.observacao, src: f.url })), v.assinatura_url);
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.document.title = nomeArquivoLaudo(v); setTimeout(() => w.print(), 400); }
  }

  const telLimpo = (t: string) => t.replace(/\D/g, "").replace(/^0+/, "");

  async function enviar(canal: "whatsapp" | "email", telefone?: string, email?: string) {
    if (!v) return;
    // Abre a aba/app IMEDIATAMENTE no clique, evitando o bloqueio de pop-up
    // que ocorre quando window.open é chamado depois de um await.
    const win = window.open("", "_blank");
    setEnviando(canal);
    try {
      const baseVars = {
        nome: v.locatario_nome ?? "", placa: v.vehicles?.placa ?? v.placa ?? "",
        tipo: tipoLabel(v.tipo), empresa: config?.empresa_nome ?? "VIP CARS",
      };
      // Gera o PDF do laudo (o externo, ou um a partir das fotos) uma única vez.
      let base64: string, blob: Blob;
      if (v.laudo_externo_url) {
        blob = await (await fetch(v.laudo_externo_url)).blob();
        base64 = await new Promise((res) => { const r = new FileReader(); r.onloadend = () => res((r.result as string).split(",")[1]); r.readAsDataURL(blob); });
      } else {
        const fotos = await Promise.all(v.fotos.map(async (f) => ({ parte: f.parte, avaria: f.avaria, observacao: f.observacao ?? "", dataUrl: await urlToDataUrl(f.url) })));
        const assinatura = await urlToDataUrl(v.assinatura_url);
        const pdf = await gerarLaudoPdf({
          tipoLabel: tipoLabel(v.tipo), placa: v.vehicles?.placa ?? v.placa ?? "—", modelo: v.vehicles?.modelo ?? "",
          km: String(v.km ?? "—"), combustivel: v.combustivel ?? "—", locatario: v.locatario_nome ?? "—",
          documento: v.locatario_documento ? `(${v.locatario_documento})` : "", vistoriador: v.vistoriador ?? "—",
          data: new Date(v.created_at).toLocaleString("pt-BR"), avarias: v.avarias ?? "",
          fotos, checklist: (v.checklist ?? []).map((c) => ({ item: c.item, situacao: c.situacao, observacao: c.observacao })), assinatura,
        });
        base64 = pdf.base64; blob = pdf.blob;
      }
      // Link do PDF (aberto nativamente no WhatsApp/navegador).
      const link = v.laudo_externo_url ?? await salvarLaudoPdfLink(v.id, blob);

      if (canal === "whatsapp") {
        const msg = aplicarTemplate(config?.laudo_whatsapp_msg ?? "", { ...baseVars, link: link ?? "" });
        const tel = telLimpo(telefone ?? v.locatario_telefone ?? "");
        const num = tel.length <= 11 ? `55${tel}` : tel;
        const url = `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
        if (win) win.location.href = url; else window.location.href = url;
      } else {
        const dest = email ?? v.locatario_email ?? "";
        const titulo = aplicarTemplate(config?.laudo_email_assunto ?? "", { ...baseVars, link: link ?? "" });
        const corpo = aplicarTemplate(config?.laudo_email_corpo ?? "", { ...baseVars, link: link ?? "" });
        const { data, error } = await supabase.functions.invoke("enviar-laudo-email", {
          body: {
            to: dest, subject: titulo, filename: `${nomeArquivoLaudo(v)}.pdf`, pdfBase64: base64,
            html: `<div style="font-family:Arial;font-size:14px;color:#111;white-space:pre-line">${corpo}</div>`,
          },
        });
        let erroMsg = error?.message;
        try { const ctx = (error as { context?: Response })?.context; const j = ctx && "json" in ctx ? await ctx.json() : null; if (j?.error) erroMsg = j.error; } catch { /* */ }
        if (error || data?.error) {
          const body = `${corpo}\n\nLaudo: ${link ?? ""}`;
          const murl = `mailto:${encodeURIComponent(dest)}?subject=${encodeURIComponent(titulo)}&body=${encodeURIComponent(body)}`;
          if (win) win.location.href = murl; else window.location.href = murl;
          toast.info("Servidor de e-mail não configurado — abrindo seu app de e-mail com o link do laudo.");
        } else {
          if (win) win.close();
          toast.success(`Laudo enviado para ${dest}`);
        }
      }
    } catch (e) {
      if (win) win.close();
      toast.error("Erro no envio: " + (e as Error).message);
    } finally {
      setEnviando(null);
    }
  }

  function onEnviarClick(canal: "whatsapp" | "email") {
    if (!v) return;
    const temContato = canal === "whatsapp" ? !!v.locatario_telefone : !!v.locatario_email;
    if (temContato) { enviar(canal); return; }
    setCTel(v.locatario_telefone ?? ""); setCEmail(v.locatario_email ?? "");
    setContatoOpen(canal);
  }

  function confirmarContato() {
    if (!v || !contatoOpen) return;
    const canal = contatoOpen;
    updateContato.mutate({ id: v.id, telefone: cTel || undefined, email: cEmail || undefined });
    setContatoOpen(null);
    enviar(canal, cTel, cEmail);
  }

  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>Vistoria {v ? `— ${v.vehicles?.placa ?? v.placa ?? ""}` : ""}</DialogTitle></DialogHeader>
        {isLoading || !v ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <span><Badge variant={tipoBadge[v.tipo]}>{tipoLabel(v.tipo)}</Badge></span>
              <span className="text-muted-foreground">KM: <strong className="text-foreground">{v.km ?? "—"}</strong></span>
              <span className="text-muted-foreground">Combustível: <strong className="text-foreground">{v.combustivel ?? "—"}</strong></span>
              <span className="text-muted-foreground">Locatário: <strong className="text-foreground">{v.locatario_nome ?? "—"}</strong></span>
              {v.locatario_documento && <span className="text-muted-foreground">Doc.: <strong className="text-foreground">{v.locatario_documento}</strong></span>}
              <span className="text-muted-foreground">WhatsApp: <strong className="text-foreground">{v.locatario_telefone ?? "—"}</strong></span>
              <span className="text-muted-foreground">E-mail: <strong className="text-foreground">{v.locatario_email ?? "—"}</strong></span>
              <span className="text-muted-foreground">Vistoriador: <strong className="text-foreground">{v.vistoriador ?? "—"}</strong></span>
              <span className="text-muted-foreground">{formatDate(v.created_at)}</span>
            </div>
            {v.avarias && <div className="rounded-lg bg-destructive/10 p-3 text-sm"><strong>Avarias:</strong> {v.avarias}</div>}
            {v.laudo_externo_url && (
              <div className="flex items-center gap-2 rounded-lg bg-primary/5 p-3 text-sm">
                <FileText className="h-4 w-4 shrink-0 text-primary" />
                <span>Laudo importado de outro sistema — clique em <strong>“Laudo (PDF)”</strong> para abrir o documento original.</span>
              </div>
            )}

            {v.fotos.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-semibold">Fotos ({v.fotos.length})</h4>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {v.fotos.map((f) => (
                    <div key={f.id} className="group relative">
                      <a href={f.url ?? "#"} target="_blank" rel="noreferrer" className="block">
                        {f.url && <img src={f.url} alt={f.parte} className="h-28 w-full rounded-lg border object-cover" />}
                        <div className="mt-0.5 text-[11px] text-muted-foreground">{f.parte} {f.avaria && <span className="text-destructive">· avaria</span>}</div>
                      </a>
                      {canWrite && (
                        <button type="button" title="Marcar avarias"
                          className="absolute right-1 top-1 rounded-md bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                          onClick={() => marcarFotoExistente(f)} disabled={abrindoEditor === f.storage_path}>
                          {abrindoEditor === f.storage_path ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(v.checklist?.length ?? 0) > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-semibold">Checklist</h4>
                <div className="grid grid-cols-2 gap-1 text-sm sm:grid-cols-3">
                  {v.checklist!.map((c) => (
                    <div key={c.item} className="rounded border px-2 py-1">
                      <div className="flex items-center justify-between">
                        <span>{c.item}</span>
                        <Badge variant={c.situacao === "ok" ? "success" : c.situacao === "avaria" ? "destructive" : "muted"}>{c.situacao.toUpperCase()}</Badge>
                      </div>
                      {c.situacao === "avaria" && c.observacao && <div className="mt-0.5 text-xs text-destructive">{c.observacao}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {v.assinatura_url && (
              <div>
                <h4 className="mb-1 text-sm font-semibold">Assinatura do locatário</h4>
                <img src={v.assinatura_url} alt="assinatura" className="max-w-xs rounded-lg border bg-white" />
              </div>
            )}

            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={laudo}><FileText className="h-4 w-4" /> Laudo (PDF)</Button>
              <Button type="button" variant="outline" className="border-green-600 text-green-700 hover:bg-green-50" onClick={() => onEnviarClick("whatsapp")} disabled={enviando !== null}>
                {enviando === "whatsapp" ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />} Enviar por WhatsApp
              </Button>
              <Button type="button" variant="outline" onClick={() => onEnviarClick("email")} disabled={enviando !== null}>
                {enviando === "email" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} Enviar por e-mail
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>

      {/* Preenchimento de contato no momento do envio */}
      <Dialog open={contatoOpen !== null} onOpenChange={(o) => !o && setContatoOpen(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{contatoOpen === "whatsapp" ? "Enviar por WhatsApp" : "Enviar por e-mail"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Informe o contato do locatário para envio do laudo. Ele será salvo na vistoria.</p>
            {contatoOpen === "whatsapp" ? (
              <Field label="WhatsApp / telefone">
                <Input type="tel" inputMode="tel" value={cTel} onChange={(e) => setCTel(e.target.value)} placeholder="(81) 99999-9999" autoFocus />
              </Field>
            ) : (
              <Field label="E-mail">
                <Input type="email" value={cEmail} onChange={(e) => setCEmail(e.target.value)} placeholder="locatario@email.com" autoFocus />
              </Field>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setContatoOpen(null)}>Cancelar</Button>
            <Button type="button" onClick={confirmarContato} disabled={contatoOpen === "whatsapp" ? !cTel : !cEmail}>Enviar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Editor de marcação de foto já salva */}
      <EditorFoto
        file={editFoto?.file ?? null}
        parte={editFoto?.parte ?? ""}
        onClose={() => setEditFoto(null)}
        onSave={(novo) => { if (editFoto) atualizarFoto.mutate({ storagePath: editFoto.path, file: novo }); }}
      />
    </Dialog>
  );
}
