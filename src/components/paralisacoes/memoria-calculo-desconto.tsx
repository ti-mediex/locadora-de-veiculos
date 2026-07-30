import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, formatDateTime, formatNumber, maskPlaca } from "@/lib/format";
import type { ParalisacaoLinha } from "@/hooks/use-paralisacoes";

const HORAS_SEMANA = 168;
const h1 = (n: number) => `${formatNumber(Math.round(n * 10) / 10)} h`;

function Linha({ label, valor, forte }: { label: string; valor: React.ReactNode; forte?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-right text-sm tabular-nums ${forte ? "font-semibold" : ""}`}>{valor}</span>
    </div>
  );
}

/** Memória de cálculo do desconto de UMA paralisação (passo a passo auditável). */
function MemoriaLinha({ l, franquiaH }: { l: ParalisacaoLinha; franquiaH: number }) {
  const semDesconto = l.horasDesc <= 0 || l.desconto <= 0;
  const motivoSem = !l.contrato
    ? "Sem contrato-alvo ativo no período → valor/hora R$ 0 → sem desconto."
    : l.horasDesc <= 0
      ? `Paralisação de ${h1(l.horas)} não excede a franquia de ${h1(franquiaH)} → sem desconto.`
      : null;

  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm font-medium">{maskPlaca(l.placa)}</span>
        {l.modelo && <span className="text-xs text-muted-foreground">{l.modelo}</span>}
        <Badge variant="secondary" className="px-1.5 py-0 text-[10px] capitalize">{l.tipo}</Badge>
        {l.emAberto && <Badge variant="warning" className="px-1.5 py-0 text-[10px]">em aberto</Badge>}
      </div>

      <div className="divide-y">
        <Linha label="Início da paralisação" valor={formatDateTime(l.inicio)} />
        <Linha label="Fim da paralisação" valor={l.fim ? formatDateTime(l.fim) : "em aberto (até agora)"} />
        <Linha label="① Duração total" valor={h1(l.horas)} />
        <Linha label="② Franquia (sem desconto)" valor={h1(franquiaH)} />
        <Linha label="③ Horas descontáveis = máx(0; ① − ②)" valor={h1(l.horasDesc)} forte />
        <Linha
          label="Contrato-alvo"
          valor={l.contrato ? `${l.contrato.numero}${l.contrato.cliente_nome ? ` · ${l.contrato.cliente_nome}` : ""}` : "—"}
        />
        <Linha label="④ Valor semanal da locação" valor={l.contrato ? formatCurrency(l.contrato.valor_locacao) : "—"} />
        <Linha label={`⑤ Valor por hora = ④ ÷ ${HORAS_SEMANA}h`} valor={formatCurrency(l.valorHora)} />
        <Linha label="⑥ Desconto = ③ × ⑤" valor={<span className="text-destructive">{formatCurrency(l.desconto)}</span>} forte />
        <Linha label="Boleto que recebe o desconto" valor={`${formatDate(l.semanaIni)} · ${l.semanaLabel}`} />
      </div>

      {semDesconto ? (
        <p className="mt-2 text-xs text-muted-foreground">{motivoSem}</p>
      ) : (
        <p className="mt-2 rounded bg-background px-2 py-1.5 text-center text-xs tabular-nums">
          {h1(l.horasDesc)} × {formatCurrency(l.valorHora)}/h = <b className="text-destructive">{formatCurrency(l.desconto)}</b>
        </p>
      )}
    </div>
  );
}

/** Bloco com a memória de cálculo de uma ou mais paralisações (com total quando &gt;1). */
export function MemoriaCalculoDesconto({ linhas, franquiaH }: { linhas: ParalisacaoLinha[]; franquiaH: number }) {
  if (!linhas.length) {
    return <p className="text-sm text-muted-foreground">Sem paralisação vinculada para calcular desconto.</p>;
  }
  const total = linhas.reduce((s, l) => s + l.desconto, 0);
  return (
    <div className="space-y-3">
      {linhas.map((l, i) => <MemoriaLinha key={l.ocorrencia?.id ?? i} l={l} franquiaH={franquiaH} />)}
      {linhas.length > 1 && (
        <div className="flex items-baseline justify-between rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2">
          <span className="text-sm font-medium">Total do desconto</span>
          <span className="text-sm font-semibold tabular-nums text-destructive">{formatCurrency(total)}</span>
        </div>
      )}
    </div>
  );
}

/** Diálogo com a memória de cálculo do desconto por paralisação. */
export function MemoriaCalculoDialog({
  open, onOpenChange, linhas, franquiaH, titulo,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  linhas: ParalisacaoLinha[]; franquiaH: number; titulo?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Memória de cálculo do desconto{titulo ? ` — ${titulo}` : ""}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Regra: paralisações acima da franquia de {h1(franquiaH)} geram desconto proporcional ao valor semanal
          da locação (valor semanal ÷ {HORAS_SEMANA}h por hora excedente), abatido no próximo boleto.
        </p>
        <MemoriaCalculoDesconto linhas={linhas} franquiaH={franquiaH} />
      </DialogContent>
    </Dialog>
  );
}
