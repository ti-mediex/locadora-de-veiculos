import { useEffect, useMemo } from "react";
import { useList } from "@/hooks/use-crud";
import { useVehicleStatuses, type VehicleStatus } from "@/hooks/use-vehicle-statuses";
import { useContratos, useLocatarioPorVeiculo, type ContratoRow } from "@/hooks/use-contratos";
import { useFinanceEntries } from "@/hooks/use-finance";
import { useKmMesPorVeiculo } from "@/hooks/use-km";
import { usePendenciasPorVeiculo, usePendenciasFinanceirasPorVeiculo } from "@/hooks/use-pendencias";
import { useRastreamentoStatusPorVeiculo } from "@/hooks/use-rastreamento";
import { useOcorrenciasAbertasPorVeiculo } from "@/hooks/use-ocorrencias";
import type { Vehicle } from "@/types/database";

/** Status operacionais que compõem a "frota ativa" gerenciada no módulo. */
export const STATUS_FROTA_ATIVA = [
  "locado",
  "carro_reserva",
  "disponivel_para_locar",
  "em_manutencao_rapida",
  "em_manutencao_demorada",
] as const;

export type GrupoFrota = "locado" | "carro_reserva" | "disponivel" | "manutencao";

export const GRUPO_LABEL: Record<GrupoFrota, string> = {
  locado: "Locado",
  carro_reserva: "Carro reserva",
  disponivel: "Disponível p/ locar",
  manutencao: "Em manutenção",
};

/** Registro (parametrizável) status → grupo de frota, hidratado do banco
 *  (`vehicle_statuses.grupo_frota`). Só contém entradas com grupo definido;
 *  o `switch` abaixo é o fallback para os status internos antes do carregamento. */
let OVERRIDES: Record<string, GrupoFrota> = {};

/** Hidrata o registro a partir dos status configurados. Chamado no topo do app
 *  (AppLayout) e por `useFrotaClassifier`, para que os chamadores estáticos
 *  (`grupoFrota`/`ehFrotaAtiva`) também reflitam a parametrização. */
export function setFrotaOverrides(statuses: Pick<VehicleStatus, "value" | "grupo_frota">[]) {
  const next: Record<string, GrupoFrota> = {};
  for (const s of statuses) if (s.grupo_frota) next[s.value] = s.grupo_frota;
  OVERRIDES = next;
}

/** Agrupa o status em uma das 4 categorias operacionais. Consulta primeiro a
 *  parametrização do banco (status personalizados) e, na ausência, dobra os
 *  legados `disponivel`→disponível e `manutencao`→manutenção. Retorna null se o
 *  veículo não pertence à frota ativa. */
export function grupoFrota(status?: string | null): GrupoFrota | null {
  if (status && OVERRIDES[status]) return OVERRIDES[status];
  switch (status) {
    case "locado": return "locado";
    case "carro_reserva": return "carro_reserva";
    case "disponivel_para_locar":
    case "disponivel": return "disponivel";
    case "em_manutencao_rapida":
    case "em_manutencao_demorada":
    case "manutencao": return "manutencao";
    default: return null;
  }
}

/** Veículo está em um dos status operacionais (internos + personalizados parametrizados). */
export const ehFrotaAtiva = (status?: string | null) => grupoFrota(status) !== null;

/** Hook reativo: retorna `grupoFrota`/`ehFrotaAtiva` já considerando a
 *  parametrização carregada do banco. As funções mudam de identidade quando os
 *  status carregam, disparando o recálculo dos memos que as usam nas deps. */
export function useFrotaClassifier() {
  const { data: statuses = [] } = useVehicleStatuses();
  useEffect(() => { setFrotaOverrides(statuses); }, [statuses]);
  return useMemo(() => {
    setFrotaOverrides(statuses);
    return {
      grupoFrota: (status?: string | null) => grupoFrota(status),
      ehFrotaAtiva: (status?: string | null) => grupoFrota(status) !== null,
      statuses,
    };
  }, [statuses]);
}

/** Nº de semanas no mês de referência (dias/7 ≈ 4,3). */
export function semanasNoMes(ref: Date) {
  const dias = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
  return dias / 7;
}

