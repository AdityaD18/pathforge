"use client";

import * as Tabs from "@radix-ui/react-tabs";
import { Lock, Route } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { StartAssessmentButton } from "@/components/learner";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Meter, PageHeader, Panel, Skeleton, StatePill } from "@/components/ui/primitives";
import { ApiError } from "@/lib/api";
import { cn, pct, STATUS_LABEL } from "@/lib/format";
import { useRoadmap } from "@/lib/queries";
import type { Roadmap } from "@/lib/types";

import { SkillGraph } from "./skill-graph";

function Detail({ roadmap, topicId }: { roadmap: Roadmap; topicId: string }) {
  const node = roadmap.graph.nodes.find((n) => n.topic_id === topicId)!;
  const step = roadmap.steps.find((s) => s.topic_id === topicId);
  const name = (id: string) => roadmap.graph.nodes.find((n) => n.topic_id === id)?.name ?? id;
  const prereqs = roadmap.graph.edges.filter((e) => e.target === topicId).map((e) => e.source);
  const unlocks = roadmap.graph.edges.filter((e) => e.source === topicId).map((e) => e.target);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs text-haze">{node.domain}</p>
        <h2 className="mt-1 text-xl font-medium">{node.name}</h2>
        <div className="mt-2"><StatePill state={node.status === "mastered" ? "mastered" : node.state} /></div>
      </div>
      {node.mastery_score !== null && (
        <div>
          <Meter value={node.mastery_score} />
          <p className="mt-1.5 text-xs text-mist">{pct(node.mastery_score)} estimated mastery</p>
        </div>
      )}
      {step ? <p className="text-sm leading-relaxed text-mist">{step.reason}</p> : <p className="text-sm text-mist">Mastered. It no longer takes time on your schedule.</p>}
      {step && (
        <p className="text-sm text-mist">Scheduled for week {step.start_week}{step.end_week > step.start_week ? `–${step.end_week}` : ""}, about {Math.round(step.est_hours_remaining)} hours.</p>
      )}
      <dl className="grid gap-3 text-sm">
        <div><dt className="text-haze">Prerequisites</dt><dd className="mt-0.5 text-ink">{prereqs.length ? prereqs.map(name).join(", ") : "None"}</dd></div>
        <div><dt className="text-haze">Unlocks</dt><dd className="mt-0.5 text-ink">{unlocks.length ? unlocks.map(name).join(", ") : "Nothing further on this path"}</dd></div>
      </dl>
      <div className="flex flex-wrap gap-2">
        <StartAssessmentButton topicId={topicId} size="sm" label={node.mastery_score === null ? "Take diagnostic" : "Retake assessment"} />
        {node.status !== "locked" && (
          <Button asChild size="sm" variant="secondary"><Link href={`/recommendations?topic=${topicId}`}>Resources</Link></Button>
        )}
      </div>
      {node.status === "locked" && (
        <p className="text-xs leading-relaxed text-haze">Resources unlock once the prerequisites are mastered. A diagnostic can still show you already know it.</p>
      )}
    </div>
  );
}

export default function RoadmapPage() {
  const q = useRoadmap();
  const [selected, setSelected] = useState<string | null>(null);
  const firstReady = useMemo(() => q.data?.steps.find((s) => s.status !== "locked")?.topic_id ?? null, [q.data]);
  const active = selected ?? firstReady;

  if (q.isPending) return <div className="grid gap-4"><Skeleton className="h-16 w-1/2" /><Skeleton className="h-[560px]" /></div>;
  if (q.error) {
    if (q.error instanceof ApiError && q.error.status === 409) {
      return <EmptyState icon={Route} title="No roadmap yet" body="Choose a target career and PathForge will lay out every topic you need, in prerequisite order."
        action={<Button asChild><Link href="/onboarding">Choose a career</Link></Button>} />;
    }
    return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  }
  const rm = q.data;
  const weeks = rm.steps.length ? rm.steps[rm.steps.length - 1].end_week : 0;

  return (
    <div>
      <PageHeader title={`${rm.career_title} roadmap`}
        description={rm.steps.length
          ? `${rm.summary.remaining} topics to go, about ${Math.round(rm.summary.total_hours_remaining)} hours over ${weeks} weeks at ${rm.weekly_hours} hours a week. Every topic is scheduled after the prerequisites it depends on.`
          : "Every topic on this path is mastered."}
        action={<Button asChild variant="secondary" size="sm"><Link href="/profile">Change pace or career</Link></Button>} />

      <Tabs.Root defaultValue="graph">
        <Tabs.List className="mb-4 inline-flex rounded-md border border-line p-0.5" aria-label="Roadmap view">
          {[["graph", "Skill graph"], ["schedule", "Schedule"]].map(([v, l]) => (
            <Tabs.Trigger key={v} value={v} className="rounded-[5px] px-4 py-1.5 text-sm text-mist data-[state=active]:bg-white/[0.08] data-[state=active]:text-ink">{l}</Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value="graph" className="grid gap-6 xl:grid-cols-[1fr_320px]">
          <Panel className="overflow-hidden">
            <SkillGraph roadmap={rm} selected={active} onSelect={setSelected} />
            <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-line-soft px-5 py-3 text-xs text-mist">
              <span>Columns follow prerequisite depth, left to right.</span>
              <span className="flex items-center gap-1.5"><span className="h-px w-5 bg-mastered" /> prerequisite met</span>
              <span className="flex items-center gap-1.5"><span className="h-px w-5 border-t border-dashed border-[#4c5c95]" /> not yet met</span>
            </div>
          </Panel>
          <Panel className="h-fit p-5">{active ? <Detail roadmap={rm} topicId={active} /> : <p className="text-sm text-mist">Select a topic in the graph.</p>}</Panel>
        </Tabs.Content>

        <Tabs.Content value="schedule">
          <Panel>
            <ol>
              {rm.steps.map((s) => (
                <li key={s.topic_id} className="grid gap-3 border-t border-line-soft px-5 py-4 first:border-t-0 md:grid-cols-[90px_1fr_auto] md:items-center">
                  <span className="text-sm text-mist tabular-nums">Week {s.start_week}{s.end_week > s.start_week ? `–${s.end_week}` : ""}</span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className={cn("font-medium", s.status === "locked" ? "text-mist" : "text-ink")}>{s.order}. {s.name}</span>
                      <span className={cn("inline-flex items-center gap-1 text-xs", s.status === "locked" ? "text-haze" : "text-electric-soft")}>
                        {s.status === "locked" && <Lock className="size-3" />}{STATUS_LABEL[s.status]}
                      </span>
                    </div>
                    <p className="mt-1 text-[13px] text-mist">{s.reason}</p>
                  </div>
                  <span className="text-sm text-mist tabular-nums">{Math.round(s.est_hours_remaining)} h</span>
                </li>
              ))}
            </ol>
          </Panel>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
