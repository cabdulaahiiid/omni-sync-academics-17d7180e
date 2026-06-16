import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { User, Lock, Eye, EyeOff } from "lucide-react";
import loginBg from "@/assets/login-bg.png.asset.json";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

async function redirectByRole(navigate: ReturnType<typeof useNavigate>, userId: string) {
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const set = new Set((roles ?? []).map((r) => r.role));
  if (set.has("MA")) return navigate({ to: "/strategic" });
  if (set.has("DH")) return navigate({ to: "/operational" });
  if (set.has("T")) return navigate({ to: "/ground" });
  toast.error("No role assigned — contact administrator");
  await supabase.auth.signOut();
}

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data.user) await redirectByRole(navigate, data.user.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid credentials");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="relative min-h-screen w-full bg-cover bg-center"
      style={{ backgroundImage: `url(${loginBg.url})` }}
    >
      <div className="relative flex min-h-screen items-center justify-end px-6 py-10 sm:px-12 lg:pr-24">
        <form
          onSubmit={onSubmit}
          className="w-full max-w-sm space-y-4 rounded-xl bg-white/90 p-6 shadow-2xl backdrop-blur-md"
        >
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Email or username"
              className="h-11 bg-white pl-10"
            />
          </div>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="password"
              type={showPw ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="Password"
              className="h-11 bg-white pl-10 pr-10"
            />
            <button
              type="button"
              aria-label={showPw ? "Hide password" : "Show password"}
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <Button type="submit" className="h-11 w-full text-base" disabled={loading}>
            {loading ? "Please wait…" : "Sign In"}
          </Button>
        </form>
      </div>
    </div>
  );
}