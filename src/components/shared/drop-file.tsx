import { useRef, useState } from "react";
import { Upload, FileCheck2, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Área de upload com clique, arrastar-e-soltar e nome do arquivo selecionado.
 *  Mantém apenas o arquivo pendente (o envio/persistência fica com o pai). */
export function DropFile({
  file, onFile, accept = "image/*,application/pdf", disabled, className,
}: {
  file: File | null;
  onFile: (f: File | null) => void;
  accept?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); if (disabled) return; const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
      onClick={() => !disabled && inputRef.current?.click()}
      className={cn(
        "flex min-h-[64px] cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed p-2.5 text-center text-xs transition-colors",
        drag ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/40",
        disabled && "cursor-not-allowed opacity-60",
        className,
      )}
    >
      <input ref={inputRef} type="file" accept={accept} className="hidden" disabled={disabled}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
      {file ? (
        <span className="flex max-w-full items-center gap-1.5 font-medium text-foreground">
          <FileCheck2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span className="max-w-[180px] truncate" title={file.name}>{file.name}</span>
          <button type="button" className="shrink-0 rounded p-0.5 hover:bg-muted" title="Remover"
            onClick={(e) => { e.stopPropagation(); onFile(null); }}>
            <X className="h-3.5 w-3.5 text-destructive" />
          </button>
        </span>
      ) : (
        <span className="flex flex-col items-center gap-1 text-muted-foreground">
          <Upload className="h-4 w-4" />
          Arraste o arquivo aqui ou clique para selecionar
        </span>
      )}
    </div>
  );
}
