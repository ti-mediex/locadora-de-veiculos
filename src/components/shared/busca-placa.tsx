import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { soAlfa } from "@/lib/format";

/** Item mínimo para sugestão de veículo (Vehicle e outros satisfazem). */
export interface VeicSugestao {
  id: string;
  placa: string;
  marca?: string | null;
  modelo?: string | null;
}

/**
 * Campo de busca com autocomplete por qualquer parte da placa (ou modelo).
 * Ao digitar, apresenta os veículos possíveis; ao escolher, aplica a placa.
 */
export function BuscaPlaca({
  value,
  onChange,
  onSelect,
  vehicles,
  placeholder = "Buscar por placa (ex.: 8451), modelo...",
  contador,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  /** Chamado ao escolher um veículo. Padrão: aplica a placa em onChange. */
  onSelect?: (v: VeicSugestao) => void;
  vehicles: VeicSugestao[];
  placeholder?: string;
  /** Texto auxiliar por veículo (ex.: "3 abertas"). */
  contador?: (vehicleId: string) => string | null;
  className?: string;
}) {
  const [aberta, setAberta] = useState(false);

  const sugestoes = useMemo(() => {
    const q = soAlfa(value);
    const qLower = value.toLowerCase().trim();
    if (!qLower) return [];
    const vistos = new Set<string>();
    const out: VeicSugestao[] = [];
    for (const v of vehicles) {
      if (!v.placa || vistos.has(v.placa)) continue;
      const casaPlaca = q !== "" && soAlfa(v.placa).includes(q);
      const casaModelo = `${v.marca ?? ""} ${v.modelo ?? ""}`.toLowerCase().includes(qLower);
      if (casaPlaca || casaModelo) { vistos.add(v.placa); out.push(v); }
      if (out.length >= 8) break;
    }
    return out;
  }, [vehicles, value]);

  const escolher = (v: VeicSugestao) => {
    if (onSelect) onSelect(v);
    else onChange(v.placa);
    setAberta(false);
  };

  return (
    <div className={`relative flex flex-1 items-center gap-2 ${className ?? ""}`}>
      <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => { onChange(e.target.value); setAberta(true); }}
        onFocus={() => setAberta(true)}
        onBlur={() => setTimeout(() => setAberta(false), 150)}
        className="border-0 focus-visible:ring-0"
      />
      {aberta && sugestoes.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-auto rounded-lg border bg-popover p-1 shadow-md">
          <div className="px-2 py-1 text-[11px] uppercase text-muted-foreground">Veículos</div>
          {sugestoes.map((v) => {
            const hint = contador?.(v.id);
            return (
              <button
                key={v.id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); escolher(v); }}
                className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
              >
                <span>
                  <span className="font-mono font-medium">{v.placa}</span>{" "}
                  <span className="text-xs text-muted-foreground">{v.marca} {v.modelo}</span>
                </span>
                {hint && <Badge variant="secondary">{hint}</Badge>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
