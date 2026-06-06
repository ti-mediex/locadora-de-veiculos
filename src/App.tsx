import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/auth-context";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppLayout } from "@/components/layout/app-layout";
import { Toaster } from "@/components/ui/sonner";

import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import VehiclesPage from "@/pages/vehicles";
import RentersPage from "@/pages/renters";
import ContractsPage from "@/pages/contracts";
import ReceivablesPage from "@/pages/receivables";
import ExpensesPage from "@/pages/expenses";
import MaintenancesPage from "@/pages/maintenances";
import MaintenanceKanbanPage from "@/pages/maintenance-kanban";
import FinesPage from "@/pages/fines";
import OccurrencesPage from "@/pages/occurrences";
import InspectionsPage from "@/pages/inspections";
import SuppliersPage from "@/pages/suppliers";
import VehicleGroupsPage from "@/pages/vehicle-groups";
import YardsPage from "@/pages/yards";
import BuyersPage from "@/pages/buyers";
import PartsServicesPage from "@/pages/parts-services";
import FinancingPage from "@/pages/financing";
import InvoicesPage from "@/pages/invoices";
import BankAccountsPage from "@/pages/bank-accounts";
import LedgerPage from "@/pages/ledger";
import VehicleColorsPage from "@/pages/vehicle-colors";
import BulkOperationsPage from "@/pages/bulk-operations";
import ImportPage from "@/pages/import";
import ReportsPage from "@/pages/reports";
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
              <Route path="/veiculos" element={<VehiclesPage />} />
              <Route path="/locatarios" element={<RentersPage />} />
              <Route path="/fornecedores" element={<SuppliersPage />} />
              <Route path="/contratos" element={<ContractsPage />} />
              <Route path="/recebiveis" element={<ReceivablesPage />} />
              <Route path="/despesas" element={<ExpensesPage />} />
              <Route path="/manutencoes" element={<MaintenancesPage />} />
              <Route path="/manutencao-kanban" element={<MaintenanceKanbanPage />} />
              <Route path="/multas" element={<FinesPage />} />
              <Route path="/ocorrencias" element={<OccurrencesPage />} />
              <Route path="/vistorias" element={<InspectionsPage />} />
              <Route path="/grupos" element={<VehicleGroupsPage />} />
              <Route path="/patios" element={<YardsPage />} />
              <Route path="/compradores" element={<BuyersPage />} />
              <Route path="/pecas-servicos" element={<PartsServicesPage />} />
              <Route path="/cores" element={<VehicleColorsPage />} />
              <Route path="/financiamentos" element={<FinancingPage />} />
              <Route path="/notas-fiscais" element={<InvoicesPage />} />
              <Route path="/contas-bancarias" element={<BankAccountsPage />} />
              <Route path="/lancamentos" element={<LedgerPage />} />
              <Route path="/operacoes-lote" element={<BulkOperationsPage />} />
              <Route path="/relatorios" element={<ReportsPage />} />
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
