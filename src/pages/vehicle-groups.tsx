import { Layers } from "lucide-react";
import { GenericRegistry } from "@/components/shared/generic-registry";
import { formatCurrency, formatPercent } from "@/lib/format";

export default function VehicleGroupsPage() {
  return (
    <GenericRegistry
      title="Grupos de Veículos"
      description="Categorias da frota com depreciação e diária (RAC)"
      table="vehicle_groups"
      module="vehicle_groups"
      icon={<Layers className="h-6 w-6" />}
      newLabel="Novo grupo"
      searchKeys={["nome", "sigla"]}
      orderBy={{ column: "nome", ascending: true }}
      defaults={{ status: "ativo" }}
      fields={[
        { name: "nome", label: "Nome do grupo", required: true },
        { name: "sigla", label: "Sigla RAC" },
        { name: "taxa_depreciacao_anual", label: "Taxa de depreciação anual (%)", type: "number" },
        { name: "preco_diaria_rac", label: "Preço diária RAC (R$)", type: "number" },
        { name: "veiculos_disponiveis_rac", label: "Veículos disponíveis (RAC)", type: "number" },
        { name: "observacoes", label: "Observações", type: "textarea", full: true },
      ]}
      columns={[
        { key: "nome", label: "Grupo" },
        { key: "sigla", label: "Sigla" },
        { key: "taxa_depreciacao_anual", label: "Depreciação", render: (r) => (r.taxa_depreciacao_anual != null ? formatPercent(Number(r.taxa_depreciacao_anual)) : "—") },
        { key: "preco_diaria_rac", label: "Diária", align: "right", render: (r) => (r.preco_diaria_rac != null ? formatCurrency(Number(r.preco_diaria_rac)) : "—") },
        { key: "veiculos_disponiveis_rac", label: "Disp. RAC", align: "right" },
      ]}
    />
  );
}
