// Extrai a data/hora de CHEGADA e SAÍDA do veículo a partir do "Relatório de
// ociosidade" do Ituran (xlsx), para evidenciar o período de paralisação de
// uma Ordem de Serviço. Chegada = 1ª leitura; Saída = última leitura. Quando o
// endereço da oficina é informado, restringe às leituras nesse endereço.
// xlsx é carregado sob demanda para não pesar no bundle inicial.
import { extrairPlaca } from "@/lib/format";

export interface IturanChegadaSaida {
  chegada: string | null;   // "YYYY-MM-DDTHH:MM" (formato datetime-local)
  saida: string | null;     // "YYYY-MM-DDTHH:MM"
  placa: string | null;
  registros: number;
  endereco: string | null;  // endereço predominante das leituras
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** "DD/MM/YYYY HH:MM(:SS)" -> "YYYY-MM-DDTHH:MM" (ou null). */
function paraLocalInput(s: unknown): string | null {
  const m = String(s ?? "").match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}`;
}

export async function parseIturanChegadaSaida(buf: ArrayBuffer, enderecoManutencao = ""): Promise<IturanChegadaSaida> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false });

  let hi = rows.findIndex((r) => Array.isArray(r) && r.some((c) => typeof c === "string" && /hora\s*loc|od[oô]metro/i.test(c)));
  if (hi < 0) hi = 8;
  const header = (rows[hi] as unknown[]).map((c) => norm(String(c ?? "")));
  const findCol = (re: RegExp, fallback: number) => { const idx = header.findIndex((c) => re.test(c)); return idx >= 0 ? idx : fallback; };
  const colData = findCol(/hora|data/, 0);
  const colEnd = findCol(/endereco/, 4);
  let colPlaca = header.findIndex((c) => /placa/.test(c));
  if (colPlaca < 0) colPlaca = header.findIndex((c, i) => c === "nome" && i !== colData);
  if (colPlaca < 0) colPlaca = 1;

  const termo = norm(enderecoManutencao).trim();
  type Leitura = { ts: string; endereco: string; naManut: boolean };
  const leituras: Leitura[] = [];
  let placa: string | null = null;
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i] as unknown[];
    if (!Array.isArray(r)) continue;
    const ts = paraLocalInput(r[colData]);
    if (!ts) continue; // pula linhas de rodapé/totais
    const endereco = String(r[colEnd] ?? "").trim();
    const p = extrairPlaca(String(r[colPlaca] ?? ""));
    if (p && p.length >= 5 && !placa) placa = p;
    leituras.push({ ts, endereco, naManut: !!termo && norm(endereco).includes(termo) });
  }

  // Se o endereço da oficina foi informado e há leituras nele, usa só essas.
  const naManut = leituras.filter((l) => l.naManut);
  const base = naManut.length ? naManut : leituras;
  if (!base.length) return { chegada: null, saida: null, placa, registros: 0, endereco: null };

  const ordenadas = [...base].sort((a, b) => a.ts.localeCompare(b.ts));
  // Endereço predominante (mais frequente) entre as leituras usadas.
  const cont = new Map<string, number>();
  for (const l of base) if (l.endereco) cont.set(l.endereco, (cont.get(l.endereco) ?? 0) + 1);
  const endereco = [...cont.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return {
    chegada: ordenadas[0].ts,
    saida: ordenadas[ordenadas.length - 1].ts,
    placa,
    registros: base.length,
    endereco,
  };
}
