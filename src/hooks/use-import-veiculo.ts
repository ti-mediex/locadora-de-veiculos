import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import type { ConsultaPlacaParsed } from "@/lib/consulta-placa-parse";

/** Importa os dados da "Consulta Placa" para o cadastro do veículo.
 *  Sobrescreve os campos existentes; cria o veículo se a placa não existir. */
export function useImportConsultaPlaca() {
  const qc = useQueryClient();
  return useMutation<
    { criado: boolean; campos: number; vehicleId: string },
    Error,
    { vehicleId: string | null; parsed: ConsultaPlacaParsed }
  >({
    mutationFn: async ({ vehicleId, parsed }) => {
      const dados: Record<string, unknown> = {};
      const set = (k: string, v: unknown) => {
        if (v !== null && v !== undefined && v !== "") dados[k] = v;
      };
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

      if (vehicleId) {
        const { error } = await supabase.from("vehicles").update(dados as never).eq("id", vehicleId);
        if (error) throw error;
        return { criado: false, campos: Object.keys(dados).length, vehicleId };
      }
      // Cria um novo veículo com a placa da consulta.
      const { data, error } = await supabase
        .from("vehicles")
        .insert({ placa: parsed.placa, status: "disponivel", km_atual: 0, ...dados } as never)
        .select("id")
        .single();
      if (error) throw error;
      return { criado: true, campos: Object.keys(dados).length, vehicleId: (data as { id: string }).id };
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["vehicles"] });
      toast.success(
        r.criado
          ? `Veículo cadastrado com ${r.campos} campo(s) da Consulta Placa`
          : `${r.campos} campo(s) atualizados a partir da Consulta Placa`
      );
    },
    onError: (e: Error) => toast.error("Erro na importação: " + e.message),
  });
}
