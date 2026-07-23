import { useEffect, useState } from "react";
import { Users, ShieldCheck, Info, Plus, Trash2, KeyRound, MessageSquare } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Field } from "@/components/shared/field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAppConfig, useUpdateAppConfig, CONFIG_DEFAULTS, type AppConfig } from "@/hooks/use-app-config";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useList } from "@/hooks/use-crud";
import { useCreateUser, useUpdateUser, useDeleteUser, useResetPassword } from "@/hooks/use-admin-users";
import { useAuth } from "@/contexts/auth-context";
import { formatDate } from "@/lib/format";
import type { Profile } from "@/types/database";

const ROLES = [
  { value: "admin", label: "Administrador", desc: "Acesso total, incluindo gestão de usuários." },
  { value: "financeiro", label: "Financeiro", desc: "Receitas, despesas, pendências e relatórios." },
  { value: "operador", label: "Operador", desc: "Cadastros de veículos, pendências e vistorias." },
  { value: "vistoriador", label: "Vistoriador", desc: "Acesso apenas ao módulo de Vistorias." },
];
const roleLabel = (r: string) => ROLES.find((x) => x.value === r)?.label ?? r;

export default function SettingsPage() {
  const { profile } = useAuth();
  const { data: profiles = [], isLoading } = useList<Profile>("profiles", { orderBy: { column: "created_at", ascending: true } });
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const resetPass = useResetPassword();
  const isAdmin = profile?.role === "admin";

  const [novoOpen, setNovoOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [papel, setPapel] = useState("operador");

  // Mensagens configuráveis (envio de laudo)
  const { data: config } = useAppConfig();
  const updateConfig = useUpdateAppConfig();
  const [msg, setMsg] = useState<AppConfig>(CONFIG_DEFAULTS);
  useEffect(() => { if (config) setMsg(config); }, [config]);

  function criar() {
    createUser.mutate({ full_name: nome, email, password: senha, role: papel }, {
      onSuccess: () => { setNovoOpen(false); setNome(""); setEmail(""); setSenha(""); setPapel("operador"); },
    });
  }
  const [resetTarget, setResetTarget] = useState<Profile | null>(null);
  const [novaSenha, setNovaSenha] = useState("");
  function confirmarRedefinicao() {
    if (!resetTarget || novaSenha.length < 6) return;
    resetPass.mutate({ id: resetTarget.id, password: novaSenha }, {
      onSuccess: () => { setResetTarget(null); setNovaSenha(""); },
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configurações"
        description="Usuários, permissões e parâmetros do sistema"
        actions={isAdmin && <Button onClick={() => setNovoOpen(true)}><Plus className="h-4 w-4" /> Novo usuário</Button>}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Usuários</CardTitle>
          <CardDescription>{isAdmin ? "Crie, edite papéis, redefina senhas e exclua usuários" : "Apenas administradores podem gerenciar usuários"}</CardDescription>
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
                  {isAdmin && <TableHead className="w-24"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.full_name ?? "—"}</TableCell>
                    <TableCell>{p.email}</TableCell>
                    <TableCell>
                      {isAdmin ? (
                        <Select value={p.role} onValueChange={(v) => updateUser.mutate({ id: p.id, role: v })}>
                          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="secondary">{roleLabel(p.role)}</Badge>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(p.created_at)}</TableCell>
                    <TableCell>
                      {isAdmin ? (
                        <button onClick={() => updateUser.mutate({ id: p.id, active: !p.active })}>
                          {p.active ? <Badge variant="success">Ativo</Badge> : <Badge variant="muted">Inativo</Badge>}
                        </button>
                      ) : p.active ? <Badge variant="success">Ativo</Badge> : <Badge variant="muted">Inativo</Badge>}
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" title="Redefinir senha" aria-label={`Redefinir senha de ${p.email}`} onClick={() => { setResetTarget(p); setNovaSenha(""); }}><KeyRound className="h-4 w-4" /></Button>
                          {p.id !== profile?.id && (
                            <Button variant="ghost" size="icon" title="Excluir" onClick={() => confirm(`Excluir o usuário ${p.email}?`) && deleteUser.mutate(p.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
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
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Papéis de acesso</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {ROLES.map((r) => (
              <div key={r.value} className="flex gap-3">
                <Badge variant={r.value === "admin" ? "default" : r.value === "vistoriador" ? "warning" : "secondary"} className="shrink-0">{r.label}</Badge>
                <span className="text-muted-foreground">{r.desc}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Info className="h-5 w-5" /> Sobre o sistema</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p><strong className="text-foreground">VIP CARS</strong> · v2.1</p>
            <p>Gestão de frota para locação: financeiro, pendências, vistorias e relatórios.</p>
            <p>Backend: Supabase (PostgreSQL, Auth, Storage). Frontend: React + Vite.</p>
          </CardContent>
        </Card>
      </div>

      {/* Mensagens de envio do laudo */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5" /> Mensagens de envio do laudo</CardTitle>
            <CardDescription>
              Personalize o texto enviado ao locatário. Variáveis:{" "}
              <code className="rounded bg-muted px-1">{"{nome}"}</code> <code className="rounded bg-muted px-1">{"{placa}"}</code>{" "}
              <code className="rounded bg-muted px-1">{"{tipo}"}</code> <code className="rounded bg-muted px-1">{"{link}"}</code>{" "}
              <code className="rounded bg-muted px-1">{"{empresa}"}</code>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome da empresa"><Input value={msg.empresa_nome ?? ""} onChange={(e) => setMsg((m) => ({ ...m, empresa_nome: e.target.value }))} /></Field>
              <Field label="Assunto do e-mail"><Input value={msg.laudo_email_assunto ?? ""} onChange={(e) => setMsg((m) => ({ ...m, laudo_email_assunto: e.target.value }))} /></Field>
            </div>
            <Field label="Mensagem do WhatsApp">
              <Textarea rows={4} value={msg.laudo_whatsapp_msg ?? ""} onChange={(e) => setMsg((m) => ({ ...m, laudo_whatsapp_msg: e.target.value }))} />
            </Field>
            <Field label="Corpo do e-mail">
              <Textarea rows={4} value={msg.laudo_email_corpo ?? ""} onChange={(e) => setMsg((m) => ({ ...m, laudo_email_corpo: e.target.value }))} />
            </Field>
            <div className="flex justify-end">
              <Button onClick={() => updateConfig.mutate(msg)} disabled={updateConfig.isPending}>
                {updateConfig.isPending ? "Salvando..." : "Salvar mensagens"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Novo usuário */}
      <Dialog open={novoOpen} onOpenChange={setNovoOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Novo usuário</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Field label="Nome completo"><Input value={nome} onChange={(e) => setNome(e.target.value)} /></Field>
            <Field label="E-mail"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@empresa.com" /></Field>
            <Field label="Senha inicial"><Input type="text" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="mín. 6 caracteres" /></Field>
            <Field label="Papel">
              <Select value={papel} onValueChange={setPapel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <p className="text-xs text-muted-foreground">{ROLES.find((r) => r.value === papel)?.desc}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovoOpen(false)}>Cancelar</Button>
            <Button onClick={criar} disabled={!email || senha.length < 6 || createUser.isPending}>
              {createUser.isPending ? "Criando..." : "Criar usuário"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Redefinição de senha */}
      <Dialog open={!!resetTarget} onOpenChange={(o) => { if (!o) { setResetTarget(null); setNovaSenha(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Redefinir senha</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Nova senha para <span className="font-medium text-foreground">{resetTarget?.email}</span>.</p>
            <Field label="Nova senha (mín. 6 caracteres)">
              <Input
                type="password"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                placeholder="••••••"
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter" && novaSenha.length >= 6) confirmarRedefinicao(); }}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResetTarget(null); setNovaSenha(""); }}>Cancelar</Button>
            <Button onClick={confirmarRedefinicao} disabled={novaSenha.length < 6 || resetPass.isPending}>
              {resetPass.isPending ? "Salvando..." : "Redefinir senha"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
