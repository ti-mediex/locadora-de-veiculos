// Parser da "Consulta Placa" do Detran (PDF), para importar os dados
// cadastrais de um veículo. Trabalha sobre o texto já extraído do PDF.

export interface ConsultaPlacaParsed {
  placa: string | null;
  especie_tipo: string | null;
  marca: string | null;
  modelo: string | null;
  capacidade_passageiros: number | null;
  potencia: string | null;
  cilindrada: number | null;
  cor: string | null;
  chassi: string | null;
  combustivel: string | null;
  ano_fabricacao: number | null;
  ano_modelo: number | null;
  categoria: string | null;
  parcelamento_cotas: string | null;
  restricoes: string[];
  alienacao_fiduciaria: boolean;
  alienante: string | null;
}

// Rótulos na ordem em que aparecem na consulta (usados para recortar valores).
const ROTULOS: { chave: string; re: RegExp }[] = [
  { chave: "placa", re: /Placa:/i },
  { chave: "especie_tipo", re: /Esp[ée]cie\s*\/?\s*Tipo:/i },
  { chave: "marca_modelo", re: /Marca\s*\/?\s*Modelo:/i },
  { chave: "cap_pot_cil", re: /Capacidade\s*\/?\s*Pot[êe]ncia\s*\/?\s*Cilindrada:/i },
  { chave: "cor", re: /Cor\s*predominante:/i },
  { chave: "chassi", re: /Chassi:/i },
  { chave: "combustivel", re: /Combust[íi]vel:/i },
  { chave: "anos", re: /Ano\s*fabrica[çc][ãa]o\s*\/?\s*Ano\s*modelo:/i },
  { chave: "categoria", re: /Categoria:/i },
  { chave: "parcelamento", re: /Parcelamento\s*\/?\s*Cotas:/i },
  { chave: "fim", re: /Consultar\s*d[ée]bitos|Sair\s*do|Compartilhar|P[áa]gina\s*Inicial/i },
];

function num(s: string | null | undefined): number | null {
  if (!s) return null;
  const n = parseInt(String(s).replace(/\D/g, ""), 10);
  return isNaN(n) ? null : n;
}

export function parseConsultaPlaca(textoRaw: string): ConsultaPlacaParsed {
  const flat = textoRaw.replace(/ /g, " ").replace(/\s+/g, " ").trim();

  // Recorta o valor de cada rótulo (entre o fim do rótulo e o início do próximo encontrado).
  const valores: Record<string, string> = {};
  const posicoes = ROTULOS.map((r) => {
    const m = flat.match(r.re);
    return { chave: r.chave, start: m ? (m.index ?? -1) : -1, len: m ? m[0].length : 0 };
  }).filter((p) => p.start >= 0).sort((a, b) => a.start - b.start);

  for (let i = 0; i < posicoes.length; i++) {
    const cur = posicoes[i];
    if (cur.chave === "fim") continue;
    const next = posicoes[i + 1];
    const ini = cur.start + cur.len;
    const fim = next ? next.start : flat.length;
    valores[cur.chave] = flat.slice(ini, fim).trim();
  }

  const splitBarra = (s?: string) => (s ? s.split("/").map((x) => x.trim()) : []);

  const marcaModelo = splitBarra(valores["marca_modelo"]);
  const marca = marcaModelo[0] || null;
  const modelo = marcaModelo.length > 1 ? marcaModelo.slice(1).join("/").trim() : null;

  const capPot = splitBarra(valores["cap_pot_cil"]);
  const anos = splitBarra(valores["anos"]);

  // Restrições (página 2): itens iniciados por "-"
  const restricoes: string[] = [];
  const restrM = flat.match(/Restri[çc][õo]es:\s*(.+?)(?:Quero compartilhar|DETRAN-PE|Voc[êe] ainda|CPF|$)/i);
  if (restrM) {
    for (const part of restrM[1].split(/\s-\s|(?:^|\s)-\s/)) {
      const t = part.replace(/\s+/g, " ").trim().replace(/^-\s*/, "");
      if (t.length > 3 && !/^restri/i.test(t)) restricoes.push(t);
    }
  }
  const alienacao_fiduciaria = /al\.?\s*fid\.?|aliena[çc][ãa]o\s+fiduci[áa]ria/i.test(flat);
  let alienante: string | null = null;
  const alM = flat.match(/al\.?\s*fid\.?\s*(.+?)(?:\s*-\s*REST|\s*Quero|\s*DETRAN|$)/i);
  if (alM) alienante = alM[1].replace(/\s+/g, " ").trim() || null;

  const limpo = (s?: string | null) => (s ? s.replace(/\s+/g, " ").trim() || null : null);

  return {
    placa: (valores["placa"] || "").replace(/[^A-Z0-9]/gi, "").toUpperCase() || null,
    especie_tipo: limpo(valores["especie_tipo"]),
    marca: limpo(marca),
    modelo: limpo(modelo),
    capacidade_passageiros: num(capPot[0]),
    potencia: limpo(capPot[1]),
    cilindrada: num(capPot[2]),
    cor: limpo(valores["cor"]),
    chassi: (valores["chassi"] || "").replace(/\s+/g, "") || null,
    combustivel: limpo(valores["combustivel"]),
    ano_fabricacao: num(anos[0]),
    ano_modelo: num(anos[1] ?? anos[0]),
    categoria: limpo(valores["categoria"]),
    parcelamento_cotas: limpo(valores["parcelamento"]),
    restricoes: restricoes.map((r) => r.replace(/\s+/g, " ").trim()),
    alienacao_fiduciaria,
    alienante: limpo(alienante),
  };
}
