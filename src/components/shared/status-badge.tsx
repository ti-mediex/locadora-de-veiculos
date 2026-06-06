import { Badge, type BadgeProps } from "@/components/ui/badge";

type Variant = NonNullable<BadgeProps["variant"]>;

const MAP: Record<string, { label: string; variant: Variant }> = {
  // Veículos
  disponivel: { label: "Disponível", variant: "success" },
  locado: { label: "Locado", variant: "default" },
  manutencao: { label: "Manutenção", variant: "warning" },
  inativo: { label: "Inativo", variant: "muted" },
  // Locatários
  ativo: { label: "Ativo", variant: "success" },
  bloqueado: { label: "Bloqueado", variant: "destructive" },
  prospect: { label: "Prospect", variant: "secondary" },
  // Contratos
  encerrado: { label: "Encerrado", variant: "muted" },
  suspenso: { label: "Suspenso", variant: "warning" },
  inadimplente: { label: "Inadimplente", variant: "destructive" },
  rascunho: { label: "Rascunho", variant: "secondary" },
  // Recebíveis
  pendente: { label: "Pendente", variant: "secondary" },
  pago: { label: "Pago", variant: "success" },
  parcial: { label: "Parcial", variant: "warning" },
  atrasado: { label: "Atrasado", variant: "destructive" },
  cancelado: { label: "Cancelado", variant: "muted" },
  // Manutenções
  agendada: { label: "Agendada", variant: "secondary" },
  em_andamento: { label: "Em andamento", variant: "warning" },
  concluida: { label: "Concluída", variant: "success" },
  cancelada: { label: "Cancelada", variant: "muted" },
  preventiva: { label: "Preventiva", variant: "default" },
  corretiva: { label: "Corretiva", variant: "warning" },
  sinistro: { label: "Sinistro", variant: "destructive" },
  revisao: { label: "Revisão", variant: "secondary" },
  // Multas
  lancada: { label: "Lançada", variant: "secondary" },
  repassada: { label: "Repassada", variant: "default" },
  recorrida: { label: "Recorrida", variant: "warning" },
};

export function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="text-muted-foreground">—</span>;
  const cfg = MAP[status] ?? { label: status, variant: "secondary" as Variant };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
