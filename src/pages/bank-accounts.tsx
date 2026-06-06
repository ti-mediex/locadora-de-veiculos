import { Landmark } from "lucide-react";
import { GenericRegistry } from "@/components/shared/generic-registry";
import { formatCurrency } from "@/lib/format";

export default function BankAccountsPage() {
  return (
    <GenericRegistry
      title="Contas Bancárias"
      description="Contas e caixa da empresa"
      table="bank_accounts"
      module="bank_accounts"
      icon={<Landmark className="h-6 w-6" />}
      newLabel="Nova conta"
      searchKeys={["nome", "banco"]}
      orderBy={{ column: "nome", ascending: true }}
      defaults={{ status: "ativo", tipo: "corrente", saldo_inicial: 0 }}
      fields={[
        { name: "nome", label: "Nome", required: true, full: true },
        {
          name: "tipo",
          label: "Tipo",
          type: "select",
          options: [
            { value: "corrente", label: "Conta corrente" },
            { value: "poupanca", label: "Poupança" },
            { value: "caixa", label: "Caixa" },
          ],
        },
        { name: "banco", label: "Banco" },
        { name: "agencia", label: "Agência" },
        { name: "conta", label: "Conta" },
        { name: "saldo_inicial", label: "Saldo inicial (R$)", type: "number" },
      ]}
      columns={[
        { key: "nome", label: "Conta" },
        { key: "banco", label: "Banco" },
        { key: "tipo", label: "Tipo" },
        { key: "saldo_inicial", label: "Saldo inicial", align: "right", render: (r) => formatCurrency(Number(r.saldo_inicial ?? 0)) },
      ]}
    />
  );
}
