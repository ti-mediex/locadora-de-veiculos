// Tipos do banco — alinhados às migrations em supabase/migrations.
// Para regenerar a partir do projeto real:
//   supabase gen types typescript --project-id <ref> > src/types/database.ts

export type VehicleStatus = "disponivel" | "locado" | "manutencao" | "inativo";
export type RenterStatus = "ativo" | "inativo" | "bloqueado" | "prospect";
export type BillingCycle = "diario" | "semanal" | "quinzenal" | "mensal";
export type ContractStatus =
  | "ativo"
  | "encerrado"
  | "suspenso"
  | "inadimplente"
  | "rascunho";
export type ReceivableStatus =
  | "pendente"
  | "pago"
  | "parcial"
  | "atrasado"
  | "cancelado";
export type MaintenanceType = "preventiva" | "corretiva" | "sinistro" | "revisao";
export type MaintenanceStatus =
  | "agendada"
  | "em_andamento"
  | "concluida"
  | "cancelada";
export type MaintenanceStage =
  | "programada"
  | "pre_agendamento"
  | "confirmacao_agenda"
  | "aguardando_chegada"
  | "aguardando_orcamento"
  | "orcamento_analise"
  | "aguardando_saida"
  | "aguardando_nf"
  | "finalizada"
  | "cancelada";
export type FineStatus = "lancada" | "repassada" | "paga" | "recorrida" | "cancelada";
export type ExpenseStatus = "pendente" | "pago" | "cancelado";
export type AppRole = "admin" | "financeiro" | "operador" | "vistoriador";

export type OccurrenceType =
  | "manutencao"
  | "sinistro"
  | "infracao"
  | "veiculo_reserva"
  | "devolucao"
  | "preparacao"
  | "translado";
export type OccurrenceStatus = "aberta" | "em_andamento" | "resolvida" | "cancelada";
export type InspectionType = "entrega" | "devolucao";

