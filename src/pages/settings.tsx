import { Users, ShieldCheck, Info } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
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
import { useList, useUpdate } from "@/hooks/use-crud";
import { useAuth } from "@/contexts/auth-context";
import { formatDate } from "@/lib/format";
import type { Profile } from "@/types/database";

const ROLES = [
  { value: "admin", label: "Administrador" },
  { value: "financeiro", label: "Financeiro" },
  { value: "operador", label: "Operador" },
];

export default function SettingsPage() {
  const { profile } = useAuth();
  const { data: profiles = [], isLoading } = useList<Profile>("profiles", {
    orderBy: { column: "created_at", ascending: true },
  });
  const update = useUpdate<Profile>("profiles", "Usuário");
  const isAdmin = profile?.role === "admin";

  return (
    <div className="space-y-6">
      <PageHeader title="Configurações" description="Usuários, permissões e parâmetros do sistema" />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Usuários
          </CardTitle>
          <CardDescription>
            {isAdmin
              ? "Gerencie os papéis de acesso dos usuários do sistema"
              : "Apenas administradores podem alterar papéis"}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : profiles.length === 0 ? (
            <EmptyState message="Nenhum usuário encontrado" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>Cadastrado em</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.full_name ?? "—"}</TableCell>
                    <TableCell>{p.email}</TableCell>
                    <TableCell>
                      {isAdmin ? (
                        <Select
                          value={p.role}
                          onValueChange={(v) => update.mutate({ id: p.id, role: v as Profile["role"] })}
                        >
                          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {ROLES.map((r) => (
                              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="secondary">{p.role}</Badge>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(p.created_at)}</TableCell>
                    <TableCell>
                      {p.active ? <Badge variant="success">Ativo</Badge> : <Badge variant="muted">Inativo</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" /> Papéis de acesso
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex gap-3">
              <Badge>Administrador</Badge>
              <span className="text-muted-foreground">Acesso total, incluindo gestão de usuários.</span>
            </div>
            <div className="flex gap-3">
              <Badge variant="secondary">Financeiro</Badge>
              <span className="text-muted-foreground">Cobranças, despesas, relatórios e contratos.</span>
            </div>
            <div className="flex gap-3">
              <Badge variant="muted">Operador</Badge>
              <span className="text-muted-foreground">Cadastros de veículos, locatários e manutenções.</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" /> Sobre o sistema
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p><strong className="text-foreground">VIP CARS</strong> · v1.0</p>
            <p>Gestão financeira de frota para locação de veículos a motoristas de aplicativo.</p>
            <p>Ciclo de cobrança padrão: <strong className="text-foreground">semanal</strong>.</p>
            <p>Backend: Supabase (PostgreSQL, Auth, Storage). Frontend: React + Vite.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
