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

export const OCCURRENCE_TYPE = [
  { value: "manutencao", label: "Manutenção", color: "hsl(211 90% 64%)" },
  { value: "sinistro", label: "Sinistro", color: "hsl(340 82% 66%)" },
  { value: "infracao", label: "Infração", color: "hsl(38 92% 60%)" },
  { value: "veiculo_reserva", label: "Veículo Reserva", color: "hsl(142 60% 60%)" },
  { value: "devolucao", label: "Devolução", color: "hsl(262 70% 72%)" },
  { value: "preparacao", label: "Preparação", color: "hsl(0 72% 65%)" },
  { value: "translado", label: "Translado", color: "hsl(180 50% 60%)" },
];

export const OCCURRENCE_STATUS = [
  { value: "aberta", label: "Aberta" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "resolvida", label: "Resolvida" },
  { value: "cancelada", label: "Cancelada" },
];

export const INSPECTION_TYPE = [
  { value: "entrega", label: "Entrega" },
  { value: "devolucao", label: "Devolução" },
];

// Itens padrão do checklist de vistoria
export const INSPECTION_ITEMS = [
  { key: "pneus", label: "Pneus" },
  { key: "estepe", label: "Estepe" },
  { key: "macaco_triangulo", label: "Macaco e triângulo" },
  { key: "lataria", label: "Lataria" },
  { key: "vidros_retrovisores", label: "Vidros e retrovisores" },
  { key: "farois_lanternas", label: "Faróis e lanternas" },
  { key: "limpeza", label: "Limpeza" },
  { key: "documentos", label: "Documentos do veículo" },
  { key: "chave_reserva", label: "Chave reserva" },
  { key: "ar_condicionado", label: "Ar-condicionado" },
  { key: "multimidia", label: "Multimídia" },
  { key: "extintor", label: "Extintor (se aplicável)" },
];

export const FORMA_PAGAMENTO = [
  { value: "pix", label: "PIX" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cartao", label: "Cartão" },
  { value: "transferencia", label: "Transferência" },
  { value: "boleto", label: "Boleto" },
];
