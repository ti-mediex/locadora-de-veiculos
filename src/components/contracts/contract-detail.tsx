import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/lib/supabase";
import { formatCurrency, formatDate } from "@/lib/format";
import type { ContractWithRefs } from "@/hooks/use-contracts";

function useContract360(id: string | null) {
  return useQuery({
    queryKey: ["contract360", id],
    enabled: !!id,
    queryFn: async () => {
      const [rec, occ, insp] = await Promise.all([
        supabase.from("receivables").select("*").eq("contract_id", id).order("vencimento"),
        supabase.from("occurrences").select("*").eq("contract_id", id).order("data", { ascending: false }),
        supabase.from("inspections").select("*").eq("contract_id", id).order("data", { ascending: false }),
      ]);
      return {
        receivables: (rec.data ?? []) as { id: string; competencia: string | null; vencimento: string; valor: number; status: string }[],
        occurrences: (occ.data ?? []) as { id: string; tipo: string; descricao: string; data: string; status: string }[],
        inspections: (insp.data ?? []) as { id: string; tipo: string; data: string; km: number | null }[],
      };
    },
  });
}

export function ContractDetailDialog({
  contract,
  onClose,
}: {
  contract: ContractWithRefs | null;
  onClose: () => void;
}) {
  const { data } = useContract360(contract?.id ?? null);

  return (
    <Dialog open={!!contract} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            Contrato {contract?.numero} — {contract?.renters?.nome}
          </DialogTitle>
        </DialogHeader>
        {contract && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 rounded-md bg-muted p-3 text-sm sm:grid-cols-4">
              <div><div className="text-muted-foreground">Veículo</div><div className="font-medium">{contract.vehicles?.placa}</div></div>
              <div><div className="text-muted-foreground">Aluguel</div><div className="font-medium">{formatCurrency(contract.valor_aluguel)}</div></div>
              <div><div className="text-muted-foreground">Ciclo</div><div className="font-medium capitalize">{contract.ciclo_cobranca}</div></div>
              <div><div className="text-muted-foreground">Status</div><StatusBadge status={contract.status} /></div>
            </div>

            <Tabs defaultValue="receivables">
              <TabsList>
                <TabsTrigger value="receivables">Cobranças ({data?.receivables.length ?? 0})</TabsTrigger>
                <TabsTrigger value="occurrences">Ocorrências ({data?.occurrences.length ?? 0})</TabsTrigger>
                <TabsTrigger value="inspections">Vistorias ({data?.inspections.length ?? 0})</TabsTrigger>
              </TabsList>

              <TabsContent value="receivables">
                <div className="max-h-72 overflow-auto rounded-md border">
                  <Table>
                    <TableHeader><TableRow><TableHead>Competência</TableHead><TableHead>Vencimento</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {(data?.receivables ?? []).map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>{r.competencia ?? "—"}</TableCell>
                          <TableCell>{formatDate(r.vencimento)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(r.valor)}</TableCell>
                          <TableCell><StatusBadge status={r.status} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="occurrences">
                <div className="max-h-72 overflow-auto rounded-md border">
                  <Table>
                    <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Tipo</TableHead><TableHead>Descrição</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {(data?.occurrences ?? []).map((o) => (
                        <TableRow key={o.id}>
                          <TableCell>{formatDate(o.data)}</TableCell>
                          <TableCell className="capitalize">{o.tipo}</TableCell>
                          <TableCell>{o.descricao}</TableCell>
                          <TableCell><StatusBadge status={o.status} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="inspections">
                <div className="max-h-72 overflow-auto rounded-md border">
                  <Table>
                    <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Tipo</TableHead><TableHead className="text-right">KM</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {(data?.inspections ?? []).map((i) => (
                        <TableRow key={i.id}>
                          <TableCell>{formatDate(i.data)}</TableCell>
                          <TableCell><StatusBadge status={i.tipo} /></TableCell>
                          <TableCell className="text-right">{i.km ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
