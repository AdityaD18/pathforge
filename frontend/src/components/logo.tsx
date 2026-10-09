import { cn } from "@/lib/format";

/** A forked path: two prerequisite nodes converging on a goal. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7", className)} aria-hidden>
      <defs>
        <linearGradient id="pf-g" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="var(--pf-accent)" />
          <stop offset="1" stopColor="var(--pf-accent-2)" />
        </linearGradient>
      </defs>
      <path d="M7 24 C 10 18, 13 16, 16 15.5 M7 8 C 10 12, 13 14.5, 16 15.5 M16 15.5 L 25 15.5" fill="none"
        stroke="url(#pf-g)" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="7" cy="24" r="2.6" fill="var(--pf-panel)" stroke="var(--pf-accent)" strokeWidth="1.8" />
      <circle cx="7" cy="8" r="2.6" fill="var(--pf-panel)" stroke="var(--pf-accent)" strokeWidth="1.8" />
      <circle cx="25.5" cy="15.5" r="3.6" fill="url(#pf-g)" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      <span className="font-display text-[19px] font-medium tracking-tight text-ink">PathForge</span>
    </span>
  );
}
