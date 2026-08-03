import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import type { LocatarioDebito, LocatarioCaucao } from "@/types/database";
import { distribuirParcelas, mesesLabel, type CobrancaKmExcedente } from "@/lib/km-excedente";

/** Retorna N sextas-feiras consecutivas (7 em 7 dias) a partir de uma sexta ISO. */
function proximasSextas(primeiraSextaIso: string, n: number): string[] {
  const base = new Date(primeiraSextaIso + "T00:00:00");
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(base); d.setDate(d.getDate() + i * 7);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
}

export function useDebitos() {
  return useQuery<LocatarioDebito[]>({
    queryKey: ["locatario_debitos", "list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("locatario_debitos").select("*").order("competencia", { ascending: false }).limit(20000);
      if (error) throw error;
      return (data ?? []) as LocatarioDebito[];
    },
  });
}

export function useCaucoes() {
  return useQuery<LocatarioCaucao[]>({
    queryKey: ["locatario_caucoes", "list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("locatario_caucoes").select("*").order("data", { ascending: false }).limit(20000);
      if (error) throw error;
      return (data ?? []) as LocatarioCaucao[];
    },
  });
}

const withUser = async (campos: Record<string, unknown>) => {
  const { data: prof } = await supabase.auth.getUser();
  return { ...campos, created_by: prof.user?.id ?? null };
};

export function useSaveDebito() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<LocatarioDebito> & { id?: string }) => {
      const { id, created_at, updated_at, created_by, ...campos } = input as Record<string, unknown> & { id?: string };
      if (id) {
        const { error } = await supabase.from("locatario_debitos").update(campos as never).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("locatario_debitos").insert((await withUser(campos)) as never);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["locatario_debitos"] }); toast.success("Débito salvo"); },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });
}

/** Gera a cobrança de KM excedente (à vista ou parcelada) como débitos do
 *  locatário, distribuídos nas próximas N sextas (boletos semanais). */
export function useGerarCobrancaKmExcedente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ cobranca, parcelas, primeiraSexta }: { cobranca: CobrancaKmExcedente; parcelas: number; primeiraSexta: string }) => {
      if (!cobranca.locatarioId) throw new Error("Contrato ativo sem locatário vinculado — não é possível cobrar.");
      if (cobranca.valorTotal <= 0) throw new Error("Sem valor a cobrar.");
      const N = Math.max(1, Math.floor(parcelas));
      const valores = distribuirParcelas(cobranca.valorTotal, N);
      const sextas = proximasSextas(primeiraSexta, N);
      const grupo = crypto.randomUUID();
      const ultimoMes = cobranca.meses[cobranca.meses.length - 1]?.ym;
      const { data: prof } = await supabase.auth.getUser();
      const rows = valores.map((v, i) => ({
        locatario_id: cobranca.locatarioId,
        contrato_id: cobranca.contratoId,
        vehicle_id: cobranca.vehicle_id,
        placa: cobranca.placa,
        categoria: "km_excedente",
        descricao: `KM excedente ${cobranca.placa} (${mesesLabel(cobranca)})${N > 1 ? ` — parcela ${i + 1}/${N}` : ""}`,
        valor: v,
        competencia: ultimoMes ? `${ultimoMes}-01` : null,
        semana_venc: sextas[i],
        parcela_num: i + 1,
        parcela_total: N,
        grupo_id: grupo,
        created_by: prof.user?.id ?? null,
      }));
      const { error } = await supabase.from("locatario_debitos").insert(rows as never);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["locatario_debitos"] }); toast.success("Cobrança de KM excedente gerada"); },
    onError: (e: Error) => toast.error("Erro ao gerar cobrança: " + e.message),
  });
}

export function useDeleteDebito() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("locatario_debitos").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["locatario_debitos"] }); toast.success("Débito removido"); },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });
}

export function useSaveCaucao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<LocatarioCaucao> & { id?: string }) => {
      const { id, created_at, updated_at, created_by, ...campos } = input as Record<string, unknown> & { id?: string };
      if (id) {
        const { error } = await supabase.from("locatario_caucoes").update(campos as never).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("locatario_caucoes").insert((await withUser(campos)) as never);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["locatario_caucoes"] }); toast.success("Caução salvo"); },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });
}

export function useDeleteCaucao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("locatario_caucoes").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["locatario_caucoes"] }); toast.success("Caução removido"); },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });
}

/** Marca o caução como devolvido (na devolução após o prazo). */
export function useDevolverCaucao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, valor }: { id: string; valor: number }) => {
      const { error } = await supabase.from("locatario_caucoes")
        .update({ devolvido: true, devolvido_em: new Date().toISOString().slice(0, 10), valor_devolvido: valor } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["locatario_caucoes"] }); toast.success("Devolução registrada"); },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });
}
