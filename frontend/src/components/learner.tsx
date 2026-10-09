"use client";

import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Check, ChevronDown, ExternalLink, History, Loader2, Play, Bookmark, CircleDashed } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from "recharts";

import { Button, type ButtonProps } from "@/components/ui/button";
import { Tag } from "@/components/ui/primitives";
import { cn, FORMAT_LABEL, LEVEL_LABEL, minutesLabel, pct, relativeTime } from "@/lib/format";
import { useSetProgress, useStartAssessment } from "@/lib/queries";
import type { AdaptationEvent, Dashboard, Recommendation } from "@/lib/types";

export function StartAssessmentButton({ topicId, label = "Take assessment", ...props }: { topicId: string; label?: string } & ButtonProps) {
  const router = useRouter();
  const start = useStartAssessment();
  return (
    <span className="inline-flex flex-col gap-1">
      <Button {...props} disabled={start.isPending || props.disabled}
        onClick={async () => {
          const res = await start.mutateAsync(topicId);
          router.push(`/assessments/${res.assessment.id}`);
        }}>
        {start.isPending ? <Loader2 className="animate-spin" /> : <Play />} {label}
      </Button>
      {start.error && <span role="alert" className="text-xs text-beginning">{start.error.message}</span>}
    </span>
  );
}

const COMPONENT_LABEL: Record<string, string> = {
  relevance: "Content match", priority: "Roadmap position", level_fit: "Level fit", format_fit: "Format preference", time_fit: "Fits your week",
};

