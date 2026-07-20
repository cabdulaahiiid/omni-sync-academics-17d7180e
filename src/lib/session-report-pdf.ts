import collegeLogo from "@/assets/college-logo.jpg.asset.json";
import { COLLEGE_FULL_NAME, COLLEGE_SHORT_NAME, COLLEGE_TAGLINE } from "@/components/erp/brand";

const BRAND = {
  institution: COLLEGE_FULL_NAME,
  short: COLLEGE_SHORT_NAME,
  tagline: COLLEGE_TAGLINE,
  primary: [10, 75, 168] as [number, number, number],
  primaryDark: [6, 50, 120] as [number, number, number],
  accentBg: [245, 247, 252] as [number, number, number],
};

let _logoDataUrl: string | null = null;
async function getLogoDataUrl(): Promise<string | null> {
  if (_logoDataUrl) return _logoDataUrl;
  try {
    const res = await fetch(collegeLogo.url);
    const blob = await res.blob();
    _logoDataUrl = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
    return _logoDataUrl;
  } catch {
    return null;
  }
}

export type SessionReportInput = {
  schedule: {
    date?: string | null;
    start_time?: string | null;
    end_time?: string | null;
    module_code?: string | null;
    module_name?: string | null;
    mode?: string | null;
    checkin_at?: string | null;
    ended_at?: string | null;
    status?: string | null;
  };
  department?: { name?: string | null } | null;
  level?: { display_name?: string | null; name?: string | null } | null;
  section?: { name?: string | null } | null;
  venue?: { name?: string | null } | null;
  trainer?: { full_name?: string | null } | null;
  session_number?: number | null;
  target_sessions?: number | null;
  lesson_plan: string;
  learning_outcome: string;
  students: Array<{ id: string; full_name: string; registration_number: string }>;
  presence: Record<string, boolean>;
};

export async function generateSessionReportPdf(input: SessionReportInput): Promise<void> {
  const [{ default: jsPDF }, autoTableMod] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const autoTable = (autoTableMod as { default: (doc: unknown, opts: unknown) => void }).default;

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const logo = await getLogoDataUrl();

  const s = input.schedule;
  const presentCount = input.students.filter((st) => input.presence[st.id]).length;
  const absentCount = input.students.length - presentCount;
  const pct = input.students.length ? Math.round((presentCount / input.students.length) * 100) : 0;
  const generatedAt = new Date();

  const drawHeader = () => {
    doc.setFillColor(...BRAND.primary);
    doc.rect(0, 0, pageW, 56, "F");
    if (logo) {
      try { doc.addImage(logo, "JPEG", 24, 10, 36, 36); } catch { /* noop */ }
    }
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(BRAND.institution, 68, 26);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(BRAND.tagline, 68, 40);
    doc.setFontSize(9);
    doc.text(`Generated: ${generatedAt.toLocaleString()}`, pageW - 24, 26, { align: "right" });
    doc.text(`Trainer: ${input.trainer?.full_name ?? "—"}`, pageW - 24, 40, { align: "right" });
  };

  const drawFooter = (n: number, total: number) => {
    doc.setDrawColor(220);
    doc.setLineWidth(0.5);
    doc.line(24, pageH - 30, pageW - 24, pageH - 30);
    doc.setFontSize(8);
    doc.setTextColor(110, 110, 110);
    doc.text(`${BRAND.short} · TVET ERP · Session Report`, 24, pageH - 16);
    doc.text(`Page ${n} of ${total}`, pageW - 24, pageH - 16, { align: "right" });
  };

  drawHeader();

  // Title
  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("Session Report", 24, 82);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90, 90, 90);
  doc.text(
    `${s.module_name ?? ""} (${s.module_code ?? "—"})  ·  ${s.date ?? ""}  ·  ${(s.start_time ?? "").slice(0, 5)}–${(s.end_time ?? "").slice(0, 5)}`,
    24,
    98,
  );

  // Overview table
  autoTable(doc, {
    startY: 116,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: BRAND.primaryDark, textColor: 255 },
    head: [["Field", "Value"]],
    body: [
      ["Department", input.department?.name ?? "—"],
      ["Level", input.level?.display_name ?? input.level?.name ?? "—"],
      ["Section", input.section?.name ?? "—"],
      ["Venue", input.venue?.name ?? "—"],
      ["Mode", s.mode ?? "—"],
      ["Session #", input.session_number != null ? `${input.session_number}${input.target_sessions ? " of " + input.target_sessions : ""}` : "—"],
      ["Check-in", s.checkin_at ? new Date(s.checkin_at).toLocaleString() : "—"],
      ["Ended", s.ended_at ? new Date(s.ended_at).toLocaleString() : "—"],
      ["Status", s.status ?? "—"],
    ],
    margin: { left: 24, right: 24 },
  });

  // Summary
  let y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 116) + 16;
  autoTable(doc, {
    startY: y,
    theme: "grid",
    styles: { fontSize: 10, cellPadding: 6, halign: "center" },
    headStyles: { fillColor: BRAND.primary, textColor: 255 },
    head: [["Present", "Absent", "Total", "Attendance %"]],
    body: [[String(presentCount), String(absentCount), String(input.students.length), `${pct}%`]],
    margin: { left: 24, right: 24 },
  });

  // Lesson plan + outcome
  y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 16;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20);
  doc.text("Lesson Plan", 24, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(60);
  const planLines = doc.splitTextToSize(input.lesson_plan || "—", pageW - 48);
  doc.text(planLines, 24, y + 14);
  y = y + 14 + planLines.length * 11 + 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20);
  doc.text("Learning Outcome", 24, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(60);
  const outLines = doc.splitTextToSize(input.learning_outcome || "—", pageW - 48);
  doc.text(outLines, 24, y + 14);
  y = y + 14 + outLines.length * 11 + 10;

  // Attendance table
  autoTable(doc, {
    startY: y,
    theme: "striped",
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: BRAND.primary, textColor: 255 },
    alternateRowStyles: { fillColor: BRAND.accentBg },
    head: [["#", "Registration", "Student", "Status"]],
    body: input.students.map((st, i) => [
      String(i + 1),
      st.registration_number ?? "—",
      st.full_name,
      input.presence[st.id] ? "Present" : "Absent",
    ]),
    columnStyles: { 0: { halign: "right", cellWidth: 30 }, 3: { halign: "center", cellWidth: 70 } },
    margin: { left: 24, right: 24, top: 60 },
    didDrawPage: () => drawHeader(),
  });

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    drawFooter(i, total);
  }

  const filename = `session_${s.module_code ?? "report"}_${s.date ?? ""}.pdf`;
  doc.save(filename);
}