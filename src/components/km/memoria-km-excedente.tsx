import { formatCurrency, formatNumber, maskPlaca } from "@/lib/format";
import type { CobrancaKmExcedente } from "@/lib/km-excedente";

const km0 = (n: number) => `${formatNumber(Math.round(n))} km`;
const mesLabel = (ym: string) => `${ym.slice(5)}/${ym.slice(0, 4)}`;

/** Memória de cálculo da cobrança de KM excedente de um contrato/locatário. */
export function MemoriaKmExcedente({ cobranca, kmValor }: { cobranca: CobrancaKmExcedente; kmValor: number }) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-muted/20 p-3">
        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm">
          <span className="font-mono font-medium">{maskPlaca(cobranca.placa)}</span>
          <span className="text-muted-foreground">Contrato {cobranca.contratoNumero}</span>
          {cobranca.locatario && <span className="text-muted-foreground">· {cobranca.locatario}</span>}
        </div>
        <p className="mb-2 text-xs text-muted-foreground">
          Regra: KM rodado acima da franquia de {km0(cobranca.meses[0]?.franquia ?? 0)}/mês é cobrado a {formatCurrency(kmValor)}/km.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[26rem] text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="py-1 text-left font-medium">Mês</th>
                <th className="py-1 text-right font-medium">KM rodado</th>
                <th className="py-1 text-right font-medium">Franquia</th>
                <th className="py-1 text-right font-medium">Excedente</th>
                <th className="py-1 text-right font-medium">Valor</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {cobranca.meses.map((m) => (
                <tr key={m.ym} className="border-b last:border-0">
                  <td className="py-1.5">{mesLabel(m.ym)}</td>
                  <td className="py-1.5 text-right">{km0(m.km)}</td>
                  <td className="py-1.5 text-right text-muted-foreground">{km0(m.franquia)}</td>
                  <td className="py-1.5 text-right font-medium">{km0(m.excedente)}</td>
                  <td className="py-1.5 text-right text-destructive">{formatCurrency(m.valor)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t font-semibold">
                <td className="py-1.5" colSpan={3}>Total</td>
                <td className="py-1.5 text-right tabular-nums">{km0(cobranca.excedenteTotal)}</td>
                <td className="py-1.5 text-right tabular-nums text-destructive">{formatCurrency(cobranca.valorTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="mt-2 rounded bg-background px-2 py-1.5 text-center text-xs tabular-nums">
          {km0(cobranca.excedenteTotal)} × {formatCurrency(kmValor)}/km = <b className="text-destructive">{formatCurrency(cobranca.valorTotal)}</b>
        </p>
      </div>
    </div>
  );
}
