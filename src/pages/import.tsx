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
import type { Vehicle, Renter } from "@/types/database";

type FieldType = "text" | "number" | "date" | "boolean";
interface FieldDef {
  field: string;
  label: string;
  type: FieldType;
  required?: boolean;
  synonyms?: string[];
  resolveTo?: "vehicle_id" | "renter_id"; // resolve placa->veículo ou CPF->locatário
  valueMap?: Record<string, string>; // tradução de valores (ex.: situação -> enum)
}
interface EntityDef {
  key: string;
  label: string;
  table: "vehicles" | "renters" | "expenses" | "maintenances" | "occurrences" | "suppliers" | "contracts";
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
      { field: "status", label: "Status", type: "text" },
    ],
  },
  {
    key: "renters",
    label: "Locatários / Condutores",
    table: "renters",
    conflict: "cpf",
    fields: [
      { field: "nome", label: "Nome", type: "text", required: true, synonyms: ["condutor", "cliente", "nome do condutor", "nome completo"] },
      { field: "cpf", label: "CPF", type: "text", required: true, synonyms: ["cpf/cnpj", "documento", "cpf cnpj"] },
      { field: "rg", label: "RG", type: "text", synonyms: ["rg", "identidade"] },
      { field: "cnh", label: "CNH", type: "text", synonyms: ["registro cnh", "numero da cnh", "registro"] },
      { field: "categoria_cnh", label: "Categoria CNH", type: "text", synonyms: ["categoria", "cat cnh", "categoria da cnh"] },
      { field: "validade_cnh", label: "Validade CNH", type: "date", synonyms: ["validade", "vencimento da cnh", "validade da cnh"] },
      { field: "data_nascimento", label: "Nascimento", type: "date", synonyms: ["data de nascimento", "nascimento"] },
      { field: "telefone", label: "Telefone", type: "text", synonyms: ["celular", "fone", "telefone 1", "contato"] },
      { field: "email", label: "E-mail", type: "text", synonyms: ["e-mail", "email 1"] },
      { field: "cidade", label: "Cidade", type: "text", synonyms: ["municipio"] },
      { field: "estado", label: "Estado", type: "text", synonyms: ["uf"] },
      { field: "chave_pix", label: "Chave PIX", type: "text", synonyms: ["pix"] },
      { field: "status", label: "Status", type: "text", synonyms: ["situacao"] },
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
      { field: "tipo", label: "Tipo", type: "text", required: true, synonyms: ["tipo de ocorrencia"] },
      { field: "_placa", label: "Placa (→ veículo)", type: "text", resolveTo: "vehicle_id", synonyms: ["placa", "veiculo"] },
      { field: "data", label: "Data", type: "date", required: true, synonyms: ["data da ocorrencia", "data de abertura"] },
      { field: "descricao", label: "Descrição", type: "text", required: true, synonyms: ["descricao da ocorrencia"] },
      { field: "valor", label: "Valor", type: "number", synonyms: ["valor total"] },
      { field: "status", label: "Status", type: "text", synonyms: ["etapa", "situacao"] },
    ],
  },
  {
    key: "contracts",
    label: "Contratos de Locação",
    table: "contracts",
    conflict: "numero",
    fields: [
      { field: "_placa", label: "Placa do veículo (→ veículo)", type: "text", required: true, resolveTo: "vehicle_id", synonyms: ["veiculo atual", "veiculo do contrato", "veiculo principal", "placa", "veiculo"] },
      { field: "_cpf", label: "CPF do condutor (→ locatário)", type: "text", required: true, resolveTo: "renter_id", synonyms: ["cpf condutor", "documento cliente", "cpf", "cpf/cnpj"] },
      { field: "numero", label: "Número do contrato", type: "text", synonyms: ["contrato de locacao", "contrato comercial", "contrato"] },
      { field: "valor_aluguel", label: "Valor do aluguel", type: "number", required: true, synonyms: ["valor de locacao vigente", "valor inicial de locacao", "valor de locacao"] },
      { field: "data_inicio", label: "Data de início", type: "date", required: true, synonyms: ["inicio de contrato", "inicio do contrato", "data de inicio"] },
      { field: "data_fim", label: "Data de término", type: "date", synonyms: ["termino do contrato", "termino previsto", "data de termino"] },
      { field: "franquia_km", label: "Franquia de KM", type: "number", synonyms: ["franquia km/mes", "franquia km", "franquia"] },
      { field: "nivel_combustivel_retirada", label: "Nível combustível (entrega)", type: "text", synonyms: ["nivel de combustivel na entrega"] },
      { field: "informacoes_adicionais", label: "Informações adicionais", type: "text", synonyms: ["descritivo adicional"] },
      {
        field: "status", label: "Situação", type: "text", synonyms: ["situacao"],
        valueMap: {
          "ativo": "ativo", "vigente": "ativo", "em aberto": "ativo", "aberto": "ativo", "em andamento": "ativo",
          "encerrado": "encerrado", "finalizado": "encerrado", "cancelado": "encerrado", "devolvido": "encerrado",
          "suspenso": "suspenso", "inadimplente": "inadimplente",
        },
      },
    ],
  },
];

