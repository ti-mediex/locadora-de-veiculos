// Edge Function: envia o laudo de vistoria por e-mail (com PDF anexado) via Resend.
// Requer os secrets: RESEND_API_KEY (obrigatório) e RESEND_FROM (opcional).
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const RESEND = Deno.env.get("RESEND_API_KEY");
  if (!RESEND) {
    return json({ error: "Envio de e-mail não configurado. Configure o secret RESEND_API_KEY nas Edge Functions do Supabase." }, 400);
  }
  const from = Deno.env.get("RESEND_FROM") ?? "VIP CARS <onboarding@resend.dev>";

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* vazio */ }
  const { to, subject, filename, pdfBase64, html } = body as {
    to?: string; subject?: string; filename?: string; pdfBase64?: string; html?: string;
  };
  if (!to || !pdfBase64) return json({ error: "destinatário e PDF são obrigatórios" }, 400);

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [to],
      subject: subject ?? "Laudo de vistoria — VIP CARS",
      html: html ?? "<p>Segue em anexo o laudo da vistoria do seu veículo.</p>",
      attachments: [{ filename: filename ?? "laudo.pdf", content: pdfBase64 }],
    }),
  });
  const data = await r.json();
  if (!r.ok) return json({ error: data?.message ?? "falha no envio (Resend)" }, 400);
  return json({ ok: true, id: data?.id });
});
