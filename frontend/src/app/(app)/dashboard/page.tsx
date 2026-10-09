"use client";

import { motion } from "framer-motion";
import { ArrowRight, Award, BookOpen, CalendarCheck, Flame, Gauge as GaugeIcon, Lock, PlayCircle, Radar, Sparkles, Target, TrendingUp } from "lucide-react";
import Link from "next/link";

import { CareerIcon } from "@/components/career-icon";
import { CourseCard, CourseRow } from "@/components/course";
import { InfoTip } from "@/components/info-tip";
import { EventFeed, MasteryRadar, StartAssessmentButton } from "@/components/learner";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Panel, PanelHeader, Skeleton } from "@/components/ui/primitives";
import { BadgeGrid, CountUp, Gauge, Ring, StatTile, WeekDots } from "@/components/viz";
import { cn, pct, STATE_COLOR } from "@/lib/format";
import { useDashboard, useMyResources, useTopics } from "@/lib/queries";
import type { Dashboard, RoadmapStep } from "@/lib/types";

function UpNext({ steps }: { steps: RoadmapStep[] }) {
  const topics = useTopics();
  const name = (id: string) => topics.data?.find((t) => t.id === id)?.name ?? id;
  return (
    <ol className="grid gap-3">
      {steps.map((s, i) => {
        const first = i === 0;
        const locked = s.status === "locked";
        return (
          <motion.li key={s.topic_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07 * i, duration: 0.35 }}
            className={cn("relative flex items-center gap-4 rounded-xl border p-4",
              first ? "border-electric/50 bg-electric/[0.07]" : locked ? "border-line-soft opacity-75" : "border-line-soft bg-ink/[0.02]")}>
            <Ring value={s.mastery_score ?? 0} size={52} stroke={5} color={locked ? STATE_COLOR.not_assessed : STATE_COLOR[s.state]}
              label={s.mastery_score === null ? "Not assessed" : `${Math.round(s.mastery_score * 100)}% mastery`}>
              {locked ? <Lock className="size-4 text-haze" /> : <span className="numeral text-base text-ink">{s.order}</span>}
            </Ring>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h3 className="truncate font-sans text-[17px] font-medium text-ink">{s.name}</h3>
                {s.is_goal && <span className="rounded-full bg-violet/15 px-2 py-0.5 text-xs text-violet-soft">Career goal</span>}
              </div>
              <p className="mt-0.5 text-sm text-mist">
                {locked ? `After ${s.unmet_prerequisites.map(name).join(", ")}` : `Week ${s.start_week}${s.end_week > s.start_week ? `–${s.end_week}` : ""} · ~${Math.round(s.est_hours_remaining)} h`}
                {s.mastery_score !== null && ` · ${pct(s.mastery_score)}`}
              </p>
            </div>
            {!locked && (
              <div className="hidden shrink-0 gap-2 sm:flex">
                <Button asChild size="sm" variant="ghost"><Link href={`/recommendations?topic=${s.topic_id}`}><BookOpen /> Courses</Link></Button>
                <StartAssessmentButton topicId={s.topic_id} size="sm" variant={first ? "primary" : "secondary"}
                  label={s.mastery_score === null ? "Test me" : "Retest"} />
              </div>
            )}
          </motion.li>
        );
      })}
    </ol>
  );
}

