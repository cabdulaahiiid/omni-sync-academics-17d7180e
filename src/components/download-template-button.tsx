import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { downloadXlsxTemplate, type TemplateSpec } from "@/lib/xlsx-templates";

export function DownloadTemplateButton({
  spec,
  label = "Download sample template",
  variant = "outline",
  size = "sm",
}: {
  spec: TemplateSpec;
  label?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg";
}) {
  return (
    <Button type="button" variant={variant} size={size} onClick={() => downloadXlsxTemplate(spec)}>
      <Download className="mr-2 h-4 w-4" /> {label}
    </Button>
  );
}