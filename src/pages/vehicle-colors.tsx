import { Palette } from "lucide-react";
import { GenericRegistry } from "@/components/shared/generic-registry";

export default function VehicleColorsPage() {
  return (
    <GenericRegistry
      title="Cores de Veículo"
      description="Catálogo de cores por montadora"
      table="vehicle_colors"
      module="vehicle_colors"
      icon={<Palette className="h-6 w-6" />}
      newLabel="Nova cor"
      searchKeys={["cor", "montadora"]}
      orderBy={{ column: "cor", ascending: true }}
      defaults={{ status: "ativo", montadora: "TODAS" }}
      fields={[
        { name: "montadora", label: "Montadora", placeholder: "TODAS ou nome da montadora" },
        { name: "cor", label: "Cor", required: true },
        { name: "identificador_externo", label: "Identificador externo" },
      ]}
      columns={[
        { key: "montadora", label: "Montadora" },
        { key: "cor", label: "Cor" },
        { key: "identificador_externo", label: "Identificador externo" },
      ]}
    />
  );
}
