/** Canonical header names accepted by the roster/contact importers. */
const ALIASES: Record<string, string> = {
  name: "full_name",
  full_name: "full_name",
  fullname: "full_name",
  student_name: "full_name",
  student_full_name: "full_name",

  id: "student_id_code",
  student_id: "student_id_code",
  student_id_code: "student_id_code",
  studentid: "student_id_code",
  registration_number: "student_id_code",
  registration_no: "student_id_code",
  reg_no: "student_id_code",

  guardian: "parent_guardian_name",
  guardian_name: "parent_guardian_name",
  parent_name: "parent_guardian_name",
  parent: "parent_guardian_name",
  parent_guardian: "parent_guardian_name",
  parent_guardian_name: "parent_guardian_name",

  guardian_telephone: "parent_guardian_telephone",
  guardian_phone: "parent_guardian_telephone",
  guardian_tel: "parent_guardian_telephone",
  guardian_mobile: "parent_guardian_telephone",
  parent_telephone: "parent_guardian_telephone",
  parent_phone: "parent_guardian_telephone",
  parent_guardian_telephone: "parent_guardian_telephone",
  parent_guardian_phone: "parent_guardian_telephone",

  relationship: "parent_guardian_relationship",
  guardian_relationship: "parent_guardian_relationship",
  parent_relationship: "parent_guardian_relationship",
  parent_guardian_relationship: "parent_guardian_relationship",

  phone: "telephone",
  tel: "telephone",
  mobile: "telephone",
  telephone: "telephone",
  telephone_number: "telephone",
  phone_number: "telephone",
  student_telephone: "telephone",
  student_phone: "telephone",

  sex: "gender",
  gender: "gender",

  level: "level_name",
  level_name: "level_name",
  section: "section_name",
  section_name: "section_name",
};

/** Trim, lowercase and collapse spaces/dashes/slashes to underscores, then apply aliases. */
export function normalizeHeader(raw: string): string {
  const key = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s\-/.]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return ALIASES[key] ?? key;
}

/** Map a raw parsed row onto canonical column names; first non-empty value wins on collisions. */
export function canonicalizeRow(row: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    const key = normalizeHeader(k);
    if (!key) continue;
    const value = String(v ?? "").trim();
    if (out[key] === undefined || out[key] === "") out[key] = value;
  }
  return out;
}
