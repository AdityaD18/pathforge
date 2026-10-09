"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft, ArrowRight, Check, ChevronDown, HelpCircle, Loader2, Route, Shuffle, Sparkles, ThumbsUp, TrendingDown, TrendingUp, Unlock, X,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { InfoTip } from "@/components/info-tip";
import { StartAssessmentButton } from "@/components/learner";
import { OptionText, RichText } from "@/components/rich-text";
import { Button } from "@/components/ui/button";
import { ErrorState, Panel, Skeleton } from "@/components/ui/primitives";
import { CountUp, Ring } from "@/components/viz";
import { celebrate } from "@/lib/celebrate";
import { cn, LEVEL_LABEL, masteryState, pct, STATE_COLOR } from "@/lib/format";
import { useAssessment, useSubmitAssessment } from "@/lib/queries";
import type { AdaptationEvent, Evidence, Level, PublicQuestion, ReviewItem } from "@/lib/types";

const CONFIDENCE = [
  { value: 1, label: "Guessing", icon: Shuffle },
  { value: 2, label: "Unsure", icon: HelpCircle },
  { value: 3, label: "Sure", icon: ThumbsUp },
];
const LETTERS = ["A", "B", "C", "D"];
const DIFF_COLOR = { easy: "text-mastered", medium: "text-developing", hard: "text-beginning" } as const;

export default function AssessmentPage() {
  const { id } = useParams<{ id: string }>();
  const q = useAssessment(id);
  const submit = useSubmitAssessment(id);

  if (q.isPending) return <Skeleton className="mx-auto h-[560px] max-w-3xl" />;
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
      adaptation={r.adaptation} modelVersion={r.estimate.model_version} fresh />;
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
  return <Runner topic={data.topic.name} questions={data.questions!} submitting={submit.isPending} error={submit.error}
    onSubmit={(responses) => submit.mutate(responses)} />;
}

type Answer = { selected: number | null; confidence: number | null; ms: number };

