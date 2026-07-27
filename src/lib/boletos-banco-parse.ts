// Parser do "Relatório de consulta de boletos" do banco (xlsx/csv): extrai os
// boletos pagos para conciliação e baixa automática, casando por CPF/CNPJ e nome
// do pagador com o locatário do contrato.
import { parseSpreadsheet } from "@/lib/spreadsheet";

export interface BoletoBancoRow {
  pagador: string;
  cpfCnpj: string;      // só dígitos
  nossoNumero: string;
  vencimento: string | null; // YYYY-MM-DD
  pagamento: string | null;  // YYYY-MM-DD (data do pagamento)
  valorTitulo: number;
  valorPago: number;
  status: string;
  pago: boolean;
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
export const soDigitos = (s: string) => (s ?? "").replace(/\D+/g, "");

/** Converte "1.234,56" / "94,5" / "94.5" em número. */
function parseValor(s: string): number {
  const t = (s ?? "").toString().replace(/[^\d.,-]/g, "").trim();
  if (!t) return 0;
  if (t.includes(",")) return Number(t.replace(/\./g, "").replace(",", ".")) || 0; // BR: ponto milhar, vírgula decimal
  return Number(t) || 0;
}

/** Converte "dd/mm/aaaa" (ou aaaa-mm-dd) em YYYY-MM-DD. */
function parseData(s: string): string | null {
  const t = (s ?? "").toString().trim();
  if (!t) return null;
  const br = t.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
}

export async function parseBoletosBanco(file: File): Promise<BoletoBancoRow[]> {
  const { headers, rows } = await parseSpreadsheet(file);
  const h = headers.map(norm);
  const idx = (pred: (x: string) => boolean) => h.findIndex(pred);
  const iPagador = idx((x) => x === "pagador" || (x.includes("pagador") && !x.includes("cpf")));
  const iCpf = idx((x) => x.includes("cpf") || x.includes("cnpj"));
  const iNosso = idx((x) => x.includes("nosso"));
  const iVenc = idx((x) => x.includes("vencimento"));
  const iPagto = idx((x) => x.includes("pagamento"));
  const iValPago = idx((x) => x.includes("valor") && x.includes("pago"));
  const iValTit = idx((x) => x.includes("valor") && (x.includes("titulo") || x.includes("título")));
  const iStatus = idx((x) => x.includes("status") || x.includes("situacao"));

  const out: BoletoBancoRow[] = [];
  for (const r of rows) {
    const pagador = (iPagador >= 0 ? r[iPagador] : "") ?? "";
    const cpfCnpj = soDigitos(iCpf >= 0 ? r[iCpf] : "");
    const status = (iStatus >= 0 ? r[iStatus] : "") ?? "";
    if (!pagador && !cpfCnpj) continue;
    const valorPago = iValPago >= 0 ? parseValor(r[iValPago]) : 0;
    const pagamento = iPagto >= 0 ? parseData(r[iPagto]) : null;
    const pago = /pag/i.test(status) || (valorPago > 0 && !!pagamento);
    out.push({
      pagador: String(pagador).trim(),
      cpfCnpj,
      nossoNumero: String(iNosso >= 0 ? r[iNosso] : "").trim(),
      vencimento: iVenc >= 0 ? parseData(r[iVenc]) : null,
      pagamento,
      valorTitulo: iValTit >= 0 ? parseValor(r[iValTit]) : 0,
      valorPago,
      status: String(status).trim(),
      pago,
    });
  }
  return out;
}
