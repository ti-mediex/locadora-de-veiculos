import { useMemo, useState } from "react";
import {
  Plus, Search, Trash2, Eye, Camera, ClipboardCheck, MapPin, FileText, Loader2, AlertTriangle, X, MessageCircle, Mail,
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
import {
  useVistorias, useVistoriaDetalhe, useCreateVistoria, useDeleteVistoria,
  useUpdateVistoriaContato, gerarLinkLaudo, nomeArquivoLaudo,
  type FotoInput, type VistoriaDetalhe,
} from "@/hooks/use-vistorias";
import { VISTORIA_TIPO, VISTORIA_COMBUSTIVEL, VISTORIA_PARTES, VISTORIA_CHECKLIST_ITENS } from "@/lib/options";
import { formatDate } from "@/lib/format";
import type { Vehicle, ChecklistItem } from "@/types/database";

const tipoLabel = (t: string) => VISTORIA_TIPO.find((x) => x.value === t)?.label ?? t;
const tipoBadge: Record<string, "success" | "warning" | "destructive"> = { liberacao: "success", devolucao: "warning", sinistro: "destructive" };

export default function VistoriasPage() {
  const { data: rows = [], isLoading } = useVistorias();
  const { data: vehicles = [] } = useList<Vehicle>("vehicles");
  const create = useCreateVistoria();
  const remove = useDeleteVistoria();
  const canWrite = useCanWrite("vistorias");

  const [open, setOpen] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [fTipo, setFTipo] = useState("todos");

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
    return rows.filter((r) => {
      const matchTipo = fTipo === "todos" || r.tipo === fTipo;
      const matchSearch = !q || (r.vehicles?.placa ?? "").toLowerCase().includes(q) || (r.locatario_nome ?? "").toLowerCase().includes(q);
      return matchTipo && matchSearch;
    });
  }, [rows, search, fTipo]);

  const fotosPreenchidas = fotos.filter((f) => f.file).length;
  const hoje = new Date().toISOString().slice(0, 10);
  const noMes = rows.filter((r) => r.created_at.slice(0, 7) === hoje.slice(0, 7)).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vistoria de veículos"
        description="Checklist com fotos na liberação, devolução e sinistro"
        actions={canWrite && <Button onClick={abrirNova}><Plus className="h-4 w-4" /> Nova vistoria</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Total de vistorias" value={rows.length} icon={<ClipboardCheck className="h-5 w-5" />} />
        <StatCard title="No mês" value={noMes} icon={<Camera className="h-5 w-5" />} />
        <StatCard title="Sinistros registrados" value={rows.filter((r) => r.tipo === "sinistro").length} tone="destructive" icon={<AlertTriangle className="h-5 w-5" />} />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flex flex-col gap-2 border-b p-4 sm:flex-row sm:items-center">
            <div className="flex flex-1 items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por placa ou locatário..." value={search} onChange={(e) => setSearch(e.target.value)} className="border-0 focus-visible:ring-0" />
            </div>
            <Select value={fTipo} onValueChange={setFTipo}>
              <SelectTrigger className="w-full sm:w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os tipos</SelectItem>
                {VISTORIA_TIPO.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <EmptyState message="Nenhuma vistoria registrada" icon={<ClipboardCheck className="h-6 w-6" />} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Locatário</TableHead>
                  <TableHead className="text-right">KM</TableHead>
                  <TableHead>Fotos</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => setViewId(r.id)}>
                    <TableCell className="whitespace-nowrap text-sm">{new Date(r.created_at).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="font-mono font-medium">{r.vehicles?.placa ?? r.placa ?? "—"}</TableCell>
                    <TableCell><Badge variant={tipoBadge[r.tipo]}>{tipoLabel(r.tipo)}</Badge></TableCell>
                    <TableCell>{r.locatario_nome ?? "—"}</TableCell>
                    <TableCell className="text-right">{r.km ?? "—"}</TableCell>
                    <TableCell>{r.fotos?.[0]?.count ?? 0}</TableCell>
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
                      {f.file ? (
                        <img src={URL.createObjectURL(f.file)} alt={f.parte} className="h-20 w-full rounded object-cover" />
                      ) : (
                        <><Camera className="h-4 w-4" /> Tirar / escolher foto</>
                      )}
                      <input type="file" accept="image/*" capture="environment" className="hidden"
                        onChange={(e) => setFoto(i, { file: e.target.files?.[0] ?? null })} />
                    </label>
                    {f.file && (
                      <div className="mt-1 flex items-center justify-between gap-2 text-xs">
                        <label className="flex items-center gap-1">
                          <input type="checkbox" checked={f.avaria} onChange={(e) => setFoto(i, { avaria: e.target.checked })} /> Avaria
                        </label>
                        <button type="button" onClick={() => setFoto(i, { file: null, avaria: false })}><X className="h-3.5 w-3.5 text-destructive" /></button>
                      </div>
                    )}
                    {f.file && f.avaria && (
                      <Input className="mt-1 h-8 text-xs" placeholder="Descrição da avaria" value={f.observacao} onChange={(e) => setFoto(i, { observacao: e.target.value })} />
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
                  <div key={c.item} className="flex items-center justify-between gap-2 rounded border px-2 py-1 text-sm">
                    <span>{c.item}</span>
                    <Select value={c.situacao} onValueChange={(v) => setChk(i, { situacao: v as ChecklistItem["situacao"] })}>
                      <SelectTrigger className="h-7 w-24 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ok">OK</SelectItem>
                        <SelectItem value="avaria">Avaria</SelectItem>
                        <SelectItem value="na">N/A</SelectItem>
                      </SelectContent>
                    </Select>
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

      <VerVistoriaDialog id={viewId} onClose={() => setViewId(null)} />
    </div>
  );
}

function VerVistoriaDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data: v, isLoading } = useVistoriaDetalhe(id ?? undefined);
  const updateContato = useUpdateVistoriaContato();
  const [enviando, setEnviando] = useState<"whatsapp" | "email" | null>(null);
  const [contatoOpen, setContatoOpen] = useState<null | "whatsapp" | "email">(null);
  const [cTel, setCTel] = useState("");
  const [cEmail, setCEmail] = useState("");

  // Monta o HTML do laudo; recebe as fotos com o src já resolvido (url ou dataURL).
  function buildHtml(vv: VistoriaDetalhe, fotos: { parte: string; avaria: boolean; observacao: string | null; src: string | null }[], assinatura: string | null) {
    const fotosHtml = fotos.map((f) => `<div class="foto"><div class="cap">${f.parte}${f.avaria ? " — AVARIA" : ""}${f.observacao ? `: ${f.observacao}` : ""}</div>${f.src ? `<img src="${f.src}">` : ""}</div>`).join("");
    const chk = (vv.checklist ?? []).map((c) => `<tr><td>${c.item}</td><td>${c.situacao.toUpperCase()}</td></tr>`).join("");
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${nomeArquivoLaudo(vv)}</title>
      <style>body{font-family:Arial;margin:24px;color:#111} h1{font-size:18px} .meta{font-size:12px;color:#555;margin-bottom:12px}
      .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px} .foto img{width:100%;height:150px;object-fit:cover;border:1px solid #ddd;border-radius:6px}
      .cap{font-size:10px;margin:4px 0} table{border-collapse:collapse;width:60%;font-size:12px;margin-top:10px} td{border:1px solid #ddd;padding:4px 8px}
      .sig{margin-top:12px} .sig img{border:1px solid #ddd;max-width:320px}</style></head><body>
      <h1>VIP CARS — Laudo de Vistoria (${tipoLabel(vv.tipo)})</h1>
      <div class="meta">Veículo: ${vv.vehicles?.placa ?? vv.placa ?? "—"} ${vv.vehicles?.modelo ?? ""} · KM: ${vv.km ?? "—"} · Combustível: ${vv.combustivel ?? "—"}<br>
      Locatário: ${vv.locatario_nome ?? "—"} ${vv.locatario_documento ? `(${vv.locatario_documento})` : ""} · Vistoriador: ${vv.vistoriador ?? "—"}<br>
      Data: ${new Date(vv.created_at).toLocaleString("pt-BR")}</div>
      ${vv.avarias ? `<p><strong>Avarias:</strong> ${vv.avarias}</p>` : ""}
      <div class="grid">${fotosHtml}</div>
      <table>${chk}</table>
      ${assinatura ? `<div class="sig"><div class="cap">Assinatura do locatário</div><img src="${assinatura}"></div>` : ""}
      </body></html>`;
  }

  // Abre o laudo para impressão/salvar em PDF (nome do arquivo = placa-data-tipo).
  function laudo() {
    if (!v) return;
    const html = buildHtml(v, v.fotos.map((f) => ({ parte: f.parte, avaria: f.avaria, observacao: f.observacao, src: f.url })), v.assinatura_url);
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.document.title = nomeArquivoLaudo(v); setTimeout(() => w.print(), 400); }
  }

  const telLimpo = (t: string) => t.replace(/\D/g, "").replace(/^0+/, "");

  async function enviar(canal: "whatsapp" | "email", telefone?: string, email?: string) {
    if (!v) return;
    setEnviando(canal);
    try {
      const link = await gerarLinkLaudo(v, (fotos, assinatura) =>
        buildHtml(v, fotos.map((f) => ({ parte: f.parte, avaria: f.avaria, observacao: f.observacao, src: f.dataUrl })), assinatura));
      const titulo = `Laudo de vistoria (${tipoLabel(v.tipo)}) — ${v.vehicles?.placa ?? v.placa ?? ""}`;
      const msg = `Olá${v.locatario_nome ? ` ${v.locatario_nome}` : ""}! Segue o laudo da vistoria do veículo ${v.vehicles?.placa ?? v.placa ?? ""} (${tipoLabel(v.tipo)}).\n\nLaudo: ${link}\n\nVIP CARS`;
      if (canal === "whatsapp") {
        const tel = telLimpo(telefone ?? v.locatario_telefone ?? "");
        const num = tel.length <= 11 ? `55${tel}` : tel;
        window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, "_blank");
      } else {
        const dest = email ?? v.locatario_email ?? "";
        window.open(`mailto:${dest}?subject=${encodeURIComponent(titulo)}&body=${encodeURIComponent(msg)}`, "_blank");
      }
    } catch (e) {
      alert("Erro ao gerar o laudo: " + (e as Error).message);
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
              <span className="text-muted-foreground">Vistoriador: <strong className="text-foreground">{v.vistoriador ?? "—"}</strong></span>
              <span className="text-muted-foreground">{formatDate(v.created_at)}</span>
            </div>
            {v.avarias && <div className="rounded-lg bg-destructive/10 p-3 text-sm"><strong>Avarias:</strong> {v.avarias}</div>}

            {v.fotos.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-semibold">Fotos ({v.fotos.length})</h4>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {v.fotos.map((f) => (
                    <a key={f.id} href={f.url ?? "#"} target="_blank" rel="noreferrer" className="block">
                      {f.url && <img src={f.url} alt={f.parte} className="h-28 w-full rounded-lg border object-cover" />}
                      <div className="mt-0.5 text-[11px] text-muted-foreground">{f.parte} {f.avaria && <span className="text-destructive">· avaria</span>}</div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {(v.checklist?.length ?? 0) > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-semibold">Checklist</h4>
                <div className="grid grid-cols-2 gap-1 text-sm sm:grid-cols-3">
                  {v.checklist!.map((c) => (
                    <div key={c.item} className="flex items-center justify-between rounded border px-2 py-1">
                      <span>{c.item}</span>
                      <Badge variant={c.situacao === "ok" ? "success" : c.situacao === "avaria" ? "destructive" : "muted"}>{c.situacao.toUpperCase()}</Badge>
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
    </Dialog>
  );
}
