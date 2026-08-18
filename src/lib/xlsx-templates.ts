import * as XLSX from "xlsx";

export type TemplateColumn = {
  name: string;
  required: boolean;
  type: string;
  allowed?: string;
  example: string;
  notes?: string;
};

export type TemplateSpec = {
  fileName: string;
  sheetName: string;
  columns: TemplateColumn[];
  examples: Record<string, string | number>[];
};

export function downloadXlsxTemplate(spec: TemplateSpec) {
  const headers = spec.columns.map((c) => c.name);
  const dataRows = spec.examples.map((ex) =>
    Object.fromEntries(headers.map((h) => [h, ex[h] ?? ""])),
  );
  const dataSheet = XLSX.utils.json_to_sheet(dataRows, { header: headers });

  const instructionRows = [
    ["Column", "Required", "Type", "Allowed values", "Example", "Notes"],
    ...spec.columns.map((c) => [
      c.name,
      c.required ? "Yes" : "No",
      c.type,
      c.allowed ?? "",
      c.example,
      c.notes ?? "",
    ]),
    [],
    ["Tips:"],
    ["• Keep the header row exactly as shown on the Data sheet."],
    ["• Do not rename, reorder, or add columns."],
    ["• Save as .xlsx and upload from the same screen."],
  ];
  const instr = XLSX.utils.aoa_to_sheet(instructionRows);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, dataSheet, spec.sheetName);
  XLSX.utils.book_append_sheet(wb, instr, "Instructions");
  XLSX.writeFile(wb, spec.fileName);
}

export const SEMESTER_TIMETABLE_TEMPLATE: TemplateSpec = {
  fileName: "semester-timetable-template.xlsx",
  sheetName: "Timetable",
  columns: [
    { name: "module_code", required: true, type: "text", example: "ICT-101", notes: "Must exist in Modules registry" },
    { name: "module_name", required: true, type: "text", example: "Intro to Computing" },
    { name: "trainer_name", required: true, type: "text", example: "Jane Doe", notes: "Must match a trainer in your department" },
    { name: "frequency", required: true, type: "integer", example: "1", notes: "Sessions per week (1-5)" },
    { name: "duration_min", required: true, type: "integer", example: "60", notes: "Minutes" },
    { name: "section_name", required: true, type: "text", example: "Section A" },
    { name: "level_name", required: true, type: "text", allowed: "I, II, III, IV, V", example: "I" },
    { name: "venue_name", required: true, type: "text", example: "Lab 1" },
    { name: "day", required: true, type: "text", allowed: "MON, TUE, WED, THU, FRI, SAT, SUN", example: "MON" },
    { name: "start_time", required: true, type: "time HH:MM", example: "08:00" },
  ],
  examples: [
    { module_code: "ICT-101", module_name: "Intro to Computing", trainer_name: "Jane Doe", frequency: 1, duration_min: 60, section_name: "Section A", level_name: "I", venue_name: "Lab 1", day: "MON", start_time: "08:00" },
    { module_code: "ICT-102", module_name: "Networks", trainer_name: "John Smith", frequency: 2, duration_min: 90, section_name: "Section A", level_name: "I", venue_name: "Lab 2", day: "WED", start_time: "10:00" },
  ],
};

export const STUDENTS_ROSTER_TEMPLATE: TemplateSpec = {
  fileName: "students-roster-template.xlsx",
  sheetName: "Students",
  columns: [
    { name: "student_id_code", required: false, type: "text (unique)", example: "ICT-26-0001", notes: "Leave blank to let the system generate it" },
    { name: "full_name", required: true, type: "text", example: "Abdi Mohammed Ali" },
    { name: "gender", required: false, type: "text", allowed: "Male, Female (M / F accepted)", example: "Female" },
    { name: "telephone", required: false, type: "phone (unique)", allowed: "09XXXXXXXX or 07XXXXXXXX", example: "0912345678" },
    { name: "level_name", required: false, type: "text", allowed: "Must match a level in your department", example: "I", notes: "Blank = use the Level selector on screen" },
    { name: "section_name", required: false, type: "text", allowed: "Must match a section under that level", example: "A", notes: "Blank = use the Section selector on screen" },
    { name: "parent_guardian_name", required: false, type: "text", example: "Ahmed Hassan" },
    { name: "parent_guardian_telephone", required: false, type: "phone", allowed: "09XXXXXXXX or 07XXXXXXXX", example: "0911223344" },
    { name: "parent_guardian_relationship", required: false, type: "text", allowed: "Father, Mother, Brother, Sister, Uncle, Aunt, Grandfather, Grandmother, Guardian, Other", example: "Father" },
  ],
  examples: [
    { student_id_code: "ICT-26-0001", full_name: "Abdi Mohammed Ali", gender: "Male", telephone: "0912345678", level_name: "I", section_name: "A", parent_guardian_name: "Ahmed Hassan", parent_guardian_telephone: "0911223344", parent_guardian_relationship: "Father" },
    { student_id_code: "ICT-26-0002", full_name: "Bahja Maxamad Cali", gender: "Female", telephone: "0912345679", level_name: "I", section_name: "A", parent_guardian_name: "Maxamad Cali", parent_guardian_telephone: "0911223345", parent_guardian_relationship: "Father" },
    { student_id_code: "", full_name: "Sagal Yusuf Omar", gender: "Female", telephone: "", level_name: "I", section_name: "A", parent_guardian_name: "", parent_guardian_telephone: "", parent_guardian_relationship: "" },
  ],
};

export const MODULES_TEMPLATE: TemplateSpec = {
  fileName: "modules-template.xlsx",
  sheetName: "Modules",
  columns: [
    { name: "code", required: true, type: "text", example: "ICT-101" },
    { name: "name", required: true, type: "text", example: "Intro to Computing" },
    { name: "department_name", required: true, type: "text", example: "ICT" },
    { name: "level_name", required: true, type: "text", example: "Level 1" },
    { name: "type", required: true, type: "text", allowed: "Theory, Practical, Both", example: "Both" },
    { name: "qualifications", required: false, type: "comma-separated", example: "ICT-101,ICT-100", notes: "Use commas to separate" },
    { name: "total_hours", required: true, type: "integer", example: "60" },
    { name: "total_sessions", required: true, type: "integer", example: "30" },
  ],
  examples: [
    { code: "ICT-101", name: "Intro to Computing", department_name: "ICT", level_name: "Level 1", type: "Both", qualifications: "ICT-101,ICT-100", total_hours: 60, total_sessions: 30 },
  ],
};