// app/src/lib/report-export.ts
import * as XLSX from 'xlsx';

export interface SheetRow {
  [col: string]: string | number | null;
}

/**
 * Export nhiều sheet vào 1 file .xlsx và tự download
 * @param sheets - Array of { name, rows }
 * @param filename - tên file không cần đuôi
 */
export function exportToExcel(
  sheets: Array<{ name: string; rows: SheetRow[] }>,
  filename: string
): void {
  const wb = XLSX.utils.book_new();

  for (const { name, rows } of sheets) {
    if (rows.length === 0) continue;
    const ws = XLSX.utils.json_to_sheet(rows);

    // Auto column width
    const cols = Object.keys(rows[0]);
    ws['!cols'] = cols.map((col) => ({
      wch: Math.max(
        col.length,
        ...rows.map((r) => String(r[col] ?? '').length)
      ) + 2,
    }));

    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  }

  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/** Format number cho Excel (null → '') */
export function fmtXlsx(v: number | null | undefined): number | string {
  if (v === null || v === undefined) return '';
  return v;
}
