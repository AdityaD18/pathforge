"use client";

import { motion } from "framer-motion";
import { Lock, Sparkles } from "lucide-react";
import Link from "next/link";

import { CareerIcon } from "@/components/career-icon";
import { EventFeed, MasteryRadar, RecommendationCard, StartAssessmentButton } from "@/components/learner";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Meter, Panel, PanelHeader, Skeleton, StateDot } from "@/components/ui/primitives";
import { cn, pct, STATE_COLOR, STATUS_LABEL } from "@/lib/format";
import { useDashboard, useTopics } from "@/lib/queries";
import type { RoadmapStep } from "@/lib/types";

function NextStops({ steps }: { steps: RoadmapStep[] }) {
  const topics = useTopics();
  const name = (id: string) => topics.data?.find((t) => t.id === id)?.name ?? id;
  return (
    <ol className="relative">
      {steps.map((s, i) => {
        const first = i === 0;
        const locked = s.status === "locked";
        return (
          <motion.li key={s.topic_id} className="relative grid grid-cols-[28px_1fr] gap-4 pb-6 last:pb-0"
            initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08 * i, duration: 0.4, ease: [0.25, 1, 0.5, 1] }}>
            {i < steps.length - 1 && (
              <span className={cn("absolute top-7 bottom-0 left-[13px] w-px", locked ? "bg-line" : "bg-gradient-to-b from-electric/70 to-violet/40")} aria-hidden />
            )}
            <span className={cn("relative z-10 mt-1 flex size-7 items-center justify-center rounded-full border text-xs tabular-nums",
              first ? "border-electric bg-electric text-[#06102a] shadow-[0_0_18px_rgb(76_141_255/0.55)]" : locked ? "border-line bg-panel text-haze" : "border-electric/60 bg-panel text-electric-soft")}>
              {locked ? <Lock className="size-3" /> : s.order}
            </span>
            <div className={cn("min-w-0 rounded-lg", first && "glass -mt-1 p-4")}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3 className={cn("font-medium text-ink", first ? "text-xl" : "text-[16px] font-sans")}>{s.name}</h3>
                <span className="text-xs text-mist">Weeks {s.start_week}{s.end_week > s.start_week ? `–${s.end_week}` : ""}, about {Math.round(s.est_hours_remaining)} h</span>
              </div>
              <p className="mt-1 text-[13px] leading-relaxed text-mist">{s.reason}</p>
              {s.mastery_score !== null && (
                <div className="mt-2 flex items-center gap-3">
                  <Meter value={s.mastery_score} className="max-w-[220px]" color={STATE_COLOR[s.state]} />
                  <span className="text-xs text-mist">{pct(s.mastery_score)}</span>
                </div>
              )}
              {locked ? (
                <p className="mt-2 text-xs text-haze">{STATUS_LABEL.locked}: finish {s.unmet_prerequisites.map(name).join(", ")} first.</p>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  <StartAssessmentButton topicId={s.topic_id} size="sm" variant={first ? "primary" : "secondary"}
                    label={s.mastery_score === null ? "Take diagnostic" : "Retake assessment"} />
                  <Button asChild size="sm" variant="ghost"><Link href={`/recommendations?topic=${s.topic_id}`}>Resources</Link></Button>
                </div>
              )}
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}

export default function DashboardPage() {
  const q = useDashboard();
  if (q.isPending) return <div className="grid gap-6"><Skeleton className="h-20 w-2/3" /><Skeleton className="h-[420px]" /></div>;
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;
  if (!d.career || !d.roadmap_summary) {
    return <EmptyState icon={Sparkles} title="Choose a target career" body="Your roadmap, recommendations and progress all start from the career you're aiming for."
      action={<Button asChild><Link href="/onboarding">Choose a career</Link></Button>} />;
  }
  const s = d.roadmap_summary;
  const name = d.profile.display_name?.split(" ")[0];

  return (
    <div>
      <header className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="flex items-center gap-2 text-sm text-mist">
            <CareerIcon name={d.career.icon} className="size-4 text-violet-soft" />
            {name ? `${name}, your` : "Your"} {d.career.title} path
          </p>
          <h1 className="mt-3 text-[2.2rem] leading-tight font-medium sm:text-[2.6rem]">
            {s.remaining === 0 ? "Every topic on this path is mastered." : `${s.mastered} of ${s.required_topics} topics mastered`}
          </h1>
          {s.remaining > 0 && (
            <p className="mt-2 text-[15px] text-mist">
              About {s.estimated_weeks} weeks left at {d.profile.weekly_hours} hours a week. {s.ready_now} topic{s.ready_now === 1 ? " is" : "s are"} ready to start now.
            </p>
          )}
        </div>
        <div className="w-full max-w-xs">
          <Meter value={s.progress} className="h-2" />
          <p className="mt-2 text-xs text-mist">{pct(s.progress)} of required topics mastered</p>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <Panel className="p-6">
          <div className="mb-6 flex items-baseline justify-between gap-4">
            <h2 className="text-xl font-medium">Next on your route</h2>
            <Link href="/roadmap" className="text-sm text-electric-soft hover:underline">Full roadmap</Link>
          </div>
          {d.next_steps.length ? <NextStops steps={d.next_steps} /> : (
            <p className="text-sm text-mist">Nothing left to schedule. Retake assessments to confirm your mastery, or switch careers in your profile.</p>
          )}
        </Panel>

        <div className="flex flex-col gap-6">
          <Panel>
            <PanelHeader title="Career skill profile" description="Model-estimated mastery for each of this career's topics." />
            <div className="px-3 pb-5">
              {d.stats.topics_assessed === 0 ? (
                <p className="px-2 pt-4 text-sm text-mist">Take your first diagnostic to see your profile take shape. It takes about four minutes.</p>
              ) : <MasteryRadar data={d.radar} />}
            </div>
          </Panel>
          <Panel>
            <PanelHeader title="What changed" />
            <div className="px-5 pt-4 pb-5"><EventFeed events={d.recent_events} /></div>
          </Panel>
        </div>
      </div>

      <section className="mt-10">
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2 className="text-xl font-medium">Recommended now</h2>
          <Link href="/recommendations" className="text-sm text-electric-soft hover:underline">Explore all</Link>
        </div>
        {d.recommendations.items.length ? (
          <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
            {d.recommendations.items.map((r, i) => <RecommendationCard key={r.resource_id} rec={r} rank={i + 1} />)}
          </div>
        ) : (
          <p className="text-sm text-mist">No recommendations right now: every unlocked topic&apos;s resources are completed or your roadmap is done.</p>
        )}
      </section>

      <dl className="mt-10 grid grid-cols-2 gap-x-8 gap-y-4 border-t border-line-soft pt-6 text-sm sm:grid-cols-4">
        {[
          ["Assessments counted", d.stats.assessments_taken],
          ["Topics assessed", d.stats.topics_assessed],
          ["Average estimated mastery", pct(d.stats.average_mastery)],
          ["Resources completed", d.stats.resources_completed],
        ].map(([k, v]) => (
          <div key={k as string}>
            <dt className="text-mist">{k}</dt>
            <dd className="numeral mt-1 text-2xl text-ink">{v}</dd>
          </div>
        ))}
      </dl>
      <StateLegend />
    </div>
  );
}

function StateLegend() {
  return (
    <p className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-haze">
      {(["beginning", "developing", "mastered"] as const).map((st) => (
        <span key={st} className="flex items-center gap-1.5"><StateDot state={st} />
          {{ beginning: "Beginning (below 40%)", developing: "Developing (40–69%)", mastered: "Mastered (70% and above)" }[st]}
        </span>
      ))}
    </p>
  );
}
