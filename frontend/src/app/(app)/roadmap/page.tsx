"use client";

import * as Tabs from "@radix-ui/react-tabs";
import { motion } from "framer-motion";
import { CalendarRange, Clock, Flag, GitBranch, Lock, Route, Settings2, Sparkles, Target } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { InfoTip } from "@/components/info-tip";
import { StartAssessmentButton } from "@/components/learner";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, PageHeader, Panel, Skeleton } from "@/components/ui/primitives";
import { Ring } from "@/components/viz";
import { ApiError } from "@/lib/api";
import { C, pct, STATE_COLOR, STATE_LABEL } from "@/lib/format";
import { useRoadmap } from "@/lib/queries";
import type { Roadmap } from "@/lib/types";

import { SkillGraph } from "./skill-graph";

function Detail({ roadmap, topicId }: { roadmap: Roadmap; topicId: string }) {
  const node = roadmap.graph.nodes.find((n) => n.topic_id === topicId)!;
  const step = roadmap.steps.find((s) => s.topic_id === topicId);
  const name = (id: string) => roadmap.graph.nodes.find((n) => n.topic_id === id)?.name ?? id;
  const prereqs = roadmap.graph.edges.filter((e) => e.target === topicId).map((e) => e.source);
  const unlocks = roadmap.graph.edges.filter((e) => e.source === topicId).map((e) => e.target);
  const mastered = node.status === "mastered";
  const state = mastered ? "mastered" : node.state;
  const statusOf = (id: string) => roadmap.graph.nodes.find((n) => n.topic_id === id)?.status;
  return (
    <motion.div key={topicId} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col gap-5">
      <div className="flex items-center gap-4">
        <Ring value={node.mastery_score ?? 0} size={84} stroke={8} color={STATE_COLOR[state]} gradient={false}>
          <span className="numeral text-xl text-ink">{node.mastery_score === null ? "—" : Math.round(node.mastery_score * 100)}</span>
        </Ring>
        <div className="min-w-0">
          <p className="text-sm text-haze">{node.domain}</p>
          <h2 className="text-2xl leading-tight font-medium">{node.name}</h2>
          <p className="mt-1 flex items-center gap-1.5 text-sm" style={{ color: STATE_COLOR[state] }}>
            <span className="size-2 rounded-full" style={{ background: STATE_COLOR[state] }} />{STATE_LABEL[state]}
            {node.is_goal && <span className="ml-2 inline-flex items-center gap-1 text-violet-soft"><Flag className="size-3.5" /> goal</span>}
          </p>
        </div>
      </div>

      {step && (
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/[0.06] px-3 py-1 text-ink"><CalendarRange className="size-4 text-electric-soft" />
            Week {step.start_week}{step.end_week > step.start_week ? `–${step.end_week}` : ""}</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/[0.06] px-3 py-1 text-ink"><Clock className="size-4 text-violet-soft" /> ~{Math.round(step.est_hours_remaining)} h</span>
          <InfoTip>{step.reason}</InfoTip>
        </div>
      )}

      {[["Needs", prereqs], ["Unlocks", unlocks]].map(([label, ids]) => (
        <div key={label as string}>
          <p className="mb-2 text-sm text-haze">{label as string}</p>
          <div className="flex flex-wrap gap-1.5">
            {(ids as string[]).length ? (ids as string[]).map((id) => (
              <span key={id} className="inline-flex items-center gap-1.5 rounded-full border border-line-soft px-2.5 py-1 text-sm text-ink">
                <span className="size-2 rounded-full" style={{ background: statusOf(id) === "mastered" ? C.mastered : statusOf(id) === "locked" ? C.locked : C.accent }} />
                {name(id)}
              </span>
            )) : <span className="text-sm text-mist">{label === "Needs" ? "Nothing, start any time" : "End of this branch"}</span>}
          </div>
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        <StartAssessmentButton topicId={topicId} label={node.mastery_score === null ? "Test me" : "Retest"} />
        {node.status !== "locked" && (
          <Button asChild variant="secondary"><Link href={`/recommendations?topic=${topicId}`}><Sparkles /> Courses</Link></Button>
        )}
      </div>
      {node.status === "locked" && <p className="flex items-center gap-1.5 text-sm text-haze"><Lock className="size-4" /> Courses unlock after the prerequisites. A test can still show you know it.</p>}
    </motion.div>
  );
}

/** Week-by-week timeline: one bar per remaining topic. */
function Timeline({ rm, onSelect }: { rm: Roadmap; onSelect: (id: string) => void }) {
  const weeks = rm.steps.length ? rm.steps[rm.steps.length - 1].end_week : 0;
  if (!weeks) return <p className="p-6 text-mist">Every topic on this path is mastered.</p>;
  const cols = Array.from({ length: weeks }, (_, i) => i + 1);
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px] p-5 sm:p-6">
        <div className="mb-2 grid items-end gap-2 text-xs text-haze" style={{ gridTemplateColumns: `200px repeat(${weeks}, minmax(28px, 1fr))` }}>
          <span>Topic</span>
          {cols.map((w) => <span key={w} className="text-center">{weeks > 16 ? (w % 2 ? w : "") : `W${w}`}</span>)}
        </div>
        <ol className="space-y-2">
          {rm.steps.map((s, i) => {
            const locked = s.status === "locked";
            const color = locked ? C.locked : s.mastery_score !== null ? STATE_COLOR[s.state] : C.accent;
            return (
              <li key={s.topic_id} className="grid items-center gap-2" style={{ gridTemplateColumns: `200px repeat(${weeks}, minmax(28px, 1fr))` }}>
                <button type="button" onClick={() => onSelect(s.topic_id)} className="flex min-w-0 items-center gap-2 text-left text-sm text-ink hover:text-electric-soft">
                  <span className="numeral w-5 shrink-0 text-haze">{s.order}</span>
                  <span className="truncate">{s.name}</span>
                  {locked && <Lock className="size-3.5 shrink-0 text-haze" />}
                </button>
                <motion.span initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.04 * i, duration: 0.45, ease: [0.25, 1, 0.5, 1] }}
                  className="relative h-8 origin-left rounded-lg" title={`${s.name}: week ${s.start_week}–${s.end_week}, ~${Math.round(s.est_hours_remaining)} h`}
                  style={{ gridColumn: `${s.start_week + 1} / ${s.end_week + 2}`, background: `color-mix(in oklab, ${color} ${locked ? 35 : 75}%, transparent)`,
                    border: `1px solid ${color}` }}>
                  <span className="absolute inset-y-0 left-2 flex items-center text-xs font-medium whitespace-nowrap text-ink">{Math.round(s.est_hours_remaining)}h</span>
                </motion.span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

export default function RoadmapPage() {
  const q = useRoadmap();
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState("graph");
  const firstReady = useMemo(() => q.data?.steps.find((s) => s.status !== "locked")?.topic_id ?? null, [q.data]);
  const active = selected ?? firstReady;

  if (q.isPending) return <div className="grid gap-4"><Skeleton className="h-16 w-1/2" /><Skeleton className="h-[600px]" /></div>;
  if (q.error) {
    if (q.error instanceof ApiError && q.error.status === 409) {
      return <EmptyState icon={Route} title="No roadmap yet" body="Pick a career and we'll lay out every topic you need, in the right order."
        action={<Button asChild><Link href="/onboarding">Choose a career</Link></Button>} />;
    }
    return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  }
  const rm = q.data;
  const weeks = rm.steps.length ? rm.steps[rm.steps.length - 1].end_week : 0;
  const sm = rm.summary;

  return (
    <div>
      <PageHeader icon={Route} eyebrow="Your roadmap" title={rm.career_title}
        action={<Button asChild variant="secondary" size="sm"><Link href="/profile"><Settings2 /> Change pace or career</Link></Button>} />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { icon: Target, label: "mastered", value: `${sm.mastered}/${sm.required_topics}`, color: C.mastered },
          { icon: GitBranch, label: "ready now", value: String(sm.ready_now), color: C.accent },
          { icon: Clock, label: "hours left", value: String(Math.round(sm.total_hours_remaining)), color: C.accent2 },
          { icon: CalendarRange, label: `weeks at ${rm.weekly_hours} h/wk`, value: String(weeks), color: C.developing },
        ].map((x) => (
          <div key={x.label} className="surface flex items-center gap-3 rounded-xl p-4">
            <span className="flex size-10 items-center justify-center rounded-lg" style={{ background: `color-mix(in oklab, ${x.color} 16%, transparent)`, color: x.color }}><x.icon className="size-5" /></span>
            <span><span className="numeral block text-2xl leading-none text-ink">{x.value}</span><span className="text-sm text-mist">{x.label}</span></span>
          </div>
        ))}
      </div>

      <Tabs.Root value={tab} onValueChange={setTab}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Tabs.List className="inline-flex rounded-full border border-line p-1" aria-label="Roadmap view">
            {[["graph", "Skill map"], ["timeline", "Timeline"]].map(([v, l]) => (
              <Tabs.Trigger key={v} value={v} className="rounded-full px-5 py-1.5 text-sm text-mist data-[state=active]:bg-electric data-[state=active]:text-on-accent">{l}</Tabs.Trigger>
            ))}
          </Tabs.List>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-mist">
            {(["mastered", "developing", "beginning"] as const).map((s) => (
              <span key={s} className="flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: STATE_COLOR[s] }} />{STATE_LABEL[s]}</span>
            ))}
            <span className="flex items-center gap-1.5"><Lock className="size-3.5" /> Locked</span>
          </div>
        </div>

        <Tabs.Content value="graph" className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <Panel className="overflow-hidden"><SkillGraph roadmap={rm} selected={active} onSelect={setSelected} /></Panel>
          <Panel className="h-fit p-6">{active ? <Detail roadmap={rm} topicId={active} /> : <p className="text-mist">Tap a topic on the map.</p>}</Panel>
        </Tabs.Content>

        <Tabs.Content value="timeline">
          <Panel><Timeline rm={rm} onSelect={(id) => { setSelected(id); setTab("graph"); }} /></Panel>
          {sm.progress > 0 && <p className="mt-3 text-sm text-haze">{pct(sm.progress)} of the path is already mastered and not shown.</p>}
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
