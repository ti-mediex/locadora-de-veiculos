import { useMemo, useRef, useState } from "react";
import { Upload, Database, CheckCircle2, AlertTriangle, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
import { useList } from "@/hooks/use-crud";
import { normalizeHeader, coerceValue } from "@/lib/csv-parse";
import { parseSpreadsheet } from "@/lib/spreadsheet";
import type { Vehicle, Locatario } from "@/types/database";

type FieldType = "text" | "number" | "date" | "boolean";
interface FieldDef {
  field: string;
  label: string;
  type: FieldType;
  required?: boolean;
  synonyms?: string[];
  resolveTo?: "vehicle_id" | "locatario_id";
  valueMap?: Record<string, string>;
  constant?: unknown; // valor fixo para todas as linhas (não precisa mapear)
}
interface EntityDef {
  key: string;
  label: string;
  table: "vehicles" | "locatarios" | "contratos" | "expenses" | "maintenances" | "occurrences" | "suppliers" | "ledger_entries" | "finance_entries";
  conflict?: string;
  fields: FieldDef[];
}

const ENTITIES: EntityDef[] = [
  {
    key: "vehicles",
    label: "Veículos",
    table: "vehicles",
    conflict: "placa",
    fields: [
      { field: "placa", label: "Placa", type: "text", required: true },
      { field: "marca", label: "Marca", type: "text", required: true, synonyms: ["montadora", "fabricante"] },
      { field: "modelo", label: "Modelo", type: "text", required: true },
      { field: "ano_fabricacao", label: "Ano fabricação", type: "number", synonyms: ["anofab", "ano", "anodefabricacao", "anofabricacao"] },
      { field: "ano_modelo", label: "Ano modelo", type: "number", synonyms: ["anomodelo"] },
      { field: "cor", label: "Cor", type: "text" },
      { field: "categoria", label: "Categoria", type: "text", synonyms: ["grupo", "carroceria"] },
      { field: "renavam", label: "Renavam", type: "text" },
      { field: "chassi", label: "Chassi", type: "text" },
      { field: "km_atual", label: "KM atual", type: "number", synonyms: ["km", "quilometragem", "kmconfirmado", "kmatual", "kmestimado"] },
      { field: "valor_fipe", label: "Valor FIPE", type: "number", synonyms: ["fipe", "valorfipe"] },
      { field: "valor_aquisicao", label: "Valor aquisição", type: "number", synonyms: ["valordecompra", "valordeaquisicao", "valorcompra"] },
      { field: "data_aquisicao", label: "Data de aquisição", type: "date", synonyms: ["datadecompra", "dataaquisicao", "datadeaquisicao"] },
      { field: "fornecedor", label: "Fornecedor", type: "text" },
      { field: "status", label: "Status", type: "text", valueMap: { "disponivel": "disponivel", "no patio": "disponivel", "no pátio": "disponivel", "disponível": "disponivel", "locado": "locado", "alugado": "locado", "manutencao": "manutencao", "em manutencao": "manutencao", "manutenção": "manutencao", "inativo": "inativo", "baixado": "inativo" } },
    ],
  },
  {
    key: "locatarios",
    label: "Locatários / Condutores",
    table: "locatarios",
    conflict: "cpf",
    fields: [
      { field: "nome", label: "Nome", type: "text", required: true, synonyms: ["nome fantasia", "cliente", "condutor", "nome do condutor", "nome completo", "nome cliente", "nome do cliente", "razao social", "nome / razao social", "razao social / nome", "nome razao social"] },
      { field: "cpf", label: "CPF", type: "text", required: true, synonyms: ["cpf/cnpj", "documento", "cpf cnpj", "cnpj", "documento cliente", "cpf condutor"] },
      { field: "rg", label: "RG", type: "text", synonyms: ["rg", "identidade"] },
      { field: "cnh", label: "CNH", type: "text", synonyms: ["registro cnh", "numero da cnh", "registro"] },
      { field: "categoria_cnh", label: "Categoria CNH", type: "text", synonyms: ["categoria", "cat cnh", "categoria da cnh"] },
      { field: "validade_cnh", label: "Validade CNH", type: "date", synonyms: ["validade", "vencimento da cnh", "validade da cnh"] },
      { field: "data_nascimento", label: "Nascimento", type: "date", synonyms: ["data de nascimento", "nascimento"] },
      { field: "telefone", label: "Telefone", type: "text", synonyms: ["celular", "fone", "telefone 1", "contato"] },
      { field: "email", label: "E-mail", type: "text", synonyms: ["e-mail", "email 1"] },
      { field: "cep", label: "CEP", type: "text", synonyms: ["cep"] },
      { field: "endereco", label: "Endereço", type: "text", synonyms: ["logradouro", "endereco", "rua"] },
      { field: "bairro", label: "Bairro", type: "text", synonyms: ["bairro"] },
      { field: "cidade", label: "Cidade", type: "text", synonyms: ["municipio"] },
      { field: "estado", label: "Estado", type: "text", synonyms: ["uf"] },
      { field: "chave_pix", label: "Chave PIX", type: "text", synonyms: ["pix"] },
      { field: "status", label: "Status", type: "text", synonyms: ["situacao"], valueMap: { "ativo": "ativo", "ativa": "ativo", "inativo": "inativo", "inativa": "inativo", "bloqueado": "inativo", "baixado": "inativo", "encerrado": "inativo" } },
    ],
  },
  {
    key: "suppliers",
    label: "Fornecedores",
    table: "suppliers",
    fields: [
      { field: "nome_fantasia", label: "Nome fantasia", type: "text", required: true, synonyms: ["nome", "fornecedor", "nome fantasia"] },
      { field: "razao_social", label: "Razão social", type: "text", synonyms: ["razao social"] },
      { field: "tipo", label: "Tipo", type: "text", synonyms: ["tipo de fornecedor"] },
      { field: "cnpj", label: "CNPJ", type: "text", synonyms: ["cpf/cnpj", "cpf cnpj"] },
      { field: "categoria", label: "Categoria", type: "text", synonyms: ["categorias do fornecedor", "categoria do fornecedor"] },
      { field: "telefone", label: "Telefone", type: "text", synonyms: ["telefone 1", "celular", "fone"] },
      { field: "email", label: "E-mail", type: "text", synonyms: ["e-mail", "email 1"] },
      { field: "cidade", label: "Cidade", type: "text", synonyms: ["municipio"] },
      { field: "estado", label: "Estado", type: "text", synonyms: ["uf"] },
      { field: "prazo_pagamento", label: "Prazo pagamento", type: "number", synonyms: ["prazo de pagamento"] },
      { field: "chave_pix", label: "Chave PIX", type: "text", synonyms: ["pix"] },
      { field: "status", label: "Status", type: "text", synonyms: ["situacao"] },
    ],
  },
  {
    key: "expenses",
    label: "Despesas",
    table: "expenses",
    fields: [
      { field: "categoria", label: "Categoria", type: "text", required: true, synonyms: ["grupo de despesa", "tipo de despesa", "grupo"] },
      { field: "descricao", label: "Descrição", type: "text", required: true, synonyms: ["historico", "descricao da despesa"] },
      { field: "data", label: "Data", type: "date", required: true, synonyms: ["data de lancamento", "vencimento", "data de vencimento"] },
      { field: "valor", label: "Valor", type: "number", required: true, synonyms: ["valor total", "valor da despesa"] },
      { field: "fornecedor", label: "Fornecedor", type: "text" },
      { field: "status", label: "Status", type: "text", synonyms: ["situacao"] },
      { field: "_placa", label: "Placa (→ veículo)", type: "text", resolveTo: "vehicle_id", synonyms: ["placa", "veiculo"] },
    ],
  },
  {
    key: "maintenances",
    label: "Manutenções",
    table: "maintenances",
    fields: [
      { field: "_placa", label: "Placa (→ veículo)", type: "text", required: true, resolveTo: "vehicle_id", synonyms: ["placa", "veiculo"] },
      { field: "tipo", label: "Tipo", type: "text", synonyms: ["tipo de manutencao"] },
      { field: "descricao", label: "Descrição", type: "text", required: true, synonyms: ["descricao do servico", "servico"] },
      { field: "data", label: "Data", type: "date", required: true, synonyms: ["data de abertura", "data do servico"] },
      { field: "km", label: "KM", type: "number", synonyms: ["km atual", "quilometragem"] },
      { field: "valor", label: "Valor", type: "number", synonyms: ["valor total", "custo"] },
      { field: "oficina", label: "Oficina", type: "text", synonyms: ["fornecedor"] },
      { field: "status", label: "Status", type: "text", synonyms: ["etapa", "situacao"] },
    ],
  },
  {
    key: "occurrences",
    label: "Ocorrências",
    table: "occurrences",
    fields: [
      {
        field: "tipo", label: "Tipo", type: "text", required: true, synonyms: ["tipo", "tipo de ocorrencia"],
        valueMap: {
          "manutencao": "manutencao", "manutencao corretiva": "manutencao", "manutencao preventiva": "manutencao",
          "manutenção": "manutencao", "manutenção corretiva": "manutencao", "manutenção preventiva": "manutencao",
          "sinistro": "sinistro", "infracao": "infracao", "infração": "infracao", "multa": "infracao",
          "veiculo reserva": "veiculo_reserva", "veículo reserva": "veiculo_reserva", "carro reserva": "veiculo_reserva",
          "devolucao": "devolucao", "devolução": "devolucao", "preparacao": "preparacao", "preparação": "preparacao",
          "translado": "translado",
        },
      },
      { field: "_placa", label: "Placa (→ veículo)", type: "text", resolveTo: "vehicle_id", synonyms: ["placa", "veiculo"] },
      { field: "data", label: "Data", type: "date", required: true, synonyms: ["criado em", "data de agendamento", "data da ocorrencia", "data de abertura"] },
      { field: "descricao", label: "Descrição", type: "text", required: true, synonyms: ["motivo", "justificativa", "descricao da ocorrencia"] },
      { field: "valor", label: "Valor", type: "number", synonyms: ["gasto total", "valor total"] },
      {
        field: "status", label: "Status", type: "text", synonyms: ["situacao"],
        valueMap: {
          "aberta": "aberta", "pre-agendamento": "aberta", "pré-agendamento": "aberta", "agendada": "aberta",
          "em andamento": "em_andamento", "resolvida": "resolvida", "concluida": "resolvida", "concluída": "resolvida",
          "finalizada": "resolvida", "cancelada": "cancelada",
        },
      },
    ],
  },
  {
    key: "contas_receber",
    label: "Contas a Receber (lançamentos)",
    table: "ledger_entries",
    fields: [
      { field: "tipo", label: "Tipo", type: "text", constant: "entrada" },
      { field: "categoria", label: "Categoria", type: "text", constant: "Recebível" },
      { field: "descricao", label: "Descrição", type: "text", required: true, synonyms: ["descricao", "receber de", "receber de (fantasia)", "receber de (razao social)", "numero do documento"] },
      { field: "valor", label: "Valor previsto", type: "number", required: true, synonyms: ["valor previsto", "valor bruto", "valor"] },
      { field: "data", label: "Data", type: "date", synonyms: ["data de vencimento", "data prevista", "data de competencia"] },
      { field: "vencimento", label: "Vencimento", type: "date", synonyms: ["data de vencimento", "data prevista"] },
      { field: "valor_pago", label: "Valor recebido", type: "number", synonyms: ["valor recebido"] },
      {
        field: "status", label: "Recebido", type: "text", synonyms: ["recebido"],
        valueMap: { "sim": "baixado", "nao": "previsto", "não": "previsto" },
      },
    ],
  },
  {
    key: "contratos",
    label: "Contratos de Locação",
    table: "contratos",
    conflict: "numero",
    fields: [
      { field: "_placa", label: "Placa do veículo (→ veículo)", type: "text", resolveTo: "vehicle_id", synonyms: ["veiculo atual", "veiculo do contrato", "veiculo principal", "placa", "veiculo"] },
      { field: "_cpf", label: "CPF do condutor (→ locatário)", type: "text", resolveTo: "locatario_id", synonyms: ["cpf condutor", "documento cliente", "cpf", "cpf/cnpj"] },
      { field: "numero", label: "Número do contrato", type: "text", synonyms: ["contrato de locacao", "contrato", "n contrato", "numero do contrato"] },
      { field: "cliente_nome", label: "Cliente / condutor", type: "text", required: true, synonyms: ["cliente", "condutor", "nome do condutor", "nome do cliente", "locatario", "nome"] },
      { field: "cliente_cpf", label: "CPF do cliente", type: "text", synonyms: ["cpf condutor", "documento cliente", "cpf", "cpf/cnpj"] },
      { field: "cliente_telefone", label: "Telefone do cliente", type: "text", synonyms: ["telefone do condutor", "telefone do cliente", "telefone", "celular"] },
      { field: "placa", label: "Placa (texto)", type: "text", synonyms: ["placa", "veiculo atual"] },
      { field: "valor_locacao", label: "Valor da locação (semanal)", type: "number", required: true, synonyms: ["valor de locacao vigente", "valor inicial de locacao", "valor de locacao", "valor do aluguel", "valor semanal"] },
      { field: "data_entrega", label: "Data de início/entrega", type: "date", required: true, synonyms: ["inicio de contrato", "inicio do contrato", "data de inicio", "data de entrega", "inicio"] },
      { field: "devolucao_prevista", label: "Data de término/devolução", type: "date", synonyms: ["termino do contrato", "termino previsto", "data de termino", "devolucao prevista", "termino"] },
      { field: "grupo", label: "Grupo", type: "text", synonyms: ["grupo", "categoria"] },
      { field: "informacoes_adicionais", label: "Informações adicionais", type: "text", synonyms: ["descritivo adicional", "observacoes"] },
      {
        field: "status", label: "Situação", type: "text", synonyms: ["situacao"],
        valueMap: {
          "ativo": "ativo", "vigente": "ativo", "em aberto": "ativo", "aberto": "ativo", "em andamento": "ativo", "atual": "ativo",
          "encerrado": "encerrado", "finalizado": "encerrado", "devolvido": "encerrado",
          "cancelado": "cancelado", "renovado": "renovado",
        },
      },
    ],
  },
  {
    key: "receitas",
    label: "Receitas",
    table: "finance_entries",
    fields: [
      { field: "tipo", label: "Tipo", type: "text", constant: "receita" },
      { field: "data", label: "Data", type: "date", required: true, synonyms: ["data", "data de recebimento", "data prevista", "data de vencimento", "competencia", "data de competencia"] },
      { field: "_placa", label: "Placa (→ veículo)", type: "text", resolveTo: "vehicle_id", synonyms: ["placa", "veiculo"] },
      { field: "categoria", label: "Categoria", type: "text", synonyms: ["categoria", "tipo de fatura"] },
      { field: "descricao", label: "Descrição", type: "text", required: true, synonyms: ["descricao", "historico", "receber de", "receber de (fantasia)", "observacoes"] },
      { field: "valor", label: "Valor", type: "number", required: true, synonyms: ["valor", "valor previsto", "valor recebido", "valor bruto"] },
      { field: "forma_pagamento", label: "Forma de pagamento", type: "text", synonyms: ["forma de recebimento", "forma de pagamento"] },
    ],
  },
  {
    key: "despesas",
    label: "Despesas",
    table: "finance_entries",
    fields: [
      { field: "tipo", label: "Tipo", type: "text", constant: "despesa" },
      { field: "data", label: "Data", type: "date", required: true, synonyms: ["data", "data de lancamento", "vencimento", "data de vencimento"] },
      { field: "_placa", label: "Placa (→ veículo)", type: "text", resolveTo: "vehicle_id", synonyms: ["placa", "veiculo"] },
      { field: "categoria", label: "Categoria", type: "text", synonyms: ["categoria", "grupo de despesa", "tipo de despesa"] },
      { field: "descricao", label: "Descrição", type: "text", required: true, synonyms: ["descricao", "historico"] },
      { field: "valor", label: "Valor", type: "number", required: true, synonyms: ["valor", "valor total"] },
      { field: "forma_pagamento", label: "Forma de pagamento", type: "text", synonyms: ["forma de pagamento"] },
    ],
  },
];

// Tipos de dado disponíveis na importação (app simplificado)
const VISIBLE_KEYS = ["vehicles", "locatarios", "contratos", "receitas", "despesas"];

const IGNORE = "__ignore__";

export default function ImportPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const { data: vehicles = [] } = useList<Vehicle>("vehicles");
  const { data: locatarios = [] } = useList<Locatario>("locatarios");

  const fileRef = useRef<HTMLInputElement>(null);
  const [entityKey, setEntityKey] = useState("vehicles");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ ok: number; skip: number; errors: string[] } | null>(null);
  const [importing, setImporting] = useState(false);

  const entity = useMemo(() => ENTITIES.find((e) => e.key === entityKey)!, [entityKey]);

  const vehiclesByPlaca = useMemo(() => {
    const m = new Map<string, string>();
    for (const v of vehicles) m.set(v.placa.replace(/\W/g, "").toUpperCase(), v.id);
    return m;
  }, [vehicles]);

  const locatariosByCpf = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of locatarios) m.set((r.cpf ?? "").replace(/\D/g, ""), r.id);
    return m;
  }, [locatarios]);

  function autoMap(hs: string[], ent: EntityDef) {
    const map: Record<string, string> = {};
    for (const f of ent.fields) {
      if (f.constant !== undefined) continue;
      // prioridade: campo, depois sinônimos (na ordem), depois rótulo
      const candList = [f.field, ...(f.synonyms ?? []), f.label];
      let found: string | undefined;
      for (const c of candList) {
        const cn = normalizeHeader(c);
        const h = hs.find((x) => normalizeHeader(x) === cn);
        if (h) { found = h; break; }
      }
      map[f.field] = found ?? IGNORE;
    }
    return map;
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = await parseSpreadsheet(file);
      if (parsed.headers.length === 0) {
        toast.error("Não foi possível ler o cabeçalho do arquivo");
        return;
      }
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setMapping(autoMap(parsed.headers, entity));
      setResult(null);
      toast.success(`${parsed.rows.length} linha(s) lida(s)`);
    } catch (err) {
      toast.error("Erro ao ler arquivo: " + (err as Error).message);
    }
  }

  function onEntityChange(k: string) {
    setEntityKey(k);
    setHeaders([]);
    setRows([]);
    setMapping({});
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function buildRecord(row: string[], cpfMap: Map<string, string>, placaMap: Map<string, string>): Record<string, unknown> | null {
    const rec: Record<string, unknown> = {};
    for (const f of entity.fields) if (f.constant !== undefined) rec[f.field] = f.constant;
    // Inclui apenas campos com valor; campos vazios são omitidos e o banco usa
    // o DEFAULT (envio com defaultToNull:false). Evita violar NOT NULL e mantém
    // colunas heterogêneas (PostgREST usa a união das colunas).
    for (const f of entity.fields) {
      if (f.constant !== undefined) continue;
      const header = mapping[f.field];
      const mapped = !!header && header !== IGNORE;
      if (!mapped) continue;
      const idx = headers.indexOf(header);
      if (idx < 0) continue;
      const value = coerceValue(row[idx] ?? "", f.type);
      if (value === null || value === "") continue;
      if (f.resolveTo === "vehicle_id") {
        const placa = String(value).replace(/\W/g, "").toUpperCase();
        const vid = placaMap.get(placa);
        if (vid) rec["vehicle_id"] = vid;
      } else if (f.resolveTo === "locatario_id") {
        const cpf = String(value).replace(/\D/g, "");
        const rid = cpfMap.get(cpf);
        if (rid) rec["locatario_id"] = rid;
      } else if (f.valueMap) {
        const mappedVal = f.valueMap[String(value).trim().toLowerCase()];
        if (mappedVal) rec[f.field] = mappedVal;
      } else if (f.field === "placa") {
        rec[f.field] = String(value).toUpperCase().replace(/\s/g, "");
      } else if (f.field === "cpf") {
        rec[f.field] = String(value).replace(/\D/g, "");
      } else {
        rec[f.field] = value;
      }
    }
    // valida obrigatórios
    for (const f of entity.fields) {
      if (!f.required || f.constant !== undefined) continue;
      const key =
        f.resolveTo === "vehicle_id" ? "vehicle_id" : f.resolveTo === "locatario_id" ? "locatario_id" : f.field;
      if (rec[key] === undefined || rec[key] === null || rec[key] === "") return null;
    }
    return rec;
  }

  /** Para contratos: cria automaticamente os locatários (condutores) que faltam. */
  async function ensureContractRenters(): Promise<Map<string, string>> {
    const cpfMap = new Map(locatariosByCpf);
    const cpfHeader = mapping["_cpf"];
    if (!cpfHeader || cpfHeader === IGNORE) return cpfMap;
    const cpfIdx = headers.indexOf(cpfHeader);
    if (cpfIdx < 0) return cpfMap;
    const findIdx = (...names: string[]) => {
      const cands = names.map(normalizeHeader);
      return headers.findIndex((h) => cands.includes(normalizeHeader(h)));
    };
    const nomeIdx = findIdx("nome condutor", "cliente", "nome do condutor", "nome");
    const emailIdx = findIdx("e-mail condutor", "email do cliente", "email condutor", "email");
    const telIdx = findIdx("telefone do condutor", "telefone do cliente", "telefone condutor", "telefone", "celular");
    const novos = new Map<string, Record<string, unknown>>();
    for (const row of rows) {
      const cpf = String(row[cpfIdx] ?? "").replace(/\D/g, "");
      if (!cpf || cpfMap.has(cpf) || novos.has(cpf)) continue;
      const nome = nomeIdx >= 0 ? String(row[nomeIdx] ?? "").trim() : "";
      novos.set(cpf, {
        cpf,
        nome: nome || `Condutor ${cpf}`,
        email: emailIdx >= 0 ? String(row[emailIdx] ?? "").trim() || null : null,
        telefone: telIdx >= 0 ? String(row[telIdx] ?? "").trim() || null : null,
        status: "ativo",
      });
    }
    const arr = [...novos.values()];
    for (let i = 0; i < arr.length; i += 200) {
      const batch = arr.slice(i, i + 200);
      const { data } = await supabase
        .from("locatarios")
        .upsert(batch as never, { onConflict: "cpf", defaultToNull: false })
        .select("id, cpf");
      for (const r of (data ?? []) as { id: string; cpf: string }[]) {
        cpfMap.set(String(r.cpf).replace(/\D/g, ""), r.id);
      }
    }
    return cpfMap;
  }

  /** Para contratos: cria automaticamente os veículos que faltam (dados na própria planilha). */
  async function ensureContractVehicles(): Promise<Map<string, string>> {
    const placaMap = new Map(vehiclesByPlaca);
    const placaHeader = mapping["_placa"];
    if (!placaHeader || placaHeader === IGNORE) return placaMap;
    const placaIdx = headers.indexOf(placaHeader);
    if (placaIdx < 0) return placaMap;
    const findIdx = (...names: string[]) => {
      const cands = names.map(normalizeHeader);
      return headers.findIndex((h) => cands.includes(normalizeHeader(h)));
    };
    const marcaIdx = findIdx("montadora", "marca", "fabricante");
    const modeloIdx = findIdx("modelo");
    const renavamIdx = findIdx("renavam");
    const chassiIdx = findIdx("chassi");
    const anoFabIdx = findIdx("ano de fabricacao", "ano fabricacao");
    const anoModIdx = findIdx("ano modelo");
    const grupoIdx = findIdx("grupo", "categoria");
    const novos = new Map<string, Record<string, unknown>>();
    for (const row of rows) {
      const placa = String(row[placaIdx] ?? "").replace(/\W/g, "").toUpperCase();
      if (!placa || placaMap.has(placa) || novos.has(placa)) continue;
      const num = (i: number) => (i >= 0 ? Number(String(row[i] ?? "").replace(/\D/g, "")) || null : null);
      novos.set(placa, {
        placa,
        marca: (marcaIdx >= 0 ? String(row[marcaIdx] ?? "").trim() : "") || "(importado)",
        modelo: (modeloIdx >= 0 ? String(row[modeloIdx] ?? "").trim() : "") || "(importado)",
        renavam: renavamIdx >= 0 ? String(row[renavamIdx] ?? "").trim() || null : null,
        chassi: chassiIdx >= 0 ? String(row[chassiIdx] ?? "").trim() || null : null,
        ano_fabricacao: num(anoFabIdx),
        ano_modelo: num(anoModIdx),
        categoria: grupoIdx >= 0 ? String(row[grupoIdx] ?? "").trim() || null : null,
        status: "disponivel",
      });
    }
    const arr = [...novos.values()];
    for (let i = 0; i < arr.length; i += 200) {
      const batch = arr.slice(i, i + 200);
      const { data } = await supabase
        .from("vehicles")
        .upsert(batch as never, { onConflict: "placa", defaultToNull: false })
        .select("id, placa");
      for (const v of (data ?? []) as { id: string; placa: string }[]) {
        placaMap.set(v.placa.replace(/\W/g, "").toUpperCase(), v.id);
      }
    }
    return placaMap;
  }

  async function handleImport() {
    // valida se os campos obrigatórios foram mapeados (evita importar 0 em silêncio)
    const faltando = entity.fields
      .filter((f) => f.required && f.constant === undefined && (!mapping[f.field] || mapping[f.field] === IGNORE))
      .map((f) => f.label);
    if (faltando.length > 0) {
      toast.error(`Mapeie os campos obrigatórios: ${faltando.join(", ")}`);
      setResult({ ok: 0, skip: rows.length, errors: [`Campos obrigatórios não mapeados: ${faltando.join(", ")}`] });
      return;
    }
    setImporting(true);
    setResult(null);

    const cpfMap = entity.key === "contratos" ? await ensureContractRenters() : locatariosByCpf;
    const placaMap = entity.key === "contratos" ? await ensureContractVehicles() : vehiclesByPlaca;

    const records: Record<string, unknown>[] = [];
    let skip = 0;
    for (const row of rows) {
      const rec = buildRecord(row, cpfMap, placaMap);
      if (rec) records.push(rec);
      else skip++;
    }

    const errors: string[] = [];
    let ok = 0;

    const send = (batch: Record<string, unknown>[]) =>
      entity.conflict
        ? supabase.from(entity.table).upsert(batch as never, { onConflict: entity.conflict, defaultToNull: false })
        : supabase.from(entity.table).insert(batch as never, { defaultToNull: false });

    // importa em lotes de 100; se o lote falhar, tenta linha a linha para isolar o erro
    for (let i = 0; i < records.length; i += 100) {
      const batch = records.slice(i, i + 100);
      const { error } = await send(batch);
      if (!error) {
        ok += batch.length;
        continue;
      }
      for (let j = 0; j < batch.length; j++) {
        const { error: e2 } = await send([batch[j]]);
        if (!e2) ok += 1;
        else if (errors.length < 8) errors.push(`Linha ${i + j + 1}: ${e2.message}`);
      }
    }

    setResult({ ok, skip, errors });
    setImporting(false);
    if (errors.length === 0) toast.success(`${ok} registro(s) importado(s)`);
    else toast.error("Importação concluída com erros — verifique abaixo");
  }

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <PageHeader title="Importar dados" />
        <EmptyState message="Apenas administradores podem importar dados." icon={<Database className="h-6 w-6" />} />
      </div>
    );
  }

  const previewRows = rows.slice(0, 5);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Importar dados (migração)"
        description="Migre os dados do Blue Fleet (ou planilhas) para o VIP CARS via CSV"
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" /> 1. Escolha o que importar e o arquivo
          </CardTitle>
          <CardDescription>
            Exporte do Blue Fleet em <strong>Excel (.xlsx)</strong> ou CSV. O sistema ignora as linhas de título/filtro, detecta o cabeçalho e mapeia as colunas automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Tipo de dado</Label>
              <Select value={entityKey} onValueChange={onEntityChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ENTITIES.filter((e) => VISIBLE_KEYS.includes(e.key)).map((e) => (
                    <SelectItem key={e.key} value={e.key}>{e.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Arquivo CSV</Label>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx,.xls,text/csv"
                onChange={handleFile}
                className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
              />
            </div>
          </div>
          {entity.conflict && (
            <p className="text-xs text-muted-foreground">
              Registros existentes com a mesma <strong>{entity.conflict}</strong> serão atualizados (sem duplicar).
            </p>
          )}
        </CardContent>
      </Card>

      {headers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>2. Mapeie as colunas</CardTitle>
            <CardDescription>Associe cada campo do sistema à coluna correspondente do seu arquivo.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {entity.fields.filter((f) => f.constant === undefined).map((f) => (
                <div key={f.field} className="space-y-1.5">
                  <Label className="text-xs">
                    {f.label} {f.required && <span className="text-destructive">*</span>}
                  </Label>
                  <Select
                    value={mapping[f.field] ?? IGNORE}
                    onValueChange={(v) => setMapping((m) => ({ ...m, [f.field]: v }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={IGNORE}>— ignorar —</SelectItem>
                      {headers.map((h) => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <div className="mt-6">
              <p className="mb-2 text-sm font-medium">Prévia ({rows.length} linha(s))</p>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {entity.fields.filter((f) => f.constant === undefined).map((f) => (
                        <TableHead key={f.field}>{f.label}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.map((row, ri) => (
                      <TableRow key={ri}>
                        {entity.fields.filter((f) => f.constant === undefined).map((f) => {
                          const h = mapping[f.field];
                          const idx = h && h !== IGNORE ? headers.indexOf(h) : -1;
                          return <TableCell key={f.field}>{idx >= 0 ? row[idx] : "—"}</TableCell>;
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <Button onClick={handleImport} disabled={importing}>
                <Upload className="h-4 w-4" /> {importing ? "Importando..." : `Importar ${rows.length} registro(s)`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {result.errors.length === 0 ? (
                <CheckCircle2 className="h-5 w-5 text-success" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-warning" />
              )}
              Resultado da importação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>✅ Importados: <strong>{result.ok}</strong></p>
            <p>⏭️ Ignorados (faltando campos obrigatórios): <strong>{result.skip}</strong></p>
            {result.errors.length > 0 && (
              <div className="mt-2 rounded-md bg-destructive/10 p-3 text-destructive">
                {result.errors.map((e, i) => (
                  <p key={i}>{e}</p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
