import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import type { Ocorrencia } from "@/types/database";
import type { ContratoRow } from "@/hooks/use-contratos";

export type OcorrenciaRow = Ocorrencia & { vehicles: { placa: string; modelo: string } | null };

const BUCKET = "ocorrencias";
const slug = (s: string) => s.replace(/[^\w.]+/g, "_");

export interface OcorrenciaFoto { id: string; storage_path: string; avaria: boolean; observacao: string | null; url?: string | null }

/** Fotos de uma ocorrência (com signed URLs de 1h). */
export function useOcorrenciaFotos(ocorrenciaId?: string) {
  return useQuery<OcorrenciaFoto[]>({
    queryKey: ["ocorrencia_fotos", ocorrenciaId ?? ""],
    enabled: !!ocorrenciaId,
    queryFn: async () => {
      const { data, error } = await supabase.from("ocorrencia_fotos").select("*").eq("ocorrencia_id", ocorrenciaId!).order("created_at", { ascending: true });
      if (error) throw error;
      const fotos = (data ?? []) as OcorrenciaFoto[];
      return Promise.all(fotos.map(async (f) => {
        const { data: s } = await supabase.storage.from(BUCKET).createSignedUrl(f.storage_path, 3600);
        return { ...f, url: s?.signedUrl ?? null };
      }));
    },
  });
}

/** Envia fotos (câmera do celular) para uma ocorrência. */
export function useSaveOcorrenciaFotos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ocorrenciaId, files }: { ocorrenciaId: string; files: File[] }) => {
      for (const file of files) {
        const path = `${ocorrenciaId}/${Date.now()}-${slug(file.name)}`;
        const up = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || "image/jpeg", upsert: true });
        if (up.error) throw up.error;
        const { error } = await supabase.from("ocorrencia_fotos").insert({ ocorrencia_id: ocorrenciaId, storage_path: path } as never);
        if (error) throw error;
      }
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["ocorrencia_fotos", v.ocorrenciaId] }),
    onError: (e: Error) => toast.error("Erro ao enviar foto: " + e.message),
  });
}

export function useDeleteOcorrenciaFoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (f: OcorrenciaFoto) => {
      await supabase.storage.from(BUCKET).remove([f.storage_path]);
      const { error } = await supabase.from("ocorrencia_fotos").delete().eq("id", f.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ocorrencia_fotos"] }),
    onError: (e: Error) => toast.error("Erro ao remover foto: " + e.message),
  });
}

/** Nº de ocorrências abertas/em andamento por veículo (para badge em Veículos). */
export function useOcorrenciasAbertasPorVeiculo() {
  return useQuery<Record<string, number>>({
    queryKey: ["ocorrencias", "abertas-por-veiculo"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ocorrencias").select("vehicle_id").in("status", ["aberta", "em_andamento"]).limit(5000);
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const r of (data ?? []) as { vehicle_id: string | null }[]) if (r.vehicle_id) map[r.vehicle_id] = (map[r.vehicle_id] ?? 0) + 1;
      return map;
    },
  });
}

/** Lista de ocorrências (com join do veículo), mais recentes primeiro. */
export function useOcorrencias() {
  return useQuery<OcorrenciaRow[]>({
    queryKey: ["ocorrencias", "list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ocorrencias")
        .select("*, vehicles(placa, modelo)")
        .order("inicio", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as never;
    },
  });
}

/** Carro reserva aberto por veículo (contrato_id/locatario_id), para pré-preencher o form. */
export function useReservaAtualPorVeiculo() {
  return useQuery<Record<string, { contrato_id: string | null; locatario_id: string | null }>>({
    queryKey: ["ocorrencias", "reserva-atual"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ocorrencias")
        .select("vehicle_id, contrato_id, locatario_id")
        .eq("tipo", "carro_reserva")
        .in("status", ["aberta", "em_andamento"])
        .is("fim", null);
      if (error) throw error;
      const map: Record<string, { contrato_id: string | null; locatario_id: string | null }> = {};
      for (const r of (data ?? []) as { vehicle_id: string | null; contrato_id: string | null; locatario_id: string | null }[]) {
        if (r.vehicle_id) map[r.vehicle_id] = { contrato_id: r.contrato_id, locatario_id: r.locatario_id };
      }
      return map;
    },
  });
}

/** Sincroniza a ocorrência de "carro reserva" ao mudar o status do veículo.
 *  isReserva=true garante uma ocorrência aberta (cria/atualiza contrato+locatário);
 *  isReserva=false encerra a ocorrência aberta, se houver. */
