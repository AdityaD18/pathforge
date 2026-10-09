"use client";

import { motion } from "framer-motion";
import { Clock, History, ListChecks, PlayCircle } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { InfoTip } from "@/components/info-tip";
import { StartAssessmentButton } from "@/components/learner";
import { Button } from "@/components/ui/button";
import { ErrorState, PageHeader, Panel, Skeleton } from "@/components/ui/primitives";
import { Ring, Sparkline } from "@/components/viz";
import { cn, LEVEL_LABEL, masteryState, pct, relativeTime, STATE_COLOR, STATE_LABEL } from "@/lib/format";
import { useAssessments, useCareers, useMastery, useProfile, useTopics } from "@/lib/queries";
import type { AssessmentRow, MasteryRow, Topic } from "@/lib/types";

function TopicCard({ t, m, open, trend, i }: { t: Topic; m?: MasteryRow; open?: AssessmentRow; trend: number[]; i: number }) {
  const state = masteryState(m?.mastery_score);
  return (
    <motion.li initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.4) }}
      className="surface flex flex-col gap-4 rounded-2xl p-5 transition-colors hover:border-line">
      <div className="flex items-start gap-4">
        <Ring value={m?.mastery_score ?? 0} size={64} stroke={6} color={STATE_COLOR[state]} gradient={false}
          label={m ? `${pct(m.mastery_score)} mastery` : "Not assessed"}>
          <span className="numeral text-base text-ink">{m ? Math.round(m.mastery_score * 100) : "—"}</span>
        </Ring>
        <div className="min-w-0 flex-1">
          <h3 className="font-sans text-[17px] leading-snug font-medium text-ink">{t.name}</h3>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm">
            <span className="flex items-center gap-1.5" style={{ color: STATE_COLOR[state] }}>
              <span className="size-2 rounded-full" style={{ background: STATE_COLOR[state] }} />{STATE_LABEL[state]}
            </span>
            {m && <span className="text-haze">· {LEVEL_LABEL[m.level]}</span>}
          </p>
        </div>
        {trend.length > 1 && <Sparkline values={trend} width={64} height={28} color={STATE_COLOR[state]} />}
      </div>
      <div className="mt-auto flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-sm text-haze"><Clock className="size-4" /> {m ? relativeTime(m.updated_at) : "5 questions · ~4 min"}</span>
        {open ? (
          <Button asChild size="sm"><Link href={`/assessments/${open.id}`}><PlayCircle /> Resume</Link></Button>
        ) : (
          <StartAssessmentButton topicId={t.id} size="sm" variant={m ? "secondary" : "primary"} label={m ? "Retest" : "Test me"} />
        )}
      </div>
    </motion.li>
  );
}

export default function AssessmentsPage() {
  const topics = useTopics();
  const mastery = useMastery();
  const history = useAssessments();
  const profile = useProfile();
  const careers = useCareers();
  const [tab, setTab] = useState<"path" | "other">("path");

  const groups = useMemo(() => {
    if (!topics.data || !profile.data || !careers.data) return null;
    const career = careers.data.find((c) => c.id === profile.data!.target_career_id);
    const onPath = new Set(career?.topics.map((t) => t.topic_id) ?? []);
    return {
      careerTitle: career?.title,
      path: topics.data.filter((t) => onPath.has(t.id)),
      other: topics.data.filter((t) => !onPath.has(t.id)),
    };
  }, [topics.data, profile.data, careers.data]);

  const error = topics.error ?? mastery.error ?? history.error ?? profile.error ?? careers.error;
  if (error) return <ErrorState error={error} onRetry={() => { topics.refetch(); mastery.refetch(); history.refetch(); }} />;
  if (!groups || !mastery.data || !history.data) {
    return <div className="grid gap-4"><Skeleton className="h-16 w-1/2" /><div className="grid gap-4 md:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-40" />)}</div></div>;
  }

  const byTopic = Object.fromEntries(mastery.data.map((m) => [m.topic_id, m]));
  const open = Object.fromEntries(history.data.filter((a) => a.status === "in_progress").map((a) => [a.topic_id, a]));
  const submitted = history.data.filter((a) => a.status === "submitted");
  const trend = (tid: string) => submitted.filter((a) => a.topic_id === tid && a.counted && a.mastery_score !== null)
    .sort((a, b) => (a.submitted_at ?? "").localeCompare(b.submitted_at ?? "")).map((a) => a.mastery_score!);
  const list = tab === "path" ? groups.path : groups.other;

  return (
    <div>
      <PageHeader icon={ListChecks} title="Assessments" description="5 quick questions per topic, easy to hard."
        action={<InfoTip label="How it works">Retakes favour questions you haven&apos;t seen and lean harder once you&apos;re past beginner. You can test any topic, even locked ones.</InfoTip>} />

      <div className="grid gap-8 xl:grid-cols-[1fr_340px]">
        <div>
          <div className="mb-5 inline-flex rounded-full border border-line p-1" role="tablist">
            {([["path", groups.careerTitle ? `${groups.careerTitle} topics` : "Career topics", groups.path.length], ["other", "Prerequisites & more", groups.other.length]] as const).map(([v, l, n]) => (
              <button key={v} role="tab" aria-selected={tab === v} onClick={() => setTab(v)}
                className={cn("rounded-full px-4 py-1.5 text-sm transition-colors", tab === v ? "bg-electric text-on-accent" : "text-mist hover:text-ink")}>
                {l} <span className="opacity-75">{n}</span>
              </button>
            ))}
          </div>
          <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {list.map((t, i) => <TopicCard key={t.id} t={t} m={byTopic[t.id]} open={open[t.id]} trend={trend(t.id)} i={i} />)}
          </ul>
        </div>

        <Panel className="h-fit">
          <h2 className="flex items-center gap-2 px-5 pt-5 pb-3 text-xl font-medium"><History className="size-5 text-electric-soft" /> History</h2>
          {submitted.length === 0 ? (
            <p className="px-5 pb-6 text-mist">Your results will show up here.</p>
          ) : (
            <ul className="max-h-[640px] overflow-y-auto pb-2">
              {submitted.map((a) => {
                const st = a.counted ? masteryState(a.mastery_score) : "not_assessed";
                return (
                  <li key={a.id}>
                    <Link href={`/assessments/${a.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-ink/[0.03]">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold tabular-nums"
                        style={{ background: `color-mix(in oklab, ${STATE_COLOR[st]} 16%, transparent)`, color: STATE_COLOR[st] }}>
                        {a.counted && a.mastery_score !== null ? Math.round(a.mastery_score * 100) : "—"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] text-ink">{a.topic_name}</span>
                        <span className="text-sm text-haze">{!a.counted ? "Not counted" : a.predicted_level ? LEVEL_LABEL[a.predicted_level] : "—"} · {a.submitted_at ? relativeTime(a.submitted_at) : ""}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
