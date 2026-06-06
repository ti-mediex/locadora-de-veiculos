import { Warehouse } from "lucide-react";
import { GenericRegistry } from "@/components/shared/generic-registry";

export default function YardsPage() {
  return (
    <GenericRegistry
      title="Pátios de Veículos"
      description="Locais de guarda da frota"
      table="yards"
      module="yards"
      icon={<Warehouse className="h-6 w-6" />}
      newLabel="Novo pátio"
      searchKeys={["nome", "cidade"]}
      orderBy={{ column: "nome", ascending: true }}
      defaults={{ status: "ativo" }}
      fields={[
        { name: "nome", label: "Nome do pátio", required: true, full: true },
        { name: "capacidade", label: "Capacidade", type: "number" },
        { name: "cep", label: "CEP" },
        { name: "endereco", label: "Endereço", full: true },
        { name: "cidade", label: "Cidade" },
        { name: "estado", label: "Estado" },
        {
          name: "status",
          label: "Status",
          type: "select",
          options: [
            { value: "ativo", label: "Ativo" },
            { value: "inativo", label: "Inativo" },
          ],
        },
      ]}
      columns={[
        { key: "nome", label: "Pátio" },
        { key: "capacidade", label: "Capacidade", align: "right" },
        { key: "endereco", label: "Endereço" },
        { key: "cidade", label: "Cidade", render: (r) => `${r.cidade ?? ""}${r.estado ? `/${r.estado}` : ""}` },
        { key: "status", label: "Status" },
      ]}
    />
  );
}