export function useSyncCarroReserva() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { vehicleId: string; placa: string | null; isReserva: boolean; contrato_id?: string | null; locatario_id?: string | null }) => {
      const { data: abertas } = await supabase
        .from("ocorrencias")
        .select("id")
        .eq("vehicle_id", p.vehicleId)
        .eq("tipo", "carro_reserva")
        .in("status", ["aberta", "em_andamento"])
        .is("fim", null);
      const abertaId = (abertas ?? [])[0]?.id as string | undefined;

      if (p.isReserva) {
        if (abertaId) {
          await supabase.from("ocorrencias").update({ contrato_id: p.contrato_id ?? null, locatario_id: p.locatario_id ?? null } as never).eq("id", abertaId);
        } else {
          const { data: prof } = await supabase.auth.getUser();
          await supabase.from("ocorrencias").insert({
            vehicle_id: p.vehicleId, placa: p.placa, tipo: "carro_reserva", gravidade: "media",
            titulo: "Carro reserva", status: "em_andamento", inicio: new Date().toISOString(),
            contrato_id: p.contrato_id ?? null, locatario_id: p.locatario_id ?? null,
            muda_status_veiculo: "carro_reserva", created_by: prof.user?.id ?? null,
          } as never);
        }
      } else if (abertaId) {
        await supabase.from("ocorrencias").update({ fim: new Date().toISOString(), status: "resolvida" } as never).eq("id", abertaId);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ocorrencias"] }),
    onError: (e: Error) => toast.error("Erro ao sincronizar carro reserva: " + e.message),
  });
}

// ===== Linha do tempo (histórico dia a dia do veículo) =====
export interface SegmentoTempo {
  inicioISO: string;      // YYYY-MM-DD (ou com hora para ocorrências com horário)
  fimISO: string | null;  // null = em aberto
  estado: string;         // rótulo do estado (Locado, Manutenção, Disponível…)
  detalhe: string;        // texto descritivo
  cor?: string;
  tipo: "contrato_inicio" | "contrato_fim" | "locado" | "disponivel" | "ocorrencia";
}

const soData = (iso: string) => iso.slice(0, 10);
const temHora = (iso: string) => iso.length > 10 && !iso.endsWith("T00:00:00") && iso.slice(11, 16) !== "00:00";

/** Constrói os segmentos cronológicos do estado de um veículo a partir dos
 *  contratos e ocorrências. Best-effort com as datas disponíveis. */
export function construirLinhaTempo(
  vehicleId: string,
  contratos: ContratoRow[],
  ocorrencias: OcorrenciaRow[],
  labelTipo: (tipo: string) => string,
  corTipo: (tipo: string) => string,
): SegmentoTempo[] {
  const hoje = new Date().toISOString().slice(0, 10);
  const segs: SegmentoTempo[] = [];

  // Contratos do veículo → períodos "Locado" + marcadores de início/fim.
  const cts = contratos
    .filter((c) => c.vehicle_id === vehicleId && c.data_entrega)
    .sort((a, b) => (a.data_entrega ?? "").localeCompare(b.data_entrega ?? ""));
  for (const c of cts) {
    const ini = c.data_entrega!;
    const fim = c.status === "ativo" ? null : (c.data_encerramento ?? c.devolucao_prevista ?? null);
    segs.push({ inicioISO: ini, fimISO: fim, estado: "Locado", detalhe: `Contrato ${c.numero} — ${c.cliente_nome}`, tipo: "locado", cor: "hsl(211 90% 60%)" });
    segs.push({ inicioISO: ini, fimISO: ini, estado: "Novo contrato", detalhe: `Novo contrato (${c.numero}) — Locado`, tipo: "contrato_inicio", cor: "hsl(211 90% 60%)" });
    if (fim) segs.push({ inicioISO: fim, fimISO: fim, estado: "Disponível", detalhe: `Contrato ${c.numero} encerrado — disponível para locação`, tipo: "contrato_fim", cor: "hsl(142 60% 45%)" });
  }

  // Ocorrências do veículo (sobrepõem o estado base).
  for (const o of ocorrencias) {
    if (o.vehicle_id !== vehicleId || o.status === "cancelada") continue;
    const ini = o.inicio;
    const fim = o.fim;
    let detalhe = labelTipo(o.tipo);
    if (temHora(ini)) {
      detalhe += fim && temHora(fim)
        ? ` das ${ini.slice(11, 16)}h às ${fim.slice(11, 16)}h`
        : ` a partir das ${ini.slice(11, 16)}h`;
    }
    if (o.titulo) detalhe += ` — ${o.titulo}`;
    segs.push({ inicioISO: ini, fimISO: fim, estado: labelTipo(o.tipo), detalhe, tipo: "ocorrencia", cor: corTipo(o.tipo) });
  }

  // Ordena por início (data), com marcadores por último no mesmo dia.
  segs.sort((a, b) => {
    const d = soData(a.inicioISO).localeCompare(soData(b.inicioISO));
    if (d !== 0) return d;
    return a.inicioISO.localeCompare(b.inicioISO);
  });
  // Marca segmentos "em aberto" (sem fim) como indo até hoje para exibição.
  return segs.map((s) => ({ ...s, fimISO: s.fimISO ?? (s.tipo === "locado" || s.tipo === "ocorrencia" ? hoje : s.fimISO) }));
}
