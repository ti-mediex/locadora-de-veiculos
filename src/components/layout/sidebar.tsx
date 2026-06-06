import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Car,
  Users,
  FileText,
  Receipt,
  Wrench,
  AlertTriangle,
  Wallet,
  BarChart3,
  Settings,
  ClipboardList,
  ClipboardCheck,
  Upload,
  Building2,
  Layers,
  Warehouse,
  UserSquare2,
  Boxes,
  Banknote,
  Palette,
  Layers3,
  KanbanSquare,
  Landmark,
  ArrowLeftRight,
  ShieldAlert,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import type { AppRole } from "@/types/database";

const ALL: AppRole[] = ["admin", "financeiro", "operador"];

const NAV: {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
  roles: AppRole[];
}[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true, roles: ALL },
  { to: "/veiculos", label: "Veículos", icon: Car, roles: ALL },
  { to: "/locatarios", label: "Locatários", icon: Users, roles: ALL },
  { to: "/fornecedores", label: "Fornecedores", icon: Building2, roles: ALL },
  { to: "/grupos", label: "Grupos de Veículos", icon: Layers, roles: ALL },
  { to: "/patios", label: "Pátios", icon: Warehouse, roles: ALL },
  { to: "/compradores", label: "Compradores", icon: UserSquare2, roles: ALL },
  { to: "/pecas-servicos", label: "Peças e Serviços", icon: Boxes, roles: ALL },
  { to: "/cores", label: "Cores de Veículo", icon: Palette, roles: ALL },
  { to: "/contratos", label: "Contratos", icon: FileText, roles: ALL },
  { to: "/operacoes-lote", label: "Operações em lote", icon: Layers3, roles: ["admin", "financeiro"] },
  { to: "/recebiveis", label: "Recebíveis", icon: Receipt, roles: ["admin", "financeiro"] },
  { to: "/faturamento", label: "Faturamento", icon: Receipt, roles: ["admin", "financeiro"] },
  { to: "/despesas", label: "Despesas", icon: Wallet, roles: ["admin", "financeiro"] },
  { to: "/financiamentos", label: "Financiamentos", icon: Banknote, roles: ["admin", "financeiro"] },
  { to: "/notas-fiscais", label: "Notas Fiscais", icon: FileText, roles: ["admin", "financeiro"] },
  { to: "/lancamentos", label: "Lançamentos", icon: ArrowLeftRight, roles: ["admin", "financeiro"] },
  { to: "/contas-bancarias", label: "Contas Bancárias", icon: Landmark, roles: ["admin", "financeiro"] },
  { to: "/manutencoes", label: "Manutenções", icon: Wrench, roles: ALL },
  { to: "/manutencao-kanban", label: "Dashboard Manutenção", icon: KanbanSquare, roles: ALL },
  { to: "/multas", label: "Multas", icon: AlertTriangle, roles: ALL },
  { to: "/sinistros-kanban", label: "Dashboard Sinistro", icon: ShieldAlert, roles: ALL },
  { to: "/ocorrencias", label: "Ocorrências", icon: ClipboardList, roles: ALL },
  { to: "/vistorias", label: "Vistorias", icon: ClipboardCheck, roles: ALL },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3, roles: ["admin", "financeiro"] },
  { to: "/importar", label: "Importar dados", icon: Upload, roles: ["admin"] },
  { to: "/configuracoes", label: "Configurações", icon: Settings, roles: ["admin"] },
];

export function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { profile } = useAuth();
  const role = profile?.role;
  const items = NAV.filter((item) => !role || item.roles.includes(role));
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r bg-card transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between border-b px-5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Car className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold">VIP CARS</span>
          </div>
          <button className="lg:hidden" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t p-4 text-xs text-muted-foreground">
          VIP CARS · v1.0
        </div>
      </aside>
    </>
  );
}
