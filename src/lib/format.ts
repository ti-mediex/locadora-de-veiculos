import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export function formatCurrency(value: number | null | undefined): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value ?? 0);
}

export function formatNumber(value: number | null | undefined): string {
  return new Intl.NumberFormat("pt-BR").format(value ?? 0);
}

export function formatPercent(value: number | null | undefined): string {
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value ?? 0)}%`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    return format(parseISO(value), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return "—";
  }
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    return format(parseISO(value), "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch {
    return "—";
  }
}

/** Máscaras simples para exibição */
export function maskCpf(cpf: string | null | undefined): string {
  if (!cpf) return "—";
  const d = cpf.replace(/\D/g, "").padStart(11, "0");
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
}

export function maskPlaca(placa: string | null | undefined): string {
  if (!placa) return "—";
  return placa.toUpperCase();
}

/** Normaliza texto para comparação de placa (só letras/números, minúsculo). */
export function soAlfa(s: string | null | undefined): string {
  return (s ?? "").replace(/[^a-z0-9]/gi, "").toLowerCase();
}

/**
 * Extrai o token de placa (Mercosul LLLNLNN ou antigo LLLNNNN) de um texto —
 * ex.: "QYU6A95 KWID BC OUTSIDE" -> "QYU6A95". Se não achar, devolve o texto
 * só com letras/números em maiúsculas.
 */
export function extrairPlaca(texto: string | null | undefined): string {
  const up = (texto ?? "").toUpperCase();
  const m = up.match(/[A-Z]{3}\d[A-Z0-9]\d{2}/);
  return m ? m[0] : up.replace(/[^A-Z0-9]/g, "");
}

const L5 = "ABCDEFGHIJ";
/** Converte a 5ª posição da placa entre dígito e letra (Mercosul <-> antigo). */
function converte5(p: string): string | null {
  if (p.length !== 7) return null;
  const c = p[4];
  if (c >= "0" && c <= "9") return p.slice(0, 4) + L5[Number(c)] + p.slice(5);
  const i = L5.indexOf(c);
  return i >= 0 ? p.slice(0, 4) + i + p.slice(5) : null;
}

/**
 * Variantes normalizadas de uma placa: a própria + a conversão Mercosul↔antigo
 * (ex.: "QYD6357" e "QYD6D57"), para casar cadastros em formatos diferentes.
 */
export function placaVariantes(placa: string | null | undefined): string[] {
  const p = (placa ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (!p) return [];
  const alt = converte5(p);
  return alt && alt !== p ? [p, alt] : [p];
}
