import { useCallback, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { explainError, type ExplainedError } from "@/lib/errors/explain";

type Options<TData, TVars> = {
  mutationFn: (vars: TVars) => Promise<TData>;
  /** Query keys refreshed (and awaited) before the dialog closes. */
  invalidateKeys?: readonly (readonly unknown[])[];
  successMessage: string;
  /** Runs only after a confirmed successful save + refreshed lists. */
  onSaved?: (data: TData) => void;
};

/**
 * Word-like save contract for every registration/edit form:
 * commit -> confirm success -> refresh lists -> close -> toast.
 * On failure nothing closes, the entered values stay, and the real
 * server error is surfaced inline and as a toast.
 */
export function useFormSubmit<TData = unknown, TVars = void>(opts: Options<TData, TVars>) {
  const qc = useQueryClient();
  const [error, setError] = useState<ExplainedError | null>(null);

  const mutation = useMutation<TData, Error, TVars>({
    mutationFn: opts.mutationFn,
    onMutate: () => {
      setError(null);
    },
    onSuccess: async (data) => {
      await Promise.all(
        (opts.invalidateKeys ?? []).map((key) => qc.invalidateQueries({ queryKey: key as unknown[] })),
      );
      toast.success(opts.successMessage);
      opts.onSaved?.(data);
    },
    onError: (e: Error) => {
      const explained = explainError(e);
      setError(explained);
      toast.error(explained.title, {
        description: `${explained.problem} Fix: ${explained.solution}`,
        duration: 8000,
      });
    },
  });

  const isSaving = mutation.isPending;

  /** Ignores repeat clicks while a save is in flight. */
  const submit = useCallback(
    (vars: TVars) => {
      if (mutation.isPending) return;
      mutation.mutate(vars);
    },
    [mutation],
  );

  const clearError = useCallback(() => setError(null), []);

  return { submit, isSaving, error, clearError };
}
