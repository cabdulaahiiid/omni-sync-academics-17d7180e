/**
 * Single source of truth for system-controlled option lists.
 * Values come from the database enums (generated types), never hand-typed,
 * so the UI can never drift from the schema.
 */
import { Constants } from "@/integrations/supabase/types";

const E = Constants.public.Enums;

export const GENDER_OPTIONS = ["Male", "Female"] as const;
export const STUDENT_STATUS_OPTIONS = E.entity_active; // ACTIVE | INACTIVE
export const TRAINER_STATUS_OPTIONS = E.entity_status; // ACTIVE | SUSPENDED
export const DEPARTMENT_STATUS_OPTIONS = E.entity_status;
export const MODULE_TYPE_OPTIONS = E.module_type;
export const VENUE_TYPE_OPTIONS = E.venue_type;
export const LEVEL_NAME_OPTIONS = E.level_name;
export const SEMESTER_STATUS_OPTIONS = E.semester_status;
export const GUARDIAN_RELATIONSHIP_OPTIONS = [
  "Father", "Mother", "Brother", "Sister", "Uncle", "Aunt",
  "Grandfather", "Grandmother", "Guardian", "Other",
] as const;

/** Shared query key so every form reads one cached copy of master data. */
export const MASTER_DATA_KEY = ["master-data"] as const;