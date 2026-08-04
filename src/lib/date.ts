// Utilitários de data/período para o filtro global (Mês + De/Até).

/** Date → "YYYY-MM-DD" no fuso local. */
export function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "YYYY-MM" atual. */
export function ymAtual(): string {
  return isoLocal(new Date()).slice(0, 7);
}

/** Intervalo (1º e último dia) de um mês "YYYY-MM". Vazio → { ini:"", fim:"" }. */
export function mesRange(ym: string): { ini: string; fim: string } {
  if (!ym) return { ini: "", fim: "" };
  const [y, m] = ym.split("-").map(Number);
  const ultimo = new Date(y, m, 0).getDate();
  return { ini: `${ym}-01`, fim: `${ym}-${String(ultimo).padStart(2, "0")}` };
}

/** True se a data (ISO ou timestamp) está no período [ini, fim] — ou se não há filtro. */
export function noPeriodo(data: string | null | undefined, ini: string, fim: string): boolean {
  if (!ini && !fim) return true;
  if (!data) return false;
  const dia = String(data).slice(0, 10);
  if (ini && dia < ini) return false;
  if (fim && dia > fim) return false;
  return true;
}
