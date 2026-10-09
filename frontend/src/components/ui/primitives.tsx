import { AlertTriangle } from "lucide-react";
import * as React from "react";

import { cn, STATE_COLOR, STATE_LABEL } from "@/lib/format";
import type { MasteryState } from "@/lib/types";

export function Panel({ className, glass, ...props }: React.HTMLAttributes<HTMLDivElement> & { glass?: boolean }) {
  return <div className={cn(glass ? "glass" : "surface", "min-w-0 rounded-2xl", className)} {...props} />;
}

export function PanelHeader({ title, description, action, icon: Icon }: {
  title: string; description?: React.ReactNode; action?: React.ReactNode; icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 pt-5 sm:px-6 sm:pt-6">
      <div className="flex min-w-0 items-start gap-3">
        {Icon && <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-electric/[0.12] text-electric-soft"><Icon className="size-5" /></span>}
        <div className="min-w-0">
          <h2 className="text-xl font-medium text-ink">{title}</h2>
          {description && <p className="mt-1 text-sm text-mist">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, description, action, icon: Icon, eyebrow }: {
  title: string; description?: React.ReactNode; action?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>; eyebrow?: React.ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex max-w-3xl items-start gap-4">
        {Icon && (
          <span className="hidden size-14 shrink-0 items-center justify-center rounded-2xl bg-accent-gradient text-on-accent shadow-[0_12px_30px_-12px_var(--pf-accent)] sm:flex">
            <Icon className="size-7" />
          </span>
        )}
        <div>
          {eyebrow && <p className="mb-1 text-sm font-medium text-electric-soft">{eyebrow}</p>}
          <h1 className="text-[2.1rem] leading-tight font-medium text-ink sm:text-[2.6rem]">{title}</h1>
          {description && <p className="mt-2 text-base leading-relaxed text-mist">{description}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton-shimmer animate-shimmer rounded-xl", className)} aria-hidden />;
}

export function StateDot({ state, className }: { state: MasteryState; className?: string }) {
  return (
    <span
      className={cn("inline-block size-2 shrink-0 rounded-full", className)}
      style={{ background: STATE_COLOR[state], boxShadow: state === "mastered" ? `0 0 10px ${STATE_COLOR[state]}` : undefined }}
      aria-hidden
    />
  );
}

export function StatePill({ state }: { state: MasteryState }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-0.5 text-xs text-mist">
      <StateDot state={state} />
      {STATE_LABEL[state]}
    </span>
  );
}

export function Tag({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center rounded-full bg-ink/[0.06] px-2.5 py-0.5 text-xs text-mist", className)}>{children}</span>;
}

/** Horizontal meter. Value 0–1; null renders an empty track. */
export function Meter({ value, className, color }: { value: number | null; className?: string; color?: string }) {
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-ink/[0.07]", className)} role="meter"
      aria-valuemin={0} aria-valuemax={100} aria-valuenow={value === null ? undefined : Math.round(value * 100)}>
      {value !== null && (
        <div className="h-full rounded-full transition-[width] duration-700 ease-[var(--ease-out-quart)]"
          style={{ width: `${Math.max(2, value * 100)}%`, background: color ?? "linear-gradient(90deg,var(--pf-accent),var(--pf-accent-2))" }} />
      )}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, body, action, className }: {
  icon: React.ComponentType<{ className?: string }>; title: string; body: React.ReactNode; action?: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("relative flex flex-col items-center gap-4 overflow-hidden rounded-2xl border border-dashed border-line px-6 py-12 text-center", className)}>
      <span className="absolute -top-20 left-1/2 size-56 -translate-x-1/2 rounded-full bg-violet/10 blur-3xl" aria-hidden />
      <span className="relative flex size-16 animate-float items-center justify-center rounded-2xl bg-accent-gradient text-on-accent shadow-[0_14px_36px_-14px_var(--pf-accent)]">
        <Icon className="size-8" />
      </span>
      <div className="relative">
        <p className="font-display text-xl font-medium text-ink">{title}</p>
        <p className="mx-auto mt-1.5 max-w-md text-[15px] leading-relaxed text-mist">{body}</p>
      </div>
      {action && <div className="relative">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  return (
    <div role="alert" className="flex items-start gap-3 rounded-lg border border-beginning/30 bg-beginning/[0.06] px-5 py-4">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-beginning" />
      <div className="text-sm">
        <p className="text-ink">{message}</p>
        {onRetry && (
          <button onClick={onRetry} className="mt-2 text-electric-soft underline-offset-4 hover:underline">Try again</button>
        )}
      </div>
    </div>
  );
}
