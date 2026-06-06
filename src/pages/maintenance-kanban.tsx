import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, ListChecks, Wrench, MessageCircle } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { useCanWrite } from "@/hooks/use-can-write";
import { useUpdateMaintenanceStage } from "@/hooks/use-maintenance-items";
import { MaintenanceItemsDialog } from "@/components/maintenance/items-dialog";
import { MAINTENANCE_STAGE } from "@/lib/options";
import { whatsappLink } from "@/lib/whatsapp";
import { formatCurrency, formatDate } from "@/lib/format";

interface KanbanCard {
  id: string;
  etapa: string;
  motivo: string | null;
  descricao: string;
  oficina: string | null;
  valor: number;
  agendamento: string | null;
  data: string;
  vehicles: { placa: string } | null;
  suppliers: { nome_fantasia: string; telefone: string | null } | null;
}

const ORDER = MAINTENANCE_STAGE.filter((s) => s.value !== "cancelada");

function useKanban() {
  return useQuery<KanbanCard[]>({
    queryKey: ["maintenances", "kanban"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenances")
        .select("id, etapa, motivo, descricao, oficina, valor, agendamento, data, vehicles(placa), suppliers(nome_fantasia, telefone)")
        .neq("etapa", "cancelada")
        .order("data", { ascending: false });
      if (error) throw error;
      return (data ?? []) as never;
    },
  });
}

export default function MaintenanceKanbanPage() {
  const { data: cards = [] } = useKanban();
  const updateStage = useUpdateMaintenanceStage();
  const canWrite = useCanWrite("maintenances");
  const [itemsFor, setItemsFor] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, KanbanCard[]>();
    for (const s of ORDER) map.set(s.value, []);
    for (const c of cards) {
      if (!map.has(c.etapa)) map.set(c.etapa, []);
      map.get(c.etapa)!.push(c);
    }
    return map;
  }, [cards]);

  function nextStage(etapa: string): string | null {
    const idx = ORDER.findIndex((s) => s.value === etapa);
    if (idx < 0 || idx >= ORDER.length - 1) return null;
    return ORDER[idx + 1].value;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard de Manutenção"
        description="Pipeline de ordens de serviço por etapa (estilo Blue Fleet)"
      />

      <div className="flex gap-3 overflow-x-auto pb-4">
        {ORDER.map((stage) => {
          const list = grouped.get(stage.value) ?? [];
          return (
            <div key={stage.value} className="w-72 shrink-0">
              <div className="mb-2 flex items-center justify-between rounded-md px-2 py-1.5" style={{ background: stage.color + "22" }}>
                <span className="text-sm font-semibold" style={{ color: stage.color }}>{stage.label}</span>
                <Badge variant="muted">{list.length}</Badge>
              </div>
              <div className="space-y-2">
                {list.map((c) => {
                  const next = nextStage(c.etapa);
                  return (
                    <div key={c.id} className="rounded-lg border bg-card p-3 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm font-semibold">{c.vehicles?.placa ?? "—"}</span>
                        <span className="text-xs text-muted-foreground">{formatDate(c.agendamento ?? c.data)}</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{c.motivo ? `${c.motivo} — ` : ""}{c.descricao}</p>
                      <div className="mt-1 text-xs text-muted-foreground">{c.suppliers?.nome_fantasia ?? c.oficina ?? "Sem fornecedor"}</div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-sm font-medium">{formatCurrency(c.valor)}</span>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" title="Itens da OS" onClick={() => setItemsFor(c.id)}>
                            <ListChecks className="h-4 w-4" />
                          </Button>
                          {c.suppliers?.telefone && (
                            <Button variant="ghost" size="icon" title="Acionar fornecedor" asChild>
                              <a
                                href={whatsappLink(
                                  c.suppliers.telefone,
                                  `Olá! Referente à OS do veículo ${c.vehicles?.placa ?? ""}: ${c.motivo ? c.motivo + " - " : ""}${c.descricao}. Poderia enviar o orçamento?`
                                )}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <MessageCircle className="h-4 w-4 text-success" />
                              </a>
                            </Button>
                          )}
                          {canWrite && next && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title={`Avançar para ${ORDER.find((s) => s.value === next)?.label}`}
                              onClick={() => updateStage.mutate({ id: c.id, etapa: next })}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {list.length === 0 && (
                  <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                    <Wrench className="mx-auto mb-1 h-4 w-4" /> vazio
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <MaintenanceItemsDialog maintenanceId={itemsFor} onClose={() => setItemsFor(null)} />
    </div>
  );
}
