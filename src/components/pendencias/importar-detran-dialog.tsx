import { useMemo, useRef, useState } from "react";
import { Upload, FileText, AlertTriangle, Loader2, X, CheckCircle2, TrendingDown, Paperclip } from "lucide-react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { parseDetran, type DetranParsed } from "@/lib/detran-parse";
import { extrairTextoPdf } from "@/lib/pdf-text";
import {
  useImportDetranLote, usePendencias, reconciliarDetran, useAplicarBaixaDetran, useAnexarLoteDetran,
  type ImportDetranOpcoes, type BaixaDetranItem, type PendenciaRow,
} from "@/hooks/use-pendencias";
import { formatCurrency, maskPlaca } from "@/lib/format";
import type { Vehicle } from "@/types/database";

const normPlaca = (p: string) => p.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

interface Item { file: File; parsed: DetranParsed; placa: string | null; vehicleId: string | null; erro?: string; }

export function ImportarDetranDialog({
  open, onOpenChange, vehicles, vehicleIdInicial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  vehicles: Vehicle[];
  vehicleIdInicial?: string;
}) {
  const importar = useImportDetranLote();
  const aplicarBaixa = useAplicarBaixaDetran();
  const anexarLote = useAnexarLoteDetran();
  const { data: pendencias = [] } = usePendencias();
  const inputRef = useRef<HTMLInputElement>(null);
  const [itens, setItens] = useState<Item[]>([]);
  const [lendo, setLendo] = useState(false);
  const [opcoes, setOpcoes] = useState<ImportDetranOpcoes>({ restricoes: true, debitos: true, multas: true, marcarAlienacao: true });
  const [darBaixa, setDarBaixa] = useState(true);

  const placaMap = useMemo(() => new Map(vehicles.map((v) => [normPlaca(v.placa), v])), [vehicles]);
  const pendPorVeic = useMemo(() => {
    const m = new Map<string, PendenciaRow[]>();
    for (const p of pendencias) { const a = m.get(p.vehicle_id) ?? []; a.push(p); m.set(p.vehicle_id, a); }
    return m;
  }, [pendencias]);

  function reset() { setItens([]); setLendo(false); }

  async function onFiles(files: FileList | null) {
    if (!files || !files.length) return;
    setLendo(true);
    const novos: Item[] = [];
    for (const file of Array.from(files)) {
      try {
        const parsed = parseDetran(await extrairTextoPdf(file));
        const placa = parsed.placa ? normPlaca(parsed.placa) : null;
        const vid = placa ? placaMap.get(placa)?.id ?? null : (vehicleIdInicial ?? null);
        const vazio = parsed.restricoes.length === 0 && parsed.debitos.length === 0 && parsed.multas.length === 0;
        novos.push({ file, parsed, placa, vehicleId: vid, erro: vazio ? "Nenhum débito/pendência reconhecido" : !vid ? "Placa não cadastrada na frota" : undefined });
      } catch (e) {
        novos.push({ file, parsed: { placa: null, restricoes: [], debitos: [], multas: [] } as unknown as DetranParsed, placa: null, vehicleId: null, erro: (e as Error).message });
      }
    }
    setItens((prev) => { const nomes = new Set(prev.map((i) => i.file.name)); return [...prev, ...novos.filter((i) => !nomes.has(i.file.name))]; });
    setLendo(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  const validos = itens.filter((i) => !i.erro && i.vehicleId);
  const tot = useMemo(() => validos.reduce((a, i) => ({
    r: a.r + i.parsed.restricoes.length,
    d: a.d + i.parsed.debitos.length,
    m: a.m + i.parsed.multas.length,
    v: a.v + i.parsed.debitos.reduce((s, x) => s + x.valor, 0) + i.parsed.multas.reduce((s, x) => s + x.valor, 0),
  }), { r: 0, d: 0, m: 0, v: 0 }), [validos]);
  const semPlaca = itens.filter((i) => i.erro === "Placa não cadastrada na frota");

  // Débitos pagos detectados (some da consulta atual) → baixa + despesa.
  const baixas = useMemo<BaixaDetranItem[]>(() => {
    const out: BaixaDetranItem[] = [];
    for (const it of validos) if (it.vehicleId) out.push(...reconciliarDetran(it.parsed, pendPorVeic.get(it.vehicleId) ?? []));
    return out;
  }, [validos, pendPorVeic]);
  const totalBaixa = baixas.reduce((s, b) => s + b.valor, 0);

  function fechar() { reset(); setDarBaixa(true); onOpenChange(false); }
  async function confirmar() {
    if (!validos.length) return;
    const r = await importar.mutateAsync({ itens: validos.map((i) => ({ parsed: i.parsed, vehicleId: i.vehicleId as string, placa: i.placa, file: i.file })), opcoes });
    if (r) {
      if (darBaixa && baixas.length) await aplicarBaixa.mutateAsync(baixas);
      fechar();
    }
  }
  function onAnexos(files: FileList | null, campo: "boleto_path" | "comprovante_path") {
    if (files && files.length) anexarLote.mutate({ arquivos: Array.from(files), campo });
  }

  const chk = (k: keyof ImportDetranOpcoes, label: string) => (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" className="h-4 w-4" checked={opcoes[k]} onChange={(e) => setOpcoes((o) => ({ ...o, [k]: e.target.checked }))} /> {label}
    </label>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : fechar())}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar débitos do Detran (em lote)</DialogTitle>
          <DialogDescription>Selecione um ou vários PDFs do "Detalhamento de débitos" — cada arquivo é associado ao veículo pela placa detectada.</DialogDescription>
        </DialogHeader>

        <input ref={inputRef} type="file" accept="application/pdf" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
        <button type="button" onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/25 p-6 text-center transition-colors hover:border-primary/50 hover:bg-accent">
          {lendo ? <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /> : <Upload className="h-7 w-7 text-muted-foreground" />}
          <span className="text-sm font-medium">{lendo ? "Lendo PDFs..." : "Clique para selecionar os PDFs"}</span>
          <span className="text-xs text-muted-foreground">Aceita seleção múltipla</span>
        </button>

        <div className="flex flex-wrap gap-x-5 gap-y-1 rounded-lg border p-3">
          {chk("restricoes", "Restrições")}
          {chk("debitos", "Débitos (IPVA, licenc.)")}
          {chk("multas", "Multas")}
          {chk("marcarAlienacao", "Marcar alienação")}
        </div>

        {itens.length > 0 && (
          <div className="max-h-[38vh] space-y-2 overflow-auto">
            {itens.map((it, i) => (
              <div key={it.file.name + i} className="flex items-start gap-3 rounded-lg border p-3">
                <FileText className={`mt-0.5 h-5 w-5 shrink-0 ${it.erro ? "text-destructive" : "text-primary"}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{it.file.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    {it.placa && <Badge variant="secondary" className="font-mono">{it.placa}</Badge>}
                    {it.erro
                      ? <span className="inline-flex items-center gap-1 text-destructive"><AlertTriangle className="h-3 w-3" /> {it.erro}</span>
                      : <span>{it.parsed.restricoes.length} restr. · {it.parsed.debitos.length} déb. · {it.parsed.multas.length} multa(s)</span>}
                  </div>
                </div>
                <button type="button" onClick={() => setItens((prev) => prev.filter((_, idx) => idx !== i))} className="shrink-0 text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        )}

        {validos.length > 0 && (
          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <div className="flex items-center gap-2 font-medium"><CheckCircle2 className="h-4 w-4 text-success" /> {validos.length} veículo(s) · {tot.r} restrições · {tot.d} débitos · {tot.m} multas · {formatCurrency(tot.v)}</div>
            {semPlaca.length > 0 && <p className="mt-1 text-xs text-warning">{semPlaca.length} PDF(s) com placa fora da frota serão ignorados.</p>}
          </div>
        )}

        {baixas.length > 0 && (
          <div className="space-y-2 rounded-lg border border-success/40 bg-success/5 p-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" className="h-4 w-4" checked={darBaixa} onChange={(e) => setDarBaixa(e.target.checked)} />
              <TrendingDown className="h-4 w-4 text-success" /> {baixas.length} débito(s) pago(s) detectado(s) — dar baixa e lançar despesa ({formatCurrency(totalBaixa)})
            </label>
            <div className="max-h-32 space-y-1 overflow-auto text-xs">
              {baixas.map((b, i) => (
                <div key={i} className="flex items-center justify-between gap-2">
                  <span className="truncate"><span className="font-mono">{maskPlaca(b.pendencia.vehicles?.placa ?? "")}</span> · {b.pendencia.titulo} <span className="text-muted-foreground">({b.categoriaDespesa})</span></span>
                  <span className="whitespace-nowrap tabular-nums text-destructive">{formatCurrency(b.valor)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2 rounded-lg border p-3">
          <div className="flex items-center gap-2 text-sm font-medium"><Paperclip className="h-4 w-4 text-muted-foreground" /> Anexar por placa (opcional)</div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="space-y-1 text-xs text-muted-foreground">Boletos (nome com a placa)
              <Input type="file" accept="application/pdf,image/*" multiple className="h-9 text-xs" onChange={(e) => onAnexos(e.target.files, "boleto_path")} disabled={anexarLote.isPending} />
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">Comprovantes (nome com a placa)
              <Input type="file" accept="application/pdf,image/*" multiple className="h-9 text-xs" onChange={(e) => onAnexos(e.target.files, "comprovante_path")} disabled={anexarLote.isPending} />
            </label>
          </div>
          <p className="text-[11px] text-muted-foreground">Casa pela placa no nome do arquivo e anexa às despesas/pendências pagas do veículo.</p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={fechar} disabled={importar.isPending || aplicarBaixa.isPending}>Cancelar</Button>
          <Button onClick={confirmar} disabled={!validos.length || importar.isPending || aplicarBaixa.isPending}>
            {importar.isPending || aplicarBaixa.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Processando...</> : `Importar ${validos.length || ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
