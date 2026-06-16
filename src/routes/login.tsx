import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { GraduationCap, User, Lock, Eye, EyeOff, Database, Settings, BarChart3, CalendarCheck } from "lucide-react";
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
  const [remember, setRemember] = useState(false);

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
      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col items-stretch justify-center gap-8 px-6 py-10 lg:flex-row lg:items-center lg:px-12">
        {/* Left solid white panel */}
        <section className="hidden w-full rounded-2xl bg-white p-10 shadow-2xl lg:block lg:max-w-xl lg:p-12">
          <h1 className="text-4xl font-light leading-tight text-slate-700">
            Welcome to
            <br />
            <span className="text-5xl font-extrabold tracking-tight text-primary">TVET ERP</span>
          </h1>
          <p className="mt-5 text-base text-slate-600">
            Empowering TVET Institutions with Smart ERP Solutions.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-3">
            {[
              { Icon: Database, label: "Centralize Institution Data" },
              { Icon: Settings, label: "Optimize Resources" },
              { Icon: BarChart3, label: "Enhance Training Outcomes" },
              { Icon: CalendarCheck, label: "Finalize Schedule Design" },
            ].map(({ Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-3 rounded-xl bg-gray-100 px-4 py-3"
              >
                <Icon className="h-5 w-5 shrink-0 text-primary" />
                <span className="text-xs font-semibold leading-tight text-slate-800">
                  {label}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-8 border-t border-slate-200 pt-5 text-sm font-semibold text-slate-800">
            Welcome to TVET ERP
          </p>
        </section>

        {/* Right login card */}
        <section className="flex w-full items-center justify-center lg:max-w-md">
          <div className="w-full max-w-md rounded-2xl bg-white/85 p-8 shadow-2xl backdrop-blur-md sm:p-10">
            <div className="mb-2 flex items-center justify-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <GraduationCap className="h-6 w-6" />
              </span>
              <span className="text-3xl font-bold tracking-tight text-slate-900">TVET ERP</span>
            </div>
            <p className="mb-8 text-center text-sm text-slate-600">Sign in to your account</p>

            <form onSubmit={onSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-800">
                  Username / Email
                </Label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="Enter your username or email"
                    className="h-11 bg-white/80 pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-800">
                  Password
                </Label>
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
                    placeholder="Enter your password"
                    className="h-11 bg-white/80 pl-10 pr-10"
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
              </div>

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 text-slate-700">
                  <Checkbox
                    checked={remember}
                    onCheckedChange={(v) => setRemember(Boolean(v))}
                  />
                  Remember me
                </label>
                <a href="#" className="font-medium text-primary hover:underline">
                  Forgot Password?
                </a>
              </div>

              <Button type="submit" className="h-11 w-full text-base" disabled={loading}>
                {loading ? "Please wait…" : "Sign In"}
              </Button>

              <p className="text-center text-sm text-slate-600">
                Don't have an account?{" "}
                <span className="font-medium text-primary">Contact your administrator.</span>
              </p>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}