import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { User, Lock, Eye, EyeOff } from "lucide-react";
import { Database, Gauge, GraduationCap } from "lucide-react";
import loginBg from "@/assets/login-bg.png.asset.json";
import { resolveSignedInHome } from "@/lib/auth-routing";
import { logAuthEvent } from "@/lib/auth/telemetry";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        void logAuthEvent(supabase, {
          kind: "sign_in_fail",
          ok: false,
          reason: error.message,
        });
        throw error;
      }
      if (data.user) {
        void logAuthEvent(supabase, {
          kind: "sign_in_success",
          userId: data.user.id,
          ok: true,
        });
        const { to } = await resolveSignedInHome(data.user.id);
        if (to) {
          await navigate({ to });
        } else {
          setErrorMessage(
            "No role assigned to this account. Please contact your administrator.",
          );
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invalid credentials";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="relative min-h-screen w-full bg-cover bg-center"
      style={{ backgroundImage: `url(${loginBg.url})` }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950/70 via-slate-900/55 to-slate-900/30" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col items-center justify-center gap-10 px-6 py-10 sm:px-12 lg:flex-row lg:items-center lg:justify-between lg:gap-16">
        <section className="w-full max-w-xl animate-in fade-in slide-in-from-left-6 duration-700 text-white lg:flex-1">
          <div className="rounded-2xl border border-white/15 bg-white/10 p-8 shadow-2xl backdrop-blur-xl">
            <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium tracking-wide text-white/90">
              TVET ERP · 2026 Edition
            </span>
            <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Welcome to TVET ERP
            </h1>
            <p className="mt-3 text-base text-white/85 sm:text-lg">
              Empowering TVET Institutions with Smart ERP Solutions
            </p>
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                { icon: Database, label: "Centralize Institution Data" },
                { icon: Gauge, label: "Optimize Resources" },
                { icon: GraduationCap, label: "Enhance Training Outcomes" },
              ].map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="rounded-xl border border-white/15 bg-white/10 p-4 shadow-lg backdrop-blur-md transition hover:bg-white/15"
                >
                  <Icon className="h-5 w-5 text-white" aria-hidden />
                  <p className="mt-2 text-sm font-medium text-white">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
        <form
          onSubmit={onSubmit}
          className="w-full max-w-sm space-y-4 rounded-xl bg-white/95 p-6 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-right-6 duration-700"
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
          {errorMessage ? (
            <p
              role="alert"
              className="text-center text-sm text-red-600"
              data-testid="login-error"
            >
              {errorMessage}
            </p>
          ) : null}
        </form>
      </div>
    </div>
  );
}