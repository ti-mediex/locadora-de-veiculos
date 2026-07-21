// Exportação de relatórios em vários formatos: planilha (CSV/XLSX), HTML e PDF.
import * as XLSX from "xlsx";

export interface ExportColumn<T> {
  key: keyof T;
  label: string;
}

function matrix<T extends object>(rows: T[], columns: ExportColumn<T>[]) {
  const header = columns.map((c) => c.label);
  const body = rows.map((r) =>
    columns.map((c) => {
      const v = r[c.key];
      return v === null || v === undefined ? "" : (v as unknown as string | number);
    })
  );
  return { header, body };
}

/** Planilha CSV (separador ; e BOM para Excel pt-BR). */
export function exportCsv<T extends object>(filename: string, rows: T[], columns: ExportColumn<T>[]) {
  const { header, body } = matrix(rows, columns);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = "﻿" + [header.map(esc).join(";"), ...body.map((r) => r.map(esc).join(";"))].join("\n");
  baixar(new Blob([csv], { type: "text/csv;charset=utf-8;" }), filename, "csv");
}

/** Planilha XLSX (Excel). */
export function exportXlsx<T extends object>(filename: string, rows: T[], columns: ExportColumn<T>[], sheetName = "Relatório") {
  const { header, body } = matrix(rows, columns);
  const ws = XLSX.utils.aoa_to_sheet([header, ...body]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}

function tabelaHtml<T extends object>(title: string, rows: T[], columns: ExportColumn<T>[]) {
  const th = columns.map((c) => `<th>${c.label}</th>`).join("");
  const trs = rows
    .map((r) => "<tr>" + columns.map((c) => `<td>${String(r[c.key] ?? "")}</td>`).join("") + "</tr>")
    .join("");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${title}</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:24px}
  h1{font-size:18px;margin:0 0 4px} .meta{color:#666;font-size:12px;margin-bottom:16px}
  table{border-collapse:collapse;width:100%;font-size:12px}
  th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}
  th{background:#f3f4f6} tr:nth-child(even){background:#fafafa}
  @media print{body{margin:0}}
</style></head><body>
  <h1>VIP CARS — ${title}</h1>
  <div class="meta">Gerado em ${new Date().toLocaleString("pt-BR")}</div>
  <table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>
</body></html>`;
}

/** Relatório em HTML (download do arquivo .html). */
export function exportHtml<T extends object>(filename: string, title: string, rows: T[], columns: ExportColumn<T>[]) {
  const html = tabelaHtml(title, rows, columns);
  baixar(new Blob([html], { type: "text/html;charset=utf-8;" }), filename, "html");
}

/** Relatório em PDF (abre janela de impressão — o usuário salva como PDF). */
export function exportPdf<T extends object>(title: string, rows: T[], columns: ExportColumn<T>[]) {
  const html = tabelaHtml(title, rows, columns);
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}

function baixar(blob: Blob, filename: string, ext: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(`.${ext}`) ? filename : `${filename}.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
}
