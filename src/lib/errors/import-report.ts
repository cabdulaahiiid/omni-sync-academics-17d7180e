import * as XLSX from "xlsx";

export type ImportRowError = {
  row: number;
  column?: string;
  value?: string;
  reason: string;
};

/** Downloads the skipped rows with a problem/fix column so the file can be corrected. */
export function downloadImportErrorReport(
  fileName: string,
  errors: ImportRowError[],
  originalRows?: Record<string, unknown>[],
) {
  const rows = errors.map((e) => ({
    row_number: e.row,
    column: e.column ?? "",
    value_entered: e.value ?? "",
    problem: e.reason,
    fix: "Correct this cell in your original file, then upload the file again.",
    ...(originalRows?.[e.row - 1] ?? {}),
  }));
  const sheet = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Errors");
  XLSX.writeFile(wb, fileName);
}