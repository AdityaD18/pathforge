"use client";

import { BarChart3, Cpu, LayoutTemplate, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Wordmark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { isSupabaseConfigured } from "@/lib/env";
import { getSupabase } from "@/lib/supabase/client";

const field =
  "h-12 w-full rounded-xl border border-line bg-abyss/70 px-3.5 text-base text-ink placeholder:text-haze focus:border-electric focus:outline-none";

// Simulated showcase learners (see README "Demo accounts"); the password is public by design.
const DEMO_PASSWORD = "PathForgeDemo2026";
const DEMOS = [
  { email: "priya.sharma@example.com", name: "Priya", career: "Data Analyst", weeks: 13, icon: BarChart3 },
  { email: "arjun.mehta@example.com", name: "Arjun", career: "ML Engineer", weeks: 10, icon: Cpu },
  { email: "sara.thomas@example.com", name: "Sara", career: "Frontend Developer", weeks: 7, icon: LayoutTemplate },
];

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const nextParam = params.get("next");
  const next = nextParam?.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/dashboard";

  // Already signed in: skip the form.
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    getSupabase().auth.getSession().then(({ data }) => {
      if (data.session) router.replace(next);
    });
  }, [router, next]);

  async function demo(email: string) {
    setError(null);
    setBusy(true);
    try {
      const { error } = await getSupabase().auth.signInWithPassword({ email, password: DEMO_PASSWORD });
      if (error) throw error;
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't sign in to the demo account.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const sb = getSupabase();
      if (mode === "login") {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace(next);
        router.refresh();
      } else {
        const { data, error } = await sb.auth.signUp({
          email, password,
          options: { data: { display_name: name.trim() || null }, emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding` },
        });
        if (error) throw error;
        if (data.session) {
          router.replace("/onboarding");
          router.refresh();
        } else {
          setNotice(`We sent a confirmation link to ${email}. Open it to finish creating your account.`);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reach the authentication service.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-[400px]">
        <Link href="/" className="mb-10 inline-block"><Wordmark /></Link>
        <h1 className="text-[2rem] font-medium leading-tight">{mode === "login" ? "Welcome back" : "Start your path"}</h1>
        <p className="mt-2 text-[15px] text-mist">
          {mode === "login" ? "Sign in to pick up where your roadmap left off." : "A short diagnostic per topic is all it takes to build your first roadmap."}
        </p>

        {!isSupabaseConfigured ? (
          <p className="mt-8 rounded-md border border-developing/30 bg-developing/[0.06] p-4 text-sm text-mist">
            Authentication isn&apos;t configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
          </p>
        ) : (
          <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
            {mode === "signup" && (
              <label className="flex flex-col gap-1.5 text-sm text-mist">
                Name <span className="sr-only">(optional)</span>
                <input className={field} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" placeholder="Optional" />
              </label>
            )}
            <label className="flex flex-col gap-1.5 text-sm text-mist">
              Email
              <input className={field} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </label>
            <label className="flex flex-col gap-1.5 text-sm text-mist">
              Password
              <input className={field} type="password" required minLength={mode === "signup" ? 8 : undefined} value={password}
                onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} />
              {mode === "signup" && <span className="text-xs text-haze">At least 8 characters.</span>}
            </label>
            {error && <p role="alert" className="text-sm text-beginning">{error}</p>}
            {notice && <p role="status" className="text-sm text-mastered">{notice}</p>}
            <Button type="submit" size="lg" disabled={busy} className="mt-2">
              {busy && <Loader2 className="animate-spin" />}
              {mode === "login" ? "Sign in" : "Create account"}
            </Button>
          </form>
        )}

        {mode === "login" && isSupabaseConfigured && (
          <div className="mt-8 rounded-2xl border border-line-soft bg-panel/60 p-4">
            <p className="flex items-center gap-2 text-[15px] font-medium text-ink"><Sparkles className="size-4 text-violet-soft" /> Explore a demo learner</p>
            <p className="mt-0.5 text-sm text-haze">Simulated accounts with weeks of history.</p>
            <div className="mt-3 grid gap-2">
              {DEMOS.map((d) => (
                <button key={d.email} type="button" disabled={busy} onClick={() => demo(d.email)}
                  className="flex items-center gap-3 rounded-xl border border-line-soft px-3 py-2.5 text-left transition-colors hover:border-electric/50 hover:bg-electric/[0.06] disabled:opacity-50">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-accent-gradient text-on-accent"><d.icon className="size-5" /></span>
                  <span className="min-w-0 flex-1"><span className="block text-[15px] text-ink">{d.name} · {d.career}</span>
                    <span className="text-sm text-haze">{d.weeks} weeks of activity</span></span>
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="mt-6 text-sm text-mist">
          {mode === "login" ? (
            <>New to PathForge? <Link className="text-electric-soft hover:underline" href="/signup">Create an account</Link></>
          ) : (
            <>Already have an account? <Link className="text-electric-soft hover:underline" href="/login">Sign in</Link></>
          )}
        </p>
      </div>
    </div>
  );
}
