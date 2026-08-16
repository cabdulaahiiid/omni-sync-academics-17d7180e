import { toast } from "sonner";
import { explainError } from "./explain";

/** Shows any error as "problem" + "solution" instead of raw server text. */
export function toastError(error: unknown) {
  const e = explainError(error);
  toast.error(e.title, { description: `${e.problem} Fix: ${e.solution}`, duration: 8000 });
  return e;
}