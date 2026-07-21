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

// Pipeline de manutenção (Kanban) — etapas estilo Blue Fleet, em ordem
export const MAINTENANCE_STAGE = [
  { value: "programada", label: "Programada", color: "hsl(215 16% 60%)" },
  { value: "pre_agendamento", label: "Pré-Agendamento", color: "hsl(211 90% 60%)" },
  { value: "confirmacao_agenda", label: "Confirmação de Agenda", color: "hsl(262 70% 65%)" },
  { value: "aguardando_chegada", label: "Aguardando Chegada", color: "hsl(190 70% 50%)" },
  { value: "aguardando_orcamento", label: "Aguardando Orçamento", color: "hsl(38 92% 55%)" },
  { value: "orcamento_analise", label: "Orçamento em Análise", color: "hsl(28 90% 55%)" },
  { value: "em_execucao", label: "Serviço em Execução", color: "hsl(200 80% 50%)" },
  { value: "aguardando_saida", label: "Aguardando Saída", color: "hsl(142 60% 50%)" },
  { value: "aguardando_nf", label: "Aguardando Nota Fiscal", color: "hsl(280 60% 60%)" },
  { value: "finalizada", label: "Finalizada", color: "hsl(142 71% 40%)" },
  { value: "cancelada", label: "Cancelada", color: "hsl(0 72% 55%)" },
];

// Grupos de despesa para itens da OS (espelha a estrutura do Blue Fleet)
export const GRUPO_DESPESA = [
  { value: "Preventiva (Peças/M.O)", label: "Preventiva (Peças / M.O)" },
  { value: "Corretiva Reembolsável", label: "Corretiva Reembolsável" },
  { value: "Corretiva Não Reembolsável", label: "Corretiva Não Reembolsável" },
  { value: "Alinhamento/Balanceamento", label: "Alinhamento / Balanceamento" },
  { value: "Reboque", label: "Reboque" },
  { value: "Veículo Reserva", label: "Veículo Reserva" },
  { value: "Combustível", label: "Combustível" },
  { value: "Outros", label: "Outros" },
];

