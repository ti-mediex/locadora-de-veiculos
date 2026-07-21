# Diretrizes do projeto — VIP CARS

## Idioma
- **Sempre responder e escrever em português (pt-BR).** Toda a comunicação com o usuário, mensagens de commit, descrições de PR e textos de interface devem estar em português.

## Escopo do app
- App focado em **gestão financeira da frota**: Receitas e Despesas por frota e por veículo, além do módulo de **Pendências por veículo** (rastreador Ituran, IPVA, Licenciamento, CRLV, Seguro/CSV, multas e outras pendências, com alertas de vencimento).
- Tabelas ativas no banco: `vehicles`, `finance_entries`, `vehicle_pendencias`, `profiles`.

## UX
- **Todos os itens, dados e informações devem ser clicáveis** em todos os módulos e abas: linhas de tabela abrem edição/detalhe, valores e badges navegam para o contexto relevante.

## Stack
- React 18 + TypeScript + Vite + Tailwind + shadcn/ui + TanStack Query + React Hook Form + Zod + React Router + Recharts + Sonner.
- Backend: Supabase (RLS via `public.can_manage(app_role[])`, RPCs `SECURITY DEFINER`).

## Fluxo de trabalho
- Após cada implementação: rodar `npm run build`, corrigir erros e então mesclar para `main`.
