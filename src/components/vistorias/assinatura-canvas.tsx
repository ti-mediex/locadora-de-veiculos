import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

/** Área de assinatura desenhada por toque (celular) ou mouse. */
export function AssinaturaCanvas({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const vazio = useRef(true);

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (ctx) { ctx.lineWidth = 2.2; ctx.lineCap = "round"; ctx.strokeStyle = "#111827"; }
  }, []);

  function pos(e: React.MouseEvent | React.TouchEvent) {
    const c = ref.current!;
    const r = c.getBoundingClientRect();
    const t = "touches" in e ? e.touches[0] : (e as React.MouseEvent);
    return { x: (t.clientX - r.left) * (c.width / r.width), y: (t.clientY - r.top) * (c.height / r.height) };
  }
  function start(e: React.MouseEvent | React.TouchEvent) {
    drawing.current = true;
    const ctx = ref.current!.getContext("2d")!;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }
  function move(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing.current) return;
    if ("touches" in e) e.preventDefault();
    const ctx = ref.current!.getContext("2d")!;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    vazio.current = false;
  }
  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    onChange(vazio.current ? null : ref.current!.toDataURL("image/png"));
  }
  function limpar() {
    const c = ref.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    vazio.current = true;
    onChange(null);
  }

  return (
    <div className="space-y-2">
      <canvas
        ref={ref}
        width={600}
        height={200}
        className="w-full touch-none rounded-lg border bg-white"
        onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
        onTouchStart={start} onTouchMove={move} onTouchEnd={end}
      />
      <Button type="button" variant="outline" size="sm" onClick={limpar}>Limpar assinatura</Button>
    </div>
  );
}
