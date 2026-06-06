import { UserSquare2 } from "lucide-react";
import { GenericRegistry } from "@/components/shared/generic-registry";

export default function BuyersPage() {
  return (
    <GenericRegistry
      title="Compradores"
      description="Cadastro de compradores para venda/desmobilização de veículos"
      table="buyers"
      module="buyers"
      icon={<UserSquare2 className="h-6 w-6" />}
      newLabel="Novo comprador"
      searchKeys={["nome", "cpf_cnpj"]}
      orderBy={{ column: "nome", ascending: true }}
      defaults={{ status: "ativo", tipo: "fisica" }}
      fields={[
        { name: "nome", label: "Nome", required: true, full: true },
        {
          name: "tipo",
          label: "Tipo",
          type: "select",
          options: [
            { value: "fisica", label: "Pessoa Física" },
            { value: "juridica", label: "Pessoa Jurídica" },
          ],
        },
        { name: "cpf_cnpj", label: "CPF / CNPJ" },
        { name: "rg", label: "RG / IE" },
        { name: "telefone", label: "Telefone" },
        { name: "email", label: "E-mail" },
        { name: "endereco", label: "Endereço", full: true },
        { name: "cidade", label: "Cidade" },
        { name: "estado", label: "Estado" },
        { name: "informacoes", label: "Informações adicionais", type: "textarea", full: true },
      ]}
      columns={[
        { key: "nome", label: "Comprador" },
        { key: "tipo", label: "Tipo", render: (r) => (r.tipo === "juridica" ? "Jurídica" : "Física") },
        { key: "cpf_cnpj", label: "CPF/CNPJ" },
        { key: "telefone", label: "Telefone" },
        { key: "cidade", label: "Cidade", render: (r) => `${r.cidade ?? ""}${r.estado ? `/${r.estado}` : ""}` },
      ]}
    />
  );
}
