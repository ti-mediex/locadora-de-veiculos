/** Exporta um array de objetos para CSV e dispara o download. */
export function exportToCsv<T extends object>(
  filename: string,
  rows: T[],
  columns?: { key: keyof T; label: string }[]
) {
  if (rows.length === 0) return;

  const cols =
    columns ??
    (Object.keys(rows[0]).map((k) => ({ key: k as keyof T, label: k })) as {
      key: keyof T;
      label: string;
    }[]);

  const header = cols.map((c) => `"${c.label}"`).join(";");
  const body = rows
    .map((row) =>
      cols
        .map((c) => {
          const v = row[c.key];
          const s = v === null || v === undefined ? "" : String(v);
          return `"${s.replace(/"/g, '""')}"`;
        })
        .join(";")
    )
    .join("\n");

  const csv = "﻿" + header + "\n" + body; // BOM para acentos no Excel
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
