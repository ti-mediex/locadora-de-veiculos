// Edge Function: atualização automática do valor da Tabela FIPE por veículo.
//
// Fonte: API pública Parallelum (https://parallelum.com.br/fipe/api/v1/carros).
// Fluxo: marca -> modelo -> ano -> valor. Faz correspondência heurística entre
// os dados livres do cadastro (marca/modelo/ano_modelo) e os códigos FIPE,
// guardando as referências resolvidas para acelerar as próximas execuções.
//
// Invocação:
//   { vehicle_id?: string }  -> atualiza um veículo (usado no cadastro)
//   { all?: true }           -> atualiza toda a frota ativa (usado no cron mensal)
//
// Autorização: exige Authorization Bearer (usuário autenticado) OU o header
// x-fipe-secret igual ao segredo configurado (usado pelo agendamento).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const FIPE = "https://parallelum.com.br/fipe/api/v1/carros";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-fipe-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function norm(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
function tokens(s: string): string[] {
  return norm(s).split(" ").filter((t) => t.length > 1);
}

// Palavras da marca que não ajudam no match (categoria FIPE).
const STOP_MARCA = new Set(["automoveis", "caminhoes", "motos", "onibus", "utilitarios"]);

async function getJson(url: string, tries = 3): Promise<any> {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { accept: "application/json" } });
      if (r.ok) return await r.json();
      if (r.status === 429 || r.status >= 500) { await sleep(1200 * (i + 1)); continue; }
      return null;
    } catch { await sleep(1000 * (i + 1)); }
  }
  return null;
}

/** Escala de tokens compartilhados (para ranquear candidatos). */
function score(alvoTokens: string[], nome: string): number {
  const itTk = tokens(nome);
  let s = 0;
  for (const t of alvoTokens) if (itTk.includes(t)) s += 1;
  const ratio = alvoTokens.length ? s / alvoTokens.length : 0;
  return s + ratio;
}
function bestMatch<T extends { nome: string }>(alvoTokens: string[], itens: T[]): T | null {
  let best: T | null = null, bestScore = 0;
  for (const it of itens) { const sc = score(alvoTokens, it.nome); if (sc > bestScore) { bestScore = sc; best = it; } }
  return best;
}
function topMatches<T extends { nome: string }>(alvoTokens: string[], itens: T[], n: number): T[] {
  return itens
    .map((it) => ({ it, sc: score(alvoTokens, it.nome) }))
    .filter((x) => x.sc > 0)
    .sort((a, b) => b.sc - a.sc)
    .slice(0, n)
    .map((x) => x.it);
}

const anoNum = (codigo: string) => {
  const n = parseInt(String(codigo).split("-")[0], 10);
  return isNaN(n) || n > 3000 ? new Date().getFullYear() : n; // 32000 = "Zero Km"
};
const combScore = (nome: string) => /flex/i.test(nome) ? 3 : /gasolina/i.test(nome) ? 2 : /(álcool|alcool)/i.test(nome) ? 1 : 0;

/** Escolhe o melhor ano dentre os disponíveis; exato=true se bate o ano_modelo. */
function pickAno(anos: any[], anoModelo: number | null): { ano: any; exato: boolean } | null {
  if (!anos.length) return null;
  const exatos = anoModelo ? anos.filter((a) => anoNum(a.codigo) === anoModelo) : [];
  if (exatos.length) {
    exatos.sort((a, b) => combScore(b.nome) - combScore(a.nome));
    return { ano: exatos[0], exato: true };
  }
  const alvo = anoModelo ?? new Date().getFullYear();
  const ordenados = [...anos].sort((a, b) => {
    const d = Math.abs(anoNum(a.codigo) - alvo) - Math.abs(anoNum(b.codigo) - alvo);
    return d !== 0 ? d : combScore(b.nome) - combScore(a.nome);
  });
  return { ano: ordenados[0], exato: false };
}

interface Ref { marca: number; modelo: number; ano: string; combustivel: string; codigo: string; }

