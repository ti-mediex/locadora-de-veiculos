import { Badge } from "@/components/ui/badge";
import { VEHICLE_STATUS_CHART } from "@/lib/options";

/** Rótulo do status do veículo (Vendido, Locado, Disponível, Disponível Venda…). */
export function statusVeiculoLabel(status?: string | null): string {
  if (!status) return "—";
  return VEHICLE_STATUS_CHART[status]?.label ?? status;
}

/** Badge do status do veículo, com cor. */
export function VehicleStatusBadge({ status }: { status?: string | null }) {
  if (!status) return <span className="text-muted-foreground">—</span>;
  const s = VEHICLE_STATUS_CHART[status];
  return (
    <Badge variant="secondary" className="gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s?.color ?? "currentColor" }} />
      {s?.label ?? status}
    </Badge>
  );
}
