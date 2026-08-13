import { useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Car, CheckCircle2, Loader2, Eraser } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAditivoPorToken, useAssinarAditivo, ADITIVO_TIPO_LABEL } from "@/hooks/use-aditivos";

export default function AssinarAditivoPage() {
  const { token = "" } = useParams();
  const { data: aditivo, isLoading, refetch } = useAditivoPorToken(token);
  const assinar = useAssinarAditivo();

  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [aceite, setAceite] = useState(false);

  // Assinatura desenhada (canvas)
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const desenhando = useRef(false);
  const temTraco = useRef(false);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  }
  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e);
    desenhando.current = true; temTraco.current = true;
    ctx.beginPath(); ctx.moveTo(p.x, p.y);
    canvasRef.current!.setPointerCapture(e.pointerId);
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!desenhando.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e);
    ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.strokeStyle = "#111";
    ctx.lineTo(p.x, p.y); ctx.stroke();
  }
  function end() { desenhando.current = false; }
  function limparCanvas() {
    const c = canvasRef.current;
    if (c) c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    temTraco.current = false;
  }

  async function enviar() {
    if (!nome.trim() || !cpf.trim()) { toast.error("Preencha nome e CPF"); return; }
    if (!aceite) { toast.error("Confirme a leitura e o aceite do aditivo"); return; }
    const img = temTraco.current ? canvasRef.current?.toDataURL("image/png") : null;
    const res = await assinar.mutateAsync({ token, nome: nome.trim(), cpf: cpf.trim(), assinatura: img });
    if (res === "ok") { toast.success("Aditivo assinado com sucesso!"); refetch(); }
    else if (res === "ja_assinado") { toast.info("Este aditivo já havia sido assinado."); refetch(); }
    else if (res === "cancelado") { toast.error("Este aditivo foi cancelado."); }
    else { toast.error("Não foi possível assinar. Verifique o link."); }
  }

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-8">
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Car className="h-5 w-5" /></div>
          <span className="text-lg font-bold">VIP CARS</span>
        </div>

        {isLoading ? (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" /> Carregando aditivo…</CardContent></Card>
        ) : !aditivo ? (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Aditivo não encontrado. Verifique se o link está completo e correto.</CardContent></Card>
        ) : aditivo.status === "cancelado" ? (
          <Card><CardContent className="p-8 text-center text-sm text-destructive">Este aditivo foi cancelado e não pode ser assinado.</CardContent></Card>
        ) : aditivo.status === "assinado" ? (
          <Card className="border-emerald-500/40">
            <CardHeader><CardTitle className="flex items-center gap-2 text-emerald-600"><CheckCircle2 className="h-5 w-5" /> Aditivo {aditivo.numero} assinado</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-muted-foreground">Assinado por <b className="text-foreground">{aditivo.assinante_nome ?? aditivo.cliente_nome}</b>{aditivo.assinado_em ? ` em ${new Date(aditivo.assinado_em).toLocaleString("pt-BR")}` : ""}.</p>
              <div className="whitespace-pre-line rounded-lg border bg-card p-4 text-[13px] leading-relaxed">{aditivo.conteudo}</div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Aditivo {aditivo.numero} — {ADITIVO_TIPO_LABEL[aditivo.tipo] ?? aditivo.tipo}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="whitespace-pre-line rounded-lg border bg-muted/40 p-4 text-[13px] leading-relaxed">{aditivo.conteudo}</div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Seu nome completo</Label>
                  <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do locatário" />
                </div>
                <div className="space-y-1.5">
                  <Label>CPF</Label>
                  <Input value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" inputMode="numeric" />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>Assinatura (desenhe abaixo — opcional)</Label>
                  <Button type="button" variant="ghost" size="sm" onClick={limparCanvas}><Eraser className="h-4 w-4" /> Limpar</Button>
                </div>
                <canvas
                  ref={canvasRef}
                  width={600}
                  height={160}
                  className="h-40 w-full touch-none rounded-lg border bg-white"
                  onPointerDown={start}
                  onPointerMove={move}
                  onPointerUp={end}
                  onPointerLeave={end}
                />
              </div>

              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} className="mt-0.5 h-4 w-4" />
                <span>Li e concordo com o conteúdo deste aditivo e confirmo as informações acima.</span>
              </label>

              <Button className="w-full" onClick={enviar} disabled={assinar.isPending}>
                {assinar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Assinar aditivo
              </Button>
            </CardContent>
          </Card>
        )}
        <p className="text-center text-xs text-muted-foreground">Assinatura eletrônica · VIP CARS · Gestão de Frota</p>
      </div>
    </div>
  );
}
