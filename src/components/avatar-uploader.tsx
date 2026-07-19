import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

type Props = {
  /** "pending" for new-user registration (anyone authed can upload here),
   * or a specific user id to upload to that user's own folder. */
  ownerId: string;
  initialUrl?: string | null;
  fallback?: string;
  onUploaded: (path: string, url: string) => void;
  label?: string;
  required?: boolean;
};

export function AvatarUploader({ ownerId, initialUrl, fallback = "U", onUploaded, label = "Profile photo", required }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [url, setUrl] = useState<string | null>(initialUrl ?? null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    if (!ALLOWED.includes(file.type)) { toast.error("Use JPG, PNG, or WEBP"); return; }
    if (file.size > MAX_BYTES) { toast.error("Max 2 MB"); return; }
    setBusy(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      let path = `${ownerId}/${crypto.randomUUID()}.${ext}`;
      if (ownerId === "pending") {
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData.user?.id;
        if (!uid) throw new Error("You must be signed in to upload");
        path = `pending/${uid}/${crypto.randomUUID()}.${ext}`;
      }
      const { error } = await supabase.storage.from("avatars").upload(path, file, {
        cacheControl: "3600", upsert: true, contentType: file.type,
      });
      if (error) throw error;
      const { data: signed } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60);
      const signedUrl = signed?.signedUrl ?? "";
      setUrl(signedUrl);
      onUploaded(path, signedUrl);
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}{required && <span className="text-destructive"> *</span>}</p>
      <div className="flex items-center gap-3">
        <Avatar className="h-16 w-16 ring-2 ring-border">
          {url ? <AvatarImage src={url} alt="" /> : <AvatarFallback>{fallback.slice(0, 2).toUpperCase()}</AvatarFallback>}
        </Avatar>
        <div className="flex flex-col gap-1">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
            {busy ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Upload className="mr-2 h-3 w-3" />}
            {url ? "Change photo" : "Upload photo"}
          </Button>
          <p className="text-xs text-muted-foreground">JPG / PNG / WEBP, max 2 MB</p>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.target.value = ""; }}
      />
    </div>
  );
}