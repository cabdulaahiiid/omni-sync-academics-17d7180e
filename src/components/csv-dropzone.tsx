import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { UploadCloud, FileText, X } from "lucide-react";
import { canonicalizeRow, normalizeHeader } from "@/lib/import-headers";

export type ParsedRow = Record<string, string>;

export function parseCsv(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const splitLine = (l: string) => {
    const out: string[] = [];
    let cur = "", q = false;
    for (const ch of l) {
      if (ch === '"') { q = !q; continue; }
      if (ch === "," && !q) { out.push(cur); cur = ""; continue; }
      cur += ch;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };
  const headers = splitLine(lines.shift()!);
  return lines.map((line) => {
    const cols = splitLine(line);
    const row: ParsedRow = {};
    headers.forEach((h, i) => { row[h] = cols[i] ?? ""; });
    return row;
  });
}

export function CsvDropzone({
  onParsed,
  helpText,
  sampleHeaders,
  requiredHeaders,
  onFileError,
}: {
  onParsed: (rows: ParsedRow[], fileName: string) => void;
  helpText?: string;
  sampleHeaders?: string[];
  /** Headers that must be present; the file is rejected with an exact message if any is missing. */
  requiredHeaders?: string[];
  /** Called with a problem/solution message when the file cannot be used. */
  onFileError?: (message: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [name, setName] = useState<string | null>(null);

  function handleFile(file: File) {
    const fail = (message: string) => {
      setName(null);
      onFileError?.(message);
    };
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const isExcel = ext === "xlsx" || ext === "xls" || ext === "xlsm";
    if (!isExcel && ext !== "csv" && ext !== "txt") {
      fail(
        `"${file.name}" is a .${ext} file. This upload accepts Excel (.xlsx, .xls) or CSV files. Fix: download the sample template above, paste your data into it, and upload that file.`,
      );
      return;
    }
    if (file.size === 0) {
      fail(`"${file.name}" is empty (0 bytes). Fix: add your rows under the header line, save the file, and upload it again.`);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      fail(`"${file.name}" is larger than 10 MB. Fix: split it into batches of about 1,000 rows and upload them one after another.`);
      return;
    }
    setName(file.name);

    const finish = (rows: ParsedRow[]) => {
      if (rows.length === 0) {
        fail(`"${file.name}" has a header row but no data rows. Fix: add at least one record below the header and upload again.`);
        return;
      }
      const headers = Object.keys(rows[0]);
      const missing = (requiredHeaders ?? []).filter((h) => !headers.includes(normalizeHeader(h)));
      if (missing.length) {
        fail(
          `The file is missing the column${missing.length > 1 ? "s" : ""} ${missing.map((m) => `"${m}"`).join(", ")}. Found: ${headers.join(", ")}. Fix: download the template, copy your data into it without renaming any header, then upload again.`,
        );
        return;
      }
      onParsed(rows, file.name);
    };

    const reader = new FileReader();
    reader.onerror = () => fail(`"${file.name}" could not be read. Fix: close it in Excel, then upload it again.`);
    if (isExcel) {
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target?.result as ArrayBuffer, { type: "array" });
          const sheetName = wb.SheetNames[0];
          if (!sheetName) {
            fail(`"${file.name}" has no worksheets. Fix: download the template and paste your rows into its data sheet.`);
            return;
          }
          const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName], {
            defval: "",
            raw: false,
          });
          const rows: ParsedRow[] = raw.map((r) => canonicalizeRow(r));
          finish(rows.filter((r) => Object.values(r).some((v) => v !== "")));
        } catch {
          fail(`"${file.name}" could not be opened as an Excel workbook. Fix: re-save it as .xlsx from Excel, or use the sample template, then upload again.`);
        }
      };
      reader.readAsArrayBuffer(file);
      return;
    }
    reader.onload = (e) => {
      const rows = parseCsv(String(e.target?.result ?? "")).map((r) => canonicalizeRow(r));
      finish(rows);
    };
    reader.readAsText(file);
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault(); setOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleFile(file);
      }}
      className={`rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${over ? "border-primary bg-primary/5" : "border-muted-foreground/30"}`}
    >
      <UploadCloud className="mx-auto h-8 w-8 text-muted-foreground" />
      <p className="mt-2 text-sm font-medium">Drag and drop an Excel (.xlsx) or CSV file, or click to select</p>
      {helpText && <p className="mt-1 text-xs text-muted-foreground">{helpText}</p>}
      {sampleHeaders && (
        <p className="mt-2 font-mono text-[11px] text-muted-foreground">{sampleHeaders.join(",")}</p>
      )}
      <input
        ref={ref}
        type="file"
        accept=".xlsx,.xls,.xlsm,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
      <div className="mt-3 flex items-center justify-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => ref.current?.click()}>Choose file</Button>
        {name && (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs">
            <FileText className="h-3 w-3" /> {name}
            <button onClick={(e) => { e.stopPropagation(); setName(null); }}><X className="h-3 w-3" /></button>
          </span>
        )}
      </div>
    </div>
  );
}