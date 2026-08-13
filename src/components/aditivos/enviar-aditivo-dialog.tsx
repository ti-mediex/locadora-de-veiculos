import { useMemo, useState } from "react";
import { Copy, FileDown, MessageCircle, Mail, CheckCircle2, XCircle, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/shared/field";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAppConfig } from "@/hooks/use-app-config";
import {
  useAditivosPorContrato, useCriarAditivo, useCancelarAditivo,
  linkAssinatura, ADITIVO_STATUS_LABEL, type AditivoTipo,
} from "@/hooks/use-aditivos";
import { textoAditivoPosse, textoAditivoTroca, gerarAditivoHtml } from "@/lib/aditivo-doc";
import { formatDate } from "@/lib/format";

export interface AditivoContexto {
  contratoId: string;
  contratoNumero: string;
  locatarioId?: string | null;
  clienteNome?: string | null;
  clienteCpf?: string | null;
  clienteTelefone?: string | null;
  clienteEmail?: string | null;
  vehicleId?: string | null;
  placa?: string | null;
  veiculoDesc?: string | null;
  placaAnterior?: string | null;
  motivo?: string | null;
  trocaId?: string | null;
}

const soDigitos = (s?: string | null) => (s ?? "").replace(/\D/g, "");

export function EnviarAditivoDialog({
  open, onOpenChange, contexto, tipoInicial = "confirmacao_posse",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contexto: AditivoContexto;
  tipoInicial?: AditivoTipo;
}) {
  const { data: config } = useAppConfig();
  const criar = useCriarAditivo();
  const cancelar = useCancelarAditivo();
  const aditivos = useAditivosPorContrato(contexto.contratoId);

  const [tipo, setTipo] = useState<AditivoTipo>(tipoInicial);
  const dadosDoc = useMemo(() => ({
    contratoNumero: contexto.contratoNumero,
    clienteNome: contexto.clienteNome,
    clienteCpf: contexto.clienteCpf,
    placa: contexto.placa,
    veiculoDesc: contexto.veiculoDesc,
    placaAnterior: contexto.placaAnterior,
    motivo: contexto.motivo,
  }), [contexto]);

  const [conteudo, setConteudo] = useState(() =>
    tipoInicial === "troca_veiculo" ? textoAditivoTroca(dadosDoc) : textoAditivoPosse(dadosDoc));

  function trocarTipo(t: AditivoTipo) {
    setTipo(t);
    setConteudo(t === "troca_veiculo" ? textoAditivoTroca(dadosDoc) : textoAditivoPosse(dadosDoc));
  }

  const empresa = {
    nome: config?.empresa_nome ?? "VIP CARS",
    cnpj: config?.empresa_cnpj ?? "",
    endereco: config?.empresa_endereco ?? "",
  };

  const [ultimoLink, setUltimoLink] = useState<string | null>(null);

  async function gerar() {
    const res = await criar.mutateAsync({
      contrato_id: contexto.contratoId,
      locatario_id: contexto.locatarioId ?? null,
      troca_id: contexto.trocaId ?? null,
      tipo,
      vehicle_id: contexto.vehicleId ?? null,
      placa: contexto.placa ?? null,
      cliente_nome: contexto.clienteNome ?? null,
      cliente_cpf: contexto.clienteCpf ?? null,
      conteudo,
    });
    const link = linkAssinatura(res.token);
    setUltimoLink(link);
    toast.success(`Aditivo ${res.numero} gerado. Envie o link para assinatura.`);
  }

  function copiar(link: string) {
    navigator.clipboard?.writeText(link).then(() => toast.success("Link copiado")).catch(() => toast.error("Não foi possível copiar"));
  }
  function whatsapp(link: string) {
    const msg = `Olá ${contexto.clienteNome ?? ""}! Segue o aditivo do contrato ${contexto.contratoNumero} para sua assinatura:\n${link}\n\n${empresa.nome}`;
    const tel = soDigitos(contexto.clienteTelefone);
    const base = tel ? `https://wa.me/${tel.length <= 11 ? "55" + tel : tel}` : "https://wa.me/";
    window.open(`${base}?text=${encodeURIComponent(msg)}`, "_blank");
  }
  function email(link: string) {
    const assunto = `Aditivo do contrato ${contexto.contratoNumero} — assinatura`;
    const corpo = `Olá ${contexto.clienteNome ?? ""},\n\nSegue o aditivo para sua assinatura:\n${link}\n\n${empresa.nome}`;
    window.open(`mailto:${contexto.clienteEmail ?? ""}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`, "_blank");
  }
  function imprimir(a: { numero: string; conteudo: string | null; status: string; cliente_nome: string | null; cliente_cpf: string | null; placa: string | null; assinante_nome: string | null; assinado_em: string | null; assinante_cpf: string | null }) {
    const w = window.open("", "_blank");
    if (w) { w.document.write(gerarAditivoHtml(a, empresa)); w.document.close(); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Aditivo do contrato {contexto.contratoNumero}</DialogTitle></DialogHeader>
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo de aditivo">
              <Select value={tipo} onValueChange={(v) => trocarTipo(v as AditivoTipo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="confirmacao_posse">Confirmação de posse</SelectItem>
                  <SelectItem value="troca_veiculo">Troca de veículo</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Locatário">
              <Input readOnly className="bg-muted" value={contexto.clienteNome ?? "—"} />
            </Field>
          </div>

          <Field label="Conteúdo do aditivo (edite se necessário)">
            <Textarea value={conteudo} onChange={(e) => setConteudo(e.target.value)} rows={9} className="text-[13px] leading-relaxed" />
          </Field>

          <div className="flex items-center gap-2">
            <Button onClick={gerar} disabled={criar.isPending}>Gerar aditivo p/ assinatura</Button>
            {ultimoLink && (
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-9 w-9" title="Copiar link" onClick={() => copiar(ultimoLink)}><Copy className="h-4 w-4" /></Button>
                <Button variant="outline" size="icon" className="h-9 w-9" title="WhatsApp" onClick={() => whatsapp(ultimoLink)}><MessageCircle className="h-4 w-4 text-emerald-600" /></Button>
                <Button variant="outline" size="icon" className="h-9 w-9" title="E-mail" onClick={() => email(ultimoLink)}><Mail className="h-4 w-4 text-blue-600" /></Button>
              </div>
            )}
          </div>
          {ultimoLink && (
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-2 text-xs">
              <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate" title={ultimoLink}>{ultimoLink}</span>
            </div>
          )}

          {aditivos.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Aditivos deste contrato</p>
              <div className="space-y-1.5">
                {aditivos.map((a) => {
                  const link = linkAssinatura(a.token);
                  return (
                    <div key={a.id} className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-xs">
                      <span className="font-mono font-medium">{a.numero}</span>
                      <Badge variant={a.status === "assinado" ? "success" : a.status === "cancelado" ? "destructive" : "secondary"} className="px-1.5 py-0 text-[10px]">
                        {ADITIVO_STATUS_LABEL[a.status]}
                      </Badge>
                      {a.status === "assinado" && a.assinado_em && (
                        <span className="text-muted-foreground"><CheckCircle2 className="mr-0.5 inline h-3 w-3 text-emerald-600" />{a.assinante_nome ?? a.cliente_nome} · {formatDate(a.assinado_em)}</span>
                      )}
                      <div className="ml-auto flex items-center gap-1">
                        {a.status !== "cancelado" && a.status !== "assinado" && (
                          <>
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Copiar link" onClick={() => copiar(link)}><Copy className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="WhatsApp" onClick={() => whatsapp(link)}><MessageCircle className="h-3.5 w-3.5 text-emerald-600" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Cancelar" onClick={() => { if (confirm(`Cancelar o aditivo ${a.numero}?`)) cancelar.mutate(a.id); }}><XCircle className="h-3.5 w-3.5 text-destructive" /></Button>
                          </>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Imprimir/PDF" onClick={() => imprimir(a)}><FileDown className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
