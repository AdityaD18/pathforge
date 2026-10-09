"use client";

import type { User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { BarChart3, Compass, Flame, FlaskConical, LayoutDashboard, ListChecks, LogOut, Menu, Route, Sparkles, UserRound, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { CourseReturnPrompt } from "@/components/course";
import { Wordmark } from "@/components/logo";
import { ThemeQuickSwitch, useAccountTheme } from "@/components/theme-picker";
import { Button } from "@/components/ui/button";
import { isSupabaseConfigured } from "@/lib/env";
import { cn } from "@/lib/format";
import { useDashboard, useProfile } from "@/lib/queries";
import { getSupabase } from "@/lib/supabase/client";

const NAV = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/roadmap", label: "Roadmap", icon: Route },
  { href: "/assessments", label: "Assessments", icon: ListChecks },
  { href: "/recommendations", label: "Courses", icon: Sparkles },
  { href: "/analytics", label: "Progress", icon: BarChart3 },
  { href: "/ml", label: "Model evaluation", icon: FlaskConical, public: true },
];

const LEARNER_PREFIXES = ["/dashboard", "/assessments", "/roadmap", "/recommendations", "/analytics", "/profile"];

export function useAuthUser() {
  const [user, setUser] = useState<User | null | undefined>(isSupabaseConfigured ? undefined : null);
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const sb = getSupabase();
    sb.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);
  return user;
}

function StreakChip() {
  const d = useDashboard();
  if (!d.data?.insights) return null;
  const s = d.data.insights.streak;
  const lit = s.current > 0;
  return (
    <Link href="/analytics#activity" className={cn("flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors",
      lit ? "border-developing/30 bg-developing/[0.08] hover:bg-developing/[0.12]" : "border-line-soft hover:bg-ink/[0.03]")}
      title={`Longest streak: ${s.longest} day${s.longest === 1 ? "" : "s"}`}>
      <Flame className={cn("size-6", lit ? "text-developing" : "text-haze")} />
      <span className="leading-tight">
        <span className="numeral block text-xl text-ink">{s.current} day{s.current === 1 ? "" : "s"}</span>
        <span className="text-xs text-mist">{lit ? (s.active_today ? "streak · active today" : "streak · keep it going") : "streak · start one today"}</span>
      </span>
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const qc = useQueryClient();
  const user = useAuthUser();
  const [open, setOpen] = useState(false);
  const isLearnerPage = LEARNER_PREFIXES.some((p) => pathname.startsWith(p));
  const profileEnabled = Boolean(user);
  const profile = useProfile(profileEnabled);
  useAccountTheme(profile.data);
  const showStreak = profileEnabled && !!profile.data?.target_career_id;

  // First-run: send learners without a target career to onboarding.
  useEffect(() => {
    if (profileEnabled && isLearnerPage && profile.data && !profile.data.target_career_id) router.replace("/onboarding");
  }, [profileEnabled, isLearnerPage, profile.data, router]);

  async function signOut() {
    await getSupabase().auth.signOut();
    qc.clear();
    router.replace("/login");
  }

  const nav = (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {NAV.filter((n) => user || n.public).map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined} onClick={() => setOpen(false)}
            className={cn("group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] transition-colors",
              active ? "bg-electric/[0.12] font-medium text-ink" : "text-mist hover:bg-ink/[0.04] hover:text-ink")}>
            {active && <span className="absolute top-2 bottom-2 left-0 w-[3px] rounded-full bg-accent-gradient" />}
            <Icon className={cn("size-5", active ? "text-electric-soft" : "text-haze group-hover:text-mist")} />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  const account = user ? (
    <div className="flex flex-col gap-1 border-t border-line-soft pt-4">
      <ThemeQuickSwitch signedIn />
      <Link href="/profile" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-mist hover:bg-ink/[0.04] hover:text-ink">
        <UserRound className="size-[18px] text-haze" />
        <span className="min-w-0 truncate">{profile.data?.display_name || user.email}</span>
      </Link>
      <button onClick={signOut} className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm text-mist hover:bg-ink/[0.04] hover:text-ink">
        <LogOut className="size-[18px] text-haze" /> Sign out
      </button>
    </div>
  ) : user === null ? (
    <div className="flex flex-col gap-2 border-t border-line-soft pt-4">
      <ThemeQuickSwitch signedIn={false} />
      <Button asChild size="sm"><Link href="/signup">Create account</Link></Button>
      <Button asChild size="sm" variant="ghost"><Link href="/login">Sign in</Link></Button>
    </div>
  ) : null;

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 overflow-y-auto border-r border-line-soft bg-abyss/60 px-4 py-6 lg:flex">
        <Link href={user ? "/dashboard" : "/"} className="px-2"><Wordmark /></Link>
        {showStreak && <StreakChip />}
        <div className="flex-1">{nav}</div>
        {account}
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line-soft bg-midnight/85 px-4 py-3 backdrop-blur lg:hidden">
        <Link href={user ? "/dashboard" : "/"}><Wordmark /></Link>
        <Button variant="ghost" size="icon" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? <X /> : <Menu />}
        </Button>
      </header>
      {open && (
        <div className="fixed inset-x-0 top-[65px] z-20 flex max-h-[calc(100dvh-65px)] flex-col gap-4 overflow-y-auto border-b border-line bg-midnight px-4 py-4 lg:hidden">
          {showStreak && <StreakChip />}
          {nav}
          {account}
        </div>
      )}

      <main className="mx-auto w-full max-w-[1280px] px-4 py-8 sm:px-8 lg:py-10">
        {!isSupabaseConfigured && isLearnerPage ? <NotConfigured /> : children}
      </main>
      {user && <CourseReturnPrompt />}
    </div>
  );
}

function NotConfigured() {
  return (
    <div className="max-w-xl rounded-lg border border-developing/30 bg-developing/[0.06] p-6">
      <Compass className="mb-3 size-5 text-developing" />
      <p className="font-medium text-ink">Supabase isn&apos;t configured for this deployment</p>
      <p className="mt-2 text-sm leading-relaxed text-mist">
        Set <code className="text-ink">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="text-ink">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in
        frontend/.env.local (or your Vercel project), then restart. The model evaluation page works without it.
      </p>
    </div>
  );
}
