"use client";

import type { User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { BarChart3, Compass, FlaskConical, LayoutDashboard, ListChecks, LogOut, Menu, Route, Sparkles, UserRound, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Wordmark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { isSupabaseConfigured } from "@/lib/env";
import { cn } from "@/lib/format";
import { useProfile } from "@/lib/queries";
import { getSupabase } from "@/lib/supabase/client";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/assessments", label: "Assessments", icon: ListChecks },
  { href: "/roadmap", label: "Roadmap", icon: Route },
  { href: "/recommendations", label: "Recommendations", icon: Sparkles },
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

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const qc = useQueryClient();
  const user = useAuthUser();
  const [open, setOpen] = useState(false);
  const isLearnerPage = LEARNER_PREFIXES.some((p) => pathname.startsWith(p));
  const profileEnabled = Boolean(user);
  const profile = useProfile(profileEnabled);

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
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {NAV.filter((n) => user || n.public).map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined} onClick={() => setOpen(false)}
            className={cn("group relative flex items-center gap-3 rounded-md px-3 py-2 text-[14px] transition-colors",
              active ? "bg-white/[0.06] text-ink" : "text-mist hover:bg-white/[0.03] hover:text-ink")}>
            {active && <span className="absolute top-2 bottom-2 left-0 w-[2px] rounded-full bg-gradient-to-b from-electric to-violet" />}
            <Icon className={cn("size-[17px]", active ? "text-electric-soft" : "text-haze group-hover:text-mist")} />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  const account = user ? (
    <div className="border-t border-line-soft pt-4">
      <Link href="/profile" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-mist hover:bg-white/[0.03] hover:text-ink">
        <UserRound className="size-[17px] text-haze" />
        <span className="min-w-0 truncate">{profile.data?.display_name || user.email}</span>
      </Link>
      <button onClick={signOut} className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-mist hover:bg-white/[0.03] hover:text-ink">
        <LogOut className="size-[17px] text-haze" /> Sign out
      </button>
    </div>
  ) : user === null ? (
    <div className="flex flex-col gap-2 border-t border-line-soft pt-4">
      <Button asChild size="sm"><Link href="/signup">Create account</Link></Button>
      <Button asChild size="sm" variant="ghost"><Link href="/login">Sign in</Link></Button>
    </div>
  ) : null;

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-8 border-r border-line-soft bg-abyss/60 px-4 py-6 lg:flex">
        <Link href={user ? "/dashboard" : "/"} className="px-2"><Wordmark /></Link>
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
        <div className="fixed inset-x-0 top-[61px] z-20 flex flex-col gap-4 border-b border-line bg-midnight px-4 py-4 lg:hidden">
          {nav}
          {account}
        </div>
      )}

      <main className="mx-auto w-full max-w-[1240px] px-4 py-8 sm:px-8 lg:py-12">
        {!isSupabaseConfigured && isLearnerPage ? <NotConfigured /> : children}
      </main>
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
