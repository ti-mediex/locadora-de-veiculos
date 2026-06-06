import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, ShieldAlert, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { useCanWrite } from "@/hooks/use-can-write";
import { whatsappLink } from "@/lib/whatsapp";
import { formatCurrency, formatDate } from "@/lib/format";

interface SinistroCard {
  id: string;
  status: string;
  descricao: string;
  motivo: string | null;
  data: string;
  data_evento: string | null;
  valor_orcamento: number | null;
  indenizacao_seguradora: number | null;
  vehicles: { placa: string } | null;
  suppliers: { nome_fantasia: string; telefone: string | null } | null;
}

const COLUMNS = [
  { value: "aberta", label: "Aberta", color: "hsl(38 92% 55%)" },
  { value: "em_andamento", label: "Em andamento", color: "hsl(211 90% 60%)" },
  { value: "resolvida", label: "Resolvida", color: "hsl(142 71% 40%)" },
];

export default function SinistrosKanbanPage() {
  const qc = useQueryClient();
  const canWrite = useCanWrite("occurrences");
  const { data: cards = [] } = useQuery<SinistroCard[]>({
    queryKey: ["occurrences", "sinistros-kanban"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("occurrences")
        .select("id, status, descricao, motivo:tipo, data, data_evento, valor_orcamento, indenizacao_seguradora, vehicles(placa), suppliers(nome_fantasia, telefone)")
        .eq("tipo", "sinistro")
        .neq("status", "cancelada")
        .order("data", { ascending: false });
      if (error) throw error;
      return (data ?? []) as never;
    },
  });

  const [busy, setBusy] = useState(false);
  const grouped = useMemo(() => {
    const m = new Map<string, SinistroCard[]>();
    for (const c of COLUMNS) m.set(c.value, []);
    for (const c of cards) (m.get(c.status) ?? m.set(c.status, []).get(c.status)!).push(c);
    return m;
  }, [cards]);

  async function advance(id: string, status: string) {
    const idx = COLUMNS.findIndex((c) => c.value === status);
    if (idx < 0 || idx >= COLUMNS.length - 1) return;
    setBusy(true);
    const { error } = await supabase.from("occurrences").update({ status: COLUMNS[idx + 1].value }).eq("id", id);
    setBusy(false);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["occurrences"] });
    toast.success("Sinistro atualizado");
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard de Sinistro" description="Acompanhamento dos sinistros da frota" />
      <div className="flex gap-3 overflow-x-auto pb-4">
        {COLUMNS.map((col) => {
          const list = grouped.get(col.value) ?? [];
          return (
            <div key={col.value} className="w-80 shrink-0">
              <div className="mb-2 flex items-center justify-between rounded-md px-2 py-1.5" style={{ background: col.color + "22" }}>
                <span className="text-sm font-semibold" style={{ color: col.color }}>{col.label}</span>
                <Badge variant="muted">{list.length}</Badge>
              </div>
              <div className="space-y-2">
                {list.map((c) => (
                  <div key={c.id} className="rounded-lg border bg-card p-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-semibold">{c.vehicles?.placa ?? "—"}</span>
                      <span className="text-xs text-muted-foreground">{formatDate(c.data_evento ?? c.data)}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{c.descricao}</p>
                    <div className="mt-1 text-xs">
                      Orçamento: {formatCurrency(c.valor_orcamento ?? 0)} · Seguro: {formatCurrency(c.indenizacao_seguradora ?? 0)}
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{c.suppliers?.nome_fantasia ?? "Sem fornecedor"}</span>
                      <div className="flex gap-1">
                        {c.suppliers?.telefone && (
                          <Button size="icon" variant="ghost" title="Acionar fornecedor" asChild>
                            <a href={whatsappLink(c.suppliers.telefone, `Sinistro do veículo ${c.vehicles?.placa ?? ""}: ${c.descricao}`)} target="_blank" rel="noreferrer">
                              <MessageCircle className="h-4 w-4 text-success" />
                            </a>
                          </Button>
                        )}
                        {canWrite && col.value !== "resolvida" && (
                          <Button size="icon" variant="ghost" title="Avançar" disabled={busy} onClick={() => advance(c.id, c.status)}>
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {list.length === 0 && (
                  <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                    <ShieldAlert className="mx-auto mb-1 h-4 w-4" /> vazio
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
