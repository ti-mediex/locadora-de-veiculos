import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import type { Contrato } from "@/types/database";

export type ContratoRow = Contrato & { vehicles: { placa: string; modelo: string } | null };

/** Locatário atual de cada veículo = contrato ativo (cliente_nome), por vehicle_id. */
export function useLocatarioPorVeiculo() {
  const { data: contratos = [] } = useContratos();
  return useMemo(() => {
    const m = new Map<string, string>();
    // Contratos vêm ordenados por created_at desc; o primeiro ativo é o vigente.
    for (const c of contratos) {
      if (c.status === "ativo" && c.vehicle_id && c.cliente_nome && !m.has(c.vehicle_id)) {
        m.set(c.vehicle_id, c.cliente_nome);
      }
    }
    return m;
  }, [contratos]);
}

export interface ContratoAtivoVeic { numero: string; cliente: string }

/** Contrato ativo vigente de cada veículo (número + cliente), por vehicle_id. */
export function useContratoAtivoPorVeiculo() {
  const { data: contratos = [] } = useContratos();
  return useMemo(() => {
    const m = new Map<string, ContratoAtivoVeic>();
    for (const c of contratos) {
      if (c.status === "ativo" && c.vehicle_id && !m.has(c.vehicle_id)) {
        m.set(c.vehicle_id, { numero: c.numero, cliente: c.cliente_nome ?? "" });
      }
    }
    return m;
  }, [contratos]);
}

export function useContratos() {
  return useQuery<ContratoRow[]>({
    queryKey: ["contratos", "list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contratos")
        .select("*, vehicles(placa, modelo)")
        .order("created_at", { ascending: false })
        .limit(3000);
      if (error) throw error;
      return (data ?? []) as never;
    },
  });
}

export function useContrato(id?: string) {
  return useQuery<ContratoRow>({
    queryKey: ["contratos", "detalhe", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("contratos").select("*, vehicles(placa, modelo)").eq("id", id!).single();
      if (error) throw error;
      return data as never;
    },
  });
}

export type ContratoPayload = Omit<Contrato, "id" | "numero" | "status" | "contrato_pai_id" | "created_by" | "created_at" | "updated_at">;

export function useCreateContrato() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<ContratoPayload>) => {
      const { data: prof } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("contratos")
        .insert({ ...payload, created_by: prof.user?.id ?? null } as never)
        .select("id, numero")
        .single();
      if (error) throw error;
      return data as { id: string; numero: string };
    },
    onSuccess: (d) => { qc.invalidateQueries({ queryKey: ["contratos"] }); toast.success(`Contrato ${d.numero} criado`); },
    onError: (e: Error) => toast.error("Erro ao criar contrato: " + e.message),
  });
}

export function useUpdateContrato() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<Contrato>) => {
      const { error } = await supabase.from("contratos").update(patch as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contratos"] }); toast.success("Contrato atualizado"); },
    onError: (e: Error) => toast.error("Erro ao atualizar: " + e.message),
  });
}

/** Renova um contrato: cria um novo copiando os dados e marca o anterior como renovado. */
export function useRenovarContrato() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (pai: ContratoRow) => {
      const { data: prof } = await supabase.auth.getUser();
      const hoje = new Date().toISOString().slice(0, 10);
      const novo = {
        vehicle_id: pai.vehicle_id, placa: pai.placa, locatario_id: pai.locatario_id, cliente_nome: pai.cliente_nome, cliente_cpf: pai.cliente_cpf,
        cliente_cnh: pai.cliente_cnh, cliente_cnh_cat: pai.cliente_cnh_cat, cliente_email: pai.cliente_email,
        cliente_telefone: pai.cliente_telefone, cliente_endereco: pai.cliente_endereco, atendente: pai.atendente,
        local_entrega: pai.local_entrega, data_entrega: hoje, hora_entrega: pai.hora_entrega,
        local_devolucao: pai.local_devolucao, grupo: pai.grupo, km_entrega: pai.km_entrega,
        valor_locacao: pai.valor_locacao, semanas: pai.semanas, valor_total: pai.valor_total,
        pre_autorizacao: pai.pre_autorizacao, informacoes_adicionais: pai.informacoes_adicionais,
        contrato_pai_id: pai.id, created_by: prof.user?.id ?? null,
      };
      const { data, error } = await supabase.from("contratos").insert(novo as never).select("id, numero").single();
      if (error) throw error;
      await supabase.from("contratos").update({ status: "renovado" } as never).eq("id", pai.id);
      return data as { id: string; numero: string };
    },
    onSuccess: (d) => { qc.invalidateQueries({ queryKey: ["contratos"] }); toast.success(`Contrato renovado: ${d.numero}`); },
    onError: (e: Error) => toast.error("Erro ao renovar: " + e.message),
  });
}

export function useDeleteContrato() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contratos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contratos"] }); toast.success("Contrato removido"); },
    onError: (e: Error) => toast.error("Erro ao remover: " + e.message),
  });
}
