# FrotaGest — Gestão Financeira de Locadora de Veículos

Sistema web para gestão financeira completa de uma frota locada a **motoristas de aplicativo** (Uber, 99, etc.). Cadastro de veículos e locatários, contratos com geração de PDF, motor de cobranças recorrentes (aluguel **semanal** por padrão), controle de manutenções, multas, despesas e um **dashboard** gerencial.

## ✨ Funcionalidades

- **Dashboard financeiro** — receita prevista x recebida, lucro líquido, inadimplência, taxa de ocupação da frota, ticket médio, ROI por veículo, fluxo de caixa (12 meses) e cobranças a vencer/atrasadas.
- **Veículos** — cadastro completo (placa, renavam, FIPE, financiamento, KM) e status da frota.
- **Locatários** — dados pessoais, CNH, contato, PIX e contato de emergência.
- **Contratos** — assistente de criação, ciclo de cobrança flexível (diário/semanal/quinzenal/mensal), **geração automática de cobranças** e **geração de contrato em PDF**.
- **Recebíveis** — baixa de pagamento (com juros/multa), controle de inadimplência e régua de atrasos.
- **Manutenções** — histórico e custo por veículo.
- **Multas** — lançamento, vínculo ao responsável e **repasse ao locatário**.
- **Despesas** — IPVA, seguro, licenciamento, financiamento e custos administrativos.
- **Relatórios** — rentabilidade por veículo, composição de despesas, fluxo de caixa e **exportação CSV**.
- **Configurações** — gestão de usuários e papéis (admin / financeiro / operador).

## 🏗️ Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| UI | Tailwind CSS + shadcn/ui (Radix) |
| Estado servidor | TanStack React Query |
| Formulários | React Hook Form + Zod |
| Roteamento | React Router DOM |
| Gráficos | Recharts |
| PDF | @react-pdf/renderer |
| Backend | Supabase (PostgreSQL, Auth, Storage) |
| Deploy | Vercel |

## 🚀 Setup

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# edite .env com a URL e a chave pública (anon/publishable) do seu projeto Supabase

# 3. Rodar em desenvolvimento
npm run dev

# 4. Build de produção
npm run build
```

### Banco de dados (Supabase)

As migrations estão em [`supabase/migrations/`](supabase/migrations) e são a **fonte da verdade** do schema. Aplique-as de uma das formas:

**Via Supabase CLI (recomendado):**
```bash
supabase link --project-ref <seu-project-ref>
supabase db push
```

**Ou** cole o conteúdo de cada arquivo (em ordem) no **SQL Editor** do painel Supabase:

1. `20260606000001_initial_schema.sql` — tabelas, enums e triggers
2. `20260606000002_financial_functions.sql` — motor de cobranças, inadimplência e KPIs
3. `20260606000003_rls_policies.sql` — Row Level Security
4. `20260606000004_seed.sql` — dados de demonstração (opcional)

> O primeiro usuário que se cadastrar no app recebe automaticamente o papel **admin**.

### Agendamento (opcional)

Para marcar cobranças vencidas automaticamente, agende a função `mark_overdue_receivables()` com **pg_cron**:

```sql
select cron.schedule('marcar-atrasos', '0 6 * * *', $$ select public.mark_overdue_receivables(); $$);
```

## 📁 Estrutura

```
src/
  components/   # ui (shadcn), layout, shared, contracts (PDF)
  contexts/     # auth
  hooks/        # react-query (crud, contracts, receivables, dashboard)
  lib/          # supabase, format, options, csv, utils
  pages/        # dashboard, vehicles, renters, contracts, receivables,
                # expenses, maintenances, fines, reports, settings
  types/        # database (domínio)
supabase/migrations/  # schema SQL versionado
```

## 🔐 Modelo financeiro

- Ao criar um contrato, o sistema gera as cobranças do período conforme o ciclo escolhido (`generate_receivables`).
- A baixa de pagamento (`settle_receivable`) atualiza o caixa e reabilita contratos inadimplentes quitados.
- O **lucro líquido** = receita recebida − despesas − manutenção − multas não repassadas.
- O **ROI por veículo** desconta manutenção e multas da empresa da receita acumulada.
