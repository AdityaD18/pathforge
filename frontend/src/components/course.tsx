"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpRight, BadgeCheck, Bookmark, BookmarkCheck, BookOpen, Check, ChevronDown, Clock, FileCode2, FileText, GraduationCap,
  Loader2, MousePointerClick, PlayCircle, Star, X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/primitives";
import { Ring } from "@/components/viz";
import { celebrate } from "@/lib/celebrate";
import { alpha, C, cn, FORMAT_LABEL, LEVEL_LABEL, minutesLabel, pct } from "@/lib/format";
import { useSetProgress } from "@/lib/queries";
import type { Cost, Format, Recommendation, ResourceView } from "@/lib/types";

export const FORMAT_ICON: Record<Format, React.ComponentType<{ className?: string }>> = {
  video: PlayCircle, article: FileText, course: GraduationCap, interactive: MousePointerClick, book: BookOpen, documentation: FileCode2,
};

export const COST_LABEL: Record<Cost, string> = { free: "Free", freemium: "Free to start", paid: "Paid" };
const COST_HINT: Record<Cost, string> = {
  free: "No payment needed.",
  freemium: "Free to start or audit; a subscription or certificate costs money.",
  paid: "Requires buying the course or a subscription.",
};

export function CostBadge({ cost, className }: { cost: Cost; className?: string }) {
  const color = cost === "free" ? C.mastered : cost === "freemium" ? C.developing : C.accent2;
  return (
    <span title={COST_HINT[cost]} className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", className)}
      style={{ background: alpha(color, 16), color }}>
      {cost === "free" && <BadgeCheck className="size-3.5" />}{COST_LABEL[cost]}
    </span>
  );
}

const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

