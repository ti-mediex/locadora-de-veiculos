import { CarFront } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/**
 * Botão de escopo "Frota ativa": quando ativo, a tela mostra apenas os veículos
 * da frota ativa (locado, carro reserva, disponível p/ locar, em manutenção).
 */
export function FrotaAtivaToggle({
  ativo,
  onToggle,
  count,
  title,
}: {
  ativo: boolean;
  onToggle: () => void;
  count?: number;
  title?: string;
}) {
  return (
    <Button
      type="button"
      variant={ativo ? "default" : "outline"}
      size="sm"
      onClick={onToggle}
      title={title ?? "Mostrar apenas os veículos da frota ativa (locado, carro reserva, disponível, manutenção)"}
    >
      <CarFront className="h-4 w-4" /> Frota ativa
      {count != null && <Badge variant="secondary" className="ml-1">{count}</Badge>}
    </Button>
  );
}
