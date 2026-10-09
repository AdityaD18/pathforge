"use client";

import Link from "next/link";
import { useMemo } from "react";

import { StartAssessmentButton } from "@/components/learner";
import { ErrorState, PageHeader, Panel, Skeleton, StatePill } from "@/components/ui/primitives";
import { LEVEL_LABEL, masteryState, pct, relativeTime } from "@/lib/format";
import { useAssessments, useCareers, useMastery, useProfile, useTopics } from "@/lib/queries";
import type { Topic } from "@/lib/types";

export default function AssessmentsPage() {
  const topics = useTopics();
  const mastery = useMastery();
  const history = useAssessments();
  const profile = useProfile();
  const careers = useCareers();

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
  if (!groups || !mastery.data || !history.data) return <div className="grid gap-4"><Skeleton className="h-16 w-1/2" /><Skeleton className="h-96" /></div>;

  const byTopic = Object.fromEntries(mastery.data.map((m) => [m.topic_id, m]));
  const open = Object.fromEntries(history.data.filter((a) => a.status === "in_progress").map((a) => [a.topic_id, a]));

  const row = (t: Topic) => {
    const m = byTopic[t.id];
    const inProgress = open[t.id];
    return (
      <li key={t.id} className="grid gap-3 border-t border-line-soft px-5 py-4 first:border-t-0 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-medium text-ink">{t.name}</span>
            <StatePill state={masteryState(m?.mastery_score)} />
          </div>
          <p className="mt-1 text-[13px] text-mist">
            {m ? `${LEVEL_LABEL[m.level]}, ${pct(m.mastery_score)} estimated mastery, updated ${relativeTime(m.updated_at)}.` : t.description}
          </p>
        </div>
        {inProgress ? (
          <Link href={`/assessments/${inProgress.id}`} className="text-sm text-electric-soft hover:underline">Resume assessment</Link>
        ) : (
          <StartAssessmentButton topicId={t.id} size="sm" variant={m ? "secondary" : "primary"} label={m ? "Retake" : "Start diagnostic"} />
        )}
      </li>
    );
  };

  const submitted = history.data.filter((a) => a.status === "submitted");

  return (
    <div>
      <PageHeader title="Assessments"
        description="Five questions per topic, ordered from easy to hard. Retakes favour questions you haven't seen and lean harder once you're past beginner level. You can assess any topic, including ones still locked on your roadmap." />

      <div className="grid gap-8 xl:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-8">
          <Panel>
            <h2 className="px-5 pt-5 pb-3 text-lg font-medium">{groups.careerTitle ? `${groups.careerTitle} topics` : "Topics"}</h2>
            <ul>{groups.path.map(row)}</ul>
          </Panel>
          {groups.other.length > 0 && (
            <Panel>
              <h2 className="px-5 pt-5 pb-3 text-lg font-medium">Prerequisites and other topics</h2>
              <ul>{groups.other.map(row)}</ul>
            </Panel>
          )}
        </div>

        <Panel className="h-fit">
          <h2 className="px-5 pt-5 pb-3 text-lg font-medium">History</h2>
          {submitted.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-mist">Submitted assessments appear here with the model&apos;s estimate and a full answer review.</p>
          ) : (
            <ul>
              {submitted.map((a) => (
                <li key={a.id} className="border-t border-line-soft">
                  <Link href={`/assessments/${a.id}`} className="grid grid-cols-[1fr_auto] gap-2 px-5 py-3 hover:bg-white/[0.02]">
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-ink">{a.topic_name}</span>
                      <span className="text-xs text-haze">{a.submitted_at ? relativeTime(a.submitted_at) : ""}</span>
                    </span>
                    <span className="text-right text-sm">
                      <span className="block text-ink">{!a.counted ? "Not counted" : a.predicted_level ? LEVEL_LABEL[a.predicted_level] : "—"}</span>
                      <span className="text-xs text-mist">{pct(a.accuracy)} correct</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
