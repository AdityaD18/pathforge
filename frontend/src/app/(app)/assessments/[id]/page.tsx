"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Check, Loader2, X } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { StartAssessmentButton } from "@/components/learner";
import { OptionText, RichText } from "@/components/rich-text";
import { Button } from "@/components/ui/button";
import { ErrorState, Meter, Panel, Skeleton } from "@/components/ui/primitives";
import { cn, LEVEL_LABEL, pct, STATE_COLOR, masteryState } from "@/lib/format";
import { useAssessment, useSubmitAssessment } from "@/lib/queries";
import type { AdaptationEvent, Evidence, Level, PublicQuestion, ReviewItem } from "@/lib/types";

const CONFIDENCE = [
  { value: 1, label: "Guessing" },
  { value: 2, label: "Unsure" },
  { value: 3, label: "Sure" },
];

export default function AssessmentPage() {
  const { id } = useParams<{ id: string }>();
  const q = useAssessment(id);
  const submit = useSubmitAssessment(id);

  if (q.isPending) return <Skeleton className="h-[520px] max-w-3xl" />;
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const data = q.data;

  if (submit.data && !submit.data.counted) {
    const r = submit.data;
    return <NotCounted topic={r.topic.name} topicId={r.topic.id} reason={r.excluded_reason!} evidence={r.evidence} review={r.review} />;
  }
  if (submit.data?.estimate) {
    const r = { ...submit.data, estimate: submit.data.estimate };
    return <Result topic={r.topic.name} topicId={r.topic.id} level={r.estimate.level} score={r.estimate.mastery_score}
      probabilities={r.estimate.probabilities} previous={r.previous} evidence={r.evidence} review={r.review}
      adaptation={r.adaptation} modelVersion={r.estimate.model_version} />;
  }
  if (data.assessment.status === "submitted" && !data.assessment.counted) {
    return <NotCounted topic={data.topic.name} topicId={data.topic.id} reason={data.assessment.excluded_reason!} evidence={data.evidence!} review={data.review!} />;
  }
  if (data.assessment.status === "submitted") {
    const a = data.assessment;
    return <Result topic={data.topic.name} topicId={data.topic.id} level={a.predicted_level!} score={a.mastery_score!}
      probabilities={a.probabilities!} previous={null} evidence={data.evidence!} review={data.review!} adaptation={null}
      modelVersion={a.model_version} submittedAt={a.submitted_at} />;
  }
  return <Runner topic={data.topic.name} description={data.topic.description} questions={data.questions!}
    submitting={submit.isPending} error={submit.error}
    onSubmit={(responses) => submit.mutate(responses)} />;
}

type Answer = { selected: number | null; confidence: number | null; ms: number };