/** The site's own icon (via DuckDuckGo's icon service), falling back to a monogram tile. */
export function ProviderMark({ url, provider, size = 40 }: { url: string; provider: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const h = host(url);
  const initials = provider.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <span className="flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line-soft bg-white"
      style={{ width: size, height: size }} aria-hidden>
      {!failed && h ? (
        // eslint-disable-next-line @next/next/no-img-element -- tiny third-party favicon; next/image adds nothing here
        <img src={`https://icons.duckduckgo.com/ip3/${h}.ico`} alt="" width={size * 0.6} height={size * 0.6} loading="lazy"
          referrerPolicy="no-referrer" onError={() => setFailed(true)} className="object-contain" style={{ width: size * 0.6, height: size * 0.6 }} />
      ) : (
        <span className="text-sm font-semibold text-slate-700">{initials}</span>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Opening a course: new tab + "in progress" + a prompt when the learner comes back
// ---------------------------------------------------------------------------------------------------------
const PENDING_KEY = "pf-open-course";
type Pending = { id: string; title: string; provider: string; url: string; openedAt: number };

function readPending(): Pending | null {
  try {
    const p = JSON.parse(localStorage.getItem(PENDING_KEY) || "null");
    return p && typeof p.id === "string" ? p : null;
  } catch {
    return null;
  }
}
function writePending(p: Pending | null) {
  try {
    if (p) localStorage.setItem(PENDING_KEY, JSON.stringify(p));
    else localStorage.removeItem(PENDING_KEY);
  } catch {
    /* storage unavailable: the prompt is a convenience */
  }
}

/** Props for an <a> that opens the course in a new tab and records it as started. */
export function useCourseLink(r: ResourceView) {
  const setProgress = useSetProgress();
  const onClick = useCallback(() => {
    writePending({ id: r.id, title: r.title, provider: r.provider, url: r.url, openedAt: Date.now() });
    if (!r.progress || r.progress.status === "saved") setProgress.mutate({ id: r.id, status: "in_progress" });
  }, [r, setProgress]);
  return { href: r.url, target: "_blank", rel: "noopener noreferrer", onClick };
}

/** Mounted once in the app shell: asks "Did you finish?" when the learner returns from a course tab. */
export function CourseReturnPrompt() {
  const [pending, setPending] = useState<Pending | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const setProgress = useSetProgress();

  useEffect(() => {
    const check = () => {
      if (document.visibilityState !== "visible") return;
      const p = readPending();
      if (!p) return;
      const away = Date.now() - p.openedAt;
      if (away > 3 * 86_400_000) return writePending(null); // stale
      if (away > 15_000) {
        setRating(null);
        setDone(false);
        setPending(p);
      }
    };
    check();
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, []);

  const close = () => {
    writePending(null);
    setPending(null);
  };

  async function finish() {
    if (!pending) return;
    await setProgress.mutateAsync({ id: pending.id, status: "completed", rating });
    setDone(true);
    celebrate("small");
    writePending(null);
    window.setTimeout(() => setPending(null), 1600);
  }

  return (
    <Dialog.Root open={!!pending} onOpenChange={(o) => !o && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[min(440px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-line bg-panel p-6 shadow-2xl">
          {pending && (done ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 14 }}
                className="flex size-16 items-center justify-center rounded-full bg-mastered/15 text-mastered"><Check className="size-8" /></motion.span>
              <Dialog.Title className="text-xl font-medium">Nice work!</Dialog.Title>
              <Dialog.Description className="text-sm text-mist">Marked as completed. Take the assessment to update your mastery.</Dialog.Description>
            </div>
          ) : (
            <>
              <div className="flex items-start gap-3">
                <ProviderMark url={pending.url} provider={pending.provider} size={44} />
                <div className="min-w-0 flex-1">
                  <Dialog.Title className="font-sans text-lg leading-snug font-medium text-ink">Welcome back! How did it go?</Dialog.Title>
                  <Dialog.Description className="mt-0.5 truncate text-sm text-mist">{pending.title}</Dialog.Description>
                </div>
                <Dialog.Close className="rounded-md p-1 text-haze hover:text-ink" aria-label="Close"><X className="size-5" /></Dialog.Close>
              </div>
              <div className="mt-5">
                <p className="text-sm text-mist">Rate it (optional)</p>
                <div className="mt-2 flex gap-1" role="radiogroup" aria-label="Rating">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? "s" : ""}`}
                      onClick={() => setRating(rating === n ? null : n)}
                      className="rounded-md p-1 transition-transform hover:scale-110">
                      <Star className={cn("size-7", rating && n <= rating ? "fill-developing text-developing" : "text-haze")} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                <Button onClick={finish} disabled={setProgress.isPending}>
                  {setProgress.isPending ? <Loader2 className="animate-spin" /> : <Check />} I finished it
                </Button>
                <Button variant="secondary" onClick={close}>Still working on it</Button>
              </div>
              {setProgress.error && <p role="alert" className="mt-3 text-sm text-beginning">{setProgress.error.message}</p>}
            </>
          ))}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Course card (recommendations)
// ---------------------------------------------------------------------------------------------------------
const COMPONENT_LABEL: Record<string, string> = {
  relevance: "Content match", priority: "Roadmap position", level_fit: "Level fit", format_fit: "Format you like", time_fit: "Fits your week",
};

export function CourseCard({ rec, rank, featured = false }: { rec: Recommendation; rank?: number; featured?: boolean }) {
  const r = rec.resource;
  const [open, setOpen] = useState(false);
  const setProgress = useSetProgress();
  const link = useCourseLink(r);
  const status = r.progress?.status ?? null;
  const FormatIcon = FORMAT_ICON[r.format];
  const maxContribution = Math.max(...rec.components.map((c) => c.weight));

  return (
    <motion.article layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: (rank ?? 0) * 0.04 }}
      className={cn("group surface relative flex flex-col overflow-hidden rounded-2xl transition-[border-color,transform] hover:-translate-y-0.5 hover:border-electric/40",
        featured && "border-electric/40")}>
      <div className="h-1 w-full bg-accent-gradient opacity-70" aria-hidden />
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-start gap-3">
          <ProviderMark url={r.url} provider={r.provider} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-mist">{r.provider}{r.instructor && r.instructor !== r.provider ? ` · ${r.instructor}` : ""}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-haze">{rec.topic_name}</p>
          </div>
          <Ring value={rec.score} size={52} stroke={5} label={`Match ${Math.round(rec.score * 100)}%`}>
            <span className="numeral text-sm text-ink">{Math.round(rec.score * 100)}</span>
          </Ring>
        </div>

        <h3 className="font-sans text-lg leading-snug font-medium text-ink">
          <a {...link} className="decoration-electric/50 underline-offset-4 hover:underline">{r.title}</a>
        </h3>

        <div className="flex flex-wrap items-center gap-2">
          <CostBadge cost={r.cost} />
          <Tag className="gap-1.5"><FormatIcon className="size-3.5" />{FORMAT_LABEL[r.format]}</Tag>
          <Tag>{LEVEL_LABEL[r.difficulty]}</Tag>
          <Tag className="gap-1.5"><Clock className="size-3.5" />{minutesLabel(r.est_minutes)}</Tag>
        </div>

        {featured && <p className="text-sm leading-relaxed text-mist">{r.description}</p>}
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-line-soft px-5 py-3.5">
        {status === "completed" ? (
          <span className="flex items-center gap-1.5 text-sm font-medium text-mastered"><Check className="size-4" /> Completed</span>
        ) : (
          <>
            <Button asChild size="sm" variant={status === "in_progress" ? "secondary" : "primary"}>
              <a {...link}>{status === "in_progress" ? "Continue" : "Start course"} <ArrowUpRight /></a>
            </Button>
            {status === "in_progress" && (
              <Button size="sm" variant="ghost" disabled={setProgress.isPending}
                onClick={() => setProgress.mutate({ id: r.id, status: "completed" }, { onSuccess: () => celebrate("small") })}>
                <Check /> Done
              </Button>
            )}
            {!status && (
              <Button size="icon" variant="ghost" aria-label="Save for later" title="Save for later" disabled={setProgress.isPending}
                onClick={() => setProgress.mutate({ id: r.id, status: "saved" })}><Bookmark /></Button>
            )}
            {status === "saved" && <span className="flex items-center gap-1 text-sm text-mist" title="Saved"><BookmarkCheck className="size-4 text-electric-soft" /></span>}
          </>
        )}
        <button onClick={() => setOpen(!open)} aria-expanded={open}
          className="ml-auto flex items-center gap-1 text-sm text-electric-soft hover:text-ink">
          Why this? <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }} className="overflow-hidden">
            <div className="space-y-4 border-t border-line-soft bg-abyss/40 px-5 py-4">
              {!featured && <p className="text-sm leading-relaxed text-mist">{r.description}</p>}
              <dl className="space-y-2">
                {rec.components.map((c) => (
                  <div key={c.name} className="grid grid-cols-[120px_1fr_48px] items-center gap-3 text-sm">
                    <dt className="text-mist">{COMPONENT_LABEL[c.name] ?? c.name}</dt>
                    <dd className="h-2 overflow-hidden rounded-full bg-ink/[0.06]">
                      <motion.div className="h-full rounded-full bg-accent-gradient" initial={{ width: 0 }}
                        animate={{ width: `${(c.contribution / maxContribution) * 100}%` }} transition={{ duration: 0.6 }} />
                    </dd>
                    <dd className="text-right tabular-nums text-ink">+{c.contribution.toFixed(2)}</dd>
                  </div>
                ))}
              </dl>
              {rec.matched_terms.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {rec.matched_terms.map((t) => <Tag key={t.term} className="text-ink">{t.term} <span className="ml-1 text-haze">{pct(t.share)}</span></Tag>)}
                </div>
              )}
              <ul className="space-y-1 text-sm text-mist">{rec.reasons.map((reason) => <li key={reason}>• {reason}</li>)}</ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

/** Compact row for in-progress/saved lists. */
export function CourseRow({ r, subtitle }: { r: ResourceView & { topic_name?: string }; subtitle?: string }) {
  const link = useCourseLink(r);
  const setProgress = useSetProgress();
  const status = r.progress?.status;
  return (
    <div className="flex items-center gap-3 py-3">
      <ProviderMark url={r.url} provider={r.provider} size={38} />
      <div className="min-w-0 flex-1">
        <a {...link} className="block truncate text-[15px] font-medium text-ink hover:text-electric-soft">{r.title}</a>
        <p className="truncate text-sm text-haze">{subtitle ?? `${r.provider} · ${r.topic_name ?? ""}`}</p>
      </div>
      {status === "completed" ? <Check className="size-5 text-mastered" aria-label="Completed" /> : (
        <div className="flex shrink-0 gap-1.5">
          <Button asChild size="sm" variant="secondary"><a {...link}>{status === "in_progress" ? "Resume" : "Start"} <ArrowUpRight /></a></Button>
          {status === "in_progress" && (
            <Button size="sm" variant="ghost" aria-label={`Mark ${r.title} done`} disabled={setProgress.isPending}
              onClick={() => setProgress.mutate({ id: r.id, status: "completed" }, { onSuccess: () => celebrate("small") })}><Check /></Button>
          )}
        </div>
      )}
    </div>
  );
}
