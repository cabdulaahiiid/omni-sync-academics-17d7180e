# TVET ERP — Master Regeneration Blueprint (forensic extraction)

Read-only extraction of the current system into one master document that another Lovable account can use to rebuild it. No code, schema, or behaviour changes.

## Deliverables

1. `docs/TVET_ERP_MASTER_REGENERATION_BLUEPRINT.md` — the canonical, dense, technical document (source of truth).
2. `/mnt/documents/TVET_ERP_Master_Regeneration_Blueprint.docx` and `.pdf` — downloadable copies generated from the markdown.
3. `docs/sql/tvet_erp_full_schema.sql` — full runnable DDL dumped from the live database (types, tables, grants, RLS policies, indexes, constraints, triggers, functions), ordered so it can be applied as one migration in a fresh project. Also embedded in the document appendix.

## Extraction method

Evidence-only. Every statement traces to a file or a database query; anything unconfirmed is marked `NOT VERIFIED IN CURRENT CODEBASE`, and UI/backend disagreements are marked `UI BEHAVIOR ≠ BACKEND BEHAVIOR`.

- Database: catalog queries against `pg_class`, `information_schema`, `pg_policies`, `pg_proc`, `pg_trigger`, `pg_constraint`, `pg_indexes`, enum types — reconstructed into runnable SQL.
- Code: full read of `src/routes/**`, `src/lib/**` (server functions, scheduling engine, offline queue, SMS, reports), `src/hooks/**`, `src/components/**`, `src/integrations/**`, `src/start.ts`, `src/router.tsx`, `vite.config.ts`, `package.json`, `wrangler.jsonc`, `supabase/config.toml`.
- Parallel sub-agents for the heavy read passes (database forensics, route/screen inventory, server-function inventory, scheduling/session/week engine, realtime + offline sync, security/RBAC), each returning file-referenced findings.

## Document structure

Follows the requested 20 sections in order:

1. System identity and stack
2. Codebase map (FILE → PURPOSE → DEPENDENCIES → RESPONSIBILITY)
3. Exact database blueprint (per-table: columns, types, nullability, defaults, PK/FK, indexes, constraints, triggers, referenced-by, RLS) + full SQL
4. Relationship map + Mermaid ER diagram
5. Roles (MA / DH / T) and permission matrix, split frontend-enforced vs database-enforced
6. Routes → screens → role → components → data → actions
7. Business rules in TRIGGER → INPUT → VALIDATION → LOGIC → DB CHANGE → OUTPUT form
8. Schedule engine: exact Year → Level → Department → Module filter chain, conflict detection, draft/approve/publish/delete lifecycle
9. Session calculation engine: exact formulas from `src/lib/scheduling/engine.ts` and the `dh_save_schedule_plan` RPC, including remainder handling; divergences between UI preview, server validation, and DB reported explicitly
10. Week calculation engine: W1 anchoring, recurrence, term-end shortfall
11. Server functions / RPC / API routes inventory (input, validation, process, DB, output, errors, authorization)
12. Auth, RLS policy table, SECURITY DEFINER functions, triggers, storage, realtime config
13. Realtime propagation chains per channel/hook
14. Offline sync (IndexedDB, queue, replay, conflict handling)
15. Validation rules per field, especially schedule and phone/ID rules
16. Structural UI/UX blueprint (shells, sidebars, dialogs, form contracts, design tokens)
17. Configuration and dependencies (variable names only, no secret values)
18. Known problems, classified CRITICAL/HIGH/MEDIUM/LOW
19. Regeneration contract (must recreate / must not change / implemented / missing / broken / not verified)
20. Consolidated machine-readable blueprint tree
21. Reconstruction readiness percentages + top 10 remaining unknowns

## QA

Render every DOCX/PDF page to images and inspect for clipped tables, overflow, and broken code blocks before delivering; re-generate until clean.

## Constraints honoured

No source file, migration, or database row is modified. The only new files are the blueprint document, its SQL appendix, and the downloadable exports.