function Runner({ topic, description, questions, onSubmit, submitting, error }: {
  topic: string; description: string; questions: PublicQuestion[]; submitting: boolean; error: Error | null;
  onSubmit: (r: { question_id: string; selected_index: number; confidence: number; time_ms: number }[]) => void;
}) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>(() => questions.map(() => ({ selected: null, confidence: null, ms: 0 })));
  const shownAt = useRef(0); // set when each question is shown (see effect below)
  const q = questions[index];
  const a = answers[index];

  // Time is accumulated per question, including revisits, and paused while the tab is hidden.
  const flush = useCallback(() => {
    const now = performance.now();
    const elapsed = now - shownAt.current;
    shownAt.current = now;
    setAnswers((cur) => cur.map((x, i) => (i === index ? { ...x, ms: x.ms + elapsed } : x)));
  }, [index]);

  useEffect(() => {
    shownAt.current = performance.now();
    const onVis = () => (document.hidden ? flush() : (shownAt.current = performance.now()));
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [index, flush]);

  const set = (patch: Partial<Answer>) => setAnswers((cur) => cur.map((x, i) => (i === index ? { ...x, ...patch } : x)));
  const go = (to: number) => { flush(); setIndex(to); };
  const complete = answers.every((x) => x.selected !== null && x.confidence !== null);
  const ready = a.selected !== null && a.confidence !== null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && ["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;
      const n = Number(e.key);
      if (n >= 1 && n <= 4) set({ selected: n - 1 });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function finish() {
    const now = performance.now();
    const final = answers.map((x, i) => (i === index ? { ...x, ms: x.ms + (now - shownAt.current) } : x));
    onSubmit(final.map((x, i) => ({ question_id: questions[i].id, selected_index: x.selected!, confidence: x.confidence!,
      time_ms: Math.min(Math.round(x.ms), 3_600_000) })));
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/assessments" className="mb-6 inline-flex items-center gap-1.5 text-sm text-mist hover:text-ink">
        <ArrowLeft className="size-4" /> All assessments
      </Link>
      <h1 className="text-[2rem] leading-tight font-medium">{topic}</h1>
      <p className="mt-2 text-[15px] text-mist">{description}</p>

      <div className="mt-8 flex items-center gap-2" aria-label={`Question ${index + 1} of ${questions.length}`}>
        {questions.map((qq, i) => (
          <button key={qq.id} onClick={() => go(i)} aria-label={`Go to question ${i + 1}`}
            className={cn("h-1.5 flex-1 rounded-full transition-colors",
              i === index ? "bg-electric" : answers[i].selected !== null && answers[i].confidence !== null ? "bg-violet/70" : "bg-white/[0.08]")} />
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={q.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}>
          <Panel glass className="mt-6 p-6 sm:p-8">
            <p className="text-sm text-mist">Question {index + 1} of {questions.length}, {q.difficulty}</p>
            <h2 className="mt-3 font-sans text-[19px] leading-relaxed font-medium text-ink"><RichText text={q.prompt} /></h2>

            <div role="radiogroup" aria-label="Answer options" className="mt-6 grid gap-2.5">
              {q.options.map((opt, i) => {
                const sel = a.selected === i;
                return (
                  <button key={i} role="radio" aria-checked={sel} onClick={() => set({ selected: i })}
                    className={cn("flex items-start gap-3 rounded-md border px-4 py-3 text-left text-[15px] transition-colors",
                      sel ? "border-electric bg-electric/[0.1] text-ink" : "border-line-soft bg-abyss/40 text-ink/90 hover:border-line")}>
                    <span className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px]",
                      sel ? "border-electric bg-electric text-[#06102a]" : "border-line text-haze")}>{i + 1}</span>
                    <span className="min-w-0"><OptionText text={opt} /></span>
                  </button>
                );
              })}
            </div>

            <div className="mt-6">
              <p id="conf-label" className="text-sm text-mist">How sure are you?</p>
              <div role="radiogroup" aria-labelledby="conf-label" className="mt-2 inline-flex rounded-md border border-line p-0.5">
                {CONFIDENCE.map((c) => (
                  <button key={c.value} role="radio" aria-checked={a.confidence === c.value} onClick={() => set({ confidence: c.value })}
                    className={cn("rounded-[5px] px-4 py-1.5 text-sm transition-colors",
                      a.confidence === c.value ? "bg-violet text-[#0d0b2a]" : "text-mist hover:text-ink")}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          </Panel>
        </motion.div>
      </AnimatePresence>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => go(index - 1)} disabled={index === 0}>Previous</Button>
        {index < questions.length - 1 ? (
          <Button onClick={() => go(index + 1)} disabled={!ready}>Next question</Button>
        ) : (
          <Button onClick={finish} disabled={!complete || submitting}>
            {submitting && <Loader2 className="animate-spin" />} Submit answers
          </Button>
        )}
      </div>
      {!ready && <p className="mt-3 text-right text-xs text-haze">Choose an answer and how sure you are to continue. Keys 1–4 select an option.</p>}
      {index === questions.length - 1 && ready && !complete && (
        <p className="mt-3 text-right text-xs text-developing">Some earlier questions still need an answer or confidence rating.</p>
      )}
      {error && <div className="mt-4"><ErrorState error={error} /></div>}
      <p className="mt-10 text-xs leading-relaxed text-haze">
        Your answers, confidence and time per question are sent to the proficiency model. Time counts only while this tab is visible.
        If three or more answers take under three seconds, the attempt is saved but doesn&apos;t change your mastery estimate.
      </p>
    </div>
  );
}

const LEVEL_ORDER: Level[] = ["beginner", "intermediate", "advanced"];

function Result({ topic, topicId, level, score, probabilities, previous, evidence, review, adaptation, modelVersion, submittedAt }: {
  topic: string; topicId: string; level: Level; score: number; probabilities: Record<Level, number>;
  previous: { level: Level; mastery_score: number } | null; evidence: Evidence; review: ReviewItem[];
  adaptation: AdaptationEvent | null; modelVersion: string | null; submittedAt?: string | null;
}) {
  const state = masteryState(score);
  const delta = previous ? Math.round((score - previous.mastery_score) * 100) : null;
  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/assessments" className="mb-6 inline-flex items-center gap-1.5 text-sm text-mist hover:text-ink">
        <ArrowLeft className="size-4" /> All assessments
      </Link>
      <p className="text-sm text-mist">{topic}{submittedAt ? `, submitted ${new Date(submittedAt).toLocaleString()}` : ""}</p>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.25, 1, 0.5, 1] }}
        className="mt-3 grid gap-6 md:grid-cols-[1.1fr_1fr]">
        <Panel glass className="p-6 sm:p-8">
          <p className="text-sm text-mist">Estimated level</p>
          <h1 className="mt-1 text-[2.8rem] leading-none font-medium">{LEVEL_LABEL[level]}</h1>
          <div className="mt-6 flex items-end gap-4">
            <span className="numeral text-[3.2rem] leading-none" style={{ color: STATE_COLOR[state] }}>{Math.round(score * 100)}%</span>
            <span className="pb-1.5 text-sm text-mist">
              estimated mastery
              {delta !== null && <span className={cn("ml-2", delta > 0 ? "text-mastered" : delta < 0 ? "text-beginning" : "text-mist")}>
                {delta > 0 ? `up ${delta}` : delta < 0 ? `down ${-delta}` : "no change"} from {Math.round(previous!.mastery_score * 100)}%
              </span>}
            </span>
          </div>
          <div className="mt-6 space-y-2.5">
            {LEVEL_ORDER.map((l) => (
              <div key={l} className="grid grid-cols-[96px_1fr_44px] items-center gap-3 text-sm">
                <span className={l === level ? "text-ink" : "text-mist"}>{LEVEL_LABEL[l]}</span>
                <Meter value={probabilities[l]} />
                <span className="text-right tabular-nums text-mist">{pct(probabilities[l])}</span>
              </div>
            ))}
          </div>
          <p className="mt-5 text-xs leading-relaxed text-haze">
            Mastery = P(intermediate) × 0.5 + P(advanced). Model {modelVersion ?? "unknown"}, trained on simulated learners;
            see <Link href="/ml" className="underline underline-offset-2 hover:text-mist">model evaluation</Link>.
          </p>
        </Panel>

        <div className="flex flex-col gap-6">
          <Panel className="p-6">
            <h2 className="text-lg font-medium">What the model saw</h2>
            <p className="mt-1 text-sm text-mist">{evidence.correct} of {evidence.total} correct, median {evidence.median_seconds ?? "—"} s per question.</p>
            <ul className="mt-4 space-y-2 text-sm">
              {evidence.by_difficulty.map((d) => (
                <li key={d.difficulty} className="flex items-center justify-between">
                  <span className="capitalize text-mist">{d.difficulty}</span>
                  <span className="tabular-nums text-ink">{d.correct} / {d.total}</span>
                </li>
              ))}
              <li className="flex items-center justify-between border-t border-line-soft pt-2">
                <span className="text-mist">Marked sure but wrong</span>
                <span className="tabular-nums text-ink">{evidence.sure_answers ? `${evidence.sure_but_wrong} of ${evidence.sure_answers}` : "none marked sure"}</span>
              </li>
            </ul>
          </Panel>
          {adaptation && (
            <Panel className="border-violet/30 p-6">
              <h2 className="text-lg font-medium">How your plan changed</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink/90">{adaptation.summary}</p>
              {!!adaptation.changes.unlocked?.length && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {adaptation.changes.unlocked.map((u) => (
                    <Link key={u.id} href={`/recommendations?topic=${u.id}`}
                      className="rounded-full border border-mastered/40 px-2.5 py-0.5 text-xs text-mastered hover:bg-mastered/10">Unlocked: {u.name}</Link>
                  ))}
                </div>
              )}
            </Panel>
          )}
          <div className="flex flex-wrap gap-2">
            <Button asChild><Link href="/roadmap">View roadmap</Link></Button>
            <Button asChild variant="secondary"><Link href={`/recommendations?topic=${topicId}`}>Resources for {topic}</Link></Button>
          </div>
        </div>
      </motion.div>

      <AnswerReview review={review} />
    </div>
  );
}

