import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatDate, formatDateTime, formatNumber, maskPlaca } from "@/lib/format";
import type { ParalisacaoLinha } from "@/hooks/use-paralisacoes";

const HORAS_SEMANA = 168;
const h1 = (n: number) => `${formatNumber(Math.round(n * 10) / 10)} h`;
const isoLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const ddmm = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;

/** Sextas candidatas em torno da semana automática (para escolher o boleto). */
function opcoesSemana(autoIso: string, atualIso: string) {
  const base = new Date(`${autoIso}T00:00:00`);
  const opts: { iso: string; label: string }[] = [];
  for (let k = -4; k <= 8; k++) {
    const ini = new Date(base); ini.setDate(ini.getDate() + k * 7);
    const fim = new Date(ini); fim.setDate(fim.getDate() + 6);
    opts.push({ iso: isoLocal(ini), label: `${ddmm(ini)} a ${ddmm(fim)}` });
  }
  if (!opts.some((o) => o.iso === atualIso)) {
    const ini = new Date(`${atualIso}T00:00:00`); const fim = new Date(ini); fim.setDate(fim.getDate() + 6);
    opts.push({ iso: atualIso, label: `${ddmm(ini)} a ${ddmm(fim)}` });
    opts.sort((a, b) => a.iso.localeCompare(b.iso));
  }
  return opts;
}

function Linha({ label, valor, forte }: { label: string; valor: React.ReactNode; forte?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-right text-sm tabular-nums ${forte ? "font-semibold" : ""}`}>{valor}</span>
    </div>
  );
}

/** Memória de cálculo do desconto de UMA paralisação (passo a passo auditável). */
function MemoriaLinha({ l, franquiaH, editavelSemana, onChangeSemana }: {
  l: ParalisacaoLinha; franquiaH: number;
  editavelSemana?: boolean;
  onChangeSemana?: (ocorrenciaId: string, isoSexta: string | null) => void;
}) {
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
        {editavelSemana && onChangeSemana && l.ocorrencia?.id ? (
          <div className="flex flex-wrap items-center justify-between gap-2 py-1.5">
            <span className="text-xs text-muted-foreground">Boleto que recebe o desconto</span>
            <div className="flex items-center gap-1.5">
              <Select
                value={l.semanaOverride ? l.semanaIni : "auto"}
                onValueChange={(v) => onChangeSemana(l.ocorrencia.id, v === "auto" ? null : v)}
              >
                <SelectTrigger className="h-8 w-[190px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="auto">Automático — {(() => { const d = new Date(`${l.semanaAuto}T00:00:00`); const f = new Date(d); f.setDate(f.getDate() + 6); return `${ddmm(d)} a ${ddmm(f)}`; })()}</SelectItem>
                  {opcoesSemana(l.semanaAuto, l.semanaIni).map((o) => (
                    <SelectItem key={o.iso} value={o.iso}>{formatDate(o.iso)} · {o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {l.semanaOverride && <Badge variant="warning" className="px-1.5 py-0 text-[10px]">manual</Badge>}
            </div>
          </div>
        ) : (
          <Linha label="Boleto que recebe o desconto" valor={`${formatDate(l.semanaIni)} · ${l.semanaLabel}${l.semanaOverride ? " (manual)" : ""}`} />
        )}
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
export function MemoriaCalculoDesconto({ linhas, franquiaH, editavelSemana, onChangeSemana }: {
  linhas: ParalisacaoLinha[]; franquiaH: number;
  editavelSemana?: boolean;
  onChangeSemana?: (ocorrenciaId: string, isoSexta: string | null) => void;
}) {
  if (!linhas.length) {
    return <p className="text-sm text-muted-foreground">Sem paralisação vinculada para calcular desconto.</p>;
  }
  const total = linhas.reduce((s, l) => s + l.desconto, 0);
  return (
    <div className="space-y-3">
      {linhas.map((l, i) => <MemoriaLinha key={l.ocorrencia?.id ?? i} l={l} franquiaH={franquiaH} editavelSemana={editavelSemana} onChangeSemana={onChangeSemana} />)}
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
  open, onOpenChange, linhas, franquiaH, titulo, editavelSemana, onChangeSemana,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  linhas: ParalisacaoLinha[]; franquiaH: number; titulo?: string;
  editavelSemana?: boolean;
  onChangeSemana?: (ocorrenciaId: string, isoSexta: string | null) => void;
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
        <MemoriaCalculoDesconto linhas={linhas} franquiaH={franquiaH} editavelSemana={editavelSemana} onChangeSemana={onChangeSemana} />
      </DialogContent>
    </Dialog>
  );
}
