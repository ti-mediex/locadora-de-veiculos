import { formatCurrency, formatDate } from "@/lib/format";

/** Monta um link wa.me com mensagem pré-preenchida. Assume DDI 55 (Brasil). */
export function whatsappLink(phone: string | null | undefined, message: string): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  const intl = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${intl}?text=${encodeURIComponent(message)}`;
}

/** Mensagem padrão de cobrança de aluguel. */
export function cobrancaMessage(params: {
  nome?: string | null;
  numeroContrato?: string | null;
  valor: number;
  vencimento: string;
  atrasado?: boolean;
}): string {
  const nome = params.nome?.split(" ")[0] ?? "";
  const saudacao = `Olá${nome ? ` ${nome}` : ""}, tudo bem?`;
  const corpo = params.atrasado
    ? `Identificamos que a parcela do aluguel do contrato ${params.numeroContrato ?? ""} no valor de ${formatCurrency(
        params.valor
      )}, com vencimento em ${formatDate(params.vencimento)}, está *em atraso*.`
    : `Passando para lembrar do aluguel do contrato ${params.numeroContrato ?? ""} no valor de ${formatCurrency(
        params.valor
      )}, com vencimento em ${formatDate(params.vencimento)}.`;
  return `${saudacao} ${corpo} Por favor, regularize o pagamento. Qualquer dúvida estamos à disposição. 🚗`;
}
