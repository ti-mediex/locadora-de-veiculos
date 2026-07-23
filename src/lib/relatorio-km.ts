// Relatório gerencial de KM: monta um documento HTML imprimível (visualizar em
// nova aba e salvar em PDF pelo navegador) a partir da apuração já calculada.

export interface RelKpi {
  kmTotal: number; diasRodados: number; diasParados: number; kmMediaDia: number;
  minManut: number; diasManut: number; excedenteTotal: number; mesesExcedidos: number; veiculos: number;
}
export interface RelVeiculo { placa: string; modelo: string; km: number; kmMes: number; diasRodados: number; dias: number; minManut: number; }
export interface RelPivot { placa: string; total: number; por: Record<string, number>; }
export interface RelManut { placa: string; diasN: number; horas: number; }
export interface RelatorioKmData {
  empresa: string; escopo: string; periodo: string; franquia: number;
  kpi: RelKpi; porVeiculo: RelVeiculo[]; meses: string[]; pivot: RelPivot[];
  totMes: Record<string, number>; manutRows: RelManut[];
}

const nf = new Intl.NumberFormat("pt-BR");
const n0 = (v: number) => nf.format(Math.round(v));
const km = (v: number) => `${n0(v)} km`;
const mesLabel = (m: string) => `${m.slice(5)}/${m.slice(2, 4)}`;
const esc = (s: string) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

export function abrirRelatorioKm(d: RelatorioKmData) {
  const win = window.open("", "_blank");
  if (!win) return false;

  const hojeStr = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date());
  const excedeClass = (v: number) => (v > d.franquia ? ' class="over"' : "");

  const kpiCards = [
    ["KM total no período", km(d.kpi.kmTotal)],
    ["Média por dia rodado", km(d.kpi.kmMediaDia)],
    ["Dias rodados", n0(d.kpi.diasRodados)],
    ["Dias parados (sem rodar)", n0(d.kpi.diasParados)],
    ["KM excedente da franquia", `${km(d.kpi.excedenteTotal)}`],
    ["Meses acima da franquia", n0(d.kpi.mesesExcedidos)],
    ["Tempo em manutenção", `${n0(d.kpi.minManut / 60)} h`],
    ["Veículos apurados", n0(d.kpi.veiculos)],
  ].map(([t, v]) => `<div class="kpi"><span class="kpi-t">${esc(t)}</span><strong>${esc(v)}</strong></div>`).join("");

  const porVeic = d.porVeiculo.map((v) => `<tr>
    <td class="mono">${esc(v.placa)}</td><td class="muted">${esc(v.modelo)}</td>
    <td class="r">${km(v.km)}</td><td class="r${v.kmMes > d.franquia ? " over" : ""}">${km(v.kmMes)}</td>
    <td class="r">${v.diasRodados}/${v.dias}</td><td class="r">${v.minManut > 0 ? `${n0(v.minManut / 60)} h` : "—"}</td>
  </tr>`).join("");

  const pivotHead = d.meses.map((m) => `<th class="r">${esc(mesLabel(m))}</th>`).join("");
  const pivotBody = d.pivot.map((p) => `<tr>
    <td class="mono">${esc(p.placa)}</td>
    ${d.meses.map((m) => { const val = p.por[m] ?? 0; return `<td class="r${val > d.franquia ? " over" : val > 0 ? "" : " muted"}">${val > 0 ? n0(val) : "—"}</td>`; }).join("")}
    <td class="r b">${km(p.total)}</td>
  </tr>`).join("");
  const pivotTot = `<tr class="tot">
    <td>Total frota</td>
    ${d.meses.map((m) => `<td class="r">${n0(d.totMes[m] ?? 0)}</td>`).join("")}
    <td class="r b">${km(d.pivot.reduce((s, p) => s + p.total, 0))}</td>
  </tr>`;

  const manut = d.manutRows.length
    ? `<h2>Paralisação por manutenção (passível de desconto)</h2>
       <table><thead><tr><th>Veículo</th><th class="r">Dias parados</th><th class="r">Tempo total</th></tr></thead>
       <tbody>${d.manutRows.map((m) => `<tr><td class="mono">${esc(m.placa)}</td><td class="r">${m.diasN}</td><td class="r">${m.horas >= 1 ? `${n0(m.horas)} h` : "< 1 h"}</td></tr>`).join("")}</tbody></table>`
    : "";

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Relatório gerencial de KM — ${esc(d.empresa)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #0f172a; margin: 0; padding: 24px; }
  header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1d4ed8; padding-bottom: 12px; margin-bottom: 16px; }
  h1 { font-size: 20px; margin: 0; color: #1d4ed8; }
  h2 { font-size: 14px; margin: 22px 0 8px; color: #1e293b; border-left: 3px solid #1d4ed8; padding-left: 8px; }
  .sub { color: #64748b; font-size: 12px; margin-top: 2px; }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 8px; }
  .kpi { border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px; display: flex; flex-direction: column; gap: 2px; }
  .kpi-t { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: .03em; }
  .kpi strong { font-size: 17px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th, td { padding: 5px 8px; border-bottom: 1px solid #eef2f7; text-align: left; }
  thead th { background: #f8fafc; font-size: 10px; text-transform: uppercase; color: #475569; letter-spacing: .03em; white-space: nowrap; }
  .r { text-align: right; }
  .b { font-weight: 700; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 600; }
  .muted { color: #94a3b8; }
  .over { color: #dc2626; font-weight: 700; }
  tr.tot td { border-top: 2px solid #cbd5e1; font-weight: 700; background: #f8fafc; }
  .wrap { overflow-x: auto; }
  .actions { margin-bottom: 16px; }
  button { background: #1d4ed8; color: #fff; border: 0; border-radius: 8px; padding: 8px 16px; font-size: 13px; cursor: pointer; }
  footer { margin-top: 24px; color: #94a3b8; font-size: 10px; text-align: center; border-top: 1px solid #eef2f7; padding-top: 8px; }
  @media print { .actions { display: none; } body { padding: 0; } }
</style></head><body>
<div class="actions"><button onclick="window.print()">Imprimir / Salvar PDF</button></div>
<header>
  <div><h1>${esc(d.empresa)}</h1><div class="sub">Relatório gerencial de KM</div></div>
  <div class="sub" style="text-align:right">Escopo: <strong>${esc(d.escopo)}</strong><br>Período: ${esc(d.periodo)}<br>Emitido em ${esc(hojeStr)}</div>
</header>

<h2>Resumo</h2>
<div class="kpis">${kpiCards}</div>

<h2>KM por veículo</h2>
<div class="wrap"><table>
  <thead><tr><th>Placa</th><th>Modelo</th><th class="r">KM total</th><th class="r">KM/mês</th><th class="r">Dias rodados</th><th class="r">Manutenção</th></tr></thead>
  <tbody>${porVeic}</tbody>
</table></div>

<h2>KM rodado por mês por veículo${excedeClass(0)}</h2>
<div class="sub" style="margin-bottom:6px">Valores em km · destaque em vermelho ultrapassa a franquia de ${n0(d.franquia)} km/mês</div>
<div class="wrap"><table>
  <thead><tr><th>Veículo</th>${pivotHead}<th class="r">Total</th></tr></thead>
  <tbody>${pivotBody}${pivotTot}</tbody>
</table></div>

${manut}

<footer>Base: relatório de ociosidade do Ituran · KM apurado por variação do odômetro · VIP CARS</footer>
</body></html>`;

  win.document.open();
  win.document.write(html);
  win.document.close();
  return true;
}
