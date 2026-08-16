/**
 * Turns any thrown error (Postgres/PostgREST, Supabase auth, network, app rules,
 * Zod) into a plain-language "what went wrong" + "what to do about it" pair.
 *
 * Never returns an empty message: unknown errors fall back to the raw text plus
 * a generic next step.
 */
export type ExplainedError = {
  title: string;
  problem: string;
  solution: string;
  /** Machine tag, useful for tests and telemetry. */
  code: string;
};

type RawError = {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
  status?: number;
};

const FIELD_LABELS: Record<string, string> = {
  telephone: "telephone number",
  parent_guardian_telephone: "guardian telephone number",
  email: "email address",
  registration_number: "student ID code",
  student_id_code: "student ID code",
  code: "code",
  name: "name",
  full_name: "full name",
  department_id: "department",
  level_id: "level",
  section_id: "section",
  venue_id: "venue",
  module_id: "module",
  trainer_id: "trainer",
};

function label(field: string | null): string {
  if (!field) return "value";
  return FIELD_LABELS[field] ?? field.replace(/_id$/, "").replace(/_/g, " ");
}

function toRaw(error: unknown): RawError {
  if (!error) return { message: "" };
  if (typeof error === "string") return { message: error };
  const e = error as Record<string, unknown>;
  return {
    message: typeof e.message === "string" ? e.message : String(error),
    code: typeof e.code === "string" ? e.code : undefined,
    details: typeof e.details === "string" ? e.details : undefined,
    hint: typeof e.hint === "string" ? e.hint : undefined,
    status: typeof e.status === "number" ? e.status : undefined,
  };
}

/** Pulls the column name out of a Postgres constraint/detail string. */
function guessField(text: string): string | null {
  const detail = /Key \(([^)]+)\)=\(([^)]*)\)/.exec(text);
  if (detail) return detail[1].split(",")[0].trim();
  const constraint = /constraint "([^"]+)"/.exec(text);
  if (constraint) {
    const parts = constraint[1].split("_").filter((p) => p !== "key" && p !== "fkey" && p !== "check" && p !== "unique");
    if (parts.length > 1) return parts.slice(1).join("_");
  }
  const col = /column "([^"]+)"/.exec(text);
  if (col) return col[1];
  return null;
}

function guessValue(text: string): string | null {
  const detail = /Key \([^)]+\)=\(([^)]*)\)/.exec(text);
  return detail ? detail[1] : null;
}

