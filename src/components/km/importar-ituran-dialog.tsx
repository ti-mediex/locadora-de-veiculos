import { useMemo, useRef, useState } from "react";
import { Upload, FileSpreadsheet, X, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { parseIturanXlsx, type IturanParsed } from "@/lib/ituran-parse";
import { useImportarIturan } from "@/hooks/use-km";
import { useAppConfig } from "@/hooks/use-app-config";
import { useList } from "@/hooks/use-crud";
import type { Vehicle } from "@/types/database";

interface ArquivoParsed {
  file: File;
  parsed: IturanParsed;
  erro?: string;
}

const normPlaca = (p: string) => p.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

export function ImportarIturanDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arquivos, setArquivos] = useState<ArquivoParsed[]>([]);
  const [lendo, setLendo] = useState(false);
  const { data: config } = useAppConfig();
  const { data: veiculos = [] } = useList<Vehicle>("vehicles");
  const importar = useImportarIturan();

  const placasFrota = useMemo(
    () => new Set(veiculos.map((v) => normPlaca(v.placa))),
    [veiculos]
  );

  async function onFiles(files: FileList | null) {
    if (!files || !files.length) return;
    setLendo(true);
    const endereco = config?.endereco_manutencao ?? "";
    const novos: ArquivoParsed[] = [];
    for (const file of Array.from(files)) {
      try {
        const buf = await file.arrayBuffer();
        const parsed = parseIturanXlsx(buf, endereco);
        if (!parsed.itens.length) novos.push({ file, parsed, erro: "Nenhuma leitura de odômetro encontrada" });
        else novos.push({ file, parsed });
      } catch (e) {
        novos.push({ file, parsed: { itens: [], placas: [], periodoIni: null, periodoFim: null, totalRegistros: 0 }, erro: (e as Error).message });
      }
    }
    // Evita duplicados pelo nome do arquivo
    setArquivos((prev) => {
      const nomes = new Set(prev.map((a) => a.file.name));
      return [...prev, ...novos.filter((a) => !nomes.has(a.file.name))];
    });
    setLendo(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  const validos = arquivos.filter((a) => !a.erro && a.parsed.itens.length);
  const totalDias = validos.reduce((s, a) => s + a.parsed.itens.length, 0);
  const placasSemVeiculo = useMemo(() => {
    const set = new Set<string>();
    for (const a of validos) for (const p of a.parsed.placas) if (!placasFrota.has(normPlaca(p))) set.add(p);
    return [...set];
  }, [validos, placasFrota]);

  function fechar() {
    setArquivos([]);
    onOpenChange(false);
  }

  async function confirmar() {
    if (!validos.length) return;
    try {
      await importar.mutateAsync({ arquivos: validos.map((a) => ({ file: a.file, parsed: a.parsed })) });
      fechar();
    } catch {
      /* erro já exibido no toast do hook; mantém o diálogo aberto */
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : fechar())}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar planilhas do Ituran</DialogTitle>
          <DialogDescription>
            Relatório de ociosidade (.xlsx). Selecione uma ou várias planilhas — de veículos diferentes — para apuração em lote.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          multiple
          className="hidden"
          onChange={(e) => onFiles(e.target.files)}
        />

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/25 p-6 text-center transition-colors hover:border-primary/50 hover:bg-accent"
        >
          {lendo ? <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /> : <Upload className="h-8 w-8 text-muted-foreground" />}
          <span className="text-sm font-medium">{lendo ? "Lendo planilhas..." : "Clique para selecionar as planilhas"}</span>
          <span className="text-xs text-muted-foreground">Aceita seleção múltipla (.xlsx)</span>
        </button>

        {arquivos.length > 0 && (
          <div className="max-h-[40vh] space-y-2 overflow-auto">
            {arquivos.map((a, i) => (
              <div key={a.file.name + i} className="flex items-start gap-3 rounded-lg border p-3">
                <FileSpreadsheet className={`mt-0.5 h-5 w-5 shrink-0 ${a.erro ? "text-destructive" : "text-primary"}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.file.name}</p>
                  {a.erro ? (
                    <p className="flex items-center gap-1 text-xs text-destructive"><AlertTriangle className="h-3 w-3" /> {a.erro}</p>
                  ) : (
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      {a.parsed.placas.map((p) => (
                        <Badge key={p} variant={placasFrota.has(normPlaca(p)) ? "secondary" : "outline"} className={placasFrota.has(normPlaca(p)) ? "" : "border-warning text-warning"}>
                          {p}{placasFrota.has(normPlaca(p)) ? "" : " (fora da frota)"}
                        </Badge>
                      ))}
                      <span>· {a.parsed.itens.length} dia(s)</span>
                      {a.parsed.periodoIni && <span>· {a.parsed.periodoIni} a {a.parsed.periodoFim}</span>}
                    </div>
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
          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <div className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="h-4 w-4 text-success" />
              {validos.length} planilha(s) · {totalDias} dia(s) de leitura
            </div>
            {placasSemVeiculo.length > 0 && (
              <p className="mt-1 flex items-center gap-1 text-xs text-warning">
                <AlertTriangle className="h-3 w-3" />
                {placasSemVeiculo.length} placa(s) fora da frota serão ignoradas: {placasSemVeiculo.join(", ")}
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={fechar} disabled={importar.isPending}>Cancelar</Button>
          <Button onClick={confirmar} disabled={!validos.length || importar.isPending}>
            {importar.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Importando...</> : <>Importar {validos.length || ""} planilha(s)</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
