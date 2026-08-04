import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { mesRange } from "@/lib/date";

/**
 * Filtro de período reutilizável: atalho de Mês (preenche De/Até) + De/Até
 * manuais + Limpar. Abre vazio (mostra tudo); o pai controla `ini`/`fim`.
 */
export function PeriodoFilter({
  ini,
  fim,
  onChange,
  className,
}: {
  ini: string;
  fim: string;
  onChange: (ini: string, fim: string) => void;
  className?: string;
}) {
  // O "Mês" só é exibido quando ini/fim correspondem exatamente a um mês inteiro.
  const mes = (() => {
    if (!ini || !fim) return "";
    const r = mesRange(ini.slice(0, 7));
    return r.ini === ini && r.fim === fim ? ini.slice(0, 7) : "";
  })();

  return (
    <div className={`flex flex-wrap items-end gap-3 ${className ?? ""}`}>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Mês</label>
        <Input
          type="month"
          value={mes}
          onChange={(e) => { const r = mesRange(e.target.value); onChange(r.ini, r.fim); }}
          className="w-full sm:w-40"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">De</label>
        <Input type="date" value={ini} onChange={(e) => onChange(e.target.value, fim)} className="w-full sm:w-40" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Até</label>
        <Input type="date" value={fim} onChange={(e) => onChange(ini, e.target.value)} className="w-full sm:w-40" />
      </div>
      {(ini || fim) && (
        <Button variant="ghost" size="sm" onClick={() => onChange("", "")}>Limpar</Button>
      )}
    </div>
  );
}