export function explainError(error: unknown): ExplainedError {
  const raw = toRaw(error);
  const msg = raw.message || "";
  const all = `${msg} ${raw.details ?? ""} ${raw.hint ?? ""}`;
  const lower = all.toLowerCase();
  const field = guessField(all);
  const value = guessValue(all);

  // --- Network / offline -------------------------------------------------
  if (
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("network request failed") ||
    lower.includes("load failed") ||
    (typeof navigator !== "undefined" && navigator.onLine === false)
  ) {
    return {
      code: "network",
      title: "No connection to the server",
      problem: "The request could not reach the server, so nothing was saved.",
      solution:
        "Check your internet connection, then press Save again. Your entries stay in the form until it succeeds.",
    };
  }

  // --- Auth --------------------------------------------------------------
  if (raw.status === 401 || lower.includes("unauthorized") || lower.includes("jwt expired") || lower.includes("invalid refresh token")) {
    return {
      code: "auth_expired",
      title: "Your session has ended",
      problem: "You were signed out (session expired), so the server rejected this action.",
      solution: "Sign in again, then repeat this action. Copy any text you typed before signing in.",
    };
  }
  if (lower.includes("invalid login credentials")) {
    return {
      code: "bad_credentials",
      title: "Email or password is wrong",
      problem: "No account matches the email and password entered.",
      solution: "Re-type the password (check Caps Lock). If it still fails, ask the administrator to reset it.",
    };
  }
  if (lower.includes("user already registered") || lower.includes("email address already")) {
    return {
      code: "email_taken",
      title: "Email already in use",
      problem: "An account already exists with this email address.",
      solution: "Use a different email, or open the existing user under Users & Roles and edit it instead.",
    };
  }

  // --- Permissions / RLS -------------------------------------------------
  if (raw.code === "42501" || lower.includes("permission denied") || raw.status === 403 || lower.includes("forbidden")) {
    return {
      code: "forbidden",
      title: "Not allowed for your role",
      problem: "Your current role does not have permission to perform this action.",
      solution:
        "If you hold more than one role, switch role from the header and try again. Otherwise ask the administrator to grant access.",
    };
  }
  if (raw.code === "42501" || lower.includes("row-level security") || lower.includes("violates row-level security policy")) {
    return {
      code: "rls",
      title: "Record blocked by access rules",
      problem: "The record you tried to save is outside the data your account is allowed to change.",
      solution: "Make sure the department/level you selected is one assigned to you, then save again.",
    };
  }

  // --- Postgres data errors ---------------------------------------------
  if (raw.code === "23505" || lower.includes("duplicate key value")) {
    const what = label(field);
    return {
      code: "duplicate",
      title: `This ${what} is already registered`,
      problem: value
        ? `${value} is already used by another record, and ${what}s must be unique.`
        : `Another record already uses this ${what}, and it must be unique.`,
      solution: value
        ? `Enter a different ${what}, or search the list for ${value} and edit that existing record.`
        : `Enter a different ${what}, or open the existing record and edit it instead of creating a new one.`,
    };
  }
  if (raw.code === "23503" || lower.includes("violates foreign key constraint")) {
    const what = label(field);
    return {
      code: "missing_reference",
      title: `The selected ${what} does not exist`,
      problem: `The ${what} this record points to is missing or was deleted.`,
      solution: `Create the ${what} first under Master data, refresh the page, then pick it again.`,
    };
  }
  if (raw.code === "23502" || lower.includes("null value in column")) {
    const what = label(field);
    return {
      code: "missing_required",
      title: `${what.charAt(0).toUpperCase()}${what.slice(1)} is required`,
      problem: `The ${what} was left empty, and the system cannot save the record without it.`,
      solution: `Fill in the ${what} field, then press Save again.`,
    };
  }
  if (raw.code === "23514" || lower.includes("violates check constraint")) {
    const what = label(field);
    return {
      code: "invalid_value",
      title: `The ${what} value is not allowed`,
      problem: `The value entered for ${what} is outside the range or list the system accepts.`,
      solution: `Pick one of the values offered in the dropdown, or correct the ${what} and save again.`,
    };
  }
  if (raw.code === "22P02" || lower.includes("invalid input syntax")) {
    return {
      code: "wrong_type",
      title: "A value is in the wrong format",
      problem: msg,
      solution: "Check numeric and date fields — enter digits only for numbers and HH:MM for times.",
    };
  }
  if (raw.code === "23P01" || lower.includes("conflicting") || lower.includes("already booked") || lower.includes("conflict")) {
    return {
      code: "conflict",
      title: "Timetable conflict",
      problem: msg,
      solution: "Move this session to a free time slot, or choose a different trainer, venue or section.",
    };
  }

  // --- Telephone / email rules ------------------------------------------
  if (lower.includes("telephone") && (lower.includes("format") || lower.includes("must") || lower.includes("invalid"))) {
    return {
      code: "phone_format",
      title: "Telephone number format is wrong",
      problem: msg,
      solution: "Use the Ethiopian mobile format: 10 digits starting with 09, for example 0912345678.",
    };
  }
  if (lower.includes("email") && lower.includes("invalid")) {
    return {
      code: "email_format",
      title: "Email address is not valid",
      problem: msg,
      solution: "Use the form name@example.com — no spaces, exactly one @ sign.",
    };
  }

  // --- Upload / parsing --------------------------------------------------
  if (lower.includes("unsupported file") || lower.includes("file type") || lower.includes("not a valid workbook")) {
    return {
      code: "bad_file",
      title: "This file type cannot be imported",
      problem: msg,
      solution: "Download the template on this screen, fill it in, and upload it as .xlsx or .csv.",
    };
  }
  if (lower.includes("missing column") || lower.includes("header")) {
    return {
      code: "bad_headers",
      title: "The file headers do not match the template",
      problem: msg,
      solution: "Download the template, copy your data into it without renaming any header, then upload again.",
    };
  }
  if (lower.includes("payload too large") || lower.includes("file too large") || raw.status === 413) {
    return {
      code: "too_large",
      title: "The file is too large",
      problem: "The upload exceeds the size the server accepts.",
      solution: "Split the file into smaller batches (about 1,000 rows each) and upload them one after another.",
    };
  }

  // --- Zod / app validation ---------------------------------------------
  if (lower.includes("required") || lower.includes("expected") || lower.includes("select ")) {
    return {
      code: "validation",
      title: "Some fields need attention",
      problem: msg || "One or more required fields are missing or invalid.",
      solution: "Complete every field marked with * and correct the highlighted ones, then save again.",
    };
  }

  return {
    code: "unknown",
    title: "The action could not be completed",
    problem: msg || "The server rejected the request without giving a reason.",
    solution: "Press Save again. If the same message appears, note it down and contact the system administrator.",
  };
}

/** One-line rendering, for compact places such as table cells. */
export function explainToText(error: unknown): string {
  const e = explainError(error);
  return `${e.title} — ${e.problem} Fix: ${e.solution}`;
}