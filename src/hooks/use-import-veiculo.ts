import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import type { ConsultaPlacaParsed } from "@/lib/consulta-placa-parse";
import { salvarImportacao } from "@/hooks/use-import-history";

/** Monta os campos do veículo a partir da Consulta Placa (ignora vazios). */
export function buildVeiculoDados(parsed: ConsultaPlacaParsed): Record<string, unknown> {
  const dados: Record<string, unknown> = {};
  const set = (k: string, v: unknown) => { if (v !== null && v !== undefined && v !== "") dados[k] = v; };
  set("especie_tipo", parsed.especie_tipo);
  set("marca", parsed.marca);
  set("modelo", parsed.modelo);
  set("cor", parsed.cor);
  set("chassi", parsed.chassi);
  set("combustivel", parsed.combustivel);
  set("ano_fabricacao", parsed.ano_fabricacao);
  set("ano_modelo", parsed.ano_modelo);
  set("categoria", parsed.categoria);
  set("capacidade_passageiros", parsed.capacidade_passageiros);
  set("potencia", parsed.potencia);
  set("cilindrada", parsed.cilindrada);
  set("parcelamento_cotas", parsed.parcelamento_cotas);
  if (parsed.alienacao_fiduciaria) {
    dados.alienacao_fiduciaria = true;
    if (parsed.alienante) dados.alienante = parsed.alienante;
  }
  return dados;
}

/** Núcleo: aplica a Consulta Placa a um veículo (atualiza) ou cria um novo. */
export async function aplicarConsultaPlaca(vehicleId: string | null, parsed: ConsultaPlacaParsed): Promise<{ criado: boolean; campos: number; vehicleId: string }> {
  const dados = buildVeiculoDados(parsed);
  if (vehicleId) {
    const { error } = await supabase.from("vehicles").update(dados as never).eq("id", vehicleId);
    if (error) throw error;
    return { criado: false, campos: Object.keys(dados).length, vehicleId };
  }
  const { data, error } = await supabase
    .from("vehicles")
    .insert({ placa: parsed.placa, status: "disponivel", km_atual: 0, ...dados } as never)
    .select("id")
    .single();
  if (error) throw error;
  return { criado: true, campos: Object.keys(dados).length, vehicleId: (data as { id: string }).id };
}

/** Importa os dados da "Consulta Placa" para o cadastro do veículo.
 *  Sobrescreve os campos existentes; cria o veículo se a placa não existir. */
export function useImportConsultaPlaca() {
  const qc = useQueryClient();
  return useMutation<{ criado: boolean; campos: number; vehicleId: string }, Error, { vehicleId: string | null; parsed: ConsultaPlacaParsed }>({
    mutationFn: ({ vehicleId, parsed }) => aplicarConsultaPlaca(vehicleId, parsed),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["vehicles"] });
      toast.success(r.criado ? `Veículo cadastrado com ${r.campos} campo(s) da Consulta Placa` : `${r.campos} campo(s) atualizados a partir da Consulta Placa`);
    },
    onError: (e: Error) => toast.error("Erro na importação: " + e.message),
  });
}

export interface ConsultaPlacaItem { parsed: ConsultaPlacaParsed; vehicleId: string | null; file: File; }

/** Importa várias Consultas Placa em lote (uma por PDF/placa). */
export function useImportConsultaPlacaLote() {
  const qc = useQueryClient();
  return useMutation<{ criados: number; atualizados: number; erros: string[] }, Error, { itens: ConsultaPlacaItem[] }>({
    mutationFn: async ({ itens }) => {
      let criados = 0, atualizados = 0; const erros: string[] = [];
      for (const it of itens) {
        try {
          const r = await aplicarConsultaPlaca(it.vehicleId, it.parsed);
          if (r.criado) criados++; else atualizados++;
          try { await salvarImportacao({ vehicleId: r.vehicleId, placa: it.parsed.placa, tipo: "consulta_placa", file: it.file, resumo: { campos: r.campos, criado: r.criado, placa: it.parsed.placa } }); } catch { /* não bloqueia */ }
        } catch (e) { erros.push(`${it.parsed.placa ?? it.file.name}: ${(e as Error).message}`); }
      }
      return { criados, atualizados, erros };
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["vehicles"] });
      qc.invalidateQueries({ queryKey: ["import_history"] });
      toast.success(`Consulta Placa: ${r.criados} criado(s) · ${r.atualizados} atualizado(s)` + (r.erros.length ? ` · ${r.erros.length} erro(s)` : ""));
    },
    onError: (e: Error) => toast.error("Erro na importação em lote: " + e.message),
  });
}
