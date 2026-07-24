import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  FileBarChart,
  FolderDown,
  ClipboardCheck,
  FileSignature,
  Users,
  Wallet,
  Gauge,
  Satellite,
  Car,
  Upload,
  Settings,
  AlertOctagon,
  Wrench,
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
  { to: "/receitas", label: "Receitas", icon: TrendingUp, roles: ["admin", "financeiro"] },
  { to: "/despesas", label: "Despesas", icon: TrendingDown, roles: ["admin", "financeiro"] },
  { to: "/pendencias", label: "Pendências", icon: AlertTriangle, roles: ALL },
  { to: "/ocorrencias", label: "Ocorrências", icon: AlertOctagon, roles: ["admin", "financeiro", "operador"] },
  { to: "/ordens-servico", label: "Ordens de Serviço", icon: Wrench, roles: ["admin", "financeiro", "operador"] },
  { to: "/relatorios", label: "Relatórios", icon: FileBarChart, roles: ["admin", "financeiro"] },
  { to: "/veiculos", label: "Veículos", icon: Car, roles: ALL },
  { to: "/vistorias", label: "Vistorias", icon: ClipboardCheck, roles: ["admin", "financeiro", "operador", "vistoriador"] },
  { to: "/locatarios", label: "Locatários", icon: Users, roles: ["admin", "financeiro", "operador"] },
  { to: "/resumo-locatarios", label: "Resumo por Locatário", icon: Wallet, roles: ["admin", "financeiro", "operador"] },
  { to: "/contratos", label: "Contratos", icon: FileSignature, roles: ["admin", "financeiro", "operador"] },
  { to: "/apuracao-km", label: "Apuração de KM", icon: Gauge, roles: ["admin", "financeiro", "operador"] },
  { to: "/rastreamento", label: "Rastreamento Ituran", icon: Satellite, roles: ["admin", "financeiro", "operador"] },
  { to: "/importacoes", label: "Importações", icon: FolderDown, roles: ["admin", "financeiro", "operador"] },
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
          VIP CARS · v2.1
        </div>
      </aside>
    </>
  );
}
