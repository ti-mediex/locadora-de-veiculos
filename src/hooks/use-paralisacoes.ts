import { useMemo } from "react";
import { useList } from "@/hooks/use-crud";
import { useOcorrencias, type OcorrenciaRow } from "@/hooks/use-ocorrencias";
import { useContratos } from "@/hooks/use-contratos";
import { useFinanceEntries } from "@/hooks/use-finance";
import { useVehicleStatuses, type VehicleStatus } from "@/hooks/use-vehicle-statuses";
import { useAppConfig } from "@/hooks/use-app-config";
import { ehFrotaAtiva, grupoFrota, semanasNoMes } from "@/hooks/use-frota-ativa";
import type { Vehicle } from "@/types/database";

/** Tipos de ocorrência que paralisam o veículo (indisponibilizam para locação). */
export const TIPOS_PARALISA = new Set(["manutencao", "sinistro", "avaria", "pane", "translado"]);

const HORAS_SEMANA = 168; // 7 × 24

export interface ContratoAlvo { id: string; numero: string; valor_locacao: number; valorHora: number; cliente_nome: string }

export interface ParalisacaoLinha {
  ocorrencia: OcorrenciaRow;
  vehicle_id: string;
  placa: string;
  modelo: string;
  tipo: string;
  inicio: string;
  fim: string | null;
  emAberto: boolean;
  horas: number;         // duração total da paralisação
  horasDesc: number;     // horas descontáveis (acima da franquia)
  valorHora: number;     // valor/hora do contrato-alvo
  desconto: number;      // R$ a abater no próximo boleto
  custo: number;         // custo da ocorrência
  contrato: ContratoAlvo | null;
  semanaIni: string;     // YYYY-MM-DD (sexta de vencimento do boleto que recebe o desconto)
  semanaLabel: string;   // período do boleto: dd/mm a dd/mm
}

export interface ParalVeiculo {
  vehicle_id: string; placa: string; modelo: string; categoria: string; status: string; statusLabel: string;
  locatario: string; contratoNumero: string;
  nOcorr: number; horas: number; horasDesc: number; desconto: number; custo: number;
  porTipo: Record<string, { horas: number; custo: number; n: number }>;
  dispMes: number;       // disponibilidade no mês de referência (0..1)
  horasParadasMes: number;
  receitaProjMes: number; receitaRealMes: number; perdaMes: number;
  contrato: ContratoAlvo | null;
}

export interface DescontoSemana {
  vehicle_id: string; placa: string; contratoNumero: string; contratoId: string | null;
  semanaIni: string; semanaLabel: string; horasDesc: number; desconto: number;
}

export interface ParalTotais {
  horas: number; horasDesc: number; desconto: number; custo: number;
  dispMedia: number; receitaProjMes: number; receitaRealMes: number;
  perdaParalisacao: number; receitaOciosaSemana: number; veiculosOciosos: number;
}

/** Sexta-feira que INICIA o período de locação que contém a data (sexta ≤ data).
 *  Locações são pagas antecipadamente: o boleto da sexta F cobre [F, F+7). */
const sextaDoPeriodo = (d: Date) => { const x = new Date(d); const diff = (x.getDay() - 5 + 7) % 7; x.setDate(x.getDate() - diff); x.setHours(0, 0, 0, 0); return x; };
const fmtDia = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export interface ParalisacoesResult {
  linhas: ParalisacaoLinha[];
  porVeiculo: ParalVeiculo[];
  descontosSemana: DescontoSemana[];
  totais: ParalTotais;
  statusMap: Map<string, VehicleStatus>;
  franquiaH: number;
  isLoading: boolean;
}

/** Apura paralisações, descontos (regra: ≤ franquia sem desconto; acima, cada hora
 *  gera desconto proporcional ao valor semanal), disponibilidade e perda de receita. */
