import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listCtDepartmentTrainers, setCtPlacementTrainer } from "@/lib/ct/trainers.functions";
import { toastError } from "@/lib/errors/toast";
import { Badge } from "@/components/ui/badge";

const AVAILABILITY_TONE: Record<string, "secondary" | "outline" | "destructive"> = {
  FREE: "secondary",
  AVAILABLE: "outline",
  FULL: "destructive",
};

/**
 * Department-scoped visiting-trainer picker. The pool always comes from the
 * placement's own department, and shows each trainer's current assigned load,
 * availability and the department competency tags they cover.
 */
export function TrainerPicker({
  placementId,
  departmentId,
  value,
  disabled,
}: {
  placementId: string;
  departmentId: string | null | undefined;
  value: string | null | undefined;
  disabled?: boolean;
}) {
  const qc = useQueryClient();
  const trainersFn = useServerFn(listCtDepartmentTrainers);
  const assignFn = useServerFn(setCtPlacementTrainer);
  const dept = departmentId ? String(departmentId) : null;

  const { data } = useQuery({
    queryKey: ["ct", "department-trainers", dept],
    queryFn: () => trainersFn({ data: { department_id: dept } }),
    enabled: Boolean(dept),
    staleTime: 60_000,
  });

  const trainers = ((data as any)?.trainers ?? []) as any[];
  const competencies = ((data as any)?.competencies ?? []) as any[];
  const selected = trainers.find((t) => String(t.id) === String(value ?? ""));

  async function assign(trainerId: string) {
    try {
      await assignFn({ data: { placement_id: placementId, trainer_registry_id: trainerId || null } });
      toast.success("Assigned trainer updated.");
      await qc.invalidateQueries({ queryKey: ["ct", "workspace"] });
      await qc.invalidateQueries({ queryKey: ["ct", "department-trainers"] });
    } catch (e) {
      toastError(e);
    }
  }

  return (
    <div className="space-y-1">
      <select
        className="h-8 w-44 rounded-md border border-input bg-background px-2 text-xs disabled:opacity-60"
        value={value ?? ""}
        disabled={disabled || trainers.length === 0}
        onChange={(e) => assign(e.target.value)}
        aria-label="Assigned department trainer"
      >
        <option value="">Unassigned</option>
        {trainers.map((t) => (
          <option key={t.id} value={t.id}>
            {t.full_name} · {t.assigned_load} trainee(s)
          </option>
        ))}
      </select>
      {selected && (
        <Badge variant={AVAILABILITY_TONE[selected.availability] ?? "outline"} className="text-[10px]">
          {selected.availability === "FULL" ? "At capacity" : selected.availability === "FREE" ? "Free" : "Available"}
        </Badge>
      )}
      {competencies.length > 0 && (
        <p className="text-[10px] leading-tight text-muted-foreground">
          {competencies.slice(0, 3).map((c: any) => c.name).join(" · ")}
          {competencies.length > 3 ? ` +${competencies.length - 3}` : ""}
        </p>
      )}
      {trainers.length === 0 && (
        <p className="text-[11px] text-muted-foreground">No trainers in this department yet.</p>
      )}
    </div>
  );
}
