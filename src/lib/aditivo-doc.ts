import { VIPCAR_LOGO } from "./laudo-logo";

const esc = (s: unknown) => String(s ?? "").replace(/[<>&]/g, (m) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[m] as string));
const dt = (d: string | null | undefined) => (d ? new Date(d).toLocaleString("pt-BR") : "—");

export interface EmpresaDados { nome: string; cnpj: string; endereco: string; }

export interface AditivoDados {
  numero?: string;
  contratoNumero?: string | null;
  clienteNome?: string | null;
  clienteCpf?: string | null;
  placa?: string | null;
  veiculoDesc?: string | null;   // marca modelo
  placaAnterior?: string | null; // para troca
  data?: string;                 // data do aditivo (yyyy-mm-dd)
  motivo?: string | null;        // para troca
}

const hojeExtenso = () => new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

/** Texto padrão do aditivo de confirmação de posse do veículo. */
export function textoAditivoPosse(d: AditivoDados): string {
  const veic = [d.placa ? `placa ${d.placa}` : "", d.veiculoDesc ?? ""].filter(Boolean).join(" — ");
  return (
    `ADITIVO DE CONFIRMAÇÃO DE POSSE DE VEÍCULO\n\n` +
    `Pelo presente instrumento, o(a) LOCATÁRIO(A) ${d.clienteNome ?? "____________________"}` +
    `${d.clienteCpf ? `, inscrito(a) no CPF sob o nº ${d.clienteCpf}` : ""}, referente ao contrato de locação ` +
    `${d.contratoNumero ?? "____"}, DECLARA e CONFIRMA que está na posse do veículo ${veic || "____________________"}, ` +
    `recebido em perfeitas condições de uso e conservação, comprometendo-se a zelar pela sua guarda e a devolvê-lo ` +
    `nas condições pactuadas no contrato de locação.\n\n` +
    `O(a) LOCATÁRIO(A) declara ainda estar ciente de que é responsável pelo veículo enquanto estiver em sua posse, ` +
    `incluindo multas, avarias e demais encargos previstos em contrato.\n\n` +
    `Este aditivo integra o contrato de locação para todos os fins de direito.`
  );
}

/** Texto padrão do aditivo de troca de veículo. */
export function textoAditivoTroca(d: AditivoDados): string {
  const veic = [d.placa ? `placa ${d.placa}` : "", d.veiculoDesc ?? ""].filter(Boolean).join(" — ");
  return (
    `ADITIVO DE TROCA DE VEÍCULO\n\n` +
    `Pelo presente instrumento, referente ao contrato de locação ${d.contratoNumero ?? "____"}, ` +
    `o(a) LOCATÁRIO(A) ${d.clienteNome ?? "____________________"}` +
    `${d.clienteCpf ? `, CPF nº ${d.clienteCpf}` : ""}, DECLARA e CONFIRMA que, ` +
    `${d.motivo ? `em razão de ${d.motivo}, ` : ""}recebeu o veículo reserva ${veic || "____________________"} ` +
    `em substituição ao veículo ${d.placaAnterior ? `de placa ${d.placaAnterior}` : "anteriormente locado"}, ` +
    `permanecendo em vigor todas as demais cláusulas e condições do contrato de locação.\n\n` +
    `O(a) LOCATÁRIO(A) declara receber o veículo reserva em perfeitas condições de uso e assume a sua posse e ` +
    `responsabilidade a partir desta data.\n\n` +
    `Este aditivo integra o contrato de locação para todos os fins de direito.`
  );
}

/** HTML imprimível do aditivo (para o gestor gerar PDF/imprimir). */
export function gerarAditivoHtml(
  a: { numero?: string; conteudo?: string | null; cliente_nome?: string | null; cliente_cpf?: string | null; placa?: string | null; status?: string; assinante_nome?: string | null; assinado_em?: string | null; assinante_cpf?: string | null },
  empresa: EmpresaDados,
): string {
  const corpo = esc(a.conteudo ?? "").replace(/\n/g, "<br>");
  const assinado = a.status === "assinado";
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Aditivo ${esc(a.numero ?? "")}</title>
  <style>
    *{box-sizing:border-box} body{font-family:Arial,Helvetica,sans-serif;margin:0;padding:28px;color:#111;font-size:12px}
    .hd{display:flex;align-items:center;gap:14px;border-bottom:2px solid #333;padding-bottom:10px}
    .hd img{height:54px;border-radius:6px} .hd .emp{font-size:15px;font-weight:bold} .hd .sub{font-size:11px;color:#555}
    h1{font-size:15px;margin:18px 0 4px} .num{color:#6b21a8;font-weight:bold}
    .corpo{font-size:12px;line-height:1.6;text-align:justify;margin-top:12px}
    .assin{margin-top:46px} .linha{border-top:1px solid #333;width:320px;padding-top:6px;text-align:center;font-size:11px}
    .ok{margin-top:20px;padding:10px 12px;border:1px solid #16a34a;border-radius:8px;background:#f0fdf4;color:#166534;font-size:11px}
    .cidade{margin-top:30px;font-size:11px}
    @media print{body{padding:0 10px}}
  </style></head><body>
    <div class="hd"><img src="${VIPCAR_LOGO}"><div><div class="emp">${esc(empresa.nome)}</div><div class="sub">CNPJ ${esc(empresa.cnpj)}<br>${esc(empresa.endereco)}</div></div></div>
    <h1>Aditivo <span class="num">${esc(a.numero ?? "")}</span></h1>
    <div class="corpo">${corpo}</div>
    <div class="cidade">${esc(empresa.endereco?.split(",").slice(-2, -1)[0]?.trim() || "____________")}, ${hojeExtenso()}.</div>
    ${assinado
      ? `<div class="ok"><b>ASSINADO ELETRONICAMENTE</b><br>Por ${esc(a.assinante_nome ?? a.cliente_nome ?? "—")}${a.assinante_cpf ? ` — CPF ${esc(a.assinante_cpf)}` : ""}<br>Em ${esc(dt(a.assinado_em))}</div>`
      : `<div class="assin"><div class="linha">${esc(a.cliente_nome ?? "Locatário(a)")}${a.cliente_cpf ? `<br>CPF ${esc(a.cliente_cpf)}` : ""}</div></div>`}
  </body></html>`;
}
