// Edge Function: gestão de usuários (criar, atualizar papel/status, excluir,
// redefinir senha). Restrita a administradores.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const URL = Deno.env.get("SUPABASE_URL")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";

  // Identifica o chamador e confirma que é administrador.
  const userClient = createClient(URL, ANON, { global: { headers: { Authorization: authHeader } } });
  const { data: userData } = await userClient.auth.getUser();
  const caller = userData?.user;
  if (!caller) return json({ error: "não autenticado" }, 401);

  const admin = createClient(URL, SERVICE);
  const { data: prof } = await admin.from("profiles").select("role").eq("id", caller.id).single();
  if ((prof as { role?: string } | null)?.role !== "admin") return json({ error: "acesso restrito a administradores" }, 403);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* vazio */ }
  const action = body.action as string;

  try {
    if (action === "create") {
      const { email, password, full_name, role } = body as { email: string; password: string; full_name: string; role: string };
      if (!email || !password) return json({ error: "e-mail e senha são obrigatórios" }, 400);
      const { data: created, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { full_name },
      });
      if (error) return json({ error: error.message }, 400);
      const uid = created.user!.id;
      // O trigger cria o profile; ajusta papel/nome/status.
      await admin.from("profiles").update({ role, full_name: full_name || email, active: true } as never).eq("id", uid);
      return json({ ok: true, id: uid });
    }

    if (action === "update") {
      const { id, role, active, full_name } = body as { id: string; role?: string; active?: boolean; full_name?: string };
      const patch: Record<string, unknown> = {};
      if (role !== undefined) patch.role = role;
      if (active !== undefined) patch.active = active;
      if (full_name !== undefined) patch.full_name = full_name;
      const { error } = await admin.from("profiles").update(patch as never).eq("id", id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === "password") {
      const { id, password } = body as { id: string; password: string };
      if (!password) return json({ error: "senha obrigatória" }, 400);
      const { error } = await admin.auth.admin.updateUserById(id, { password });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === "delete") {
      const { id } = body as { id: string };
      if (id === caller.id) return json({ error: "você não pode excluir o próprio usuário" }, 400);
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) return json({ error: error.message }, 400);
      await admin.from("profiles").delete().eq("id", id);
      return json({ ok: true });
    }

    return json({ error: "ação inválida" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
