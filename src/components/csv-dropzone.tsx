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
}: {
  onParsed: (rows: ParsedRow[], fileName: string) => void;
  helpText?: string;
  sampleHeaders?: string[];
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [name, setName] = useState<string | null>(null);

  function handleFile(file: File) {
    setName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = String(e.target?.result ?? "");
      onParsed(parseCsv(text), file.name);
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