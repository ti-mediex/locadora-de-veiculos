import { ReactNode } from "react";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import type { SortDir } from "@/hooks/use-sort";

/** Cabeçalho de tabela clicável para ordenar, com seta de direção. */
export function SortableHead({
  sortKey, activeKey, dir, onSort, children, className, align,
}: {
  sortKey: string;
  activeKey: string;
  dir: SortDir;
  onSort: (k: string) => void;
  children: ReactNode;
  className?: string;
  align?: "left" | "right";
}) {
  const active = activeKey === sortKey;
  return (
    <TableHead className={`${align === "right" ? "text-right" : ""} ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 font-medium hover:text-foreground ${align === "right" ? "flex-row-reverse" : ""}`}
      >
        {children}
        {active ? (dir === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />) : <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />}
      </button>
    </TableHead>
  );
}
