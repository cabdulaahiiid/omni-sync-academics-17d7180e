import type { ReportResult } from "@/lib/reports.functions";

/** CSV ------------------------------------------------------------------ */
function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function reportToCsv(r: ReportResult): string {
  const head = r.columns.map((c) => c.label).join(",");
  const body = r.rows
    .map((row) => r.columns.map((c) => csvEscape(row[c.key])).join(","))
    .join("\n");
  return `${head}\n${body}`;
}

function triggerDownload(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
}

export function downloadCsv(r: ReportResult) {
  const csv = reportToCsv(r);
  triggerDownload(`${r.key}_${r.generated_at.slice(0, 10)}.csv`, new Blob([csv], { type: "text/csv;charset=utf-8" }));
}

/** XLSX ----------------------------------------------------------------- */
export async function downloadXlsx(r: ReportResult) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

  // Main sheet
  const aoa: (string | number)[][] = [r.columns.map((c) => c.label)];
  for (const row of r.rows) {
    aoa.push(r.columns.map((c) => (row[c.key] as string | number) ?? ""));
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = r.columns.map((c) => ({
    wch: Math.max(c.label.length + 2, ...r.rows.map((row) => String(row[c.key] ?? "").length + 2)),
  }));
  ws["!freeze"] = { xSplit: 0, ySplit: 1 } as unknown as never;
  XLSX.utils.book_append_sheet(wb, ws, "Report");

  // Filters + summary sheet
  const meta: (string | number)[][] = [["Report", r.title], ["Generated", r.generated_at]];
  for (const [k, v] of Object.entries(r.filters)) {
    if (v !== undefined && v !== "") meta.push([`Filter: ${k}`, String(v)]);
  }
  if (r.summary?.length) {
    meta.push([], ["Summary"]);
    for (const s of r.summary) meta.push([s.label, s.value]);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(meta), "Meta");

  XLSX.writeFile(wb, `${r.key}_${r.generated_at.slice(0, 10)}.xlsx`);
}

/** PDF ------------------------------------------------------------------ */
export async function downloadPdf(r: ReportResult, institutionName = "Somali Regional State Jigjiga Polytechnic College") {
  const [{ default: jsPDF }, autoTableMod] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const autoTable = (autoTableMod as { default: (doc: unknown, opts: unknown) => void }).default;

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFontSize(14);
  doc.text(institutionName, 40, 36);
  doc.setFontSize(11);
  doc.text(r.title, 40, 54);
  doc.setFontSize(9);
  doc.setTextColor(120);
  const filterText = Object.entries(r.filters)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${k}=${v}`)
    .join("  ·  ");
  if (filterText) doc.text(`Filters: ${filterText}`, 40, 70);
  doc.text(`Generated ${new Date(r.generated_at).toLocaleString()}`, pageW - 40, 36, { align: "right" });

  autoTable(doc, {
    startY: 84,
    head: [r.columns.map((c) => c.label)],
    body: r.rows.map((row) => r.columns.map((c) => String(row[c.key] ?? ""))),
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [10, 75, 168], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 247, 252] },
    margin: { left: 40, right: 40 },
  });

  if (r.summary?.length) {
    const finalY = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 90) + 16;
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text("Summary", 40, finalY);
    autoTable(doc, {
      startY: finalY + 6,
      body: r.summary.map((s) => [s.label, String(s.value)]),
      styles: { fontSize: 8, cellPadding: 4 },
      theme: "plain",
      margin: { left: 40, right: 40 },
    });
  }

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`Page ${i} of ${totalPages}`, pageW - 40, doc.internal.pageSize.getHeight() - 20, { align: "right" });
  }

  doc.save(`${r.key}_${r.generated_at.slice(0, 10)}.pdf`);
}

export function openPrintView(reportKey: string, currentSearch: string) {
  const qs = currentSearch.startsWith("?") ? currentSearch : currentSearch ? `?${currentSearch}` : "";
  window.open(`/print/${reportKey}${qs}`, "_blank", "noopener");
}
