import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { soAlfa } from "@/lib/format";

/** Item mínimo para o seletor de veículo. */
export interface VeicOpcao {
  id: string;
  placa: string;
  marca?: string | null;
  modelo?: string | null;
}

/**
 * Seletor de veículo com busca por placa (ou modelo) e lista em ordem
 * alfabética de placa. Substitui o <Select> simples onde é preciso escolher
 * um veículo: digite a placa e encontre o carro.
 */
export function SelectVeiculo({
  value,
  onChange,
  vehicles,
  placeholder = "Selecione o veículo",
  disabled,
  id,
  className,
  noneLabel,
}: {
  value: string | null | undefined;
  onChange: (id: string) => void;
  vehicles: VeicOpcao[];
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  /** Se informado, exibe uma opção para limpar a seleção (ex.: "Frota (geral)"). */
  noneLabel?: string;
}) {
  const [aberta, setAberta] = useState(false);
  const [busca, setBusca] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const ordenados = useMemo(
    () => [...vehicles].sort((a, b) => (a.placa ?? "").localeCompare(b.placa ?? "", "pt-BR", { sensitivity: "base" })),
    [vehicles]
  );

  const filtrados = useMemo(() => {
    const q = soAlfa(busca);
    const qLower = busca.toLowerCase().trim();
    if (!qLower) return ordenados;
    return ordenados.filter((v) => {
      const casaPlaca = q !== "" && soAlfa(v.placa).includes(q);
      const casaModelo = `${v.marca ?? ""} ${v.modelo ?? ""}`.toLowerCase().includes(qLower);
      return casaPlaca || casaModelo;
    });
  }, [ordenados, busca]);

  const selecionado = useMemo(() => vehicles.find((v) => v.id === value), [vehicles, value]);

  useEffect(() => {
    if (aberta) {
      setBusca("");
      const t = setTimeout(() => inputRef.current?.focus(), 20);
      return () => clearTimeout(t);
    }
  }, [aberta]);

  useEffect(() => {
    if (!aberta) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setAberta(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [aberta]);

  const escolher = (v: VeicOpcao) => {
    onChange(v.id);
    setAberta(false);
  };

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => setAberta((a) => !a)}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={cn("line-clamp-1 text-left", !selecionado && "text-muted-foreground")}>
          {selecionado ? (
            <>
              <span className="font-mono font-medium">{selecionado.placa}</span>
              {selecionado.modelo ? <span className="text-muted-foreground"> — {selecionado.modelo}</span> : null}
            </>
          ) : (
            noneLabel ?? placeholder
          )}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      </button>

      {aberta && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border bg-popover text-popover-foreground shadow-md">
          <div className="flex items-center gap-2 border-b px-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Digite a placa (ex.: 8451) ou modelo..."
              className="h-9 border-0 px-0 focus-visible:ring-0"
            />
          </div>
          <div className="max-h-72 overflow-auto p-1">
            {noneLabel && !busca.trim() && (
              <button
                type="button"
                onClick={() => escolher({ id: "", placa: "" })}
                className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent"
              >
                <span>{noneLabel}</span>
                {!value && <Check className="h-4 w-4 shrink-0 text-primary" />}
              </button>
            )}
            {filtrados.length === 0 ? (
              <div className="px-2 py-3 text-center text-sm text-muted-foreground">Nenhum veículo encontrado</div>
            ) : (
              filtrados.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => escolher(v)}
                  className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                >
                  <span>
                    <span className="font-mono font-medium">{v.placa}</span>
                    {v.modelo ? <span className="text-xs text-muted-foreground"> — {v.marca ? `${v.marca} ` : ""}{v.modelo}</span> : null}
                  </span>
                  {v.id === value && <Check className="h-4 w-4 shrink-0 text-primary" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