async function resolveRef(marca: string, modelo: string, anoModelo: number | null): Promise<Ref | null> {
  const brands = await getJson(`${FIPE}/marcas`);
  if (!Array.isArray(brands)) return null;
  const marcaTk = tokens(marca).filter((t) => !STOP_MARCA.has(t));
  const brand = bestMatch(marcaTk, brands);
  if (!brand) return null;

  const models = await getJson(`${FIPE}/marcas/${brand.codigo}/modelos`);
  const modelList = models?.modelos;
  if (!Array.isArray(modelList)) return null;

  // Considera os melhores candidatos de modelo e prefere aquele que possui o
  // ano_modelo exato (evita casar um modelo homônimo de outra geração).
  const candidatos = topMatches(tokens(modelo), modelList, 5);
  if (candidatos.length === 0) return null;

  let fallback: Ref | null = null;
  for (const m of candidatos) {
    const anos = await getJson(`${FIPE}/marcas/${brand.codigo}/modelos/${m.codigo}/anos`);
    await sleep(150);
    if (!Array.isArray(anos) || anos.length === 0) continue;
    const pick = pickAno(anos, anoModelo);
    if (!pick) continue;
    const ref: Ref = { marca: Number(brand.codigo), modelo: Number(m.codigo), ano: String(pick.ano.codigo), combustivel: pick.ano.nome, codigo: "" };
    if (pick.exato) return ref;      // melhor caso: modelo com o ano do veículo
    if (!fallback) fallback = ref;   // guarda o de maior score como aproximação
  }
  return fallback;
}

async function fetchValor(ref: Ref): Promise<{ valor: number; mes: string; codigo: string } | null> {
  const d = await getJson(`${FIPE}/marcas/${ref.marca}/modelos/${ref.modelo}/anos/${ref.ano}`);
  if (!d || !d.Valor) return null;
  const valor = Number(String(d.Valor).replace(/[^0-9,]/g, "").replace(/\./g, "").replace(",", "."));
  return { valor: isNaN(valor) ? 0 : valor, mes: d.MesReferencia?.trim() ?? "", codigo: d.CodigoFipe ?? "" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const secret = Deno.env.get("FIPE_CRON_SECRET") ?? "";
  const hdrSecret = req.headers.get("x-fipe-secret") ?? "";
  const hasAuth = (req.headers.get("Authorization") ?? "").toLowerCase().startsWith("bearer ");
  if (!(hasAuth || (secret && hdrSecret === secret))) {
    return new Response(JSON.stringify({ error: "não autorizado" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: any = {};
  try { body = await req.json(); } catch { /* corpo vazio */ }

  let query = admin.from("vehicles")
    .select("id, marca, modelo, ano_modelo, fipe_marca_ref, fipe_modelo_ref, fipe_ano_ref")
    .neq("status", "inativo");
  if (body.vehicle_id) query = admin.from("vehicles")
    .select("id, marca, modelo, ano_modelo, fipe_marca_ref, fipe_modelo_ref, fipe_ano_ref")
    .eq("id", body.vehicle_id);

  const { data: vehicles, error } = await query;
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });

  const now = new Date().toISOString();
  let atualizados = 0, semMatch = 0;
  let mesRef = "";

  // Agrupa por (marca|modelo|ano) para resolver a FIPE uma única vez por modelo.
  const groups = new Map<string, any[]>();
  for (const v of vehicles ?? []) {
    const key = `${norm(v.marca)}|${norm(v.modelo)}|${v.ano_modelo ?? ""}`;
    const arr = groups.get(key);
    if (arr) arr.push(v); else groups.set(key, [v]);
  }

  for (const [, vs] of groups) {
    const sample = vs[0];
    let ref: Ref | null = null;
    // reutiliza refs já resolvidas (execução mensal); force reprocessa do zero
    if (!body.force && sample.fipe_marca_ref && sample.fipe_modelo_ref && sample.fipe_ano_ref) {
      ref = { marca: sample.fipe_marca_ref, modelo: sample.fipe_modelo_ref, ano: sample.fipe_ano_ref, combustivel: "", codigo: "" };
    } else {
      ref = await resolveRef(sample.marca, sample.modelo, sample.ano_modelo);
      await sleep(300);
    }
    if (!ref) { semMatch += vs.length; continue; }

    const res = await fetchValor(ref);
    await sleep(300);
    if (!res || res.valor <= 0) { semMatch += vs.length; continue; }
    mesRef = res.mes || mesRef;

    const ids = vs.map((v) => v.id);
    const { error: upErr } = await admin.from("vehicles").update({
      valor_fipe: res.valor,
      fipe_codigo: res.codigo,
      fipe_marca_ref: ref.marca,
      fipe_modelo_ref: ref.modelo,
      fipe_ano_ref: ref.ano,
      fipe_combustivel: ref.combustivel || null,
      fipe_mes_referencia: res.mes,
      fipe_atualizado_em: now,
    }).in("id", ids);
    if (!upErr) atualizados += ids.length;
  }

  return new Response(
    JSON.stringify({ atualizados, sem_correspondencia: semMatch, mes_referencia: mesRef, total: vehicles?.length ?? 0 }),
    { headers: { ...cors, "Content-Type": "application/json" } },
  );
});
