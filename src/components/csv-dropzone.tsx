import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { UploadCloud, FileText, X } from "lucide-react";

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
    if (ext !== "csv" && ext !== "txt") {
      fail(
        `"${file.name}" is a .${ext} file, but this upload accepts CSV only. Fix: open the file, choose File → Save As → CSV, then upload the .csv version (or use the template button above).`,
      );
      return;
    }
    if (file.size === 0) {
      fail(`"${file.name}" is empty (0 bytes). Fix: add your rows under the header line, save the file, and upload it again.`);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      fail(`"${file.name}" is larger than 5 MB. Fix: split it into batches of about 1,000 rows and upload them one after another.`);
      return;
    }
    setName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = String(e.target?.result ?? "");
      const rows = parseCsv(text);
      if (rows.length === 0) {
        fail(`"${file.name}" has a header row but no data rows. Fix: add at least one record below the header and upload again.`);
        return;
      }
      const headers = Object.keys(rows[0]).map((h) => h.trim().toLowerCase());
      const missing = (requiredHeaders ?? []).filter((h) => !headers.includes(h.toLowerCase()));
      if (missing.length) {
        fail(
          `The file is missing the column${missing.length > 1 ? "s" : ""} ${missing.map((m) => `"${m}"`).join(", ")}. Found: ${headers.join(", ")}. Fix: download the template, copy your data into it without renaming any header, then upload again.`,
        );
        return;
      }
      onParsed(rows, file.name);
    };
    reader.onerror = () => fail(`"${file.name}" could not be read. Fix: close it in Excel, then upload it again.`);
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
      <p className="mt-2 text-sm font-medium">Drag and drop a CSV file, or click to select</p>
      {helpText && <p className="mt-1 text-xs text-muted-foreground">{helpText}</p>}
      {sampleHeaders && (
        <p className="mt-2 font-mono text-[11px] text-muted-foreground">{sampleHeaders.join(",")}</p>
      )}
      <input
        ref={ref}
        type="file"
        accept=".csv,text/csv"
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