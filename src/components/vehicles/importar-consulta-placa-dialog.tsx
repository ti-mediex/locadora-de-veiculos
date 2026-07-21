import { useState } from "react";
import { Upload, FileText, AlertTriangle, Loader2, Car } from "lucide-react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/shared/field";
import { extrairTextoPdf } from "@/lib/pdf-text";
import { parseConsultaPlaca, type ConsultaPlacaParsed } from "@/lib/consulta-placa-parse";
import { useImportConsultaPlaca } from "@/hooks/use-import-veiculo";
import type { Vehicle } from "@/types/database";

const CAMPOS: { chave: keyof ConsultaPlacaParsed; label: string }[] = [
  { chave: "especie_tipo", label: "Espécie/Tipo" },
  { chave: "marca", label: "Marca" },
  { chave: "modelo", label: "Modelo" },
  { chave: "cor", label: "Cor" },
  { chave: "chassi", label: "Chassi" },
  { chave: "combustivel", label: "Combustível" },
  { chave: "ano_fabricacao", label: "Ano fabricação" },
  { chave: "ano_modelo", label: "Ano modelo" },
  { chave: "categoria", label: "Categoria" },
  { chave: "capacidade_passageiros", label: "Capacidade (passageiros)" },
  { chave: "potencia", label: "Potência (cv)" },
  { chave: "cilindrada", label: "Cilindrada (cc)" },
  { chave: "parcelamento_cotas", label: "Parcelamento/Cotas" },
  { chave: "alienante", label: "Alienante" },
];

export function ImportarConsultaPlacaDialog({
  open, onOpenChange, vehicles,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  vehicles: Vehicle[];
}) {
  const importar = useImportConsultaPlaca();
  const [vehicleId, setVehicleId] = useState<string>("");
  const [naoEncontrado, setNaoEncontrado] = useState(false);
  const [fileName, setFileName] = useState("");
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState("");
  const [parsed, setParsed] = useState<ConsultaPlacaParsed | null>(null);

  function reset() {
    setFileName(""); setParsed(null); setErro(""); setLendo(false); setVehicleId(""); setNaoEncontrado(false);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErro(""); setLendo(true); setParsed(null); setFileName(file.name); setNaoEncontrado(false);
    try {
      const texto = await extrairTextoPdf(file);
      const p = parseConsultaPlaca(texto);
      setParsed(p);
      if (!p.placa) {
        setErro("Não foi possível identificar a placa. Verifique se é o PDF da 'Consulta Placa' do Detran.");
        return;
      }
      const v = vehicles.find((x) => x.placa.replace(/[^A-Z0-9]/gi, "").toUpperCase() === p.placa);
      if (v) { setVehicleId(v.id); setNaoEncontrado(false); }
      else { setVehicleId(""); setNaoEncontrado(true); }
    } catch (err) {
      setErro("Não foi possível ler o PDF: " + (err as Error).message);
    } finally {
      setLendo(false);
    }
  }

  function confirmar() {
    if (!parsed) return;
    // vehicleId vazio + placa não encontrada => cria novo veículo
    const alvo = vehicleId || null;
    if (!alvo && !naoEncontrado) return; // precisa escolher um veículo
    importar.mutate({ vehicleId: alvo, parsed }, {
      onSuccess: () => { onOpenChange(false); reset(); },
    });
  }

  const fmt = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : String(v));

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar dados da Consulta Placa</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-sm text-muted-foreground hover:bg-accent">
            {lendo ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
            <span>{fileName || "Selecionar PDF da 'Consulta Placa'"}</span>
            <input type="file" accept="application/pdf" className="hidden" onChange={onFile} />
          </label>

          {erro && (
            <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {erro}
            </div>
          )}

          {parsed && !erro && (
            <>
              {naoEncontrado ? (
                <div className="rounded-lg bg-warning/10 p-3 text-sm">
                  <div className="flex items-center gap-2 font-medium"><Car className="h-4 w-4" /> Placa {parsed.placa} não cadastrada</div>
                  <p className="mt-1 text-xs text-muted-foreground">Um novo veículo será criado com estes dados. Para atualizar um veículo existente, selecione-o abaixo.</p>
                  <div className="mt-2">
                    <Select value={vehicleId} onValueChange={(v) => { setVehicleId(v); setNaoEncontrado(false); }}>
                      <SelectTrigger><SelectValue placeholder="(criar novo veículo) — ou escolher existente" /></SelectTrigger>
                      <SelectContent>
                        {vehicles.map((v) => <SelectItem key={v.id} value={v.id}>{v.placa} — {v.modelo}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                <Field label="Veículo (detectado pela placa)">
                  <Select value={vehicleId} onValueChange={setVehicleId}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {vehicles.map((v) => <SelectItem key={v.id} value={v.id}>{v.placa} — {v.modelo}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              )}

              <div className="rounded-lg border p-4 text-sm">
                <div className="mb-2 flex items-center gap-2 font-medium"><FileText className="h-4 w-4" /> Dados a importar {parsed.placa ? `— placa ${parsed.placa}` : ""}</div>
                <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                  {CAMPOS.map((c) => (
                    <div key={c.chave} className="flex justify-between gap-2">
                      <span className="text-muted-foreground">{c.label}</span>
                      <span className="text-right font-medium">{fmt(parsed[c.chave])}</span>
                    </div>
                  ))}
                </div>
                {parsed.restricoes.length > 0 && (
                  <div className="mt-2 border-t pt-2 text-xs text-muted-foreground">
                    Restrições: {parsed.restricoes.join(" · ")}
                  </div>
                )}
                <p className="mt-2 text-xs text-muted-foreground">Os campos preenchidos sobrescrevem os dados atuais do veículo. Campos vazios não são alterados.</p>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" onClick={confirmar} disabled={!parsed || !!erro || (!vehicleId && !naoEncontrado) || importar.isPending}>
            {importar.isPending ? "Importando..." : naoEncontrado && !vehicleId ? "Criar veículo" : "Atualizar veículo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
