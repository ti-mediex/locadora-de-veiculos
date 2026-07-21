import { useState } from "react";
import { Upload, FileText, AlertTriangle, Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/shared/field";
import { parseDetran, type DetranParsed } from "@/lib/detran-parse";
import { extrairTextoPdf } from "@/lib/pdf-text";
import { useImportDetran, type ImportDetranOpcoes } from "@/hooks/use-pendencias";
import { useSaveImport } from "@/hooks/use-import-history";
import { ImportHistoryList } from "@/components/shared/import-history-list";
import { formatCurrency } from "@/lib/format";
import type { Vehicle } from "@/types/database";

export function ImportarDetranDialog({
  open, onOpenChange, vehicles, vehicleIdInicial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  vehicles: Vehicle[];
  vehicleIdInicial?: string;
}) {
  const importar = useImportDetran();
  const salvarImport = useSaveImport();
  const [vehicleId, setVehicleId] = useState(vehicleIdInicial ?? "");
  const [fileName, setFileName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState("");
  const [parsed, setParsed] = useState<DetranParsed | null>(null);
  const [opcoes, setOpcoes] = useState<ImportDetranOpcoes>({ restricoes: true, debitos: true, multas: true, marcarAlienacao: true });

  function reset() {
    setFileName(""); setFile(null); setParsed(null); setErro(""); setLendo(false);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErro(""); setLendo(true); setParsed(null); setFileName(file.name); setFile(file);
    try {
      const texto = await extrairTextoPdf(file);
      const p = parseDetran(texto);
      setParsed(p);
      // Se o veículo ainda não foi escolhido, tenta casar pela placa do PDF
      if (!vehicleId && p.placa) {
        const v = vehicles.find((x) => x.placa.replace(/[^A-Z0-9]/gi, "").toUpperCase() === p.placa);
        if (v) setVehicleId(v.id);
      }
      if (p.restricoes.length === 0 && p.debitos.length === 0 && p.multas.length === 0) {
        setErro("Nenhum débito ou pendência reconhecido neste PDF. Verifique se é o 'Detalhamento de débitos' do Detran.");
      }
    } catch (err) {
      setErro("Não foi possível ler o PDF: " + (err as Error).message);
    } finally {
      setLendo(false);
    }
  }

  function confirmar() {
    if (!vehicleId || !parsed) return;
    importar.mutate({ vehicleId, parsed, opcoes }, {
      onSuccess: (r) => {
        if (file) {
          const placa = vehicles.find((v) => v.id === vehicleId)?.placa ?? parsed.placa ?? null;
          salvarImport.mutate({ vehicleId, placa, tipo: "detran", file, resumo: { ...r, placa } });
        }
        onOpenChange(false); reset(); setVehicleId(vehicleIdInicial ?? "");
      },
    });
  }

  const totalMultas = parsed?.multas.reduce((s, m) => s + m.valor, 0) ?? 0;
  const totalDebitos = parsed?.debitos.reduce((s, d) => s + d.valor, 0) ?? 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar débitos do Detran</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Field label="Veículo">
            <Select value={vehicleId} onValueChange={setVehicleId}>
              <SelectTrigger><SelectValue placeholder="Selecione (ou detectado pela placa do PDF)" /></SelectTrigger>
              <SelectContent>
                {vehicles.map((v) => <SelectItem key={v.id} value={v.id}>{v.placa} — {v.modelo}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>

          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-sm text-muted-foreground hover:bg-accent">
            {lendo ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
            <span>{fileName || "Selecionar PDF do 'Detalhamento de débitos'"}</span>
            <input type="file" accept="application/pdf" className="hidden" onChange={onFile} />
          </label>

          <ImportHistoryList vehicleId={vehicleId || undefined} tipo="detran" />

          {erro && (
            <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {erro}
            </div>
          )}

          {parsed && !erro && (
            <div className="space-y-3 rounded-lg border p-4 text-sm">
              <div className="flex items-center gap-2 font-medium"><FileText className="h-4 w-4" /> Pré-visualização{parsed.placa ? ` — placa ${parsed.placa}` : ""}</div>

              <label className="flex items-start gap-2">
                <input type="checkbox" className="mt-1 h-4 w-4" checked={opcoes.restricoes} onChange={(e) => setOpcoes((o) => ({ ...o, restricoes: e.target.checked }))} />
                <span>
                  <strong>Restrições ({parsed.restricoes.length})</strong>
                  {parsed.restricoes.map((r, i) => <div key={i} className="text-xs text-muted-foreground">• {r}</div>)}
                </span>
              </label>

              {parsed.alienacaoFiduciaria && (
                <label className="flex items-center gap-2 pl-6 text-xs">
                  <input type="checkbox" className="h-4 w-4" checked={opcoes.marcarAlienacao} onChange={(e) => setOpcoes((o) => ({ ...o, marcarAlienacao: e.target.checked }))} />
                  Marcar "alienação fiduciária" no cadastro do veículo
                </label>
              )}

              <label className="flex items-start gap-2">
                <input type="checkbox" className="mt-1 h-4 w-4" checked={opcoes.debitos} onChange={(e) => setOpcoes((o) => ({ ...o, debitos: e.target.checked }))} />
                <span>
                  <strong>Débitos ({parsed.debitos.length}) — total {formatCurrency(totalDebitos)}</strong>
                  {parsed.debitos.map((d, i) => (
                    <div key={i} className="text-xs text-muted-foreground">• {d.titulo} — {formatCurrency(d.valor)}{d.vencimento ? ` (venc. ${d.vencimento.split("-").reverse().join("/")})` : ""}</div>
                  ))}
                </span>
              </label>

              <label className="flex items-start gap-2">
                <input type="checkbox" className="mt-1 h-4 w-4" checked={opcoes.multas} onChange={(e) => setOpcoes((o) => ({ ...o, multas: e.target.checked }))} />
                <span>
                  <strong>Multas ({parsed.multas.length}) — total {formatCurrency(totalMultas)}</strong>
                  {parsed.multas.map((m, i) => (
                    <div key={i} className="text-xs text-muted-foreground">• Auto {m.documento} — {formatCurrency(m.valor)} — {m.infracao.slice(0, 50)}…</div>
                  ))}
                </span>
              </label>
              <p className="text-xs text-muted-foreground">Cada multa é cadastrada como uma pendência separada. Autos já cadastrados são ignorados.</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" onClick={confirmar} disabled={!vehicleId || !parsed || !!erro || importar.isPending}>
            {importar.isPending ? "Importando..." : "Importar pendências"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
