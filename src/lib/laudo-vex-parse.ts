// Extrai dados de um laudo do Vex (PDF) para pré-preencher o anexo de laudo:
// placa, tipo de operação, data e locatário.
export interface LaudoVexParsed {
  placa: string | null;
  tipo: string | null; // liberacao | devolucao | sinistro
  data: string | null;  // YYYY-MM-DD
  locatario: string | null;
}

export function parseLaudoVex(texto: string): LaudoVexParsed {
  const flat = texto.replace(/\s+/g, " ").trim();

  // Placa (Mercosul ou antiga). Prefere a que vem após "PLACA".
  let placa: string | null = null;
  const mPlaca = flat.match(/PLACA\s*:?\s*([A-Z]{3}-?\d[A-Z0-9]\d{2})/i) || flat.match(/\b([A-Z]{3}-?\d[A-Z0-9]\d{2})\b/);
  if (mPlaca) placa = mPlaca[1].replace(/[^A-Za-z0-9]/g, "").toUpperCase();

  // Tipo de operação (Coleta = devolução; Entrega = liberação).
  let tipo: string | null = null;
  if (/sinistro/i.test(flat)) tipo = "sinistro";
  else if (/\bcoleta\b/i.test(flat)) tipo = "devolucao";
  else if (/\bentrega\b/i.test(flat)) tipo = "liberacao";

  // Data (primeira DD/MM/AAAA).
  let data: string | null = null;
  const mData = flat.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (mData) data = `${mData[3]}-${mData[2]}-${mData[1]}`;

  // Locatário (Responsável, senão Cliente).
  let locatario: string | null = null;
  const mResp = flat.match(/Respons[áa]vel\s*:?\s*([A-ZÀ-Ú][A-ZÀ-Ú .]{3,50}?)\s+(?:Respons[áa]vel\s+Documento|Documento|Bateria|CRLV|Telefone|Email)/i)
    || flat.match(/Cliente\s*:?\s*([A-ZÀ-Ú][A-ZÀ-Ú .]{3,50}?)\s+(?:Email|Respons[áa]vel|Vistoriador|Documento)/i);
  if (mResp) locatario = mResp[1].replace(/\s+/g, " ").trim();

  return { placa, tipo, data, locatario };
}