function Hero({ d }: { d: Dashboard }) {
  const s = d.roadmap_summary!;
  const name = d.profile.display_name?.split(" ")[0];
  const next = d.next_steps.find((x) => x.status !== "locked");
  const f = d.insights.forecast;
  return (
    <section className="glass relative mb-8 overflow-hidden rounded-3xl p-6 sm:p-8">
      <span className="absolute -top-24 -right-16 size-72 rounded-full bg-violet/20 blur-3xl" aria-hidden />
      <span className="absolute -bottom-28 left-1/3 size-72 rounded-full bg-electric/15 blur-3xl" aria-hidden />
      <div className="relative grid items-center gap-8 lg:grid-cols-[1fr_auto]">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-line-soft bg-panel/60 px-3 py-1 text-sm text-mist">
            <CareerIcon name={d.career!.icon} className="size-4 text-violet-soft" /> {d.career!.title}
          </p>
          <h1 className="mt-4 text-[2.3rem] leading-[1.1] font-medium sm:text-[3rem]">
            {name ? <>Hi {name}, </> : null}
            {s.remaining === 0 ? <span className="text-gradient">path complete!</span>
              : <><span className="text-gradient">{s.mastered} of {s.required_topics}</span> topics mastered</>}
          </h1>
          {s.remaining > 0 && f && (
            <div className="mt-5 flex flex-wrap gap-2.5 text-sm">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/[0.06] px-3 py-1.5 text-ink">
                <CalendarCheck className="size-4 text-electric-soft" /> Finish ~{new Date(`${f.finish_date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/[0.06] px-3 py-1.5 text-ink">
                <Target className="size-4 text-violet-soft" /> {s.remaining} to go · {s.estimated_weeks} wk at {d.profile.weekly_hours} h/wk
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/[0.06] px-3 py-1.5 text-ink">
                <PlayCircle className="size-4 text-mastered" /> {s.ready_now} ready now
              </span>
            </div>
          )}
          <div className="mt-7 flex flex-wrap gap-3">
            {next && (
              <StartAssessmentButton topicId={next.topic_id} size="lg"
                label={next.mastery_score === null ? `Start: ${next.name}` : `Retest: ${next.name}`} />
            )}
            <Button asChild size="lg" variant="secondary"><Link href="/roadmap">See my roadmap <ArrowRight /></Link></Button>
          </div>
        </div>
        <div className="flex justify-center">
          <Ring value={s.progress} size={210} stroke={16} label={`${Math.round(s.progress * 100)}% of the path mastered`}>
            <CountUp value={s.progress * 100} format={(v) => `${Math.round(v)}%`} className="numeral text-5xl text-ink" />
            <span className="mt-1 text-sm text-mist">of your path</span>
          </Ring>
        </div>
      </div>
    </section>
  );
}

export default function DashboardPage() {
  const q = useDashboard();
  const mine = useMyResources();
  if (q.isPending) {
    return (
      <div className="grid gap-6">
        <Skeleton className="h-64" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
        <Skeleton className="h-[420px]" />
      </div>
    );
  }
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;
  if (!d.career || !d.roadmap_summary) {
    return <EmptyState icon={Sparkles} title="Pick where you're headed" body="Your roadmap, courses and progress all start from a target career."
      action={<Button asChild><Link href="/onboarding">Choose a career</Link></Button>} />;
  }
  const ins = d.insights;
  const inProgress = (mine.data ?? []).filter((r) => r.progress?.status === "in_progress").slice(0, 4);
  const earned = ins.badges.filter((b) => b.earned).length;

  return (
    <div>
      <Hero d={d} />

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile icon={Flame} value={ins.streak.current} label={`day streak · best ${ins.streak.longest}`} tone="developing" />
        <StatTile icon={GaugeIcon} value={(ins.readiness?.score ?? 0) * 100} format={(v) => `${Math.round(v)}%`} label="career readiness" tone="accent2" />
        <StatTile icon={TrendingUp} value={d.stats.assessments_taken} label="assessments" />
        <StatTile icon={BookOpen} value={d.stats.resources_completed} label="courses completed" tone="mastered" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.45fr_1fr]">
        <Panel>
          <PanelHeader icon={Target} title="Up next" action={<Link href="/roadmap" className="text-sm text-electric-soft hover:underline">Full roadmap</Link>} />
          <div className="p-5 sm:p-6">
            {d.next_steps.length ? <UpNext steps={d.next_steps} /> : <p className="text-mist">Nothing left to schedule. Nice.</p>}
          </div>
        </Panel>

        <div className="flex flex-col gap-6">
          {ins.readiness && (
            <Panel>
              <PanelHeader icon={GaugeIcon} title="Career readiness" action={<InfoTip>{ins.readiness.formula}</InfoTip>} />
              <div className="flex flex-col items-center px-5 pt-4 pb-6">
                <Gauge value={ins.readiness.score} label={`${Math.round(ins.readiness.score * 100)}% ready for ${ins.readiness.career_title}`}>
                  <CountUp value={ins.readiness.score * 100} format={(v) => `${Math.round(v)}%`} className="numeral text-4xl text-ink" />
                  <span className="text-sm text-mist">ready for {ins.readiness.career_title}</span>
                </Gauge>
              </div>
            </Panel>
          )}
          <Panel>
            <PanelHeader icon={CalendarCheck} title="This week" />
            <div className="flex flex-wrap items-center justify-between gap-4 px-5 pt-4 pb-6 sm:px-6">
              <WeekDots week={ins.week} />
              <p className="text-sm text-mist"><span className="numeral text-2xl text-ink">{ins.week.active_days}</span>/{ins.week.goal} active days</p>
            </div>
          </Panel>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel>
          <PanelHeader icon={Radar} title="Skill profile" />
          <div className="px-3 pb-5">
            {d.stats.topics_assessed === 0 ? (
              <p className="px-3 py-8 text-center text-mist">Take your first quick test (about 4 min) to see this fill in.</p>
            ) : <MasteryRadar data={d.radar} />}
          </div>
        </Panel>
        <Panel>
          <PanelHeader icon={Sparkles} title="What changed" />
          <div className="px-5 pt-5 pb-6 sm:px-6"><EventFeed events={d.recent_events} compact /></div>
        </Panel>
      </div>

      {inProgress.length > 0 && (
        <Panel className="mt-6">
          <PanelHeader icon={PlayCircle} title="Continue learning" />
          <div className="divide-y divide-line-soft px-5 pb-2 sm:px-6">
            {inProgress.map((r) => <CourseRow key={r.id} r={r} />)}
          </div>
        </Panel>
      )}

      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between gap-4">
          <h2 className="text-2xl font-medium">Courses for you</h2>
          <Link href="/recommendations" className="text-sm text-electric-soft hover:underline">See all</Link>
        </div>
        {d.recommendations.items.length ? (
          <div className="grid items-start gap-5 md:grid-cols-2 xl:grid-cols-3">
            {d.recommendations.items.map((r, i) => <CourseCard key={r.resource_id} rec={r} rank={i} />)}
          </div>
        ) : <p className="text-mist">You&apos;ve done every course for your unlocked topics.</p>}
      </section>

      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between gap-4">
          <h2 className="flex items-center gap-2 text-2xl font-medium"><Award className="size-6 text-developing" /> Badges <span className="text-lg text-haze">{earned}/{ins.badges.length}</span></h2>
          <Link href="/analytics#badges" className="text-sm text-electric-soft hover:underline">All badges</Link>
        </div>
        <BadgeGrid badges={ins.badges} limit={4} />
      </section>
    </div>
  );
}
