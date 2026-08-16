import { AlertCircle } from "lucide-react";
import { explainError, type ExplainedError } from "@/lib/errors/explain";

/**
 * Inline "what went wrong / what to do" panel shown above form actions.
 * Accepts a raw error, an already-explained error, or a plain string.
 */
export function ErrorPanel({ error }: { error: unknown }) {
  if (!error) return null;
  const e: ExplainedError =
    typeof error === "object" && error !== null && "solution" in (error as object)
      ? (error as ExplainedError)
      : explainError(error);
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="space-y-1">
        <p className="font-semibold">{e.title}</p>
        <p>{e.problem}</p>
        <p className="text-destructive/90">
          <span className="font-medium">Fix:</span> {e.solution}
        </p>
      </div>
    </div>
  );
}