import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoamiTool from "./tools/whoami";
import listActiveDraftsTool from "./tools/list-active-drafts";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "jptv-schedule-mcp",
  title: "JPTV Schedule MCP",
  version: "0.1.0",
  instructions:
    "Tools for the JPTV level scheduling app. Use `whoami` to inspect the signed-in user and roles. Use `list_active_drafts` to list draft/pending/published schedule sessions per level and week for the user's department (or all departments for Master Admins).",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [whoamiTool, listActiveDraftsTool],
});