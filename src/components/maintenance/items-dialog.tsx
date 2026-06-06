import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/shared/field";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useMaintenanceItems,
  useAddMaintenanceItem,
  useDeleteMaintenanceItem,
} from "@/hooks/use-maintenance-items";
import { useCanWrite } from "@/hooks/use-can-write";
import { GRUPO_DESPESA } from "@/lib/options";
import { formatCurrency } from "@/lib/format";

export function MaintenanceItemsDialog({
  maintenanceId,
  onClose,
}: {
  maintenanceId: string | null;
  onClose: () => void;
}) {
  const { data: items = [] } = useMaintenanceItems(maintenanceId);
  const add = useAddMaintenanceItem(maintenanceId ?? "");
  const del = useDeleteMaintenanceItem(maintenanceId ?? "");
  const canWrite = useCanWrite("maintenances");

  const [grupo, setGrupo] = useState("Preventiva (Peças/M.O)");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [desconto, setDesconto] = useState("");

  const total = items.reduce((s, i) => s + (Number(i.valor) - Number(i.desconto)), 0);

  function addItem() {
    if (!descricao || !valor) return;
    add.mutate(
      { grupo_despesa: grupo, descricao, valor: Number(valor), desconto: Number(desconto || 0) },
      {
        onSuccess: () => {
          setDescricao("");
          setValor("");
          setDesconto("");
        },
      }
    );
  }

  return (
    <Dialog open={!!maintenanceId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Itens da Ordem de Serviço</DialogTitle>
        </DialogHeader>

        {canWrite && (
          <div className="grid items-end gap-2 sm:grid-cols-[1.2fr_1.5fr_0.8fr_0.8fr_auto]">
            <Field label="Grupo de despesa">
              <Select value={grupo} onValueChange={setGrupo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GRUPO_DESPESA.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Descrição">
              <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
            </Field>
            <Field label="Valor">
              <Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} />
            </Field>
            <Field label="Desconto">
              <Input type="number" step="0.01" value={desconto} onChange={(e) => setDesconto(e.target.value)} />
            </Field>
            <Button type="button" onClick={addItem} disabled={add.isPending}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Grupo</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Desconto</TableHead>
                <TableHead className="text-right">Total</TableHead>
                {canWrite && <TableHead className="w-10"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canWrite ? 6 : 5} className="text-center text-sm text-muted-foreground">
                    Nenhum item lançado
                  </TableCell>
                </TableRow>
              ) : (
                items.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="text-xs">{i.grupo_despesa}</TableCell>
                    <TableCell>{i.descricao}</TableCell>
                    <TableCell className="text-right">{formatCurrency(i.valor)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(i.desconto)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(i.valor - i.desconto)}</TableCell>
                    {canWrite && (
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => del.mutate(i.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <div className="flex justify-end text-sm">
          <span className="font-semibold">Total da OS: {formatCurrency(total)}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
