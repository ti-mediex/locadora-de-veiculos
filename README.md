# VIP CARS — Gestão Financeira de Locadora de Veículos

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
- **Régua de cobrança** — botão de **cobrança via WhatsApp** (1 clique, mensagem pré-preenchida) em recebíveis e no dashboard.
- **Alertas operacionais** — CNH vencendo/vencida, manutenções pendentes, multas a repassar e **top devedores**.
- **Controle de acesso por papel** — RLS granular no banco + menus e botões por perfil: **admin** (tudo), **financeiro** (contratos, recebíveis, despesas, multas, relatórios), **operador** (veículos, locatários, manutenções, vistorias).
- **Ocorrências** — registro operacional unificado (Manutenção, Sinistro, Infração, Veículo Reserva, Devolução, Preparação, Translado) + painéis *Ocorrências por dia* e *por tipo* no dashboard (inspirado no Blue Fleet).
- **Vistorias (checklist digital)** — inspeção de entrega/devolução com checklist de itens, KM, nível de combustível e avarias.
- **Importação / Migração** — importador CSV com mapeamento de colunas para migrar dados do Blue Fleet (ou planilhas) para o app.
- **Configurações** — gestão de usuários e papéis (admin / financeiro / operador).

## 🔄 Migração de dados (Blue Fleet → VIP CARS)

Como o Blue Fleet não expõe API pública, a migração é feita por **exportação CSV + importação assistida**:

1. No Blue Fleet, **exporte** cada conjunto de dados (veículos, condutores/locatários, contratos, ocorrências, despesas) em **CSV** (ou salve o Excel como `.csv`).
2. No VIP CARS, acesse **Importar dados** (menu lateral, perfil admin).
3. Escolha o tipo de dado, **envie o CSV** — o sistema detecta as colunas e faz o mapeamento automático (ajustável).
4. Confira a **prévia** e clique em importar. Veículos e locatários usam *upsert* por **placa**/**CPF** (não duplica em reimportações). Manutenções, despesas e ocorrências vinculam-se ao veículo pela **placa**.

> Ordem recomendada: **Veículos → Locatários → Despesas/Manutenções/Ocorrências** (assim os vínculos por placa são resolvidos).

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

> ✅ **Projeto já provisionado:** `locadora-veiculos` (`iqlhnhlvhkkfsryxvyfa`, região sa-east-1), com as 5 migrations já aplicadas e dados de demonstração carregados. URL e chave pública estão no `.env.example`.

As migrations estão em [`supabase/migrations/`](supabase/migrations) e são a **fonte da verdade** do schema. Para reaplicar em outro ambiente:

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
5. `20260606000005_security_hardening.sql` — restringe execução das RPCs ao papel autenticado

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
