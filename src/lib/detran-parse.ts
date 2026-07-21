// Parser do "Detalhamento de débitos" do Detran (PDF), para importar débitos
// e pendências de um veículo. Trabalha sobre o texto já extraído do PDF.

export interface DetranMulta {
  documento: string;       // nº do auto de infração
  infracao: string;        // código + descrição
  data_ocorrencia: string; // YYYY-MM-DD
  vencimento: string;      // YYYY-MM-DD
  valor: number;
  local: string;
}
export interface DetranDebito {
  categoria: string;       // IPVA, Licenciamento, Taxas Detran, Seguro Obrigatório
  titulo: string;
  vencimento: string;      // YYYY-MM-DD
  valor: number;
  observacoes?: string;
}
export interface DetranParsed {
  placa: string | null;
  restricoes: string[];
  alienacaoFiduciaria: boolean;
  debitos: DetranDebito[];  // IPVA (cota única), licenciamento, taxas, seguro
  multas: DetranMulta[];
}

/** "1.234,56" | "417,54" -> número. */
export function parseBRL(s: string): number {
  const n = Number(String(s).replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? 0 : n;
}
/** "19/02/2026" -> "2026-02-19". */
function parseData(s: string): string {
  const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}
/** Normaliza espaços/quebras para facilitar as expressões. */
function norm(t: string): string {
  return t.replace(/ /g, " ").replace(/[ \t]+/g, " ");
}

const SECAO_VAZIA = /nada consta/i;

export function parseDetran(textoRaw: string): DetranParsed {
  const texto = norm(textoRaw);
  const flat = texto.replace(/\s+/g, " ").trim();

  // Placa
  const placaM = flat.match(/placa\s*-?\s*([A-Z]{3}\s?\d[A-Z0-9]\d{2})/i);
  const placa = placaM ? placaM[1].replace(/\s/g, "").toUpperCase() : null;

  // Restrições: no Detran o texto da restrição aparece ANTES do rótulo
  // "RESTRIÇÃO". Captura a frase de restrição por termos conhecidos (funciona
  // tanto com quebras de linha quanto com o texto achatado do pdf.js).
  const restricoes: string[] = [];
  const restrM = flat.match(
    /((?:ALIENA[ÇC][ÃA]O|REST(?:RI[ÇC][ÃA]O)?\.?\s*IPVA|BLOQUEIO|JUDICIAL|ROUBO|FURTO|COMUNICA[ÇC][ÃA]O|INTEN[ÇC][ÃA]O)[^.]*?)\.?\s*RESTRI[ÇC][ÃA]O/i
  );
  if (restrM && !SECAO_VAZIA.test(restrM[1])) {
    restricoes.push(restrM[1].replace(/\s+/g, " ").replace(/\.$/, "").trim());
  }
  const alienacaoFiduciaria = /aliena[çc][ãa]o\s+fiduci[áa]ria/i.test(flat);

  // IPVA — todas as linhas; usa a cota ÚNICA como pendência e lista as parcelas
  const debitos: DetranDebito[] = [];
  const ipvaRe = /IPVA\s+(\d{4})\s+(ÚNICA|UNICA|\d+)\s+(\d{2}\/\d{2}\/\d{4})\s+([\d.,]+)/gi;
  const ipvaItens: { exercicio: string; cota: string; venc: string; valor: number }[] = [];
  for (const m of flat.matchAll(ipvaRe)) {
    ipvaItens.push({ exercicio: m[1], cota: m[2], venc: m[3], valor: parseBRL(m[4]) });
  }
  // Cadastra cada cota parcelada (1..N) como uma pendência; ignora a cota ÚNICA.
  const parcelas = ipvaItens.filter((i) => !/ÚNICA|UNICA/i.test(i.cota));
  for (const p of parcelas) {
    debitos.push({
      categoria: "IPVA",
      titulo: `IPVA ${p.exercicio} — cota ${p.cota}`,
      vencimento: parseData(p.venc),
      valor: p.valor,
    });
  }

  // Licenciamento / Taxas Detran / Seguro Obrigatório — só se houver valor
  const seccoes: { rotulo: RegExp; categoria: string; titulo: string }[] = [
    { rotulo: /LICENCIAMENTO/i, categoria: "Licenciamento", titulo: "Licenciamento" },
    { rotulo: /TAXAS?\s+DETRAN/i, categoria: "Taxas Detran", titulo: "Taxas Detran" },
    { rotulo: /SEGURO\s+OBRIGAT[ÓO]RIO/i, categoria: "Seguro/CSV", titulo: "Seguro obrigatório (DPVAT)" },
  ];
  for (const s of seccoes) {
    const seg = trechoSecao(texto, s.rotulo);
    if (!seg || SECAO_VAZIA.test(seg)) continue;
    const venc = seg.match(/(\d{2}\/\d{2}\/\d{4})/);
    const val = seg.match(/R?\$?\s*([\d]{1,3}(?:\.\d{3})*,\d{2})/);
    if (val) {
      debitos.push({ categoria: s.categoria, titulo: s.titulo, vencimento: venc ? parseData(venc[1]) : "", valor: parseBRL(val[1]) });
    }
  }

  // Multas — cada bloco tem Vencimento, R$, Lote, Auto, Infracao, Data, Local
  const multas: DetranMulta[] = [];
  const multaRe = /Vencimento:\s*(\d{2}\/\d{2}\/\d{4})\s*R\$:\s*([\d.,]+)\s*Lote:\s*\S+[\s\S]*?Auto:\s*(\d+-\d)\s*Infracao:\s*(\S+)\s*([\s\S]*?)Data:\s*(\d{2}\/\d{2}\/\d{4})[\s\S]*?Local:\s*([\s\S]*?)Amparo Legal:/gi;
  for (const m of flat.matchAll(multaRe)) {
    const desc = m[5].replace(/\s+/g, " ").trim();
    const local = m[7].replace(/\s*-\s*$/, "").replace(/\s+/g, " ").trim();
    multas.push({
      documento: m[3],
      infracao: `${m[4]} ${desc}`.trim(),
      data_ocorrencia: parseData(m[6]),
      vencimento: parseData(m[1]),
      valor: parseBRL(m[2]),
      local,
    });
  }

  return { placa, restricoes, alienacaoFiduciaria, debitos, multas };
}

/** Extrai o trecho de texto pertencente a uma seção (do rótulo até o próximo rótulo em caixa alta). */
function trechoSecao(texto: string, rotulo: RegExp): string | null {
  const linhas = texto.split("\n");
  const idx = linhas.findIndex((l) => rotulo.test(l.trim()) && l.trim().length < 40);
  if (idx < 0) return null;
  const out: string[] = [];
  for (let i = idx + 1; i < linhas.length && i < idx + 4; i++) {
    const l = linhas[i].trim();
    if (/^[A-ZÇÃÉ ]{6,}$/.test(l)) break; // próximo rótulo
    out.push(l);
  }
  return out.join(" ");
}
