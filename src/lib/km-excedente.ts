// Consolidação da cobrança de KM excedente por contrato/locatário, a partir das
// linhas de franquia (veículo × mês) da Apuração de KM.
import type { ContratoAtivoVeic } from "@/hooks/use-contratos";

export interface FranquiaRow { vehicle_id: string; placa: string; ym: string; km: number; excedente: number }

export interface CobrancaMes { ym: string; km: number; franquia: number; excedente: number; valor: number }
export interface CobrancaKmExcedente {
  vehicle_id: string; placa: string;
  contratoId: string | null; contratoNumero: string;
  locatarioId: string | null; locatario: string;
  meses: CobrancaMes[];
  excedenteTotal: number; valorTotal: number;
}

/** Agrupa os meses excedentes por veículo → contrato/locatário ativo, aplicando R$/km. */
export function consolidarCobrancasKmExcedente(
  rows: FranquiaRow[],
  franquia: number,
  kmValor: number,
  contratoAtivo: Map<string, ContratoAtivoVeic>,
): CobrancaKmExcedente[] {
  const map = new Map<string, CobrancaKmExcedente>();
  for (const r of rows) {
    if (r.excedente <= 0) continue;
    const ct = contratoAtivo.get(r.vehicle_id);
    let cur = map.get(r.vehicle_id);
    if (!cur) {
      cur = {
        vehicle_id: r.vehicle_id, placa: r.placa,
        contratoId: ct?.id ?? null, contratoNumero: ct?.numero ?? "—",
        locatarioId: ct?.locatarioId ?? null, locatario: ct?.cliente ?? "",
        meses: [], excedenteTotal: 0, valorTotal: 0,
      };
      map.set(r.vehicle_id, cur);
    }
    const valor = Math.round(r.excedente * kmValor * 100) / 100;
    cur.meses.push({ ym: r.ym, km: r.km, franquia, excedente: r.excedente, valor });
    cur.excedenteTotal += r.excedente;
    cur.valorTotal = Math.round((cur.valorTotal + valor) * 100) / 100;
  }
  for (const c of map.values()) c.meses.sort((a, b) => a.ym.localeCompare(b.ym));
  return [...map.values()].sort((a, b) => b.valorTotal - a.valorTotal);
}

/** Distribui um valor total em N parcelas (a última absorve o arredondamento). */
export function distribuirParcelas(total: number, n: number): number[] {
  const N = Math.max(1, Math.floor(n));
  const base = Math.floor((total / N) * 100) / 100;
  const parcelas = Array(N).fill(base);
  const soma = Math.round(base * N * 100) / 100;
  parcelas[N - 1] = Math.round((base + (total - soma)) * 100) / 100;
  return parcelas;
}

const mesLabel = (ym: string) => `${ym.slice(5)}/${ym.slice(0, 4)}`;
/** Lista de meses "MM/AAAA" de uma cobrança, para descrições. */
export function mesesLabel(c: CobrancaKmExcedente): string {
  return c.meses.map((m) => mesLabel(m.ym)).join(", ");
}
