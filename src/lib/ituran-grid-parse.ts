// Parser do relatório "Grade de veículos" (MyGridData) do Ituran: extrai a
// última comunicação de cada veículo com a central, para apurar conectividade
// do rastreamento e convocar veículos sem comunicação.
// xlsx carregado sob demanda para não pesar no bundle inicial.
import { extrairPlaca } from "@/lib/format";

export interface RastreioItem {
  placa: string;
  grupo: string | null;
  ultima_comunicacao: string | null; // ISO (naive) YYYY-MM-DDTHH:MM:SS
  endereco: string | null;
  estados: string | null;
  km: number | null;
}
export interface GridParsed {
  itens: RastreioItem[];
  referencia: string | null; // "Atualizado" do relatório
  placas: string[];
  total: number;
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** "dd/MM/yyyy HH:mm:ss" -> "yyyy-MM-ddTHH:mm:ss" (naive). */
function parseDataHora(s: unknown): string | null {
  const m = String(s ?? "").match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:${m[6] ?? "00"}`;
}
function parseNum(s: unknown): number | null {
  const t = String(s ?? "").trim();
  if (!t) return null;
  const v = t.includes(",") ? parseFloat(t.replace(/\./g, "").replace(",", ".")) : parseFloat(t);
  return isFinite(v) ? v : null;
}

export async function parseIturanGrid(buf: ArrayBuffer): Promise<GridParsed> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false });

  // Referência: "Atualizado: dd/MM/yyyy HH:mm:ss" no topo do relatório.
  let referencia: string | null = null;
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const txt = (rows[i] as unknown[]).map((c) => String(c ?? "")).join(" ");
    const m = txt.match(/atualizado:?\s*(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/i);
    if (m) { referencia = `${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:${m[6]}`; break; }
  }

  let hi = rows.findIndex((r) => Array.isArray(r) && r.some((c) => typeof c === "string" && /placa/i.test(c)));
  if (hi < 0) hi = 2;
  const header = (rows[hi] as unknown[]).map((c) => norm(String(c ?? "")));
  const col = (re: RegExp, fb: number) => { const i = header.findIndex((c) => re.test(c)); return i >= 0 ? i : fb; };
  const cPlaca = col(/placa/, 1);
  const cGrupo = col(/grupo/, 0);
  const cHora = col(/hora/, 4);
  const cEnd = col(/endereco/, 5);
  const cEstados = col(/estado/, 6);
  const cKm = col(/^km$/, 9);

  const map = new Map<string, RastreioItem>();
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i] as unknown[];
    if (!Array.isArray(r)) continue;
    const placa = extrairPlaca(String(r[cPlaca] ?? ""));
    if (!placa || placa.length < 5) continue;
    map.set(placa, {
      placa,
      grupo: String(r[cGrupo] ?? "").trim() || null,
      ultima_comunicacao: parseDataHora(r[cHora]),
      endereco: String(r[cEnd] ?? "").trim() || null,
      estados: String(r[cEstados] ?? "").trim() || null,
      km: parseNum(r[cKm]),
    });
  }

  const itens = [...map.values()];
  return { itens, referencia, placas: itens.map((i) => i.placa).sort(), total: itens.length };
}