const IGNORE = "__ignore__";

export default function ImportPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const { data: vehicles = [] } = useList<Vehicle>("vehicles");
  const { data: renters = [] } = useList<Renter>("renters");

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

  const rentersByCpf = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of renters) m.set((r.cpf ?? "").replace(/\D/g, ""), r.id);
    return m;
  }, [renters]);

  function autoMap(hs: string[], ent: EntityDef) {
    const map: Record<string, string> = {};
    for (const f of ent.fields) {
      const candidates = [f.label, f.field, ...(f.synonyms ?? [])].map(normalizeHeader);
      const found = hs.find((h) => candidates.includes(normalizeHeader(h)));
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

  function buildRecord(row: string[]): Record<string, unknown> | null {
    const rec: Record<string, unknown> = {};
    // Inclui apenas campos com valor; campos vazios são omitidos e o banco usa
    // o DEFAULT (envio com defaultToNull:false). Evita violar NOT NULL e mantém
    // colunas heterogêneas (PostgREST usa a união das colunas).
    for (const f of entity.fields) {
      const header = mapping[f.field];
      const mapped = !!header && header !== IGNORE;
      if (!mapped) continue;
      const idx = headers.indexOf(header);
      if (idx < 0) continue;
      const value = coerceValue(row[idx] ?? "", f.type);
      if (value === null || value === "") continue;
      if (f.resolveTo === "vehicle_id") {
        const placa = String(value).replace(/\W/g, "").toUpperCase();
        const vid = vehiclesByPlaca.get(placa);
        if (vid) rec["vehicle_id"] = vid;
      } else if (f.resolveTo === "renter_id") {
        const cpf = String(value).replace(/\D/g, "");
        const rid = rentersByCpf.get(cpf);
        if (rid) rec["renter_id"] = rid;
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
      if (!f.required) continue;
      const key =
        f.resolveTo === "vehicle_id" ? "vehicle_id" : f.resolveTo === "renter_id" ? "renter_id" : f.field;
      if (rec[key] === undefined || rec[key] === null || rec[key] === "") return null;
    }
    return rec;
  }

  async function handleImport() {
    setImporting(true);
    setResult(null);
    const records: Record<string, unknown>[] = [];
    let skip = 0;
    for (const row of rows) {
      const rec = buildRecord(row);
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
                  {ENTITIES.map((e) => (
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
              {entity.fields.map((f) => (
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
                      {entity.fields.map((f) => (
                        <TableHead key={f.field}>{f.label}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.map((row, ri) => (
                      <TableRow key={ri}>
                        {entity.fields.map((f) => {
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
