import { useEffect, useRef, useState } from "react";
import { Undo2, Eraser, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const CORES = [
  { nome: "Vermelho", cor: "#e11d1d" },
  { nome: "Amarelo", cor: "#f5c518" },
  { nome: "Verde", cor: "#16a34a" },
  { nome: "Branco", cor: "#ffffff" },
];

/** Editor para marcar avarias sobre a foto (desenho livre) e salvar a imagem. */
export function EditorFoto({
  file, parte, onClose, onSave,
}: {
  file: File | null;
  parte: string;
  onClose: () => void;
  onSave: (novo: File) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const undoStack = useRef<ImageData[]>([]);
  const [cor, setCor] = useState(CORES[0].cor);
  const [salvando, setSalvando] = useState(false);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    if (!file) return;
    setPronto(false);
    undoStack.current = [];
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const c = canvasRef.current;
      if (!c) return;
      const maxW = 900;
      const scale = Math.min(1, maxW / (img.width || maxW));
      c.width = Math.round((img.width || maxW) * scale);
      c.height = Math.round((img.height || maxW) * scale);
      const ctx = c.getContext("2d");
      if (ctx) { ctx.drawImage(img, 0, 0, c.width, c.height); }
      setPronto(true);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, [file]);

  function ctx2d() { return canvasRef.current?.getContext("2d") ?? null; }
  function pos(e: React.MouseEvent | React.TouchEvent) {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    const t = "touches" in e ? e.touches[0] : (e as React.MouseEvent);
    return { x: (t.clientX - r.left) * (c.width / r.width), y: (t.clientY - r.top) * (c.height / r.height) };
  }
  function start(e: React.MouseEvent | React.TouchEvent) {
    const ctx = ctx2d(); const c = canvasRef.current;
    if (!ctx || !c) return;
    undoStack.current.push(ctx.getImageData(0, 0, c.width, c.height));
    if (undoStack.current.length > 20) undoStack.current.shift();
    drawing.current = true;
    ctx.strokeStyle = cor;
    ctx.lineWidth = Math.max(3, c.width * 0.007);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }
  function move(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing.current) return;
    if ("touches" in e) e.preventDefault();
    const ctx = ctx2d();
    if (!ctx) return;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }
  function end() { drawing.current = false; }
  function desfazer() {
    const ctx = ctx2d();
    const prev = undoStack.current.pop();
    if (ctx && prev) ctx.putImageData(prev, 0, 0);
  }
  function salvar() {
    const c = canvasRef.current;
    if (!c) return;
    setSalvando(true);
    c.toBlob((blob) => {
      setSalvando(false);
      if (!blob) return;
      onSave(new File([blob], (file?.name ?? "foto").replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" }));
      onClose();
    }, "image/jpeg", 0.85);
  }

  return (
    <Dialog open={!!file} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>Marcar avarias — {parte}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Cor:</span>
            {CORES.map((c) => (
              <button key={c.cor} type="button" onClick={() => setCor(c.cor)}
                className={cn("h-6 w-6 rounded-full border-2", cor === c.cor ? "border-foreground" : "border-transparent")}
                style={{ backgroundColor: c.cor }} title={c.nome} />
            ))}
            <div className="ml-auto flex gap-1">
              <Button type="button" variant="outline" size="sm" onClick={desfazer}><Undo2 className="h-4 w-4" /> Desfazer</Button>
            </div>
          </div>
          <div className="overflow-hidden rounded-lg border bg-muted">
            {!pronto && <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
            <canvas ref={canvasRef} className={cn("w-full touch-none", !pronto && "hidden")}
              onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
              onTouchStart={start} onTouchMove={move} onTouchEnd={end} />
          </div>
          <p className="text-xs text-muted-foreground"><Eraser className="mr-1 inline h-3 w-3" /> Desenhe sobre a foto para destacar avarias (arraste o dedo/mouse).</p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="button" onClick={salvar} disabled={!pronto || salvando}>
            {salvando ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</> : <><Check className="h-4 w-4" /> Salvar marcações</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
