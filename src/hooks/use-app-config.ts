import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

export type AppConfig = Record<string, string>;

export const CONFIG_DEFAULTS: AppConfig = {
  empresa_nome: "VIP CARS",
  laudo_whatsapp_msg: "Olá {nome}! Segue o laudo da vistoria do veículo {placa} ({tipo}).\n\nLaudo: {link}\n\n{empresa}",
  laudo_email_assunto: "Laudo de vistoria ({tipo}) — {placa}",
  laudo_email_corpo: "Olá {nome},\n\nSegue em anexo o laudo da vistoria do veículo {placa} ({tipo}).\n\nAtenciosamente,\n{empresa}",
};

/** Lê todas as configurações (com fallback para os padrões). */
export function useAppConfig() {
  return useQuery<AppConfig>({
    queryKey: ["app_config"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_config").select("chave, valor");
      if (error) throw error;
      const map: AppConfig = { ...CONFIG_DEFAULTS };
      for (const r of (data ?? []) as { chave: string; valor: string | null }[]) {
        if (r.valor != null) map[r.chave] = r.valor;
      }
      return map;
    },
  });
}

/** Salva (upsert) várias configurações — restrito a administradores (RLS). */
export function useUpdateAppConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entries: AppConfig) => {
      const rows = Object.entries(entries).map(([chave, valor]) => ({ chave, valor, updated_at: new Date().toISOString() }));
      const { error } = await supabase.from("app_config").upsert(rows as never, { onConflict: "chave" });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["app_config"] }); toast.success("Configurações salvas"); },
    onError: (e: Error) => toast.error("Erro ao salvar: " + e.message),
  });
}

/** Substitui as variáveis {nome} {placa} {tipo} {link} {empresa} no template. */
export function aplicarTemplate(tpl: string, vars: Record<string, string>): string {
  return (tpl ?? "").replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? "");
}
