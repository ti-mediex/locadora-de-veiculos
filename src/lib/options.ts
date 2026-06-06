// Opções de enums para selects (valor técnico -> rótulo em PT-BR)

export const VEHICLE_STATUS = [
  { value: "disponivel", label: "Disponível" },
  { value: "locado", label: "Locado" },
  { value: "manutencao", label: "Em manutenção" },
  { value: "inativo", label: "Inativo" },
];

export const VEHICLE_CATEGORIA = [
  { value: "hatch", label: "Hatch" },
  { value: "sedan", label: "Sedan" },
  { value: "suv", label: "SUV" },
  { value: "utilitario", label: "Utilitário" },
  { value: "moto", label: "Moto" },
];

export const RENTER_STATUS = [
  { value: "ativo", label: "Ativo" },
  { value: "inativo", label: "Inativo" },
  { value: "bloqueado", label: "Bloqueado" },
  { value: "prospect", label: "Prospect" },
];

export const BILLING_CYCLE = [
  { value: "diario", label: "Diário" },
  { value: "semanal", label: "Semanal" },
  { value: "quinzenal", label: "Quinzenal" },
  { value: "mensal", label: "Mensal" },
];

export const CONTRACT_STATUS = [
  { value: "ativo", label: "Ativo" },
  { value: "encerrado", label: "Encerrado" },
  { value: "suspenso", label: "Suspenso" },
  { value: "inadimplente", label: "Inadimplente" },
  { value: "rascunho", label: "Rascunho" },
];

export const MAINTENANCE_TYPE = [
  { value: "preventiva", label: "Preventiva" },
  { value: "corretiva", label: "Corretiva" },
  { value: "revisao", label: "Revisão" },
  { value: "sinistro", label: "Sinistro" },
];

export const MAINTENANCE_STATUS = [
  { value: "agendada", label: "Agendada" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "concluida", label: "Concluída" },
  { value: "cancelada", label: "Cancelada" },
];

export const FINE_STATUS = [
  { value: "lancada", label: "Lançada" },
  { value: "repassada", label: "Repassada ao locatário" },
  { value: "paga", label: "Paga" },
  { value: "recorrida", label: "Recorrida" },
  { value: "cancelada", label: "Cancelada" },
];

export const EXPENSE_STATUS = [
  { value: "pendente", label: "Pendente" },
  { value: "pago", label: "Pago" },
  { value: "cancelado", label: "Cancelado" },
];

export const EXPENSE_CATEGORIA = [
  { value: "IPVA", label: "IPVA" },
  { value: "Seguro", label: "Seguro" },
  { value: "Licenciamento", label: "Licenciamento" },
  { value: "Financiamento", label: "Parcela de financiamento" },
  { value: "Rastreador", label: "Rastreador" },
  { value: "Administrativo", label: "Administrativo" },
  { value: "Combustivel", label: "Combustível" },
  { value: "Outros", label: "Outros" },
];

export const FORMA_PAGAMENTO = [
  { value: "pix", label: "PIX" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cartao", label: "Cartão" },
  { value: "transferencia", label: "Transferência" },
  { value: "boleto", label: "Boleto" },
];
