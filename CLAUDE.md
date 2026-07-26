# Diretrizes do projeto — VIP CARS

## Idioma
- **Sempre responder e escrever em português (pt-BR).** Toda a comunicação com o usuário, mensagens de commit, descrições de PR e textos de interface devem estar em português.

## Escopo do app
- App focado em **gestão financeira da frota**: Receitas e Despesas por frota e por veículo, além do módulo de **Pendências por veículo** (rastreador Ituran, IPVA, Licenciamento, CRLV, Seguro/CSV, multas e outras pendências, com alertas de vencimento).
- Tabelas ativas no banco: `vehicles`, `finance_entries`, `vehicle_pendencias`, `profiles`.

## Diretrizes-mestras de UX (obrigatórias em todo o app)
Estas regras valem para **todas** as telas, abas e componentes — atuais e futuros. Toda nova página/tabela deve nascer já obedecendo-as.

1. **Sem scroll horizontal.** Nenhuma tabela ou conteúdo pode exigir rolagem horizontal nas larguras de uso (1366px e 1536px no desktop; e responsivo no celular). Ajuste o tamanho/fonte das colunas para caber:
   - Tabela compacta: `className="text-xs [&_th]:h-9 [&_th]:whitespace-nowrap [&_th]:px-1 [&_th]:text-[11px] [&_td]:px-1 [&_td]:py-2"` (use `px-2` só quando houver folga).
   - Colunas de texto largas com `max-w-[…] truncate` + `title` (tooltip com o valor completo); numéricas com `text-right tabular-nums`; badges compactos `px-1.5 py-0 text-[10px]`.
   - Priorize as colunas essenciais; abrevie rótulos (ex.: "Status veíc."). Só use `overflow-x-auto` como rede de segurança — o objetivo é caber sem acioná-lo.
2. **Tudo clicável.** Todos os itens, dados e informações devem ser clicáveis em todos os módulos e abas: linhas de tabela abrem edição/detalhe/ficha, valores e badges navegam para o contexto relevante (pendências, rastreamento, contrato, veículo, locatário). Não deixe dado "morto" sem ação.

Ao criar/alterar qualquer tela, verificar as duas regras antes de concluir.

## Stack
- React 18 + TypeScript + Vite + Tailwind + shadcn/ui + TanStack Query + React Hook Form + Zod + React Router + Recharts + Sonner.
- Backend: Supabase (RLS via `public.can_manage(app_role[])`, RPCs `SECURITY DEFINER`).

## Fluxo de trabalho
- Após cada implementação: rodar `npm run build`, corrigir erros e então mesclar para `main`.
