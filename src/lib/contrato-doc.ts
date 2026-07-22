import { VIPCAR_LOGO } from "./laudo-logo";
import { CONTRATO_CLAUSULAS } from "./contrato-clausulas";
import type { Contrato } from "@/types/database";

const esc = (s: unknown) => String(s ?? "").replace(/[<>&]/g, (m) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[m] as string));
const brl = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const dt = (d: string | null | undefined) => (d ? d.split("-").reverse().join("/") : "—");

export interface EmpresaDados { nome: string; cnpj: string; endereco: string; }

/** Gera o HTML do contrato de locação no layout do modelo VIP CARS. */
export function gerarContratoHtml(
  c: Contrato & { vehicles?: { placa: string; modelo: string } | null },
  empresa: EmpresaDados,
  clausulas: string = CONTRATO_CLAUSULAS,
): string {
  const placa = c.vehicles?.placa ?? c.placa ?? "—";
  const campo = (l: string, v: string) => `<div class="fld"><div class="lbl">${l}</div><div class="val">${v || "—"}</div></div>`;
  const clHtml = esc(clausulas).replace(/\n/g, "<br>");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Contrato ${esc(c.numero)}</title>
  <style>
    *{box-sizing:border-box} body{font-family:Arial,Helvetica,sans-serif;margin:0;padding:26px;color:#111;font-size:12px}
    .hd{display:flex;align-items:center;gap:14px;border-bottom:2px solid #333;padding-bottom:10px}
    .hd img{height:54px;border-radius:6px} .hd .emp{font-size:15px;font-weight:bold} .hd .sub{font-size:11px;color:#555}
    h2{font-size:13px;background:#eceff3;padding:5px 8px;margin:16px 0 8px;border-left:4px solid #6b21a8}
    .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px 12px}
    .grid.c3{grid-template-columns:repeat(3,1fr)} .grid.c2{grid-template-columns:repeat(2,1fr)}
    .fld .lbl{font-size:9px;font-weight:bold;color:#444;text-transform:uppercase} .fld .val{font-size:12px}
    .info{border:1px solid #ddd;border-radius:6px;padding:8px;font-size:11px;white-space:pre-line}
    .clausulas{font-size:10px;line-height:1.45;text-align:justify;margin-top:8px}
    .assinaturas{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:40px}
    .assinaturas .a{border-top:1px solid #333;padding-top:6px;text-align:center;font-size:11px}
    .cidade{margin-top:26px;font-size:11px}
    @media print{body{padding:0 10px}}
  </style></head><body>
    <div class="hd"><img src="${VIPCAR_LOGO}"><div><div class="emp">${esc(empresa.nome)}</div><div class="sub">CNPJ ${esc(empresa.cnpj)}<br>${esc(empresa.endereco)}</div></div></div>

    <h2>Abertura do Contrato de Locação</h2>
    <div class="grid">
      ${campo("Contrato", esc(c.numero))}
      ${campo("Local de entrega", esc(c.local_entrega))}
      ${campo("Data de entrega", dt(c.data_entrega))}
      ${campo("Hora de entrega", esc(c.hora_entrega))}
      ${campo("Atendente", esc(c.atendente))}
      ${campo("Local de devolução", esc(c.local_devolucao))}
      ${campo("Devolução prevista", dt(c.devolucao_prevista))}
      ${campo("Status", esc(c.status))}
    </div>

    <h2>Cliente / Locatário</h2>
    <div class="grid c3">
      ${campo("Cliente", esc(c.cliente_nome))}
      ${campo("CPF", esc(c.cliente_cpf))}
      ${campo("CNH / Categoria", esc([c.cliente_cnh, c.cliente_cnh_cat].filter(Boolean).join(" / ")))}
      ${campo("E-mail", esc(c.cliente_email))}
      ${campo("Telefone", esc(c.cliente_telefone))}
      ${campo("Endereço", esc(c.cliente_endereco))}
    </div>

    <h2>Veículo e Pagamento</h2>
    <div class="grid">
      ${campo("Placa", esc(placa))}
      ${campo("Grupo", esc(c.grupo))}
      ${campo("KM de entrega", esc(c.km_entrega))}
      ${campo("Semanas", esc(c.semanas))}
      ${campo("Valor da locação", brl(c.valor_locacao))}
      ${campo("Pré-autorização", brl(c.pre_autorizacao))}
      ${campo("Total", brl(c.valor_total))}
      ${campo("Veículo", esc(c.vehicles?.modelo ?? ""))}
    </div>

    ${c.informacoes_adicionais ? `<h2>Informações Adicionais</h2><div class="info">${esc(c.informacoes_adicionais)}</div>` : ""}

    <h2>Contrato de Locação — Termos e Condições Gerais</h2>
    <div class="clausulas">${clHtml}</div>

    <div class="cidade">Jaboatão dos Guararapes, _____ de ______________ de 20____.</div>
    <div class="assinaturas">
      <div class="a">LOCADOR<br>${esc(empresa.nome)}</div>
      <div class="a">LOCATÁRIO<br>${esc(c.cliente_nome)}</div>
    </div>
  </body></html>`;
}