function AnswerReview({ review }: { review: ReviewItem[] }) {
  return (
      <section className="mt-12">
      <h2 className="text-xl font-medium">Answer review</h2>
      <ol className="mt-4 space-y-3">
        {review.map((r, i) => (
          <li key={r.id}>
            <Panel className="p-5">
              <div className="flex items-start gap-3">
                <span className={cn("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full",
                  r.is_correct ? "bg-mastered/15 text-mastered" : "bg-beginning/15 text-beginning")}>
                  {r.is_correct ? <Check className="size-3.5" /> : <X className="size-3.5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-haze">Question {i + 1}, {r.difficulty}
                    {r.confidence ? `, you were ${CONFIDENCE.find((c) => c.value === r.confidence)?.label.toLowerCase()}` : ""}
                    {r.time_ms !== null ? `, ${Math.round(r.time_ms / 1000)} s` : ""}</p>
                  <p className="mt-1 text-[15px] text-ink"><RichText text={r.prompt} /></p>
                  <ul className="mt-3 space-y-1.5 text-sm">
                    {r.options.map((o, oi) => (
                      <li key={oi} className={cn("rounded-sm px-2 py-1",
                        oi === r.correct_index ? "bg-mastered/10 text-ink" : oi === r.selected_index ? "bg-beginning/10 text-ink" : "text-mist")}>
                        <OptionText text={o} />
                        {oi === r.correct_index && <span className="ml-2 text-xs text-mastered">correct answer</span>}
                        {oi === r.selected_index && oi !== r.correct_index && <span className="ml-2 text-xs text-beginning">your answer</span>}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-[13px] leading-relaxed text-mist"><RichText text={r.explanation} /></p>
                </div>
              </div>
            </Panel>
          </li>
        ))}
      </ol>
    </section>
  );
}

function NotCounted({ topic, topicId, reason, evidence, review }: {
  topic: string; topicId: string; reason: string; evidence: Evidence; review: ReviewItem[];
}) {
  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/assessments" className="mb-6 inline-flex items-center gap-1.5 text-sm text-mist hover:text-ink">
        <ArrowLeft className="size-4" /> All assessments
      </Link>
      <p className="text-sm text-mist">{topic}</p>
      <Panel className="mt-3 border-developing/35 p-6 sm:p-8">
        <h1 className="text-[2rem] leading-tight font-medium">This attempt wasn&apos;t counted</h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-mist">{reason}</p>
        <p className="mt-2 text-sm text-mist">{evidence.correct} of {evidence.total} correct, {evidence.rapid_answers} answered in under 3 seconds.</p>
        <div className="mt-6"><StartAssessmentButton topicId={topicId} label="Retake assessment" /></div>
      </Panel>
      <AnswerReview review={review} />
    </div>
  );
}
