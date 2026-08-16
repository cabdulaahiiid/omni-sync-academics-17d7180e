import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type PhoneIgnore = {
  /** profile id to ignore (the user being edited) */
  profileId?: string | null;
  /** trainer_registry id to ignore */
  trainerId?: string | null;
  /** student id to ignore */
  studentId?: string | null;
};

const LABEL: Record<string, string> = {
  staff: "staff member",
  trainer: "trainer",
  student: "student",
};

/**
 * Ensures a normalized phone number is not already used by a staff profile,
 * a trainer registry record, or a student. Throws a user-friendly error.
 */
export async function assertPhoneAvailable(phone: string | null, ignore: PhoneIgnore = {}) {
  if (!phone) return;
  const [{ data: profiles }, { data: trainers }, { data: students }] = await Promise.all([
    supabaseAdmin.from("profiles").select("id, full_name").eq("phone", phone),
    supabaseAdmin.from("trainer_registry").select("id, full_name").eq("phone", phone),
    supabaseAdmin.from("students").select("id, full_name").eq("telephone", phone),
  ]);

  const hits: { kind: string; name: string }[] = [];
  for (const p of profiles ?? []) if (p.id !== ignore.profileId) hits.push({ kind: "staff", name: p.full_name });
  for (const t of trainers ?? []) if (t.id !== ignore.trainerId) hits.push({ kind: "trainer", name: t.full_name });
  for (const s of students ?? []) if (s.id !== ignore.studentId) hits.push({ kind: "student", name: s.full_name });

  if (hits.length) {
    const h = hits[0]!;
    throw new Error(
      `This telephone number (${phone}) is already used by the ${LABEL[h.kind]} ${h.name}. Please enter a different number.`,
    );
  }
}