const ehAluguel = (cat?: string | null) => /alug|loca[çc]/i.test(cat ?? "");
const ehManutencao = (cat?: string | null) => /manuten/i.test(cat ?? "");

export interface FrotaContrato {
  id: string;
  numero: string;
  cliente_nome: string;
  valor_locacao: number;
  semanas: number;
  data_entrega: string | null;
  devolucao_prevista: string | null;
}

export interface FrotaVeiculo {
  vehicle: Vehicle;
  status: string;
  statusLabel: string;
  statusCor: string | null;
  grupo: GrupoFrota;
  contrato: FrotaContrato | null;
  locatario: string | null;
  receitaProjMes: number;   // contrato ativo do veículo: valor_locacao × semanas do mês
  receitaRealMes: number;   // Σ receita de aluguel do veículo no mês
  despMes: number;          // Σ despesa do veículo no mês
  custoManutMes: number;    // Σ despesa de manutenção do veículo no mês
  kmMes: number;
  kmMesAnt: number;
  pendAbertas: number;
  pendVencidas: number;
  debitoAberto: number;
  debitoVencido: number;
  rastComunicando: boolean | null;  // null = sem rastreador cadastrado
  rastDias: number | null;
  ocorrAbertas: number;
}

export interface FrotaTotais {
  veiculos: number;
  porStatus: Record<string, number>;   // contagem por status técnico
  porGrupo: Record<GrupoFrota, number>;
  receitaProjMes: number;
  receitaRealMes: number;
  realizacaoPct: number;               // real/proj
  despMes: number;
  custoManutMes: number;
  pendVencidas: number;
  semComunicacao: number;
  ocorrAbertas: number;
  emManutencao: number;
}

export interface FrotaAtivaResult {
  linhas: FrotaVeiculo[];
  totais: FrotaTotais;
  statusMap: Map<string, VehicleStatus>;
  isLoading: boolean;
  refMes: Date;
}

/** Compõe a visão consolidada da frota ativa a partir dos hooks existentes,
 *  sem novas consultas ao banco além das que cada tela já usa. */
