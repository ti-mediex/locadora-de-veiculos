// Parser do "Relatório de ociosidade" do Ituran (xlsx): agrupa as leituras de
// odômetro por placa e por dia (para apurar o KM rodado) e soma o tempo ocioso
// na oficina/pátio de manutenção (rua informada) para o desconto por paralisação.
// xlsx carregado sob demanda para não pesar no bundle inicial.

export interface KmDiarioItem {
  placa: string;
  dia: string;             // YYYY-MM-DD
  odom_inicio: number;     // menor odômetro do dia
  odom_fim: number;        // maior odômetro do dia
  registros: number;
  min_ocioso_manut: number; // minutos ociosos na rua de manutenção no dia
}
export interface IturanParsed {
  itens: KmDiarioItem[];
  placas: string[];
  periodoIni: string | null;
  periodoFim: string | null;
  totalRegistros: number;
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Número no formato do Ituran: ponto é decimal ("130981.5"); trata BR ("1.234,5"). */
function parseNum(s: unknown): number {
  const t = String(s ?? "").trim();
  if (t.includes(",")) return parseFloat(t.replace(/\./g, "").replace(",", "."));
  return parseFloat(t);
}
/** "HH:MM:SS" -> minutos. */
function parseTempo(s: unknown): number {
  const m = String(s ?? "").match(/(\d{1,2}):(\d{2}):(\d{2})/);
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]) + Number(m[3]) / 60;
}

export async function parseIturanXlsx(buf: ArrayBuffer, enderecoManutencao = ""): Promise<IturanParsed> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false });

  let hi = rows.findIndex((r) => Array.isArray(r) && r.some((c) => typeof c === "string" && /od[oô]metro/i.test(c)));
  if (hi < 0) hi = 8;
  const header = (rows[hi] as unknown[]).map((c) => norm(String(c ?? "")));
  const findCol = (re: RegExp, fallback: number) => { const idx = header.findIndex((c) => re.test(c)); return idx >= 0 ? idx : fallback; };
  const colData = findCol(/hora|data/, 0);
  const colOdom = findCol(/odometro/, 2);
  const colEnd = findCol(/endereco/, 4);
  const colOcioso = findCol(/ocioso|tempo/, 9);
  let colPlaca = header.findIndex((c) => /placa/.test(c));
  if (colPlaca < 0) colPlaca = header.findIndex((c, i) => c === "nome" && i !== colData);
  if (colPlaca < 0) colPlaca = 1;

  const termo = norm(enderecoManutencao).trim();
  const map = new Map<string, { placa: string; dia: string; min: number; max: number; count: number; manut: number }>();
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i] as unknown[];
    if (!Array.isArray(r)) continue;
    const m = String(r[colData] ?? "").match(/(\d{2})\/(\d{2})\/(\d{4})/);
    const placa = String(r[colPlaca] ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    const odom = parseNum(r[colOdom]);
    if (!m || !placa || placa.length < 5 || !isFinite(odom)) continue;
    const dia = `${m[3]}-${m[2]}-${m[1]}`;
    const key = `${placa}|${dia}`;
    const cur = map.get(key) ?? { placa, dia, min: odom, max: odom, count: 0, manut: 0 };
    cur.min = Math.min(cur.min, odom);
    cur.max = Math.max(cur.max, odom);
    cur.count += 1;
    if (termo && norm(String(r[colEnd] ?? "")).includes(termo)) cur.manut += parseTempo(r[colOcioso]);
    map.set(key, cur);
  }

  const itens = [...map.values()].map((v) => ({ placa: v.placa, dia: v.dia, odom_inicio: v.min, odom_fim: v.max, registros: v.count, min_ocioso_manut: Math.round(v.manut) }));
  const placas = [...new Set(itens.map((i) => i.placa))].sort();
  const dias = itens.map((i) => i.dia).sort();
  return { itens, placas, periodoIni: dias[0] ?? null, periodoFim: dias[dias.length - 1] ?? null, totalRegistros: itens.reduce((s, i) => s + i.registros, 0) };
}
