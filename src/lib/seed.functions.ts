import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** MA-only seeder. Creates demo departments, DHs, trainers, students, modules, sections, schedules. */
export const seedDemoData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: role } = await context.supabase
      .from("user_roles").select("role").eq("user_id", context.userId).eq("role", "MA").maybeSingle();
    if (!role) throw new Error("Forbidden: Master Admin only");

    const created = { departments: 0, trainers: 0, dhs: 0, students: 0, modules: 0, sections: 0, schedules: 0, venues: 0 };

    const deptDefs = [
      { name: "ICT", description: "Information & Communication Technology" },
      { name: "Construction", description: "Building & Civil Works" },
      { name: "Hospitality", description: "Hotel & Tourism" },
    ];
    const deptIds: Record<string, string> = {};
    for (const d of deptDefs) {
      const { data } = await supabaseAdmin.from("departments")
        .upsert({ name: d.name, description: d.description }, { onConflict: "name" }).select().single();
      if (data) { deptIds[d.name] = data.id; created.departments++; }
    }

    // Levels
    const levelIds: Record<string, string> = {};
    for (const dept of Object.keys(deptIds)) {
      for (const lvl of ["L3", "L4", "L5"]) {
        const { data: existing } = await supabaseAdmin.from("levels")
          .select("id").eq("department_id", deptIds[dept]).eq("name", lvl).maybeSingle();
        if (existing) { levelIds[`${dept}-${lvl}`] = existing.id; continue; }
        const { data } = await supabaseAdmin.from("levels")
          .insert({ department_id: deptIds[dept], name: lvl }).select().single();
        if (data) levelIds[`${dept}-${lvl}`] = data.id;
      }
    }

    // Sections
    const sectionIds: string[] = [];
    for (const dept of Object.keys(deptIds)) {
      for (const lvl of ["L3", "L4"]) {
        for (const grp of ["A", "B"]) {
          const name = `${dept}-${lvl}-${grp}`;
          const { data: ex } = await supabaseAdmin.from("sections")
            .select("id").eq("department_id", deptIds[dept]).eq("level_id", levelIds[`${dept}-${lvl}`]).eq("name", name).maybeSingle();
          if (ex) { sectionIds.push(ex.id); continue; }
          const { data } = await supabaseAdmin.from("sections")
            .insert({ department_id: deptIds[dept], level_id: levelIds[`${dept}-${lvl}`], name }).select().single();
          if (data) { sectionIds.push(data.id); created.sections++; }
        }
      }
    }

    // Venues (Kigali coords)
    const venueDefs = [
      { name: "Lab A", type: "Workshop" as const, latitude: -1.9536, longitude: 30.0606, capacity: 30 },
      { name: "Lab B", type: "Workshop" as const, latitude: -1.9540, longitude: 30.0610, capacity: 30 },
      { name: "Room 101", type: "Classroom" as const, latitude: -1.9530, longitude: 30.0600, capacity: 40 },
    ];
    const venueIds: string[] = [];
    for (const v of venueDefs) {
      const { data: ex } = await supabaseAdmin.from("venues").select("id").eq("name", v.name).maybeSingle();
      if (ex) { venueIds.push(ex.id); continue; }
      const { data } = await supabaseAdmin.from("venues").insert({ ...v, geo_radius: 100 }).select().single();
      if (data) { venueIds.push(data.id); created.venues++; }
    }

    // Modules
    const moduleIds: { id: string; code: string; name: string; dept: string; level: string }[] = [];
    const modDefs = [
      { dept: "ICT", code: "ICT201", name: "Web Development", level: "L4" },
      { dept: "ICT", code: "ICT202", name: "Networking", level: "L4" },
      { dept: "Construction", code: "CON101", name: "Bricklaying", level: "L3" },
      { dept: "Hospitality", code: "HOS101", name: "Food Service", level: "L3" },
    ];
    for (const m of modDefs) {
      const { data: ex } = await supabaseAdmin.from("modules").select("id").eq("code", m.code).maybeSingle();
      let id = ex?.id;
      if (!id) {
        const { data } = await supabaseAdmin.from("modules").insert({
          code: m.code, name: m.name, department_id: deptIds[m.dept],
          level_id: levelIds[`${m.dept}-${m.level}`], type: "Both",
          qualifications: [m.code], total_hours: 60, total_sessions: 30,
        }).select().single();
        id = data?.id;
        if (data) created.modules++;
      }
      if (id) moduleIds.push({ id, code: m.code, name: m.name, dept: m.dept, level: m.level });
    }

    // Semester
    const today = new Date();
    const semStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    const semEnd = new Date(today.getFullYear(), today.getMonth() + 4, 0).toISOString().slice(0, 10);
    const { data: semEx } = await supabaseAdmin.from("semester_registry").select("id").eq("name", "Demo Semester").maybeSingle();
    const semId = semEx?.id ?? (await supabaseAdmin.from("semester_registry")
      .insert({ name: "Demo Semester", start_date: semStart, end_date: semEnd }).select().single()).data?.id;

    // Helper: create user
    async function ensureUser(email: string, password: string, fullName: string) {
      const existing = await supabaseAdmin.auth.admin.listUsers();
      const found = existing.data.users.find((u) => u.email === email);
      if (found) return found.id;
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { full_name: fullName },
      });
      if (error || !data.user) throw new Error(error?.message ?? "create user failed");
      return data.user.id;
    }

    // DHs
    const dhDefs = [
      { email: "dh1@tvet.demo", name: "Alice Mukamana", dept: "ICT" },
      { email: "dh2@tvet.demo", name: "Bosco Habimana", dept: "Construction" },
      { email: "dh3@tvet.demo", name: "Claudine Uwase", dept: "Hospitality" },
    ];
    for (const d of dhDefs) {
      const uid = await ensureUser(d.email, "Head@123!", d.name);
      await supabaseAdmin.from("profiles").upsert({
        id: uid, full_name: d.name, email: d.email, department_id: deptIds[d.dept],
      });
      const { data: hasRole } = await supabaseAdmin.from("user_roles")
        .select("id").eq("user_id", uid).eq("role", "DH").maybeSingle();
      if (!hasRole) await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: "DH" });
      const { data: hasDH } = await supabaseAdmin.from("department_heads")
        .select("id").eq("user_id", uid).eq("department_id", deptIds[d.dept]).maybeSingle();
      if (!hasDH) {
        await supabaseAdmin.from("department_heads").insert({ user_id: uid, department_id: deptIds[d.dept] });
        created.dhs++;
      }
    }

    // Trainers
    const trainerDefs = [
      { email: "trainer1@tvet.demo", name: "David Kayitare", dept: "ICT", quals: ["ICT201", "ICT202"] },
      { email: "trainer2@tvet.demo", name: "Esther Nyirahabineza", dept: "ICT", quals: ["ICT201"] },
      { email: "trainer3@tvet.demo", name: "Felix Niyongabo", dept: "Construction", quals: ["CON101"] },
      { email: "trainer4@tvet.demo", name: "Grace Ingabire", dept: "Hospitality", quals: ["HOS101"] },
    ];
    const trainerRecs: { id: string; name: string; dept: string; quals: string[] }[] = [];
    for (const t of trainerDefs) {
      const uid = await ensureUser(t.email, "Trainer@123!", t.name);
      let { data: tr } = await supabaseAdmin.from("trainer_registry")
        .select("id").eq("email", t.email).maybeSingle();
      if (!tr) {
        const { data } = await supabaseAdmin.from("trainer_registry").insert({
          full_name: t.name, email: t.email, department_id: deptIds[t.dept], qualifications: t.quals,
        }).select().single();
        tr = data;
        if (data) created.trainers++;
      }
      await supabaseAdmin.from("profiles").upsert({
        id: uid, full_name: t.name, email: t.email,
        department_id: deptIds[t.dept], trainer_registry_id: tr!.id,
      });
      const { data: hasRole } = await supabaseAdmin.from("user_roles")
        .select("id").eq("user_id", uid).eq("role", "T").maybeSingle();
      if (!hasRole) await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: "T" });
      // Skills
      for (const q of t.quals) {
        const { data: hasSkill } = await supabaseAdmin.from("trainer_skills")
          .select("id").eq("trainer_registry_id", tr!.id).eq("module_code", q).maybeSingle();
        if (!hasSkill) {
          await supabaseAdmin.from("trainer_skills").insert({
            trainer_registry_id: tr!.id, module_code: q, qualification_level: "L4",
          });
        }
      }
      trainerRecs.push({ id: tr!.id, name: t.name, dept: t.dept, quals: t.quals });
    }

    // Students (10 per section)
    const firstNames = ["Aline", "Brian", "Chantal", "Didier", "Eric", "Fabrice", "Gisele", "Henry", "Iris", "Jean"];
    for (const sectionId of sectionIds) {
      const { count } = await supabaseAdmin.from("students")
        .select("id", { count: "exact", head: true }).eq("section_id", sectionId);
      if ((count ?? 0) >= 10) continue;
      const { data: sec } = await supabaseAdmin.from("sections")
        .select("department_id, level_id, name").eq("id", sectionId).single();
      const rows = firstNames.map((f, i) => ({
        full_name: `${f} ${sec!.name}-${i + 1}`,
        registration_number: `${sec!.name}-${String(i + 1).padStart(3, "0")}`,
        section_id: sectionId, level_id: sec!.level_id, department_id: sec!.department_id,
        gender: i % 2 === 0 ? "F" : "M",
      }));
      await supabaseAdmin.from("students").insert(rows);
      created.students += rows.length;
    }

    // Schedules: today + tomorrow for each trainer's quals
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const dayName = (d: Date) => d.toLocaleDateString("en-US", { weekday: "long" });
    const todayStr = fmt(today);
    const tomorrow = new Date(today.getTime() + 86400000);
    const tomorrowStr = fmt(tomorrow);

    for (const tr of trainerRecs) {
      for (const q of tr.quals) {
        const mod = moduleIds.find((m) => m.code === q);
        if (!mod) continue;
        const { data: sec } = await supabaseAdmin.from("sections")
          .select("id").eq("department_id", deptIds[tr.dept])
          .eq("level_id", levelIds[`${tr.dept}-${mod.level}`]).limit(1).maybeSingle();
        if (!sec) continue;
        for (const [d, ds] of [[today, todayStr], [tomorrow, tomorrowStr]] as const) {
          const { data: exists } = await supabaseAdmin.from("schedules").select("id")
            .eq("trainer_registry_id", tr.id).eq("date", ds).eq("module_code", q).maybeSingle();
          if (exists) continue;
          await supabaseAdmin.from("schedules").insert({
            trainer_registry_id: tr.id, trainer_name: tr.name,
            hidden_staff_id: tr.id,
            module_code: q, module_name: mod.name,
            department_id: deptIds[tr.dept], level_id: levelIds[`${tr.dept}-${mod.level}`],
            section_id: sec.id, venue_id: venueIds[0], semester_id: semId,
            date: ds, day: dayName(d as Date), week_num: 1,
            start_time: "09:00:00", end_time: "11:00:00", status: "LIVE",
          });
          created.schedules++;
        }
      }
    }

    return { ok: true, created, accounts: {
      master_admin: "(your account)",
      department_heads: dhDefs.map((d) => ({ email: d.email, password: "Head@123!", department: d.dept })),
      trainers: trainerDefs.map((t) => ({ email: t.email, password: "Trainer@123!", department: t.dept })),
    }};
  });