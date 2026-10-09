"use client";

import { motion } from "framer-motion";
import { BookCheck, CircleDashed, History, Loader2, Play, SlidersHorizontal, Unlock } from "lucide-react";
import { useRouter } from "next/navigation";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from "recharts";

import { TOOLTIP_STYLE } from "@/components/charts/chart-kit";
import { Button, type ButtonProps } from "@/components/ui/button";
import { C, cn, relativeTime } from "@/lib/format";
import { useStartAssessment } from "@/lib/queries";
import type { AdaptationEvent, Dashboard } from "@/lib/types";

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

const TRIGGER = {
  assessment: { icon: Play, color: C.accent, label: "Assessment" },
  profile: { icon: SlidersHorizontal, color: C.accent2, label: "Profile change" },
  progress: { icon: BookCheck, color: C.mastered, label: "Course completed" },
} as const;

/** Plan changes as a compact visual timeline: icon, the headline change, and chips for what unlocked. */
export function EventFeed({ events, compact = false }: { events: AdaptationEvent[]; compact?: boolean }) {
  if (!events.length) {
    return (
      <p className="flex items-start gap-2 text-sm text-mist">
        <History className="mt-0.5 size-4 shrink-0 text-haze" />
        Changes to your plan show up here.
      </p>
    );
  }
  return (
    <ol className="relative space-y-4">
      <span className="absolute top-2 bottom-2 left-[17px] w-px bg-line-soft" aria-hidden />
      {events.map((e, i) => {
        const t = TRIGGER[e.trigger];
        const topic = e.changes.topic;
        const delta = topic && topic.previous_score !== null ? Math.round((topic.new_score - topic.previous_score) * 100) : null;
        return (
          <motion.li key={e.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i }}
            className="relative flex gap-3">
            <span className="relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full border border-line-soft"
              style={{ background: `color-mix(in oklab, ${t.color} 16%, var(--pf-panel))`, color: t.color }}>
              <t.icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <span className="font-medium text-ink">{topic ? topic.name : t.label}</span>
                {topic && (
                  <span className={cn("tabular-nums", delta === null ? "text-mist" : delta > 0 ? "text-mastered" : delta < 0 ? "text-beginning" : "text-mist")}>
                    {Math.round(topic.new_score * 100)}%{delta !== null && delta !== 0 ? ` (${delta > 0 ? "+" : ""}${delta})` : ""}
                  </span>
                )}
                <span className="text-xs text-haze">{relativeTime(e.created_at)}</span>
              </p>
              {(!compact || !topic) && (
                <p className={cn("mt-0.5 text-sm leading-relaxed text-mist", compact ? "line-clamp-1" : "line-clamp-2")}>
                  {compact && e.trigger === "progress" ? e.summary.split(". It is now")[0].replace(/^Completed /, "") : e.summary}
                </p>
              )}
              {!!e.changes.unlocked?.length && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {e.changes.unlocked.map((u) => (
                    <span key={u.id} className="inline-flex items-center gap-1 rounded-full bg-mastered/15 px-2 py-0.5 text-xs text-mastered">
                      <Unlock className="size-3" /> {u.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}

export function MasteryRadar({ data, height = 300 }: { data: Dashboard["radar"]; height?: number }) {
  const rows = data.map((d) => ({ name: d.name, value: d.mastery_score === null ? 0 : Math.round(d.mastery_score * 100), assessed: d.assessed }));
  const assessed = data.filter((d) => d.assessed).length;
  if (rows.length < 3) return null;
  return (
    <div>
      <div className="w-full" style={{ height }}>
        <ResponsiveContainer>
          <RadarChart data={rows} outerRadius="66%">
            <PolarGrid stroke={C.line} />
            <PolarAngleAxis dataKey="name" tick={{ fill: C.mist, fontSize: 13 }}
              tickFormatter={(v: string) => (v.length > 14 ? `${v.slice(0, 13)}…` : v)} />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            <Radar dataKey="value" stroke={C.accent2} fill={C.accent2} fillOpacity={0.28} strokeWidth={2}
              dot={{ r: 3, fill: C.accent2 }} animationDuration={900} />
            <Tooltip contentStyle={TOOLTIP_STYLE}
              formatter={(v, _n, item) => [(item.payload as { assessed: boolean }).assessed ? `${v}%` : "Not assessed", "Mastery"]} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <p className="flex items-center justify-center gap-1.5 text-sm text-haze">
        <CircleDashed className="size-4" /> {assessed} of {rows.length} assessed
      </p>
    </div>
  );
}
