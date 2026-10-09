import { AlertTriangle } from "lucide-react";
import * as React from "react";

import { cn, STATE_COLOR, STATE_LABEL } from "@/lib/format";
import type { MasteryState } from "@/lib/types";

export function Panel({ className, glass, ...props }: React.HTMLAttributes<HTMLDivElement> & { glass?: boolean }) {
  return <div className={cn(glass ? "glass" : "surface", "rounded-lg", className)} {...props} />;
}

export function PanelHeader({ title, description, action }: { title: string; description?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 pt-5">
      <div className="min-w-0">
        <h2 className="text-lg font-medium text-ink">{title}</h2>
        {description && <p className="mt-1 text-sm text-mist">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, description, action }: { title: string; description?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <h1 className="text-[2rem] leading-tight font-medium text-ink sm:text-[2.4rem]">{title}</h1>
        {description && <p className="mt-2 text-[15px] leading-relaxed text-mist">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-white/[0.05]", className)} aria-hidden />;
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
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2 py-0.5 text-xs text-mist">
      <StateDot state={state} />
      {STATE_LABEL[state]}
    </span>
  );
}

export function Tag({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center rounded-sm bg-white/[0.05] px-1.5 py-0.5 text-xs text-mist", className)}>{children}</span>;
}

/** Horizontal meter. Value 0–1; null renders an empty track. */
export function Meter({ value, className, color }: { value: number | null; className?: string; color?: string }) {
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]", className)} role="meter"
      aria-valuemin={0} aria-valuemax={100} aria-valuenow={value === null ? undefined : Math.round(value * 100)}>
      {value !== null && (
        <div className="h-full rounded-full transition-[width] duration-700 ease-[var(--ease-out-quart)]"
          style={{ width: `${Math.max(2, value * 100)}%`, background: color ?? "linear-gradient(90deg,#4c8dff,#8b7bff)" }} />
      )}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, body, action, className }: {
  icon: React.ComponentType<{ className?: string }>; title: string; body: React.ReactNode; action?: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-start gap-3 rounded-lg border border-dashed border-line px-6 py-8", className)}>
      <Icon className="size-5 text-violet-soft" />
      <div>
        <p className="font-medium text-ink">{title}</p>
        <p className="mt-1 max-w-md text-sm leading-relaxed text-mist">{body}</p>
      </div>
      {action}
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
