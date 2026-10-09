"use client";

import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, FlaskConical } from "lucide-react";
import { useState } from "react";
import { CartesianGrid, Line, ComposedChart, ReferenceLine, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from "recharts";

import { AXIS, GRID, SERIES, TOOLTIP_LABEL, TOOLTIP_STYLE } from "@/components/charts/chart-kit";
import { ErrorState, PageHeader, Panel, PanelHeader, Skeleton } from "@/components/ui/primitives";
import { C, cn, fixed, heatColor, heatInk, LEVEL_LABEL, pct } from "@/lib/format";
import { useMetrics } from "@/lib/queries";
import type { MlMetrics } from "@/lib/types";

function HBar({ value, max, label, emphasis }: { value: number; max: number; label: string; emphasis?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-ink/[0.07]">
        <motion.div className="h-full rounded-full" initial={{ width: 0 }} whileInView={{ width: `${Math.max(0, (value / max) * 100)}%` }}
          viewport={{ once: true }} transition={{ duration: 0.8, ease: [0.25, 1, 0.5, 1] }}
          style={{ background: emphasis ? "linear-gradient(90deg,var(--pf-accent),var(--pf-accent-2))" : C.locked }} />
      </div>
      <span className="w-14 text-right text-xs tabular-nums text-ink">{label}</span>
    </div>
  );
}

function Comparison({ m }: { m: MlMetrics }) {
  const rows = [...m.test.comparison].sort((a, b) => b.macro_f1 - a.macro_f1);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <caption className="sr-only">Held-out test metrics for each model and baseline</caption>
        <thead>
          <tr className="text-left text-xs text-mist">
            <th className="px-5 py-2 font-normal">Model</th>
            <th className="w-[200px] px-3 py-2 font-normal">Macro F1</th>
            <th className="px-3 py-2 text-right font-normal">Accuracy</th>
            <th className="px-3 py-2 text-right font-normal">Balanced acc.</th>
            <th className="px-3 py-2 text-right font-normal" title="Quadratic weighted kappa: agreement that penalises far-off levels more">QW kappa</th>
            <th className="px-3 py-2 text-right font-normal">Log loss</th>
            <th className="px-5 py-2 text-right font-normal">Brier</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className={cn("border-t border-line-soft", r.selected && "bg-electric/[0.06]")}>
              <td className="px-5 py-3">
                <span className="text-ink">{r.name}</span>
                <span className="mt-0.5 block text-xs text-haze">{r.selected ? "Selected by cross-validation, served in the app" : r.kind === "baseline" ? "Baseline" : "Candidate"}</span>
              </td>
              <td className="px-3 py-3"><HBar value={r.macro_f1} max={1} label={fixed(r.macro_f1)} emphasis={r.selected} /></td>
              <td className="px-3 py-3 text-right tabular-nums">{fixed(r.accuracy)}</td>
              <td className="px-3 py-3 text-right tabular-nums">{fixed(r.balanced_accuracy)}</td>
              <td className="px-3 py-3 text-right tabular-nums">{fixed(r.quadratic_kappa)}</td>
              <td className="px-3 py-3 text-right tabular-nums">{r.log_loss === null ? <span className="text-haze" title="Produces no probabilities">n/a</span> : fixed(r.log_loss)}</td>
              <td className="px-5 py-3 text-right tabular-nums">{r.brier === null ? <span className="text-haze">n/a</span> : fixed(r.brier)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Confusion({ title, cm }: { title: string; cm: MlMetrics["test"]["confusion_matrix"] }) {
  const [hover, setHover] = useState<[number, number] | null>(null);
  const [counts, setCounts] = useState(false);
  const total = cm.matrix.flat().reduce((a, b) => a + b, 0);
  return (
    <figure>
      <figcaption className="mb-3 flex items-center justify-between gap-3 text-[15px] text-ink">
        {title}
        <button type="button" onClick={() => setCounts(!counts)} className="rounded-full border border-line-soft px-2.5 py-0.5 text-xs text-mist hover:text-ink">
          {counts ? "Show %" : "Show counts"}
        </button>
      </figcaption>
      <table className="border-separate border-spacing-1 text-sm" onMouseLeave={() => setHover(null)}>
        <thead>
          <tr><th /><th colSpan={3} className="pb-1 font-normal text-mist">Predicted</th></tr>
          <tr><th />{cm.labels.map((l, j) => <th key={l} className={cn("w-[92px] font-normal", hover?.[1] === j ? "text-ink" : "text-mist")}>{LEVEL_LABEL[l]}</th>)}</tr>
        </thead>
        <tbody>
          {cm.matrix.map((row, i) => {
            const rowTotal = row.reduce((a, b) => a + b, 0);
            return (
              <tr key={cm.labels[i]}>
                <th scope="row" className={cn("pr-2 text-right font-normal", hover?.[0] === i ? "text-ink" : "text-mist")}>{LEVEL_LABEL[cm.labels[i]]}</th>
                {row.map((v, j) => {
                  const share = rowTotal ? v / rowTotal : 0;
                  const dim = hover && hover[0] !== i && hover[1] !== j;
                  return (
                    <td key={j} onMouseEnter={() => setHover([i, j])} tabIndex={0} onFocus={() => setHover([i, j])}
                      className={cn("h-16 cursor-default rounded-lg text-center tabular-nums transition-opacity", i === j && "ring-2 ring-ink/30", dim && "opacity-40")}
                      style={{ background: heatColor(share), color: heatInk(share) }}
                      title={`True ${cm.labels[i]}, predicted ${cm.labels[j]}: ${v} (${pct(share)} of row)`}>
                      <span className="block text-base font-semibold">{counts ? v : pct(share)}</span>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 min-h-5 text-sm text-mist">
        {hover ? `${cm.matrix[hover[0]][hover[1]]} of ${total} attempts: true ${LEVEL_LABEL[cm.labels[hover[0]]].toLowerCase()}, predicted ${LEVEL_LABEL[cm.labels[hover[1]]].toLowerCase()}.`
          : "Rows are the true level. Hover a cell."}
      </p>
    </figure>
  );
}

function Reliability({ m }: { m: MlMetrics }) {
  const bins = m.test.calibration.bins.map((b) => ({ x: +(b.mean_confidence * 100).toFixed(1), y: +(b.observed_accuracy * 100).toFixed(1), n: b.count }));
  const diagonal = [{ x: 33, d: 33 }, { x: 100, d: 100 }];
  return (
    <div className="h-[280px]">
      <ResponsiveContainer>
        <ComposedChart margin={{ top: 10, right: 16, bottom: 18, left: -8 }}>
          <CartesianGrid {...GRID} vertical />
          <XAxis dataKey="x" type="number" domain={[33, 100]} ticks={[40, 60, 80, 100]} unit="%" {...AXIS}
            label={{ value: "Predicted probability of the chosen level", fill: C.mist, fontSize: 13, position: "insideBottom", offset: -12 }} />
          <YAxis type="number" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} unit="%" {...AXIS} />
          <Line data={diagonal} dataKey="d" stroke={C.haze} strokeDasharray="4 4" dot={false} isAnimationActive={false} legendType="none" />
          <Scatter data={bins} dataKey="y" fill={SERIES} stroke={C.panel} strokeWidth={2} isAnimationActive={false} />
          <ReferenceLine x={33.3} stroke="transparent" />
          <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL}
            content={({ active, payload }) => {
              const p = payload?.find((x) => (x.payload as { n?: number }).n !== undefined)?.payload as { x: number; y: number; n: number } | undefined;
              if (!active || !p) return null;
              return <div style={TOOLTIP_STYLE} className="px-3 py-2">{p.n} predictions at ~{p.x}% confidence were right {p.y}% of the time.</div>;
            }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function MlPage() {
  const q = useMetrics();
  if (q.isPending) return <div className="grid gap-4"><Skeleton className="h-16 w-1/2" /><Skeleton className="h-96" /></div>;
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const m = q.data;
  const sel = m.test.comparison.find((r) => r.selected)!;
  const thr = m.test.comparison.find((r) => r.key === "accuracy_thresholds")!;
  const gain = m.test.macro_f1_gain_vs_thresholds;
  const v = m.test.score_validity_spearman;
  const imp = m.test.feature_importance;
  const impMax = Math.max(...imp.map((f) => f.importance_mean));
  const rec = m.system_checks.recommender;
  const rm = m.system_checks.roadmap;
  const cv = [...m.model_selection.cv].sort((a, b) => a.log_loss_mean - b.log_loss_mean);
  const margin = cv.length > 1 ? cv[1].log_loss_mean - cv[0].log_loss_mean : 0;
  const selectionNote = cv.length > 1
    ? margin < cv[0].log_loss_std
      ? `${cv[0].name} has the lowest mean log loss, but its lead over ${cv[1].name.toLowerCase()} (${margin.toFixed(4)}) is smaller than one fold-to-fold standard deviation, so the candidates are close.`
      : `${cv[0].name} leads ${cv[1].name.toLowerCase()} by ${margin.toFixed(4)} mean log loss, more than one fold-to-fold standard deviation.`
    : "";
  const checks = m.test.behavioural_checks;
  const cmx = m.test.confusion_matrix.matrix;
  const total = cmx.flat().reduce((a, b) => a + b, 0);
  const wrong = total - cmx.reduce((a, row, i) => a + row[i], 0);
  const farOff = cmx[0][2] + cmx[2][0];

  return (
    <div>
      <PageHeader icon={FlaskConical} title="Model evaluation"
        description={`How well the proficiency model works on learners it never saw. Read straight from the training run (model ${m.model_version}, ${new Date(m.generated_at).toLocaleDateString()}).`} />

      <div role="note" className="mb-8 flex gap-3 rounded-lg border border-developing/35 bg-developing/[0.06] px-5 py-4">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-developing" />
        <div className="text-sm leading-relaxed">
          <p className="font-medium text-ink">Trained and tested on simulated learners</p>
          <p className="mt-1 text-mist">{m.data.description} These results show the model recovers the simulator&apos;s ground truth; they do not measure accuracy on real people.</p>
        </div>
      </div>

      <section className="mb-10 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="text-[1.6rem] leading-tight font-medium">
            {gain.ci_low > 0
              ? `The selected model beats tuned accuracy thresholds by ${gain.mean.toFixed(3)} macro F1.`
              : `The selected model does not clearly beat tuned accuracy thresholds (gain ${gain.mean.toFixed(3)} macro F1).`}
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-mist">
            {m.serving.model_name} scores {fixed(sel.macro_f1)} macro F1 on {m.data.n_test.toLocaleString()} held-out attempts from {m.data.n_test_learners} learners,
            against {fixed(thr.macro_f1)} for the rule a non-ML app would use. The 95% interval for the gain, from {gain.n_boot} bootstrap resamples of whole learners,
            is {gain.ci_low.toFixed(3)} to {gain.ci_high.toFixed(3)}.
          </p>
        </div>
        <Panel className="p-5 text-sm">
          <p className="text-mist">Does the 0–100% mastery score track true ability?</p>
          <p className="mt-1 text-xs text-haze">Spearman correlation with the simulator&apos;s latent ability</p>
          <div className="mt-4 space-y-3">
            {[["Model mastery score", v.model_mastery_score, true], ["Raw accuracy", v.raw_accuracy, false], ["Difficulty-weighted score", v.difficulty_weighted_score, false]].map(([l, val, e]) => (
              <div key={l as string}><p className="mb-1 text-xs text-mist">{l as string}</p><HBar value={val as number} max={1} label={(val as number).toFixed(3)} emphasis={e as boolean} /></div>
            ))}
          </div>
        </Panel>
      </section>

      <div className="grid gap-6">
        <Panel>
          <PanelHeader title="Held-out test results" description={`Test set: ${m.data.split}. Candidates were compared by ${m.model_selection.criterion.toLowerCase()} before the test set was used.`} />
          <div className="pt-4 pb-2"><Comparison m={m} /></div>
        </Panel>

        <Panel>
          <PanelHeader title="Where the errors are" description="Confusion matrices on the test set. Most model errors are between adjacent levels." />
          <div className="flex flex-wrap gap-10 px-5 pt-5 pb-6">
            <Confusion title={m.serving.model_name} cm={m.test.confusion_matrix} />
            <Confusion title="Accuracy-threshold baseline" cm={m.test.baseline_confusion_matrix} />
            <div className="min-w-[220px] flex-1">
              <p className="mb-3 text-sm text-ink">Per-level results ({m.serving.model_name.toLowerCase()})</p>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-mist"><th className="py-1 font-normal">Level</th><th className="py-1 text-right font-normal">Precision</th><th className="py-1 text-right font-normal">Recall</th><th className="py-1 text-right font-normal">n</th></tr></thead>
                <tbody>
                  {m.test.per_class.map((c) => (
                    <tr key={c.level} className="border-t border-line-soft">
                      <td className="py-2 text-ink">{LEVEL_LABEL[c.level]}</td>
                      <td className="py-2 text-right tabular-nums">{fixed(c.precision)}</td>
                      <td className="py-2 text-right tabular-nums">{fixed(c.recall)}</td>
                      <td className="py-2 text-right tabular-nums text-mist">{c.support}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Panel>

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel>
            <PanelHeader title="Calibration"
              description={`Points on the dashed diagonal are perfectly calibrated. Expected calibration error: ${fixed(m.test.calibration.expected_calibration_error)}.`} />
            <div className="px-3 pt-4 pb-3"><Reliability m={m} /></div>
          </Panel>
          <Panel>
            <PanelHeader title="What the model relies on" description="Permutation importance: drop in test macro F1 when one feature is shuffled (mean of 5 repeats)." />
            <ul className="space-y-2.5 px-5 pt-5 pb-5">
              {imp.slice(0, 9).map((f) => (
                <li key={f.feature} title={`± ${f.importance_std.toFixed(3)} across repeats`}>
                  <p className="mb-1 text-xs text-mist">{f.description}</p>
                  <HBar value={Math.max(f.importance_mean, 0)} max={impMax} label={f.importance_mean.toFixed(3)} emphasis />
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel>
            <PanelHeader title="Model selection" description="5-fold GroupKFold on the training learners only." />
            <table className="mt-3 w-full text-sm">
              <thead><tr className="text-left text-xs text-mist"><th className="px-5 py-2 font-normal">Candidate</th><th className="px-3 py-2 text-right font-normal">CV log loss</th><th className="px-5 py-2 text-right font-normal">CV macro F1</th></tr></thead>
              <tbody>
                {m.model_selection.cv.map((c) => (
                  <tr key={c.key} className="border-t border-line-soft">
                    <td className="px-5 py-2.5 text-ink">{c.name}{c.key === m.model_selection.selected && <span className="ml-2 text-xs text-electric-soft">selected</span>}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{c.log_loss_mean.toFixed(4)} <span className="text-haze">± {c.log_loss_std.toFixed(4)}</span></td>
                    <td className="px-5 py-2.5 text-right tabular-nums">{c.macro_f1_mean.toFixed(3)} <span className="text-haze">± {c.macro_f1_std.toFixed(3)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-5 pt-3 pb-5 text-xs leading-relaxed text-haze">{selectionNote}</p>
          </Panel>

          <Panel>
            <PanelHeader title="Checks on the rule-based parts" />
            <ul className="space-y-5 px-5 pt-4 pb-5 text-sm">
              <li className="flex gap-3">
                <CheckCircle2 className={cn("mt-0.5 size-4 shrink-0", rm.prerequisite_violations === 0 ? "text-mastered" : "text-beginning")} />
                <div>
                  <p className="text-ink">{rm.prerequisite_violations} prerequisite violations in {rm.roadmaps_checked} generated roadmaps ({rm.steps_checked.toLocaleString()} steps)</p>
                  <p className="mt-1 text-mist">Random careers, mastery states and weekly hours; every step was checked against the prerequisite graph.</p>
                </div>
              </li>
              <li className="flex gap-3">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-mastered" />
                <div>
                  <p className="text-ink">TF-IDF retrieval: precision@{rec.k} {rec.tfidf.precision_at_k.toFixed(2)}, MRR {rec.tfidf.mrr.toFixed(2)} (random: {rec.random.precision_at_k.toFixed(2)}, {rec.random.mrr.toFixed(2)})</p>
                  <p className="mt-1 text-mist">Each topic&apos;s description was used as a query over all {rec.corpus_size} resources. This confirms the content index captures topic relevance on a small curated catalogue; it says nothing about whether learners find the resources useful.</p>
                </div>
              </li>
            </ul>
          </Panel>
        </div>

        <Panel>
          <PanelHeader title="Behavioural checks"
            description="Canonical answer patterns with an obvious right outcome, run against the served model and the attempt-validity rule after every training run." />
          <ul className="grid gap-x-8 gap-y-3 px-5 pt-4 pb-5 text-sm md:grid-cols-2">
            {checks.map((c) => (
              <li key={c.case} className="flex gap-3">
                {c.passed ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-mastered" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0 text-beginning" />}
                <div>
                  <p className="text-ink">{c.case}</p>
                  <p className="mt-0.5 text-mist">
                    {c.counted ? `Predicted ${LEVEL_LABEL[c.predicted].toLowerCase()} (${pct(c.mastery_score)} mastery)` : "Not counted by the validity rule"}
                    {c.expected ? `; expected ${c.expected}` : "; expected to be excluded"}{c.passed ? "" : ", FAILED"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <p className="px-5 pb-5 text-xs leading-relaxed text-haze">
            An earlier simulator tied speed tightly to ability, and the model rated fast, all-wrong guessing as advanced. The simulator now treats timing as a weak,
            noisy signal and includes disengaged rapid guessing; time features ignore rapid answers and are bounded; and attempts with three or more answers under
            three seconds are stored but not counted. Test macro F1 fell as a result, which is the more honest figure.
          </p>
        </Panel>

        <Panel>
          <PanelHeader title="Data and limitations" />
          <div className="grid gap-8 px-5 pt-4 pb-6 lg:grid-cols-2">
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              <dt className="text-mist">Simulated learners</dt><dd className="tabular-nums">{m.data.n_learners.toLocaleString()} ({m.data.n_attempts.toLocaleString()} topic attempts)</dd>
              <dt className="text-mist">Train / test</dt><dd className="tabular-nums">{m.data.n_train.toLocaleString()} / {m.data.n_test.toLocaleString()} attempts, no learner in both</dd>
              <dt className="text-mist">Class balance</dt><dd>{(["beginner", "intermediate", "advanced"] as const).map((l) => `${LEVEL_LABEL[l]} ${pct(m.data.class_balance[l])}`).join(", ")}</dd>
              <dt className="text-mist">Level thresholds</dt><dd>beginner below θ = {m.data.label_thresholds.beginner_below_theta}, advanced above θ = {m.data.label_thresholds.advanced_above_theta}</dd>
              <dt className="text-mist">Mastery score</dt><dd>{m.policy.mastery_score_formula}; mastered at {pct(m.policy.mastered_threshold)}</dd>
              <dt className="text-mist">Random seed</dt><dd className="tabular-nums">{m.data.seed}</dd>
              <dt className="text-mist">Environment</dt><dd>Python {m.environment.python}, scikit-learn {m.environment.scikit_learn}</dd>
            </dl>
            <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-mist marker:text-haze">
              <li>The labels come from a simulator PathForge defines, so a high score partly reflects how closely the model matches that simulator&apos;s assumptions.</li>
              <li>The model leans most on &ldquo;{imp[0].description.toLowerCase()}&rdquo;. How confidence ratings and response times relate to ability in the simulator are assumptions; real behaviour (distractions, reading speed, accessibility tools) may differ, so their learned weights may not transfer.</li>
              <li>The 3-second rapid-guess threshold is a fixed rule, not learned from real behaviour. Very fast readers answering easy questions could occasionally trip it.</li>
              <li>Five questions per attempt is little evidence. Even on simulated data {pct(wrong / total)} of test attempts are misclassified; {pct(wrong ? (wrong - farOff) / wrong : 0)} of those errors are off by one level and {farOff} confuse beginner with advanced.</li>
              <li>Only about six questions exist per topic, so frequent retakes will start repeating questions.</li>
              <li>Collecting real assessment outcomes and re-fitting (or re-calibrating) the model on them is the necessary next step before relying on these estimates.</li>
            </ul>
          </div>
        </Panel>
      </div>
    </div>
  );
}
