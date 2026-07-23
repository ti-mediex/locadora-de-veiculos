import { useMemo, useState } from "react";

export type SortDir = "asc" | "desc";

/** Compara dois valores (nulos por último; números e datas ISO ordenam natural). */
export function compareVals(a: unknown, b: unknown): number {
  const na = a === null || a === undefined || a === "";
  const nb = b === null || b === undefined || b === "";
  if (na && nb) return 0;
  if (na) return 1;   // nulos sempre depois
  if (nb) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") return a === b ? 0 : a ? -1 : 1;
  return String(a).localeCompare(String(b), "pt-BR", { numeric: true, sensitivity: "base" });
}

/** Ordenação de tabela por coluna, com direção alternável. */
export function useSort<T>(defaultKey: string, defaultDir: SortDir = "asc") {
  const [sortKey, setSortKey] = useState(defaultKey);
  const [sortDir, setSortDir] = useState<SortDir>(defaultDir);

  function toggle(k: string) {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("asc"); }
  }

  /** Ordena `rows` usando um acessor (row, colunaAtual) -> valor comparável. */
  function useSorted(rows: T[], accessor: (row: T, key: string) => unknown): T[] {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useMemo(() => {
      const arr = [...rows];
      arr.sort((a, b) => {
        const c = compareVals(accessor(a, sortKey), accessor(b, sortKey));
        return sortDir === "asc" ? c : -c;
      });
      return arr;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rows, sortKey, sortDir]);
  }

  return { sortKey, sortDir, toggle, useSorted };
}
