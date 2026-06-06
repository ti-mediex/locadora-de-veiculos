import { parseCsvMatrix } from "./csv-parse";

export interface ParsedSheet {
  headers: string[];
  rows: string[][];
}

/**
 * Detecta a linha de cabeçalho real em uma matriz (ignora linhas de título/filtros,
 * comuns nos relatórios do Blue Fleet) e separa os dados.
 */
function extractTable(matrix: unknown[][]): ParsedSheet {
  const cleaned = matrix.map((r) => (r ?? []).map((c) => String(c ?? "").trim()));
  let headerIdx = 0;
  let best = -1;
  const limit = Math.min(cleaned.length, 20);
  for (let i = 0; i < limit; i++) {
    const count = cleaned[i].filter((x) => x !== "").length;
    if (count > best) {
      best = count;
      headerIdx = i;
    }
  }
  const headers = cleaned[headerIdx] ?? [];
  const rows = cleaned.slice(headerIdx + 1).filter((r) => r.some((x) => x !== ""));
  return { headers, rows };
}

/** Lê um arquivo CSV ou Excel (.xlsx/.xls) e retorna cabeçalho + linhas. */
export async function parseSpreadsheet(file: File): Promise<ParsedSheet> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const XLSX = await import("xlsx");
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array", cellDates: false });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      raw: false,
      defval: "",
      blankrows: false,
    });
    return extractTable(matrix);
  }
  const text = await file.text();
  return extractTable(parseCsvMatrix(text));
}