export interface Occurrence {
  id: string;
  tipo: OccurrenceType;
  vehicle_id: string | null;
  renter_id: string | null;
  contract_id: string | null;
  data: string;
  descricao: string;
  valor: number | null;
  status: OccurrenceStatus;
  observacoes: string | null;
  supplier_id: string | null;
  data_evento: string | null;
  local_evento: string | null;
  boletim_ocorrencia: string | null;
  parecer_motorista: string | null;
  parecer_responsavel: string | null;
  considera_culpado: boolean | null;
  valor_orcamento: number | null;
  reembolso_terceiro: number | null;
  indenizacao_seguradora: number | null;
  danos: string | null;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  unidade: string | null;
  supplier_id: string | null;
  fornecedor: string | null;
  documento: string | null;
  numero: string | null;
  serie: string | null;
  tipo: string | null;
  data_emissao: string | null;
  data_entrada: string | null;
  valor_total: number;
  desconto: number | null;
  origem: string | null;
  cfop: string | null;
  maintenance_id: string | null;
  status: string;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Inspection {
  id: string;
  vehicle_id: string;
  contract_id: string | null;
  tipo: InspectionType;
  data: string;
  km: number | null;
  nivel_combustivel: number | null;
  itens: Record<string, boolean>;
  avarias: string | null;
  observacoes: string | null;
  responsavel: string | null;
  created_at: string;
  updated_at: string;
}

export interface Supplier {
  id: string;
  nome_fantasia: string;
  razao_social: string | null;
  tipo: string | null;
  cnpj: string | null;
  categoria: string | null;
  classificacao: string | null;
  codigo: string | null;
  site: string | null;
  telefone: string | null;
  email: string | null;
  cep: string | null;
  endereco: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  inscricao_estadual: string | null;
  inscricao_municipal: string | null;
  prazo_pagamento: number | null;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  chave_pix: string | null;
  status: string;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Billing {
  id: string;
  contract_id: string | null;
  renter_id: string | null;
  descricao: string | null;
  periodo_inicio: string | null;
  periodo_fim: string | null;
  data_emissao: string;
  valor_total: number;
  status: string;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BillingItem {
  id: string;
  billing_id: string;
  tipo: string;
  descricao: string;
  valor: number;
  ref_id: string | null;
  created_at: string;
}

export interface VehiclePendencia {
  id: string;
  vehicle_id: string;
  categoria: string;
  titulo: string;
  descricao: string | null;
  status: "aberta" | "em_andamento" | "resolvida" | "cancelada";
  prioridade: "baixa" | "media" | "alta" | "critica";
  vencimento: string | null;
  valor: number | null;
  pago: boolean;
  ativo: boolean | null;
  responsavel: string | null;
  observacoes: string | null;
  documento: string | null;
  data_ocorrencia: string | null;
  local: string | null;
  resolvido_em: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinanceEntry {
  id: string;
  tipo: "receita" | "despesa";
  data: string;
  vehicle_id: string | null;
  categoria: string | null;
  descricao: string;
  valor: number;
  forma_pagamento: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BankAccount {
  id: string;
  nome: string;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  tipo: string | null;
  saldo_inicial: number;
  status: string;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface LedgerEntry {
  id: string;
  data: string;
  vencimento: string | null;
  tipo: string; // entrada | saida | transferencia
  categoria: string | null;
  descricao: string;
  valor: number;
  valor_pago: number;
  status: string; // previsto | parcial | baixado | cancelado
  conta_id: string | null;
  conta_destino_id: string | null;
  supplier_id: string | null;
  recorrente: boolean;
  parcela_num: number | null;
  parcela_total: number | null;
  grupo: string | null;
  forma_pagamento: string | null;
  data_baixa: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Vehicle {
  id: string;
  placa: string;
  renavam: string | null;
  chassi: string | null;
  marca: string;
  modelo: string;
  ano_fabricacao: number | null;
  ano_modelo: number | null;
  cor: string | null;
  categoria: string | null;
  km_atual: number;
  status: VehicleStatus;
  data_aquisicao: string | null;
  valor_aquisicao: number | null;
  valor_fipe: number | null;
  financiado: boolean;
  valor_parcela_financiamento: number | null;
  qtd_parcelas_financiamento: number | null;
  parcelas_pagas: number | null;
  fornecedor: string | null;
  observacoes: string | null;
  foto_url: string | null;
  fipe_codigo: string | null;
  fipe_marca_ref: number | null;
  fipe_modelo_ref: number | null;
  fipe_ano_ref: string | null;
  fipe_combustivel: string | null;
  fipe_mes_referencia: string | null;
  fipe_atualizado_em: string | null;
  alienacao_fiduciaria: boolean;
  alienante: string | null;
  proprietario_nome: string | null;
  proprietario_documento: string | null;
  quitado: boolean;
  valor_quitacao: number | null;
  data_quitacao: string | null;
  busca_apreensao: boolean;
  busca_apreensao_solicitante: string | null;
  bloqueio_judicial: boolean;
  bloqueio_judicial_solicitante: string | null;
  especie_tipo: string | null;
  combustivel: string | null;
  capacidade_passageiros: number | null;
  potencia: string | null;
  cilindrada: number | null;
  parcelamento_cotas: string | null;
  created_at: string;
  updated_at: string;
}

export interface Alienante {
  id: string;
  nome: string;
  created_at: string;
}

export interface Locatario {
  id: string;
  nome: string;
  cpf: string | null;
  rg: string | null;
  cnh: string | null;
  categoria_cnh: string | null;
  validade_cnh: string | null;
  data_nascimento: string | null;
  telefone: string | null;
  email: string | null;
  cep: string | null;
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  chave_pix: string | null;
  contato_emergencia_nome: string | null;
  contato_emergencia_telefone: string | null;
  status: "ativo" | "inativo";
  observacoes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Contrato {
  id: string;
  numero: string;
  vehicle_id: string | null;
  placa: string | null;
  cliente_nome: string;
  cliente_cpf: string | null;
  cliente_cnh: string | null;
  cliente_cnh_cat: string | null;
  cliente_email: string | null;
  cliente_telefone: string | null;
  cliente_endereco: string | null;
  atendente: string | null;
  local_entrega: string | null;
  data_entrega: string | null;
  hora_entrega: string | null;
  local_devolucao: string | null;
  devolucao_prevista: string | null;
  grupo: string | null;
  km_entrega: number | null;
  valor_locacao: number | null;
  semanas: number | null;
  valor_total: number | null;
  pre_autorizacao: number | null;
  informacoes_adicionais: string | null;
  status: "ativo" | "encerrado" | "renovado" | "cancelado";
  locatario_id: string | null;
  contrato_pai_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChecklistItem {
  item: string;
  situacao: "ok" | "avaria" | "na";
  observacao?: string;
}

export interface Vistoria {
  id: string;
  vehicle_id: string | null;
  placa: string | null;
  tipo: "liberacao" | "devolucao" | "sinistro";
  locatario_nome: string | null;
  locatario_documento: string | null;
  locatario_telefone: string | null;
  locatario_email: string | null;
  vistoriador: string | null;
  km: number | null;
  combustivel: string | null;
  checklist: ChecklistItem[] | null;
  observacoes: string | null;
  avarias: string | null;
  assinatura_path: string | null;
  laudo_externo_path: string | null;
  laudo_arquivo_nome: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
  status: "rascunho" | "concluida";
  created_by: string | null;
  created_at: string;
}

export interface VistoriaFoto {
  id: string;
  vistoria_id: string;
  parte: string;
  storage_path: string;
  avaria: boolean;
  observacao: string | null;
  created_at: string;
}

export interface Renter {
  id: string;
  nome: string;
  cpf: string;
  rg: string | null;
  cnh: string | null;
  categoria_cnh: string | null;
  validade_cnh: string | null;
  data_nascimento: string | null;
  telefone: string | null;
  email: string | null;
  cep: string | null;
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  chave_pix: string | null;
  contato_emergencia_nome: string | null;
  contato_emergencia_telefone: string | null;
  status: RenterStatus;
  observacoes: string | null;
  foto_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Contract {
  id: string;
  numero: string;
  vehicle_id: string;
  renter_id: string;
  data_inicio: string;
  data_fim: string | null;
  ciclo_cobranca: BillingCycle;
  valor_aluguel: number;
  dia_vencimento: number | null;
  valor_caucao: number | null;
  caucao_devolvida: boolean;
  km_inicial: number | null;
  km_final: number | null;
  status: ContractStatus;
  observacoes: string | null;
  contrato_pdf_url: string | null;
  franquia_km: number | null;
  odometro_entrega: number | null;
  nivel_combustivel_retirada: string | null;
  informacoes_adicionais: string | null;
  qtd_faturas: number | null;
  dia_faturamento: string | null;
  created_at: string;
  updated_at: string;
}

export interface Receivable {
  id: string;
  contract_id: string;
  competencia: string | null;
  periodo_inicio: string | null;
  periodo_fim: string | null;
  vencimento: string;
  valor: number;
  valor_pago: number;
  juros: number;
  multa: number;
  data_pagamento: string | null;
  forma_pagamento: string | null;
  status: ReceivableStatus;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Maintenance {
  id: string;
  vehicle_id: string;
  tipo: MaintenanceType;
  descricao: string;
  data: string;
  km: number | null;
  valor: number;
  oficina: string | null;
  status: MaintenanceStatus;
  etapa: MaintenanceStage;
  motivo: string | null;
  solicitante: string | null;
  renter_id: string | null;
  contract_id: string | null;
  supplier_id: string | null;
  agendamento: string | null;
  leva_traz: boolean;
  reembolsavel: boolean;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceItem {
  id: string;
  maintenance_id: string;
  grupo_despesa: string | null;
  categoria: string | null;
  descricao: string;
  desconto: number;
  valor: number;
  created_at: string;
}

export interface Fine {
  id: string;
  vehicle_id: string;
  renter_id: string | null;
  contract_id: string | null;
  data_infracao: string;
  codigo_infracao: string | null;
  descricao: string;
  local_infracao: string | null;
  orgao_autuador: string | null;
  valor: number;
  pontos: number | null;
  vencimento: string | null;
  repassar_locatario: boolean;
  repassado: boolean;
  status: FineStatus;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  categoria: string;
  descricao: string;
  vehicle_id: string | null;
  data: string;
  valor: number;
  recorrente: boolean;
  fornecedor: string | null;
  status: ExpenseStatus;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  role: AppRole;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DashboardSummary {
  periodo_inicio: string;
  periodo_fim: string;
  total_veiculos: number;
  veiculos_locados: number;
  taxa_ocupacao: number;
  receita_prevista: number;
  receita_recebida: number;
  inadimplencia_valor: number;
  inadimplencia_pct: number;
  despesas: number;
  manutencao: number;
  multas_empresa: number;
  lucro_liquido: number;
  contratos_ativos: number;
  ticket_medio: number;
}

export interface MonthlyCashflow {
  mes: string;
  receita: number;
  despesa: number;
  resultado: number;
}

export interface VehicleProfitability {
  vehicle_id: string;
  placa: string;
  modelo: string;
  receita: number;
  manutencao: number;
  multas: number;
  resultado: number;
}

// Helper genérico para o cliente Supabase tipado.
type Row<T> = T;
type Insert<T> = Partial<T>;
type Update<T> = Partial<T>;

interface TableDef<T> {
  Row: Row<T>;
  Insert: Insert<T>;
  Update: Update<T>;
  Relationships: [];
}

export interface Database {
  public: {
    Tables: {
      vehicles: TableDef<Vehicle>;
      renters: TableDef<Renter>;
      contracts: TableDef<Contract>;
      receivables: TableDef<Receivable>;
      maintenances: TableDef<Maintenance>;
      fines: TableDef<Fine>;
      expenses: TableDef<Expense>;
      profiles: TableDef<Profile>;
    };
    Views: Record<string, never>;
    Functions: {
      dashboard_summary: {
        Args: { p_inicio?: string; p_fim?: string };
        Returns: DashboardSummary;
      };
      monthly_cashflow: {
        Args: { p_meses?: number };
        Returns: MonthlyCashflow[];
      };
      vehicle_profitability: {
        Args: Record<string, never>;
        Returns: VehicleProfitability[];
      };
      generate_receivables: {
        Args: { p_contract_id: string; p_ate?: string };
        Returns: number;
      };
      settle_receivable: {
        Args: {
          p_receivable_id: string;
          p_valor_pago: number;
          p_data_pagamento?: string;
          p_forma_pagamento?: string;
          p_juros?: number;
          p_multa?: number;
        };
        Returns: Receivable;
      };
      mark_overdue_receivables: {
        Args: Record<string, never>;
        Returns: number;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
