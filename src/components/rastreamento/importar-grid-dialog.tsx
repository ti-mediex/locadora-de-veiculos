import { useMemo, useRef, useState } from "react";
import { Upload, FileSpreadsheet, X, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { parseIturanGrid, type GridParsed } from "@/lib/ituran-grid-parse";
import { useImportarGrid } from "@/hooks/use-rastreamento";

interface ArquivoParsed { file: File; parsed: GridParsed; erro?: string; }

export function ImportarGridDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arquivos, setArquivos] = useState<ArquivoParsed[]>([]);
  const [lendo, setLendo] = useState(false);
  const importar = useImportarGrid();

  async function onFiles(files: FileList | null) {
    if (!files || !files.length) return;
    setLendo(true);
    const novos: ArquivoParsed[] = [];
    for (const file of Array.from(files)) {
      try {
        const parsed = parseIturanGrid(await file.arrayBuffer());
        if (!parsed.itens.length) novos.push({ file, parsed, erro: "Nenhum veículo encontrado na planilha" });
        else novos.push({ file, parsed });
      } catch (e) {
        novos.push({ file, parsed: { itens: [], referencia: null, placas: [], total: 0 }, erro: (e as Error).message });
      }
    }
    setArquivos((prev) => {
      const nomes = new Set(prev.map((a) => a.file.name));
      return [...prev, ...novos.filter((a) => !nomes.has(a.file.name))];
    });
    setLendo(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  const validos = arquivos.filter((a) => !a.erro && a.parsed.itens.length);
  const totalVeic = useMemo(() => new Set(validos.flatMap((a) => a.parsed.placas)).size, [validos]);

  function fechar() { setArquivos([]); onOpenChange(false); }
  async function confirmar() {
    if (!validos.length) return;
    try { await importar.mutateAsync({ arquivos: validos.map((a) => ({ file: a.file, parsed: a.parsed })) }); fechar(); }
    catch { /* toast no hook */ }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : fechar())}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Importar rastreamento Ituran</DialogTitle>
          <DialogDescription>
            Relatório "Grade de veículos" (MyGridData, .xlsx) — traz a última comunicação de cada veículo com a central.
          </DialogDescription>
        </DialogHeader>

        <input ref={inputRef} type="file" accept=".xlsx,.xls" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />

        <button type="button" onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/25 p-6 text-center transition-colors hover:border-primary/50 hover:bg-accent">
          {lendo ? <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /> : <Upload className="h-8 w-8 text-muted-foreground" />}
          <span className="text-sm font-medium">{lendo ? "Lendo planilha..." : "Clique para selecionar o relatório"}</span>
          <span className="text-xs text-muted-foreground">.xlsx do sistema Ituran</span>
        </button>

        {arquivos.length > 0 && (
          <div className="max-h-[36vh] space-y-2 overflow-auto">
            {arquivos.map((a, i) => (
              <div key={a.file.name + i} className="flex items-start gap-3 rounded-lg border p-3">
                <FileSpreadsheet className={`mt-0.5 h-5 w-5 shrink-0 ${a.erro ? "text-destructive" : "text-primary"}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.file.name}</p>
                  {a.erro ? (
                    <p className="flex items-center gap-1 text-xs text-destructive"><AlertTriangle className="h-3 w-3" /> {a.erro}</p>
                  ) : (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {a.parsed.total} veículo(s){a.parsed.referencia ? ` · atualizado em ${a.parsed.referencia.slice(8, 10)}/${a.parsed.referencia.slice(5, 7)}/${a.parsed.referencia.slice(0, 4)} ${a.parsed.referencia.slice(11, 16)}` : ""}
                    </p>
                  )}
                </div>
                <button type="button" onClick={() => setArquivos((prev) => prev.filter((_, idx) => idx !== i))} className="shrink-0 text-muted-foreground hover:text-destructive">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {validos.length > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3 text-sm font-medium">
            <CheckCircle2 className="h-4 w-4 text-success" /> {totalVeic} veículo(s) serão atualizados
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={fechar} disabled={importar.isPending}>Cancelar</Button>
          <Button onClick={confirmar} disabled={!validos.length || importar.isPending}>
            {importar.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Importando...</> : "Importar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
