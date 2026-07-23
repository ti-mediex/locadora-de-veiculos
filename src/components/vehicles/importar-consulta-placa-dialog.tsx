import { useMemo, useRef, useState } from "react";
import { Upload, FileText, AlertTriangle, Loader2, X, CheckCircle2, Car } from "lucide-react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { extrairTextoPdf } from "@/lib/pdf-text";
import { parseConsultaPlaca, type ConsultaPlacaParsed } from "@/lib/consulta-placa-parse";
import { useImportConsultaPlacaLote } from "@/hooks/use-import-veiculo";
import type { Vehicle } from "@/types/database";

const normPlaca = (p: string) => p.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

interface Item { file: File; parsed: ConsultaPlacaParsed; vehicleId: string | null; erro?: string; }

export function ImportarConsultaPlacaDialog({
  open, onOpenChange, vehicles,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  vehicles: Vehicle[];
}) {
  const importar = useImportConsultaPlacaLote();
  const inputRef = useRef<HTMLInputElement>(null);
  const [itens, setItens] = useState<Item[]>([]);
  const [lendo, setLendo] = useState(false);

  const placaMap = useMemo(() => new Map(vehicles.map((v) => [normPlaca(v.placa), v])), [vehicles]);

  function reset() { setItens([]); setLendo(false); }

  async function onFiles(files: FileList | null) {
    if (!files || !files.length) return;
    setLendo(true);
    const novos: Item[] = [];
    for (const file of Array.from(files)) {
      try {
        const parsed = parseConsultaPlaca(await extrairTextoPdf(file));
        if (!parsed.placa) { novos.push({ file, parsed, vehicleId: null, erro: "Placa não identificada (é o PDF da Consulta Placa?)" }); continue; }
        novos.push({ file, parsed, vehicleId: placaMap.get(parsed.placa)?.id ?? null });
      } catch (e) {
        novos.push({ file, parsed: { placa: "", restricoes: [] } as unknown as ConsultaPlacaParsed, vehicleId: null, erro: (e as Error).message });
      }
    }
    setItens((prev) => { const nomes = new Set(prev.map((i) => i.file.name)); return [...prev, ...novos.filter((i) => !nomes.has(i.file.name))]; });
    setLendo(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  const validos = itens.filter((i) => !i.erro && i.parsed.placa);
  const criar = validos.filter((i) => !i.vehicleId).length;
  const atualizar = validos.filter((i) => i.vehicleId).length;

  function fechar() { reset(); onOpenChange(false); }
  async function confirmar() {
    if (!validos.length) return;
    const r = await importar.mutateAsync({ itens: validos.map((i) => ({ parsed: i.parsed, vehicleId: i.vehicleId, file: i.file })) });
    if (r) fechar();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : fechar())}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar Consulta Placa (em lote)</DialogTitle>
          <DialogDescription>Selecione um ou vários PDFs da "Consulta Placa" — cada arquivo atualiza (ou cria) o veículo pela placa detectada.</DialogDescription>
        </DialogHeader>

        <input ref={inputRef} type="file" accept="application/pdf" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
        <button type="button" onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/25 p-6 text-center transition-colors hover:border-primary/50 hover:bg-accent">
          {lendo ? <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /> : <Upload className="h-7 w-7 text-muted-foreground" />}
          <span className="text-sm font-medium">{lendo ? "Lendo PDFs..." : "Clique para selecionar os PDFs"}</span>
          <span className="text-xs text-muted-foreground">Aceita seleção múltipla</span>
        </button>

        {itens.length > 0 && (
          <div className="max-h-[42vh] space-y-2 overflow-auto">
            {itens.map((it, i) => (
              <div key={it.file.name + i} className="flex items-start gap-3 rounded-lg border p-3">
                <FileText className={`mt-0.5 h-5 w-5 shrink-0 ${it.erro ? "text-destructive" : "text-primary"}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{it.file.name}</p>
                  {it.erro ? (
                    <p className="flex items-center gap-1 text-xs text-destructive"><AlertTriangle className="h-3 w-3" /> {it.erro}</p>
                  ) : (
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <Badge variant="secondary" className="font-mono">{it.parsed.placa}</Badge>
                      <span>{[it.parsed.marca, it.parsed.modelo].filter(Boolean).join(" ") || "—"}</span>
                      {it.vehicleId
                        ? <Badge variant="outline">atualizar existente</Badge>
                        : <Badge variant="outline" className="border-success text-success gap-1"><Car className="h-3 w-3" /> criar novo</Badge>}
                    </div>
                  )}
                </div>
                <button type="button" onClick={() => setItens((prev) => prev.filter((_, idx) => idx !== i))} className="shrink-0 text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        )}

        {validos.length > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3 text-sm font-medium">
            <CheckCircle2 className="h-4 w-4 text-success" /> {validos.length} PDF(s) · {atualizar} atualização(ões) · {criar} novo(s) veículo(s)
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={fechar} disabled={importar.isPending}>Cancelar</Button>
          <Button onClick={confirmar} disabled={!validos.length || importar.isPending}>
            {importar.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Importando...</> : `Importar ${validos.length || ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