function Runner({ topic, questions, onSubmit, submitting, error }: {
  topic: string; questions: PublicQuestion[]; submitting: boolean; error: Error | null;
  onSubmit: (r: { question_id: string; selected_index: number; confidence: number; time_ms: number }[]) => void;
}) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>(() => questions.map(() => ({ selected: null, confidence: null, ms: 0 })));
  const shownAt = useRef(0); // set when each question is shown (see effect below)
  const q = questions[index];
  const a = answers[index];
  const last = index === questions.length - 1;

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
  const answered = answers.filter((x) => x.selected !== null && x.confidence !== null).length;

  function finish() {
    const now = performance.now();
    const final = answers.map((x, i) => (i === index ? { ...x, ms: x.ms + (now - shownAt.current) } : x));
    onSubmit(final.map((x, i) => ({ question_id: questions[i].id, selected_index: x.selected!, confidence: x.confidence!,
      time_ms: Math.min(Math.round(x.ms), 3_600_000) })));
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && ["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;
      const n = Number(e.key);
      if (n >= 1 && n <= 4) set({ selected: n - 1 });
      const k = e.key.toLowerCase();
      if (k === "g") set({ confidence: 1 });
      if (k === "u") set({ confidence: 2 });
      if (k === "s") set({ confidence: 3 });
      // Enter on a focused button already activates it; only handle Enter when nothing interactive is focused.
      if (e.key === "Enter" && ready && !(e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement)) {
        if (!last) go(index + 1);
        else if (complete && !submitting) finish();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between gap-4">
        <Link href="/assessments" className="inline-flex items-center gap-1.5 text-sm text-mist hover:text-ink">
          <ArrowLeft className="size-4" /> Exit
        </Link>
        <span className="text-sm text-mist">{topic}</span>
      </div>

      <div className="flex items-center gap-2" aria-label={`Question ${index + 1} of ${questions.length}`}>
        {questions.map((qq, i) => {
          const done = answers[i].selected !== null && answers[i].confidence !== null;
          return (
            <button key={qq.id} onClick={() => go(i)} aria-label={`Go to question ${i + 1}`} className="h-2.5 flex-1 overflow-hidden rounded-full bg-ink/[0.08]">
              <motion.span className={cn("block h-full rounded-full", i === index ? "bg-accent-gradient" : "bg-violet/70")}
                initial={false} animate={{ width: i === index || done ? "100%" : "0%" }} transition={{ duration: 0.35 }} />
            </button>
          );
        })}
      </div>
      <p className="mt-3 flex items-center justify-between text-sm text-mist">
        <span>Question <span className="numeral text-lg text-ink">{index + 1}</span> of {questions.length}</span>
        <span className={cn("font-medium capitalize", DIFF_COLOR[q.difficulty])}>{q.difficulty}</span>
      </p>

      <AnimatePresence mode="wait">
        <motion.div key={q.id} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.22, ease: [0.25, 1, 0.5, 1] }}>
          <Panel glass className="mt-4 p-6 sm:p-8">
            <h1 className="font-sans text-[1.35rem] leading-relaxed font-medium text-ink sm:text-[1.5rem]"><RichText text={q.prompt} /></h1>

            <div role="radiogroup" aria-label="Answer options" className="mt-7 grid gap-3">
              {q.options.map((opt, i) => {
                const sel = a.selected === i;
                return (
                  <motion.button key={i} role="radio" aria-checked={sel} onClick={() => set({ selected: i })}
                    whileTap={{ scale: 0.985 }}
                    className={cn("flex items-center gap-4 rounded-xl border-2 px-4 py-4 text-left text-base transition-colors",
                      sel ? "border-electric bg-electric/[0.12] text-ink" : "border-line-soft bg-abyss/40 text-ink/90 hover:border-line hover:bg-ink/[0.03]")}>
                    <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold transition-colors",
                      sel ? "bg-electric text-on-accent" : "bg-ink/[0.07] text-mist")}>
                      {sel ? <Check className="size-5" /> : LETTERS[i]}
                    </span>
                    <span className="min-w-0"><OptionText text={opt} /></span>
                  </motion.button>
                );
              })}
            </div>

            <div className="mt-8">
              <p id="conf-label" className="text-base font-medium text-ink">How sure are you?</p>
              <div role="radiogroup" aria-labelledby="conf-label" className="mt-3 grid grid-cols-3 gap-2.5">
                {CONFIDENCE.map((c) => {
                  const on = a.confidence === c.value;
                  return (
                    <motion.button key={c.value} role="radio" aria-checked={on} onClick={() => set({ confidence: c.value })} whileTap={{ scale: 0.97 }}
                      className={cn("flex flex-col items-center gap-1.5 rounded-xl border-2 px-3 py-3 text-sm font-medium transition-colors",
                        on ? "border-violet bg-violet/[0.14] text-ink" : "border-line-soft text-mist hover:border-line hover:text-ink")}>
                      <c.icon className={cn("size-5", on ? "text-violet-soft" : "text-haze")} />{c.label}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </Panel>
        </motion.div>
      </AnimatePresence>

      <div className="mt-6 flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => go(index - 1)} disabled={index === 0}><ArrowLeft /> Back</Button>
        <span className="text-sm text-haze">{answered}/{questions.length} answered</span>
        {!last ? (
          <Button size="lg" onClick={() => go(index + 1)} disabled={!ready}>Next <ArrowRight /></Button>
        ) : (
          <Button size="lg" onClick={finish} disabled={!complete || submitting}>
            {submitting ? <Loader2 className="animate-spin" /> : <Sparkles />} See my result
          </Button>
        )}
      </div>
      {last && ready && !complete && <p className="mt-3 text-right text-sm text-developing">Some earlier questions still need an answer.</p>}
      {error && <div className="mt-4"><ErrorState error={error} /></div>}
      <p className="mt-10 flex flex-wrap items-center justify-center gap-x-2 text-sm text-haze">
        Keys: 1–4 answer · G/U/S confidence · Enter next
        <InfoTip label="What's measured?">
          Your answers, confidence and time per question go to the proficiency model. Time only counts while this tab is visible.
          If three or more answers take under three seconds, the attempt is saved but doesn&apos;t change your mastery.
        </InfoTip>
      </p>
    </div>
  );
}

const LEVEL_ORDER: Level[] = ["beginner", "intermediate", "advanced"];

function Result({ topic, topicId, level, score, probabilities, previous, evidence, review, adaptation, modelVersion, submittedAt, fresh = false }: {
  topic: string; topicId: string; level: Level; score: number; probabilities: Record<Level, number>;
  previous: { level: Level; mastery_score: number } | null; evidence: Evidence; review: ReviewItem[];
  adaptation: AdaptationEvent | null; modelVersion: string | null; submittedAt?: string | null; fresh?: boolean;
}) {
  const state = masteryState(score);
  const delta = previous ? Math.round((score - previous.mastery_score) * 100) : null;
  const newlyMastered = state === "mastered" && (!previous || previous.mastery_score < 0.7);
  const celebrated = useRef(false);

  useEffect(() => {
    if (!fresh || celebrated.current) return;
    celebrated.current = true;
    if (newlyMastered || (adaptation?.changes.unlocked?.length ?? 0) > 0) celebrate("big");
    else if (delta !== null && delta > 0) celebrate("small");
  }, [fresh, newlyMastered, adaptation, delta]);

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/assessments" className="mb-6 inline-flex items-center gap-1.5 text-sm text-mist hover:text-ink">
        <ArrowLeft className="size-4" /> All assessments
      </Link>

      <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.25, 1, 0.5, 1] }}
        className="glass relative overflow-hidden rounded-3xl p-6 text-center sm:p-10">
        <span className="absolute -top-24 left-1/2 size-80 -translate-x-1/2 rounded-full blur-3xl" style={{ background: `color-mix(in oklab, ${STATE_COLOR[state]} 22%, transparent)` }} aria-hidden />
        <p className="relative text-base text-mist">{topic}{submittedAt ? ` · ${new Date(submittedAt).toLocaleDateString()}` : ""}</p>
        {newlyMastered && (
          <motion.p initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", delay: 0.6 }}
            className="relative mx-auto mt-3 inline-flex items-center gap-2 rounded-full bg-mastered/15 px-4 py-1.5 text-sm font-medium text-mastered">
            <Sparkles className="size-4" /> Topic mastered!
          </motion.p>
        )}
        <div className="relative mt-6 flex justify-center">
          <Ring value={score} size={220} stroke={18} color={STATE_COLOR[state]} gradient={false} label={`${Math.round(score * 100)}% estimated mastery`}>
            <CountUp value={score * 100} format={(v) => `${Math.round(v)}%`} className="numeral text-6xl text-ink" duration={1.4} />
            <span className="mt-1 text-sm text-mist">mastery</span>
          </Ring>
        </div>
        <h1 className="relative mt-6 text-[2.4rem] leading-none font-medium">{LEVEL_LABEL[level]}</h1>
        {delta !== null && (
          <p className={cn("relative mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium",
            delta > 0 ? "bg-mastered/15 text-mastered" : delta < 0 ? "bg-beginning/15 text-beginning" : "bg-ink/[0.06] text-mist")}>
            {delta > 0 ? <TrendingUp className="size-4" /> : delta < 0 ? <TrendingDown className="size-4" /> : null}
            {delta > 0 ? `+${delta}` : delta < 0 ? delta : "No change"} from {Math.round(previous!.mastery_score * 100)}%
          </p>
        )}

        <div className="relative mx-auto mt-8 flex max-w-md justify-center gap-2" aria-label={`${evidence.correct} of ${evidence.total} correct`}>
          {review.map((r, i) => (
            <motion.span key={r.id} initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: 0.5 + i * 0.1, type: "spring", stiffness: 300, damping: 15 }}
              title={`Question ${i + 1} (${r.difficulty}): ${r.is_correct ? "correct" : "wrong"}`}
              className={cn("flex size-11 items-center justify-center rounded-xl", r.is_correct ? "bg-mastered/15 text-mastered" : "bg-beginning/15 text-beginning")}>
              {r.is_correct ? <Check className="size-5" /> : <X className="size-5" />}
            </motion.span>
          ))}
        </div>
        <p className="relative mt-3 text-sm text-mist">{evidence.correct} of {evidence.total} correct · median {evidence.median_seconds ?? "—"}s per question</p>
      </motion.section>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Panel className="p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-medium">Level probabilities</h2>
            <InfoTip>
              Mastery = P(intermediate) × 0.5 + P(advanced). Model {modelVersion ?? "unknown"}, trained on simulated learners;
              see <Link href="/ml" className="underline underline-offset-2">model evaluation</Link>.
            </InfoTip>
          </div>
          <div className="mt-5 space-y-4">
            {LEVEL_ORDER.map((l, i) => (
              <div key={l}>
                <div className="mb-1.5 flex justify-between text-sm"><span className={l === level ? "font-medium text-ink" : "text-mist"}>{LEVEL_LABEL[l]}</span><span className="tabular-nums text-ink">{pct(probabilities[l])}</span></div>
                <div className="h-3 overflow-hidden rounded-full bg-ink/[0.07]">
                  <motion.div className={cn("h-full rounded-full", l === level ? "bg-accent-gradient" : "bg-ink/25")}
                    initial={{ width: 0 }} animate={{ width: `${probabilities[l] * 100}%` }} transition={{ duration: 0.9, delay: 0.2 + i * 0.1 }} />
                </div>
              </div>
            ))}
          </div>
          {evidence.sure_answers > 0 && (
            <p className="mt-5 text-sm text-mist">Marked sure: {evidence.sure_answers - evidence.sure_but_wrong} of {evidence.sure_answers} right</p>
          )}
        </Panel>

        <Panel className="flex flex-col p-6">
          <h2 className="text-xl font-medium">What&apos;s next</h2>
          {adaptation ? (
            <>
              <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-mist">{adaptation.summary}</p>
              {!!adaptation.changes.unlocked?.length && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {adaptation.changes.unlocked.map((u, i) => (
                    <motion.span key={u.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 + i * 0.1 }}>
                      <Link href={`/recommendations?topic=${u.id}`}
                        className="inline-flex items-center gap-1.5 rounded-full border border-mastered/40 bg-mastered/10 px-3 py-1 text-sm text-mastered hover:bg-mastered/20">
                        <Unlock className="size-3.5" /> Unlocked: {u.name}
                      </Link>
                    </motion.span>
                  ))}
                </div>
              )}
            </>
          ) : <p className="mt-2 text-sm text-mist">Keep going on your roadmap or find a course for this topic.</p>}
          <div className="mt-auto flex flex-wrap gap-2 pt-6">
            <Button asChild><Link href={`/recommendations?topic=${topicId}`}><Sparkles /> Courses for {topic}</Link></Button>
            <Button asChild variant="secondary"><Link href="/roadmap"><Route /> Roadmap</Link></Button>
          </div>
        </Panel>
      </div>

      <AnswerReview review={review} />
    </div>
  );
}

