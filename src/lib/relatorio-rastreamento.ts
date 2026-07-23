// Relatório gerencial de rastreabilidade (Ituran): documento HTML imprimível
// (visualizar em nova aba / salvar PDF) com a conectividade da frota e a lista
// de veículos a convocar para ajuste do rastreador.

export interface RelRastreioKpi {
  total: number; comunicando: number; semCom: number; convocados: number; vendidos: number;
  t1a2: number; t2a7: number; t7a30: number; t30: number;
}
export interface RelRastreioLinha {
  placa: string; modelo: string; ultima: string | null; dias: number | null;
  status: string; endereco: string; estados: string; convocado: boolean;
}
export interface RelatorioRastreioData {
  empresa: string; referencia: string; limiarHoras: number;
  kpi: RelRastreioKpi; semComunicacao: RelRastreioLinha[]; vendidos: RelRastreioLinha[];
}

const nf = new Intl.NumberFormat("pt-BR");
const esc = (s: string) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
const dt = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)} ${iso.slice(11, 16)}` : "—");

export function abrirRelatorioRastreio(d: RelatorioRastreioData) {
  const win = window.open("", "_blank");
  if (!win) return false;
  const hojeStr = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date());

  const kpiCards = [
    ["Total de veículos", nf.format(d.kpi.total)],
    ["Comunicando", nf.format(d.kpi.comunicando)],
    ["Sem comunicação", nf.format(d.kpi.semCom)],
    ["Vendidos c/ rastreador", nf.format(d.kpi.vendidos)],
    ["Convocados", nf.format(d.kpi.convocados)],
    ["1 a 2 dias", nf.format(d.kpi.t1a2)],
    ["7 a 30 dias", nf.format(d.kpi.t7a30)],
    ["+ de 30 dias", nf.format(d.kpi.t30)],
  ].map(([t, v]) => `<div class="kpi"><span class="kpi-t">${esc(t)}</span><strong>${esc(v)}</strong></div>`).join("");

  const vendidosRows = d.vendidos.map((l) => `<tr>
    <td class="mono">${esc(l.placa)}</td><td class="muted">${esc(l.modelo)}</td>
    <td>${dt(l.ultima)}</td><td class="muted small">${esc(l.endereco)}</td>
  </tr>`).join("");

  const linhas = d.semComunicacao.map((l) => `<tr>
    <td class="mono">${esc(l.placa)}</td><td class="muted">${esc(l.modelo)}</td>
    <td>${dt(l.ultima)}</td>
    <td class="r ${l.dias != null && l.dias > 30 ? "crit" : "warn"}">${l.dias != null ? `${nf.format(Math.floor(l.dias))} d` : "sem data"}</td>
    <td class="muted small">${esc(l.endereco)}</td>
    <td>${l.convocado ? '<span class="tag">Convocado</span>' : ""}</td>
  </tr>`).join("");

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Relatório de rastreabilidade — ${esc(d.empresa)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #0f172a; margin: 0; padding: 24px; }
  header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1d4ed8; padding-bottom: 12px; margin-bottom: 16px; }
  h1 { font-size: 20px; margin: 0; color: #1d4ed8; }
  h2 { font-size: 14px; margin: 22px 0 8px; color: #1e293b; border-left: 3px solid #1d4ed8; padding-left: 8px; }
  .sub { color: #64748b; font-size: 12px; margin-top: 2px; }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .kpi { border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px; display: flex; flex-direction: column; gap: 2px; }
  .kpi-t { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: .03em; }
  .kpi strong { font-size: 17px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th, td { padding: 5px 8px; border-bottom: 1px solid #eef2f7; text-align: left; vertical-align: top; }
  thead th { background: #f8fafc; font-size: 10px; text-transform: uppercase; color: #475569; white-space: nowrap; }
  .r { text-align: right; } .small { font-size: 10px; }
  .mono { font-family: ui-monospace, Menlo, monospace; font-weight: 600; }
  .muted { color: #94a3b8; }
  .warn { color: #b45309; font-weight: 700; } .crit { color: #dc2626; font-weight: 700; }
  .tag { background: #fef3c7; color: #92400e; border-radius: 6px; padding: 1px 6px; font-size: 10px; font-weight: 600; }
  .actions { margin-bottom: 16px; }
  button { background: #1d4ed8; color: #fff; border: 0; border-radius: 8px; padding: 8px 16px; font-size: 13px; cursor: pointer; }
  footer { margin-top: 24px; color: #94a3b8; font-size: 10px; text-align: center; border-top: 1px solid #eef2f7; padding-top: 8px; }
  @media print { .actions { display: none; } body { padding: 0; } }
</style></head><body>
<div class="actions"><button onclick="window.print()">Imprimir / Salvar PDF</button></div>
<header>
  <div><h1>${esc(d.empresa)}</h1><div class="sub">Relatório gerencial de rastreabilidade (Ituran)</div></div>
  <div class="sub" style="text-align:right">Referência do relatório: ${dt(d.referencia)}<br>Limiar sem comunicação: ${d.limiarHoras}h<br>Emitido em ${esc(hojeStr)}</div>
</header>

<h2>Resumo de conectividade</h2>
<div class="kpis">${kpiCards}</div>

<h2>Veículos vendidos ainda com rastreador — retirar rastreador (${d.vendidos.length})</h2>
${d.vendidos.length
      ? `<table><thead><tr><th>Placa</th><th>Modelo</th><th>Última comunicação</th><th>Localização</th></tr></thead><tbody>${vendidosRows}</tbody></table>`
      : `<p class="sub">Nenhum veículo vendido consta na base de rastreamento.</p>`}

<h2>Veículos sem comunicação — convocar para ajuste (${d.semComunicacao.length})</h2>
${d.semComunicacao.length
      ? `<table><thead><tr><th>Placa</th><th>Modelo</th><th>Última comunicação</th><th class="r">Dias</th><th>Localização</th><th>Convocação</th></tr></thead><tbody>${linhas}</tbody></table>`
      : `<p class="sub">Nenhum veículo sem comunicação acima do limiar. Frota conectada.</p>`}

<footer>Base: relatório "Grade de veículos" do Ituran · sem comunicação = última atualização há mais que o limiar · VIP CARS</footer>
</body></html>`;

  win.document.open();
  win.document.write(html);
  win.document.close();
  return true;
}