export function useParalisacoes(refMes: Date = new Date()): ParalisacoesResult {
  const ini = `${refMes.getFullYear()}-${String(refMes.getMonth() + 1).padStart(2, "0")}-01`;
  const fim = `${refMes.getFullYear()}-${String(refMes.getMonth() + 1).padStart(2, "0")}-${String(new Date(refMes.getFullYear(), refMes.getMonth() + 1, 0).getDate()).padStart(2, "0")}`;

  const { data: vehicles = [], isLoading } = useList<Vehicle>("vehicles");
  const { data: ocorrencias = [] } = useOcorrencias();
  const { data: contratos = [] } = useContratos();
  const { data: entriesMes = [] } = useFinanceEntries(ini, fim);
  const { data: statuses = [] } = useVehicleStatuses();
  const { data: config } = useAppConfig();
  const franquiaH = Number(config?.paralisacao_franquia_horas ?? 4) || 4;

  const statusMap = useMemo(() => new Map(statuses.map((s) => [s.value, s])), [statuses]);

  return useMemo(() => {
    const now = Date.now();
    const mesIni = new Date(refMes.getFullYear(), refMes.getMonth(), 1).getTime();
    const mesFim = new Date(refMes.getFullYear(), refMes.getMonth() + 1, 0, 23, 59, 59).getTime();
    const horasNoMes = ((mesFim - mesIni) / 3.6e6);
    const semanas = semanasNoMes(refMes);

    const vMap = new Map(vehicles.map((v) => [v.id, v]));

    // Contrato ativo por veículo (alvo do desconto no boleto).
    const contratoAtivo = new Map<string, ContratoAlvo>();
    const contratoPorId = new Map<string, ContratoAlvo>();
    const ultimoValorSemanal = new Map<string, number>(); // referência p/ ocioso
    for (const c of contratos) {
      const vl = Number(c.valor_locacao ?? 0);
      // Usa o desconto/hora persistido no contrato (semanal ÷ 168); fallback ao cálculo.
      const vh = c.valor_desconto_hora != null ? Number(c.valor_desconto_hora) : vl / HORAS_SEMANA;
      const alvo: ContratoAlvo = { id: c.id, numero: c.numero, valor_locacao: vl, valorHora: vh, cliente_nome: c.cliente_nome ?? "" };
      contratoPorId.set(c.id, alvo);
      if (c.vehicle_id) {
        if (c.status === "ativo" && !contratoAtivo.has(c.vehicle_id)) contratoAtivo.set(c.vehicle_id, alvo);
        if (!ultimoValorSemanal.has(c.vehicle_id) && Number(c.valor_locacao) > 0) ultimoValorSemanal.set(c.vehicle_id, Number(c.valor_locacao));
      }
    }

    // Receita realizada (aluguel) do mês por veículo.
    const recMes = new Map<string, number>();
    for (const e of entriesMes) {
      if (e.vehicle_id && e.tipo === "receita" && /alug|loca[çc]/i.test(e.categoria ?? "")) recMes.set(e.vehicle_id, (recMes.get(e.vehicle_id) ?? 0) + e.valor);
    }

    // Linhas de paralisação (uma por ocorrência que paralisa).
    const linhas: ParalisacaoLinha[] = [];
    for (const o of ocorrencias) {
      if (!o.vehicle_id || !o.inicio || o.status === "cancelada" || !TIPOS_PARALISA.has(o.tipo)) continue;
      const iniT = new Date(o.inicio).getTime();
      const fimT = o.fim ? new Date(o.fim).getTime() : now;
      const horas = Math.max(0, (fimT - iniT) / 3.6e6);
      const horasDesc = Math.max(0, horas - franquiaH);
      const alvo = (o.contrato_id && contratoPorId.get(o.contrato_id)) || contratoAtivo.get(o.vehicle_id) || null;
      const valorHora = alvo ? alvo.valorHora : 0;
      // Pagamento antecipado: o desconto entra no PRÓXIMO boleto (a sexta seguinte
      // ao início do período em que ocorreu a paralisação).
      const periodoIni = sextaDoPeriodo(new Date(o.inicio));
      const boletoVenc = new Date(periodoIni); boletoVenc.setDate(boletoVenc.getDate() + 7);
      const boletoFim = new Date(boletoVenc); boletoFim.setDate(boletoFim.getDate() + 6);
      const v = vMap.get(o.vehicle_id);
      linhas.push({
        ocorrencia: o, vehicle_id: o.vehicle_id, placa: o.vehicles?.placa ?? v?.placa ?? o.placa ?? "—",
        modelo: o.vehicles?.modelo ?? v?.modelo ?? "", tipo: o.tipo, inicio: o.inicio, fim: o.fim, emAberto: !o.fim,
        horas, horasDesc, valorHora, desconto: horasDesc * valorHora, custo: Number(o.custo ?? 0),
        contrato: alvo, semanaIni: iso(boletoVenc), semanaLabel: `${fmtDia(boletoVenc)} a ${fmtDia(boletoFim)}`,
      });
    }

    // Agregação por veículo.
    const porVeicMap = new Map<string, ParalVeiculo>();
    const getV = (id: string): ParalVeiculo => {
      let x = porVeicMap.get(id);
      if (!x) {
        const v = vMap.get(id);
        const ct = contratoAtivo.get(id) ?? null;
        x = {
          vehicle_id: id, placa: v?.placa ?? "—", modelo: v?.modelo ?? "", categoria: v?.categoria ?? "—", status: v?.status ?? "",
          statusLabel: statusMap.get(v?.status ?? "")?.label ?? v?.status ?? "—",
          locatario: ct?.cliente_nome ?? "", contratoNumero: ct?.numero ?? "",
          nOcorr: 0, horas: 0, horasDesc: 0, desconto: 0, custo: 0, porTipo: {},
          dispMes: 1, horasParadasMes: 0, receitaProjMes: 0, receitaRealMes: recMes.get(id) ?? 0, perdaMes: 0,
          contrato: contratoAtivo.get(id) ?? null,
        };
        porVeicMap.set(id, x);
      }
      return x;
    };
    for (const l of linhas) {
      const x = getV(l.vehicle_id);
      x.nOcorr += 1; x.horas += l.horas; x.horasDesc += l.horasDesc; x.desconto += l.desconto; x.custo += l.custo;
      const pt = x.porTipo[l.tipo] ?? { horas: 0, custo: 0, n: 0 };
      pt.horas += l.horas; pt.custo += l.custo; pt.n += 1; x.porTipo[l.tipo] = pt;
      // Horas paradas dentro do mês de referência (interseção).
      const a = Math.max(new Date(l.inicio).getTime(), mesIni);
      const b = Math.min(l.fim ? new Date(l.fim).getTime() : now, mesFim);
      if (b > a) { x.horasParadasMes += (b - a) / 3.6e6; x.perdaMes += l.desconto; }
    }

    // Receita projetada do mês + disponibilidade, para todos os veículos da frota ativa.
    for (const v of vehicles) {
      if (!ehFrotaAtiva(v.status)) continue;
      const x = getV(v.id);
      const c = contratoAtivo.get(v.id);
      x.receitaProjMes = c ? c.valor_locacao * semanas : 0;
      x.dispMes = horasNoMes > 0 ? Math.max(0, 1 - x.horasParadasMes / horasNoMes) : 1;
    }

    const porVeiculo = [...porVeicMap.values()];

    // Descontos por semana (para o financeiro emitir o boleto correto).
    const descMap = new Map<string, DescontoSemana>();
    for (const l of linhas) {
      if (l.horasDesc <= 0) continue;
      const key = `${l.vehicle_id}|${l.semanaIni}`;
      const cur = descMap.get(key) ?? {
        vehicle_id: l.vehicle_id, placa: l.placa, contratoNumero: l.contrato?.numero ?? "—", contratoId: l.contrato?.id ?? null,
        semanaIni: l.semanaIni, semanaLabel: l.semanaLabel, horasDesc: 0, desconto: 0,
      };
      cur.horasDesc += l.horasDesc; cur.desconto += l.desconto;
      descMap.set(key, cur);
    }
    const descontosSemana = [...descMap.values()].sort((a, b) => b.semanaIni.localeCompare(a.semanaIni) || b.desconto - a.desconto);

    // Receita ociosa (veículos disponíveis para locar e SEM contrato ativo).
    let receitaOciosaSemana = 0, veiculosOciosos = 0;
    for (const v of vehicles) {
      if (grupoFrota(v.status) === "disponivel" && !contratoAtivo.has(v.id)) {
        veiculosOciosos += 1;
        receitaOciosaSemana += ultimoValorSemanal.get(v.id) ?? 0;
      }
    }

    const totais: ParalTotais = {
      horas: linhas.reduce((s, l) => s + l.horas, 0),
      horasDesc: linhas.reduce((s, l) => s + l.horasDesc, 0),
      desconto: linhas.reduce((s, l) => s + l.desconto, 0),
      custo: linhas.reduce((s, l) => s + l.custo, 0),
      dispMedia: 0, receitaProjMes: 0, receitaRealMes: 0, perdaParalisacao: 0,
      receitaOciosaSemana, veiculosOciosos,
    };
    const naFrota = porVeiculo.filter((p) => ehFrotaAtiva(p.status));
    totais.dispMedia = naFrota.length ? naFrota.reduce((s, p) => s + p.dispMes, 0) / naFrota.length : 1;
    totais.receitaProjMes = porVeiculo.reduce((s, p) => s + p.receitaProjMes, 0);
    totais.receitaRealMes = porVeiculo.reduce((s, p) => s + p.receitaRealMes, 0);
    totais.perdaParalisacao = porVeiculo.reduce((s, p) => s + p.perdaMes, 0);

    return { linhas, porVeiculo, descontosSemana, totais, statusMap, franquiaH, isLoading };
  }, [vehicles, ocorrencias, contratos, entriesMes, statusMap, franquiaH, refMes, isLoading]);
}
