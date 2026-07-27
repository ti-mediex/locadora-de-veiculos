import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { soDigitos, type BoletoBancoRow } from "@/lib/boletos-banco-parse";

const BUCKET = "importacoes";
const slug = (s: string) => s.replace(/[^\w.\-]+/g, "_");
const norm = (s: string) => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

export interface EntradaReceita {
  id: string; contrato_id: string | null; vehicle_id: string | null;
  data: string; valor: number; recebido: boolean; nosso_numero: string | null;
}
export interface ContratoConc { id: string; cliente_nome: string; cliente_cpf: string | null; vehicle_id: string | null; placa: string | null; }

export type ConcStatus = "match" | "ja_baixado" | "sem_contrato" | "sem_lancamento";
export interface ConciliacaoItem {
  boleto: BoletoBancoRow;
  contrato?: ContratoConc;
  entryId?: string;
  entryData?: string;
  status: ConcStatus;
}

/** Concilia os boletos pagos do banco com os contratos (por CPF/CNPJ e nome) e com
 *  os lançamentos de aluguel em aberto (por vencimento), propondo a baixa. */
export function conciliarBoletos(boletos: BoletoBancoRow[], contratos: ContratoConc[], entries: EntradaReceita[]): ConciliacaoItem[] {
  const porCpf = new Map<string, ContratoConc[]>();
  const porNome = new Map<string, ContratoConc[]>();
  for (const c of contratos) {
    const cpf = soDigitos(c.cliente_cpf ?? "");
    if (cpf) { const a = porCpf.get(cpf) ?? []; a.push(c); porCpf.set(cpf, a); }
    const n = norm(c.cliente_nome);
    if (n) { const a = porNome.get(n) ?? []; a.push(c); porNome.set(n, a); }
  }
  // Lançamentos de aluguel por contrato (mais recentes primeiro).
  const porContrato = new Map<string, EntradaReceita[]>();
  for (const e of entries) {
    if (!e.contrato_id) continue;
    const a = porContrato.get(e.contrato_id) ?? []; a.push(e); porContrato.set(e.contrato_id, a);
  }
  for (const a of porContrato.values()) a.sort((x, y) => y.data.localeCompare(x.data));

  return boletos.filter((b) => b.pago).map((b): ConciliacaoItem => {
    const cands = (b.cpfCnpj && porCpf.get(b.cpfCnpj)) || porNome.get(norm(b.pagador)) || [];
    const contrato = cands[0];
    if (!contrato) return { boleto: b, status: "sem_contrato" };
    const lancs = porContrato.get(contrato.id) ?? [];
    // Já dado baixa com este nosso_número?
    if (b.nossoNumero && lancs.some((e) => e.recebido && e.nosso_numero === b.nossoNumero)) {
      return { boleto: b, contrato, status: "ja_baixado" };
    }
    const abertos = lancs.filter((e) => !e.recebido);
    // Casa pelo vencimento exato; senão pelo valor; senão o mais antigo em aberto.
    let alvo = b.vencimento ? abertos.find((e) => e.data === b.vencimento) : undefined;
    if (!alvo && b.valorTitulo > 0) alvo = abertos.find((e) => Math.abs(e.valor - b.valorTitulo) < 0.5);
    if (!alvo) alvo = abertos[abertos.length - 1];
    if (!alvo) return { boleto: b, contrato, status: "sem_lancamento" };
    return { boleto: b, contrato, entryId: alvo.id, entryData: alvo.data, status: "match" };
  });
}

/** Aplica a baixa (marca recebido) nos lançamentos conciliados. */
export function useAplicarBaixa() {
  const qc = useQueryClient();
  return useMutation<{ baixados: number }, Error, ConciliacaoItem[]>({
    mutationFn: async (itens) => {
      const alvos = itens.filter((i) => i.status === "match" && i.entryId);
      let baixados = 0;
      for (const i of alvos) {
        const { error } = await supabase.from("finance_entries").update({
          recebido: true,
          recebido_em: i.boleto.pagamento ?? new Date().toISOString().slice(0, 10),
          forma_recebimento: "boleto",
          nosso_numero: i.boleto.nossoNumero || null,
        } as never).eq("id", i.entryId!);
        if (error) throw error;
        baixados++;
      }
      return { baixados };
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["finance_entries"] });
      qc.invalidateQueries({ queryKey: ["finance"] });
      toast.success(`${r.baixados} boleto(s) baixado(s)`);
    },
    onError: (e: Error) => toast.error("Erro ao dar baixa: " + e.message),
  });
}

/** Marca/desmarca o recebimento de um lançamento manualmente (pix, dinheiro, etc.). */
export function useMarcarRecebido() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, recebido, forma, data }: { id: string; recebido: boolean; forma?: string; data?: string }) => {
      const { error } = await supabase.from("finance_entries").update({
        recebido,
        recebido_em: recebido ? (data ?? new Date().toISOString().slice(0, 10)) : null,
        forma_recebimento: recebido ? (forma ?? null) : null,
      } as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["finance_entries"] }); qc.invalidateQueries({ queryKey: ["finance"] }); },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });
}

type ArqCampo = "comprovante_path" | "boleto_path";

/** Envia um arquivo (comprovante de pagamento ou boleto emitido) e grava o caminho. */
export function useUploadArquivoFinanceiro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ entryId, file, campo }: { entryId: string; file: File; campo: ArqCampo }) => {
      const pasta = campo === "comprovante_path" ? "comprovantes" : "boletos";
      const path = `${pasta}/${entryId}/${Date.now()}-${slug(file.name)}`;
      const up = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || "application/octet-stream", upsert: true });
      if (up.error) throw up.error;
      const { error } = await supabase.from("finance_entries").update({ [campo]: path } as never).eq("id", entryId);
      if (error) throw error;
      return path;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["finance_entries"] }); toast.success("Arquivo enviado"); },
    onError: (e: Error) => toast.error("Erro ao enviar arquivo: " + e.message),
  });
}

/** Gera uma URL assinada (1h) para abrir o arquivo. */
export async function abrirArquivoFinanceiro(path: string) {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  else toast.error("Não foi possível abrir o arquivo");
}