export function RecommendationCard({ rec, rank, defaultOpen = false }: { rec: Recommendation; rank?: number; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const setProgress = useSetProgress();
  const r = rec.resource;
  const status = r.progress?.status ?? null;
  const maxContribution = Math.max(...rec.components.map((c) => c.weight));

  return (
    <article className="surface flex flex-col rounded-lg">
      <div className="flex flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-haze">{rec.topic_name}</p>
            <h3 className="mt-1 font-sans text-[16px] leading-snug font-medium text-ink">
              <a href={r.url} target="_blank" rel="noopener noreferrer" className="hover:text-electric-soft">
                {r.title}<ExternalLink className="ml-1.5 inline size-3.5 -translate-y-px text-haze" aria-label="(opens in a new tab)" />
              </a>
            </h3>
            <p className="mt-0.5 text-[13px] text-mist">{r.provider}</p>
          </div>
          <div className="shrink-0 text-right" title="Ranking score (0–1)">
            {rank !== undefined && <span className="sr-only">Rank {rank}. </span>}
            <span className="numeral text-xl text-ink">{rec.score.toFixed(2)}</span>
            <p className="text-[11px] text-haze">score</p>
          </div>
        </div>
        <p className="text-sm leading-relaxed text-mist">{r.description}</p>
        <div className="flex flex-wrap gap-1.5">
          <Tag>{FORMAT_LABEL[r.format]}</Tag>
          <Tag>{LEVEL_LABEL[r.difficulty]}</Tag>
          <Tag>{minutesLabel(r.est_minutes)}</Tag>
        </div>
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-line-soft px-5 py-3">
        {status !== "completed" ? (
          <>
            <Button size="sm" variant={status === "in_progress" ? "secondary" : "primary"} disabled={setProgress.isPending}
              onClick={() => setProgress.mutate({ id: r.id, status: status === "in_progress" ? "completed" : "in_progress" })}>
              {status === "in_progress" ? <><Check /> Mark complete</> : <><BookOpen /> Start</>}
            </Button>
            {!status && (
              <Button size="sm" variant="ghost" disabled={setProgress.isPending} onClick={() => setProgress.mutate({ id: r.id, status: "saved" })}>
                <Bookmark /> Save
              </Button>
            )}
            {status === "saved" && <span className="text-xs text-mist">Saved</span>}
          </>
        ) : (
          <span className="flex items-center gap-1.5 text-sm text-mastered"><Check className="size-4" /> Completed</span>
        )}
        <button onClick={() => setOpen(!open)} aria-expanded={open}
          className="ml-auto flex items-center gap-1 text-[13px] text-electric-soft hover:text-ink">
          Why this <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }} className="overflow-hidden">
            <div className="space-y-4 border-t border-line-soft bg-abyss/40 px-5 py-4">
              <ul className="space-y-1.5 text-[13px] leading-relaxed text-mist">
                {rec.reasons.map((reason) => <li key={reason}>{reason}</li>)}
              </ul>
              <div>
                <p className="mb-2 text-xs text-haze">How the score adds up</p>
                <dl className="space-y-1.5">
                  {rec.components.map((c) => (
                    <div key={c.name} className="grid grid-cols-[110px_1fr_44px] items-center gap-3 text-xs">
                      <dt className="text-mist">{COMPONENT_LABEL[c.name] ?? c.name}</dt>
                      <dd className="h-1.5 rounded-full bg-white/[0.06]">
                        <div className="h-full rounded-full bg-gradient-to-r from-electric to-violet" style={{ width: `${(c.contribution / maxContribution) * 100}%` }} />
                      </dd>
                      <dd className="text-right tabular-nums text-ink">+{c.contribution.toFixed(2)}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-2 text-[11px] text-haze">Each bar is weight × value; the full bar is that component&apos;s maximum.</p>
              </div>
              {rec.matched_terms.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs text-haze">Terms shared with your query (TF-IDF cosine {rec.cosine_similarity.toFixed(3)})</p>
                  <div className="flex flex-wrap gap-1.5">
                    {rec.matched_terms.map((t) => <Tag key={t.term} className="text-ink">{t.term} <span className="ml-1 text-haze">{pct(t.share)}</span></Tag>)}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
}

export function EventFeed({ events }: { events: AdaptationEvent[] }) {
  if (!events.length) {
    return (
      <p className="flex items-start gap-2 text-sm text-mist">
        <History className="mt-0.5 size-4 shrink-0 text-haze" />
        Changes to your plan will appear here after assessments, profile edits and completed resources.
      </p>
    );
  }
  return (
    <ol className="space-y-4">
      {events.map((e) => (
        <li key={e.id} className="relative pl-5">
          <span className={cn("absolute top-1.5 left-0 size-2 rounded-full",
            e.trigger === "assessment" ? "bg-electric" : e.trigger === "profile" ? "bg-violet" : "bg-mastered")} />
          <p className="text-[13px] leading-relaxed text-ink">{e.summary}</p>
          <p className="mt-0.5 text-xs text-haze">
            {{ assessment: "After an assessment", profile: "After a profile change", progress: "After completing a resource" }[e.trigger]}, {relativeTime(e.created_at)}
          </p>
        </li>
      ))}
    </ol>
  );
}

export function MasteryRadar({ data }: { data: Dashboard["radar"] }) {
  const rows = data.map((d) => ({ name: d.name, value: d.mastery_score === null ? 0 : Math.round(d.mastery_score * 100), assessed: d.assessed }));
  const assessed = data.filter((d) => d.assessed).length;
  if (rows.length < 3) return null;
  return (
    <div>
      <div className="h-[280px] w-full">
        <ResponsiveContainer>
          <RadarChart data={rows} outerRadius="62%">
            <PolarGrid stroke="#22305c" />
            <PolarAngleAxis dataKey="name" tick={{ fill: "#8a97bd", fontSize: 11 }}
              tickFormatter={(v: string) => (v.length > 13 ? `${v.slice(0, 12)}…` : v)} />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            <Radar dataKey="value" stroke="#8b7bff" fill="#8b7bff" fillOpacity={0.25} strokeWidth={1.5} isAnimationActive={false} />
            <Tooltip
              contentStyle={{ background: "#101a3a", border: "1px solid #22305c", borderRadius: 8, fontSize: 12 }}
              formatter={(v, _n, item) => [(item.payload as { assessed: boolean }).assessed ? `${v}%` : "Not assessed", "Mastery"]} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <p className="flex items-center gap-1.5 text-xs text-haze">
        <CircleDashed className="size-3.5" /> {assessed} of {rows.length} career topics assessed; unassessed topics plot at zero.
      </p>
    </div>
  );
}