export const MAINTENANCE_MOTIVO = [
  { value: "Revisão", label: "Revisão" },
  { value: "Freios", label: "Freios" },
  { value: "Motor", label: "Motor" },
  { value: "Suspensão", label: "Suspensão" },
  { value: "Pneus", label: "Pneus" },
  { value: "Elétrica", label: "Elétrica" },
  { value: "Funilaria/Pintura", label: "Funilaria / Pintura" },
  { value: "Ar-condicionado", label: "Ar-condicionado" },
  { value: "Outros", label: "Outros" },
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

export const SUPPLIER_TIPO = [
  { value: "Frota", label: "Frota (manutenção, peças)" },
  { value: "Seguradora", label: "Seguradora" },
  { value: "Cliente", label: "Cliente" },
  { value: "Despachante", label: "Despachante" },
  { value: "Outro", label: "Outro" },
];

export const SUPPLIER_STATUS = [
  { value: "ativo", label: "Ativo" },
  { value: "inativo", label: "Inativo" },
];

// Situação do veículo -> rótulo + cor (donut do dashboard, estilo Blue Fleet)
export const VEHICLE_STATUS_CHART: Record<string, { label: string; color: string }> = {
  disponivel: { label: "Disponível", color: "hsl(340 82% 66%)" },
  locado: { label: "Locado", color: "hsl(211 90% 64%)" },
  manutencao: { label: "Manutenção", color: "hsl(38 92% 60%)" },
  inativo: { label: "Inativo", color: "hsl(215 16% 70%)" },
};

export const GROUP_COLORS = [
  "hsl(211 90% 64%)",
  "hsl(340 82% 66%)",
  "hsl(38 92% 60%)",
  "hsl(142 60% 60%)",
  "hsl(262 70% 72%)",
  "hsl(0 72% 65%)",
  "hsl(180 50% 60%)",
  "hsl(280 60% 65%)",
];

export const SINISTRO_MOTIVO = [
  { value: "Acidente / Colisão", label: "Acidente / Colisão" },
  { value: "Roubo", label: "Roubo" },
  { value: "Furto", label: "Furto" },
  { value: "Incêndio", label: "Incêndio" },
  { value: "Enchente", label: "Enchente" },
  { value: "Vandalismo", label: "Vandalismo" },
  { value: "Outros", label: "Outros" },
];

export const NF_TIPO = [
  { value: "Produto", label: "Produto" },
  { value: "Serviço", label: "Serviço" },
  { value: "Produto e Serviço", label: "Produto e Serviço" },
];

export const NF_STATUS = [
  { value: "em_cadastro", label: "Em cadastro" },
  { value: "aprovada", label: "Aprovada" },
  { value: "lancada", label: "Lançada" },
  { value: "cancelada", label: "Cancelada" },
];

export const LEDGER_TIPO = [
  { value: "entrada", label: "Entrada (receita)" },
  { value: "saida", label: "Saída (despesa)" },
];

export const LEDGER_STATUS = [
  { value: "previsto", label: "Previsto" },
  { value: "parcial", label: "Baixa parcial" },
  { value: "baixado", label: "Baixado" },
  { value: "cancelado", label: "Cancelado" },
];

export const LEDGER_MODO = [
  { value: "unico", label: "Avulso único" },
  { value: "parcelado", label: "Avulso parcelado" },
  { value: "recorrente", label: "Recorrente (mensal)" },
];

export const LEDGER_CATEGORIA = [
  { value: "Aluguel", label: "Aluguel (receita)" },
  { value: "Manutenção", label: "Manutenção" },
  { value: "Combustível", label: "Combustível" },
  { value: "Seguro", label: "Seguro" },
  { value: "IPVA/Licenciamento", label: "IPVA / Licenciamento" },
  { value: "Financiamento", label: "Financiamento" },
  { value: "Salários", label: "Salários" },
  { value: "Administrativo", label: "Administrativo" },
  { value: "Impostos", label: "Impostos" },
  { value: "Outros", label: "Outros" },
];

export const RECEITA_CATEGORIA = [
  { value: "Aluguel", label: "Aluguel" },
  { value: "Venda de veículo", label: "Venda de veículo" },
  { value: "Reembolso", label: "Reembolso" },
  { value: "Multa repassada", label: "Multa repassada" },
  { value: "Outros", label: "Outros" },
];

export const DESPESA_CATEGORIA = [
  { value: "Manutenção", label: "Manutenção" },
  { value: "Combustível", label: "Combustível" },
  { value: "IPVA/Licenciamento", label: "IPVA / Licenciamento" },
  { value: "Seguro", label: "Seguro" },
  { value: "Financiamento", label: "Parcela de financiamento" },
  { value: "Multas", label: "Multas" },
  { value: "Rastreador", label: "Rastreador" },
  { value: "Administrativo", label: "Administrativo" },
  { value: "Outros", label: "Outros" },
];

// Pendências por veículo -------------------------------------------------------
// controle: 'vencimento' mostra data; 'ativo' mostra toggle (Ituran); 'multa' mostra valor+responsável
export const PENDENCIA_CATEGORIA = [
  { value: "Rastreador Ituran", label: "Rastreador Ituran", controle: "ativo" },
  { value: "IPVA", label: "IPVA", controle: "vencimento" },
  { value: "Licenciamento", label: "Licenciamento", controle: "vencimento" },
  { value: "CRLV", label: "CRLV", controle: "vencimento" },
  { value: "Seguro/CSV", label: "Seguro / CSV", controle: "vencimento" },
  { value: "Multa", label: "Multa", controle: "multa" },
  { value: "Documentação", label: "Documentação", controle: "vencimento" },
  { value: "Manutenção", label: "Manutenção", controle: "vencimento" },
  { value: "Busca e Apreensão", label: "Busca e Apreensão", controle: "solicitante" },
  { value: "Bloqueio Judicial", label: "Bloqueio Judicial", controle: "solicitante" },
  { value: "Manutenção Veicular", label: "Problemas de Manutenção Veicular", controle: "livre" },
  { value: "Taxas Detran", label: "Taxas Detran", controle: "vencimento" },
  { value: "Restrição", label: "Restrição", controle: "livre" },
  { value: "Outros", label: "Outros", controle: "livre" },
];

export const PENDENCIA_STATUS = [
  { value: "aberta", label: "Aberta" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "resolvida", label: "Resolvida" },
  { value: "cancelada", label: "Cancelada" },
];

export const PENDENCIA_PRIORIDADE = [
  { value: "baixa", label: "Baixa" },
  { value: "media", label: "Média" },
  { value: "alta", label: "Alta" },
  { value: "critica", label: "Crítica" },
];

// Itens de controle criados em lote (o funcionário só preenche as datas)
export const PENDENCIA_ITENS_PADRAO = [
  { categoria: "Rastreador Ituran", titulo: "Rastreador Ituran", controle: "ativo" },
  { categoria: "IPVA", titulo: "IPVA", controle: "vencimento" },
  { categoria: "Licenciamento", titulo: "Licenciamento", controle: "vencimento" },
  { categoria: "CRLV", titulo: "CRLV", controle: "vencimento" },
  { categoria: "Seguro/CSV", titulo: "Seguro / CSV", controle: "vencimento" },
];

export const FORMA_PAGAMENTO = [
  { value: "pix", label: "PIX" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cartao", label: "Cartão" },
  { value: "transferencia", label: "Transferência" },
  { value: "boleto", label: "Boleto" },
];
