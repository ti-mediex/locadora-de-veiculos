import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/auth-context";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppLayout } from "@/components/layout/app-layout";
import { Toaster } from "@/components/ui/sonner";

// Login é carregado direto (primeira tela); as demais rotas são lazy,
// gerando um chunk por página e reduzindo o bundle inicial.
import LoginPage from "@/pages/login";
const DashboardPage = lazy(() => import("@/pages/dashboard"));
const RevenuesPage = lazy(() => import("@/pages/revenues"));
const ExpensesPage = lazy(() => import("@/pages/expenses"));
const PendenciasPage = lazy(() => import("@/pages/pendencias"));
const RelatoriosPage = lazy(() => import("@/pages/relatorios"));
const VistoriasPage = lazy(() => import("@/pages/vistorias"));
const ContratosPage = lazy(() => import("@/pages/contratos"));
const LocatariosPage = lazy(() => import("@/pages/locatarios"));
const ResumoLocatariosPage = lazy(() => import("@/pages/resumo-locatarios"));
const ApuracaoKmPage = lazy(() => import("@/pages/apuracao-km"));
const RastreamentoPage = lazy(() => import("@/pages/rastreamento"));
const ImportacoesPage = lazy(() => import("@/pages/importacoes"));
const VehiclesPage = lazy(() => import("@/pages/vehicles"));
const ImportPage = lazy(() => import("@/pages/import"));
const SettingsPage = lazy(() => import("@/pages/settings"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<div className="flex h-screen items-center justify-center text-sm text-muted-foreground">Carregando…</div>}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<DashboardPage />} />
              <Route path="/receitas" element={<RevenuesPage />} />
              <Route path="/despesas" element={<ExpensesPage />} />
              <Route path="/pendencias" element={<PendenciasPage />} />
              <Route path="/relatorios" element={<RelatoriosPage />} />
              <Route path="/veiculos" element={<VehiclesPage />} />
              <Route path="/vistorias" element={<VistoriasPage />} />
              <Route path="/locatarios" element={<LocatariosPage />} />
              <Route path="/resumo-locatarios" element={<ResumoLocatariosPage />} />
              <Route path="/contratos" element={<ContratosPage />} />
              <Route path="/apuracao-km" element={<ApuracaoKmPage />} />
              <Route path="/rastreamento" element={<RastreamentoPage />} />
              <Route path="/importacoes" element={<ImportacoesPage />} />
              <Route path="/importar" element={<ImportPage />} />
              <Route path="/configuracoes" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}
