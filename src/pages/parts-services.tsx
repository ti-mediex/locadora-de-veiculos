import { Boxes } from "lucide-react";
import { GenericRegistry } from "@/components/shared/generic-registry";
import { formatCurrency } from "@/lib/format";

export default function PartsServicesPage() {
  return (
    <GenericRegistry
      title="Peças e Serviços"
      description="Catálogo de peças e serviços usados na manutenção"
      table="parts_services"
      module="parts_services"
      icon={<Boxes className="h-6 w-6" />}
      newLabel="Nova peça/serviço"
      searchKeys={["nome", "codigo_externo", "grupo"]}
      orderBy={{ column: "nome", ascending: true }}
      defaults={{ status: "ativo", tipo: "produto" }}
      fields={[
        { name: "nome", label: "Nome", required: true, full: true },
        {
          name: "tipo",
          label: "Tipo",
          type: "select",
          options: [
            { value: "produto", label: "Produto" },
            { value: "servico", label: "Serviço" },
          ],
        },
        { name: "codigo_externo", label: "Código externo" },
        { name: "grupo", label: "Grupo" },
        { name: "ncm", label: "NCM" },
        { name: "fabricante", label: "Fabricante" },
        { name: "especificacao", label: "Especificação" },
        { name: "preco", label: "Preço (R$)", type: "number" },
        { name: "observacoes", label: "Observações", type: "textarea", full: true },
      ]}
      columns={[
        { key: "nome", label: "Nome" },
        { key: "tipo", label: "Tipo", render: (r) => (r.tipo === "servico" ? "Serviço" : "Produto") },
        { key: "grupo", label: "Grupo" },
        { key: "fabricante", label: "Fabricante" },
        { key: "preco", label: "Preço", align: "right", render: (r) => (r.preco != null ? formatCurrency(Number(r.preco)) : "—") },
      ]}
    />
  );
}