export function useFrotaAtiva(refMes: Date = new Date()): FrotaAtivaResult {
  const ini = `${refMes.getFullYear()}-${String(refMes.getMonth() + 1).padStart(2, "0")}-01`;
  const fim = `${refMes.getFullYear()}-${String(refMes.getMonth() + 1).padStart(2, "0")}-${String(new Date(refMes.getFullYear(), refMes.getMonth() + 1, 0).getDate()).padStart(2, "0")}`;

  const { data: vehicles = [], isLoading } = useList<Vehicle>("vehicles");
  const { data: statuses = [] } = useVehicleStatuses();
  const { data: contratos = [] } = useContratos();
  const locatarioMap = useLocatarioPorVeiculo();
  const { data: entriesMes = [] } = useFinanceEntries(ini, fim);
  const { data: kmMesMap = {} } = useKmMesPorVeiculo();
  const { data: pendMap = {} } = usePendenciasPorVeiculo();
  const { data: pendFin = [] } = usePendenciasFinanceirasPorVeiculo();
  const rastMap = useRastreamentoStatusPorVeiculo();
  const { data: ocorrMap = {} } = useOcorrenciasAbertasPorVeiculo();

  const statusMap = useMemo(() => new Map(statuses.map((s) => [s.value, s])), [statuses]);

  return useMemo(() => {
    setFrotaOverrides(statuses); // garante a parametrização antes de classificar
    const semanas = semanasNoMes(refMes);

    // Contrato ativo vigente por veículo (com valores).
    const contratoAtivo = new Map<string, FrotaContrato>();
    for (const c of contratos as ContratoRow[]) {
      if (c.status === "ativo" && c.vehicle_id && !contratoAtivo.has(c.vehicle_id)) {
        contratoAtivo.set(c.vehicle_id, {
          id: c.id, numero: c.numero, cliente_nome: c.cliente_nome ?? "",
          valor_locacao: Number(c.valor_locacao ?? 0), semanas: Number(c.semanas ?? 0),
          data_entrega: c.data_entrega, devolucao_prevista: c.devolucao_prevista,
        });
      }
    }

    // Agregados financeiros do mês por veículo.
    const rec = new Map<string, number>();     // receita de aluguel
    const desp = new Map<string, number>();     // despesa total
    const manut = new Map<string, number>();    // despesa de manutenção
    for (const e of entriesMes) {
      if (!e.vehicle_id) continue;
      if (e.tipo === "receita") {
        if (ehAluguel(e.categoria)) rec.set(e.vehicle_id, (rec.get(e.vehicle_id) ?? 0) + e.valor);
      } else {
        desp.set(e.vehicle_id, (desp.get(e.vehicle_id) ?? 0) + e.valor);
        if (ehManutencao(e.categoria)) manut.set(e.vehicle_id, (manut.get(e.vehicle_id) ?? 0) + e.valor);
      }
    }

    // Débitos (pendências financeiras) por veículo.
    const debito = new Map<string, { total: number; vencido: number }>();
    for (const p of pendFin) debito.set(p.vehicle_id, { total: p.total, vencido: p.vencido });

    const linhas: FrotaVeiculo[] = [];
    for (const v of vehicles) {
      const grupo = grupoFrota(v.status);
      if (!grupo) continue;
      const contrato = contratoAtivo.get(v.id) ?? null;
      const km = kmMesMap[v.id];
      const pend = pendMap[v.id];
      const rast = rastMap.get(v.id);
      const deb = debito.get(v.id);
      const cfg = statusMap.get(v.status);
      linhas.push({
        vehicle: v,
        status: v.status,
        statusLabel: cfg?.label ?? v.status,
        statusCor: cfg?.cor ?? null,
        grupo,
        contrato,
        locatario: locatarioMap.get(v.id) ?? null,
        receitaProjMes: contrato ? contrato.valor_locacao * semanas : 0,
        receitaRealMes: rec.get(v.id) ?? 0,
        despMes: desp.get(v.id) ?? 0,
        custoManutMes: manut.get(v.id) ?? 0,
        kmMes: km?.mesAtual ?? 0,
        kmMesAnt: km?.mesAnterior ?? 0,
        pendAbertas: pend?.abertas ?? 0,
        pendVencidas: pend?.vencidas ?? 0,
        debitoAberto: deb?.total ?? 0,
        debitoVencido: deb?.vencido ?? 0,
        rastComunicando: rast ? rast.comunicando : null,
        rastDias: rast?.dias ?? null,
        ocorrAbertas: ocorrMap[v.id] ?? 0,
      });
    }

    const totais: FrotaTotais = {
      veiculos: linhas.length,
      porStatus: {},
      porGrupo: { locado: 0, carro_reserva: 0, disponivel: 0, manutencao: 0 },
      receitaProjMes: 0, receitaRealMes: 0, realizacaoPct: 0,
      despMes: 0, custoManutMes: 0,
      pendVencidas: 0, semComunicacao: 0, ocorrAbertas: 0, emManutencao: 0,
    };
    for (const l of linhas) {
      totais.porStatus[l.status] = (totais.porStatus[l.status] ?? 0) + 1;
      totais.porGrupo[l.grupo] += 1;
      totais.receitaProjMes += l.receitaProjMes;
      totais.receitaRealMes += l.receitaRealMes;
      totais.despMes += l.despMes;
      totais.custoManutMes += l.custoManutMes;
      if (l.pendVencidas > 0) totais.pendVencidas += l.pendVencidas;
      if (l.rastComunicando === false) totais.semComunicacao += 1;
      totais.ocorrAbertas += l.ocorrAbertas;
      if (l.grupo === "manutencao") totais.emManutencao += 1;
    }
    totais.realizacaoPct = totais.receitaProjMes > 0 ? totais.receitaRealMes / totais.receitaProjMes : 0;

    return { linhas, totais, statusMap, isLoading, refMes };
  }, [vehicles, statuses, contratos, locatarioMap, entriesMes, kmMesMap, pendMap, pendFin, rastMap, ocorrMap, statusMap, isLoading, refMes]);
}
