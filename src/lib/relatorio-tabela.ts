// Relatório genérico de tabela: gera um documento HTML imprimível (visualizar em
// nova aba / salvar PDF) a partir dos dados já filtrados/ordenados em qualquer aba.
// Também permite exportar as mesmas linhas para CSV.

export interface RelColuna { label: string; align?: "left" | "right" | "center"; }

export interface RelatorioTabelaData {
  empresa?: string;
  titulo: string;
  subtitulo?: string;
  filtros?: { label: string; valor: string }[];  // filtros aplicados na pesquisa
  colunas: RelColuna[];
  linhas: (string | number)[][];                  // células já formatadas
  rodape?: (string | number)[];                   // linha de totais (opcional)
  autoPrint?: boolean;                            // abre já o diálogo de impressão (PDF)
}

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
const cls = (a?: string) => (a === "right" ? "r" : a === "center" ? "c" : "");

export function abrirRelatorioTabela(d: RelatorioTabelaData): boolean {
  const win = window.open("", "_blank");
  if (!win) return false;
  const hoje = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date());

  const thead = `<tr>${d.colunas.map((c) => `<th class="${cls(c.align)}">${esc(c.label)}</th>`).join("")}</tr>`;
  const tbody = d.linhas.map((row) => `<tr>${row.map((cell, i) => `<td class="${cls(d.colunas[i]?.align)}">${esc(cell)}</td>`).join("")}</tr>`).join("");
  const tfoot = d.rodape ? `<tr class="tot">${d.rodape.map((cell, i) => `<td class="${cls(d.colunas[i]?.align)}">${esc(cell)}</td>`).join("")}</tr>` : "";
  const filtros = d.filtros?.filter((f) => f.valor).map((f) => `<span class="tag"><b>${esc(f.label)}:</b> ${esc(f.valor)}</span>`).join("") ?? "";

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>${esc(d.titulo)}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;margin:0;padding:24px}
  header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1d4ed8;padding-bottom:12px;margin-bottom:14px}
  h1{font-size:19px;margin:0;color:#1d4ed8}
  .sub{color:#64748b;font-size:12px;margin-top:2px}
  .filtros{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 14px}
  .tag{background:#f1f5f9;border-radius:6px;padding:3px 8px;font-size:11px}
  .wrap{overflow-x:auto}
  table{width:100%;border-collapse:collapse;font-size:11px}
  th,td{padding:5px 8px;border-bottom:1px solid #eef2f7;text-align:left;white-space:nowrap}
  thead th{background:#f8fafc;font-size:10px;text-transform:uppercase;color:#475569;letter-spacing:.03em}
  td:nth-child(3),th:nth-child(3){white-space:normal}
  .r{text-align:right}.c{text-align:center}
  tr.tot td{border-top:2px solid #cbd5e1;font-weight:700;background:#f8fafc}
  .actions{margin-bottom:14px;display:flex;gap:8px}
  button{background:#1d4ed8;color:#fff;border:0;border-radius:8px;padding:8px 16px;font-size:13px;cursor:pointer}
  button.sec{background:#e2e8f0;color:#0f172a}
  footer{margin-top:20px;color:#94a3b8;font-size:10px;text-align:center;border-top:1px solid #eef2f7;padding-top:8px}
  @media print{.actions{display:none}body{padding:0}}
</style></head><body>
<div class="actions"><button onclick="window.print()">Imprimir / Salvar PDF</button></div>
<header>
  <div><h1>${esc(d.empresa ?? "VIP CARS")}</h1><div class="sub">${esc(d.titulo)}${d.subtitulo ? " — " + esc(d.subtitulo) : ""}</div></div>
  <div class="sub" style="text-align:right">${d.linhas.length} registro(s)<br>Emitido em ${esc(hoje)}</div>
</header>
${filtros ? `<div class="filtros">${filtros}</div>` : ""}
<div class="wrap"><table><thead>${thead}</thead><tbody>${tbody}${tfoot}</tbody></table></div>
<footer>Relatório da pesquisa · ${esc(d.empresa ?? "VIP CARS")}</footer>
${d.autoPrint ? "<script>window.onload=function(){setTimeout(function(){window.print()},400)}</script>" : ""}
</body></html>`;

  win.document.open();
  win.document.write(html);
  win.document.close();
  return true;
}

/** Exporta as mesmas linhas para CSV (separador ; para abrir direto no Excel pt-BR). */
export function exportarTabelaCsv(nome: string, colunas: RelColuna[], linhas: (string | number)[][]): void {
  const escCsv = (v: unknown) => { const s = String(v ?? ""); return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const head = colunas.map((c) => escCsv(c.label)).join(";");
  const body = linhas.map((r) => r.map(escCsv).join(";")).join("\n");
  const blob = new Blob(["﻿" + head + "\n" + body], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${nome}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