function AnswerReview({ review }: { review: ReviewItem[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <section className="mt-10">
      <h2 className="text-2xl font-medium">Review your answers</h2>
      <ol className="mt-4 space-y-3">
        {review.map((r, i) => {
          const isOpen = open === r.id;
          return (
            <li key={r.id}>
              <Panel className="overflow-hidden">
                <button type="button" onClick={() => setOpen(isOpen ? null : r.id)} aria-expanded={isOpen}
                  className="flex w-full items-center gap-4 p-4 text-left sm:p-5">
                  <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg",
                    r.is_correct ? "bg-mastered/15 text-mastered" : "bg-beginning/15 text-beginning")}>
                    {r.is_correct ? <Check className="size-5" /> : <X className="size-5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-1 text-[15px] text-ink"><RichText text={r.prompt} /></span>
                    <span className="text-sm text-haze">Q{i + 1} · <span className={DIFF_COLOR[r.difficulty]}>{r.difficulty}</span>
                      {r.confidence ? ` · ${CONFIDENCE.find((c) => c.value === r.confidence)?.label.toLowerCase()}` : ""}
                      {r.time_ms !== null ? ` · ${Math.round(r.time_ms / 1000)}s` : ""}</span>
                  </span>
                  <ChevronDown className={cn("size-5 shrink-0 text-haze transition-transform", isOpen && "rotate-180")} />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                      <div className="border-t border-line-soft px-5 pt-4 pb-5">
                        <p className="text-[15px] text-ink"><RichText text={r.prompt} /></p>
                        <ul className="mt-3 space-y-1.5 text-[15px]">
                          {r.options.map((o, oi) => (
                            <li key={oi} className={cn("flex items-center gap-2 rounded-lg px-3 py-2",
                              oi === r.correct_index ? "bg-mastered/10 text-ink" : oi === r.selected_index ? "bg-beginning/10 text-ink" : "text-mist")}>
                              <span className="w-5 text-sm text-haze">{LETTERS[oi]}</span><span className="min-w-0 flex-1"><OptionText text={o} /></span>
                              {oi === r.correct_index && <Check className="size-4 text-mastered" />}
                              {oi === r.selected_index && oi !== r.correct_index && <X className="size-4 text-beginning" />}
                            </li>
                          ))}
                        </ul>
                        <p className="mt-3 text-sm leading-relaxed text-mist"><RichText text={r.explanation} /></p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Panel>
            </li>
          );
        })}
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
      <Panel className="border-developing/35 p-6 text-center sm:p-10">
        <span className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-developing/15 text-developing"><HelpCircle className="size-8" /></span>
        <p className="mt-4 text-base text-mist">{topic}</p>
        <h1 className="mt-1 text-[2rem] leading-tight font-medium">Too fast to count</h1>
        <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-mist">{reason}</p>
        <p className="mt-2 text-sm text-haze">{evidence.correct}/{evidence.total} correct · {evidence.rapid_answers} answered in under 3 s</p>
        <div className="mt-6 flex justify-center"><StartAssessmentButton topicId={topicId} label="Try again" size="lg" /></div>
      </Panel>
      <AnswerReview review={review} />
    </div>
  );
}
