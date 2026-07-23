import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/auth-context";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppLayout } from "@/components/layout/app-layout";
import { Toaster } from "@/components/ui/sonner";

import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import RevenuesPage from "@/pages/revenues";
import ExpensesPage from "@/pages/expenses";
import PendenciasPage from "@/pages/pendencias";
import RelatoriosPage from "@/pages/relatorios";
import VistoriasPage from "@/pages/vistorias";
import ContratosPage from "@/pages/contratos";
import LocatariosPage from "@/pages/locatarios";
import ApuracaoKmPage from "@/pages/apuracao-km";
import ImportacoesPage from "@/pages/importacoes";
import VehiclesPage from "@/pages/vehicles";
import ImportPage from "@/pages/import";
import SettingsPage from "@/pages/settings";

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
              <Route path="/contratos" element={<ContratosPage />} />
              <Route path="/apuracao-km" element={<ApuracaoKmPage />} />
              <Route path="/importacoes" element={<ImportacoesPage />} />
              <Route path="/importar" element={<ImportPage />} />
              <Route path="/configuracoes" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}
