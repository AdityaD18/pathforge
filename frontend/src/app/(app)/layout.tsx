import { Suspense } from "react";

import { AppShell } from "@/components/app-shell";
import { Wordmark } from "@/components/logo";

/** Static stand-in shown while the shell (which reads the current URL) streams in on dynamic routes. */
function ShellFallback() {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="hidden h-dvh border-r border-line-soft bg-abyss/60 px-6 py-6 lg:block"><Wordmark /></aside>
      <main className="mx-auto w-full max-w-[1240px] px-4 py-8 sm:px-8 lg:py-12">
        <div className="h-10 w-1/2 animate-pulse rounded-md bg-white/[0.05]" />
      </main>
    </div>
  );
}

export default function LearnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<ShellFallback />}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
