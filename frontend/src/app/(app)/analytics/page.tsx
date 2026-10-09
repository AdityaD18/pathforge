"use client";

import { LineChart as LineIcon } from "lucide-react";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, LabelList, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";

import { AXIS, CURSOR, GRID, SERIES, TOOLTIP_LABEL, TOOLTIP_STYLE } from "@/components/charts/chart-kit";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Meter, PageHeader, Panel, PanelHeader, Skeleton } from "@/components/ui/primitives";
import { heatColor, heatInk, LEVEL_LABEL, masteryState, pct, STATE_COLOR } from "@/lib/format";
import { useAnalytics } from "@/lib/queries";
import type { Analytics } from "@/lib/types";

function Timeline({ data }: { data: Analytics["timeline"] }) {
  const points = data.map((d) => ({ ...d, t: new Date(d.submitted_at).getTime(), y: Math.round(d.mastery_score * 100) }));
  const span = points.length ? points[points.length - 1].t - points[0].t : 0;
  const fmt = (t: number) => span < 2 * 86_400_000
    ? new Date(t).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return (
    <div className="h-[260px]">
      <ResponsiveContainer>
        <ScatterChart margin={{ top: 12, right: 16, bottom: 4, left: -12 }}>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} tickFormatter={fmt} {...AXIS} padding={{ left: 16, right: 16 }} />
          <YAxis dataKey="y" type="number" domain={[0, 100]} ticks={[0, 40, 70, 100]} unit="%" {...AXIS} />
          <ReferenceLine y={70} stroke="#5ed3a8" strokeDasharray="4 4" label={{ value: "Mastered", fill: "#8a97bd", fontSize: 11, position: "insideTopLeft" }} />
          <Tooltip cursor={{ stroke: "#22305c" }} contentStyle={TOOLTIP_STYLE}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as (typeof points)[number];
              return (
                <div style={TOOLTIP_STYLE} className="px-3 py-2">
                  <p style={TOOLTIP_LABEL}>{new Date(p.submitted_at).toLocaleString()}</p>
                  <p className="font-medium">{p.topic_name}</p>
                  <p className="text-mist">{LEVEL_LABEL[p.level]}, {p.y}% mastery, {pct(p.accuracy)} correct</p>
                </div>
              );
            }} />
          <Scatter data={points} fill={SERIES} stroke="#101a3a" strokeWidth={2} shape="circle" isAnimationActive={false} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

function Heatmap({ data }: { data: Analytics["heatmap"] }) {
  const rows = data.rows.filter((r) => r.cells.some((c) => c.total > 0) || r.mastery_score !== null);
  const hidden = data.rows.length - rows.length;
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-separate border-spacing-[3px] text-sm">
          <caption className="sr-only">Accuracy by topic and question difficulty</caption>
          <thead>
            <tr className="text-xs text-mist">
              <th className="px-2 py-1 text-left font-normal">Topic</th>
              {data.difficulties.map((d) => <th key={d} className="w-[92px] px-2 py-1 font-normal capitalize">{d}</th>)}
              <th className="w-[150px] px-2 py-1 text-left font-normal">Estimated mastery</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.topic_id}>
                <th scope="row" className="max-w-[220px] truncate px-2 py-1 text-left font-normal text-ink">{r.topic_name}</th>
                {r.cells.map((c) => (
                  <td key={c.difficulty} title={c.total ? `${r.topic_name}, ${c.difficulty}: ${c.correct} of ${c.total} correct` : "No answers yet"}
                    className="h-10 rounded-[4px] text-center text-xs tabular-nums"
                    style={{ background: c.total ? heatColor(c.accuracy) : undefined, color: heatInk(c.accuracy),
                      border: c.total ? undefined : "1px dashed #22305c" }}>
                    {c.total ? `${c.correct}/${c.total}` : <span className="text-haze">—</span>}
                  </td>
                ))}
                <td className="px-2">
                  {r.mastery_score === null ? <span className="text-xs text-haze">not assessed</span> : (
                    <div className="flex items-center gap-2">
                      <Meter value={r.mastery_score} color={STATE_COLOR[masteryState(r.mastery_score)]} />
                      <span className="w-9 text-right text-xs tabular-nums text-mist">{pct(r.mastery_score)}</span>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-mist">
        <span>Accuracy</span>
        <span className="h-2 w-32 rounded-full" style={{ background: `linear-gradient(90deg, ${heatColor(0)}, ${heatColor(1)})` }} />
        <span>0% to 100%</span>
        {hidden > 0 && <span className="text-haze">{hidden} roadmap topics without answers are hidden.</span>}
      </div>
    </div>
  );
}

function Calibration({ data }: { data: Analytics["confidence_calibration"] }) {
  const rows = data.map((d) => ({ ...d, acc: d.accuracy === null ? 0 : Math.round(d.accuracy * 100) }));
  return (
    <div className="h-[220px]">
      <ResponsiveContainer>
        <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -18 }} barCategoryGap="28%">
          <CartesianGrid {...GRID} />
          <XAxis dataKey="label" {...AXIS} tickFormatter={(l: string) => { const r = rows.find((x) => x.label === l); return r ? `${l} (${r.answers})` : l; }} />
          <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} unit="%" {...AXIS} />
          <ReferenceLine y={25} stroke="#5d6a92" strokeDasharray="4 4" label={{ value: "chance", fill: "#5d6a92", fontSize: 10, position: "right" }} />
          <Tooltip cursor={CURSOR} contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL}
            formatter={(_v, _n, item) => {
              const p = item.payload as (typeof rows)[number];
              return [p.answers ? `${p.acc}% correct over ${p.answers} answers` : "No answers", "Accuracy"];
            }} />
          <Bar dataKey="acc" fill={SERIES} radius={[4, 4, 0, 0]} maxBarSize={56} isAnimationActive={false}>
            <LabelList dataKey="acc" position="top" fill="#e7ecfa" fontSize={11}
              formatter={(v) => `${v}%`} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function Pace({ data }: { data: Analytics["pace"] }) {
  const max = Math.max(90, ...data.map((d) => Math.max(d.median_seconds ?? 0, d.expected_seconds)));
  return (
    <ul className="space-y-4">
      {data.map((d) => (
        <li key={d.difficulty}>
          <div className="mb-1.5 flex justify-between text-sm">
            <span className="capitalize text-mist">{d.difficulty}</span>
            <span className="text-ink">{d.median_seconds === null ? "no answers" : `${d.median_seconds} s median, ${d.expected_seconds} s budget`}</span>
          </div>
          <div className="relative h-2 rounded-full bg-white/[0.06]">
            {d.median_seconds !== null && <div className="h-full rounded-full" style={{ width: `${(d.median_seconds / max) * 100}%`, background: SERIES }} />}
            <span className="absolute -top-1 h-4 w-0.5 rounded bg-ink/70" style={{ left: `${(d.expected_seconds / max) * 100}%` }}
              title={`Expected: ${d.expected_seconds} s`} />
          </div>
        </li>
      ))}
      <li className="flex items-center gap-2 text-xs text-haze"><span className="h-3 w-0.5 rounded bg-ink/70" /> time budget the model treats as typical</li>
    </ul>
  );
}

function WeeklyBars({ data, field, title }: { data: Analytics["activity"]; field: "assessments" | "resources_completed"; title: string }) {
  const rows = data.map((d) => ({ ...d, label: new Date(d.week_start).toLocaleDateString(undefined, { month: "short", day: "numeric" }) }));
  return (
    <div>
      <p className="mb-2 text-sm text-mist">{title}</p>
      <div className="h-[150px]">
        <ResponsiveContainer>
          <BarChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: -28 }} barCategoryGap="22%">
            <CartesianGrid {...GRID} />
            <XAxis dataKey="label" {...AXIS} interval={2} />
            <YAxis allowDecimals={false} {...AXIS} />
            <Tooltip cursor={CURSOR} contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL} labelFormatter={(l) => `Week of ${l}`}
              formatter={(v) => [v, title]} />
            <Bar dataKey={field} fill={SERIES} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const q = useAnalytics();
  if (q.isPending) return <div className="grid gap-4"><Skeleton className="h-16 w-1/2" /><Skeleton className="h-80" /></div>;
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const a = q.data;

  if (a.totals.assessments === 0) {
    return (
      <div>
        <PageHeader title="Progress" description="Mastery over time, accuracy by topic and difficulty, how well your confidence matches your results, and your study activity." />
        <EmptyState icon={LineIcon} title="Nothing to chart yet" body="Every chart here is built from your own answers. Take a diagnostic and this page fills in."
          action={<Button asChild><Link href="/assessments">Choose an assessment</Link></Button>} />
      </div>
    );
  }

  const t = a.totals;
  return (
    <div>
      <PageHeader title="Progress"
        description={`${t.assessments} assessment${t.assessments === 1 ? "" : "s"} across ${t.topics_assessed} topic${t.topics_assessed === 1 ? "" : "s"}, ${t.answers} answers at ${pct(t.overall_accuracy)} overall accuracy. ${t.resources_completed} resource${t.resources_completed === 1 ? "" : "s"} completed, about ${t.hours_completed} hours of material.`} />

      <div className="grid gap-6">
        <Panel>
          <PanelHeader title="Mastery estimate after each assessment" description="One point per submission. Hover for the topic and result." />
          <div className="px-3 pt-4 pb-4"><Timeline data={a.timeline} /></div>
        </Panel>

        <Panel>
          <PanelHeader title="Mastery heatmap" description="Share of questions answered correctly, by topic and difficulty, across all attempts." />
          <div className="px-3 pt-4 pb-5 sm:px-5"><Heatmap data={a.heatmap} /></div>
        </Panel>

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel>
            <PanelHeader title="Does your confidence match your results?" description="Accuracy grouped by how sure you said you were. Guesses should sit near chance (25%)." />
            <div className="px-3 pt-4 pb-4"><Calibration data={a.confidence_calibration} /></div>
          </Panel>
          <Panel>
            <PanelHeader title="Answer pace" description="Median time per question against the time budget for each difficulty." />
            <div className="px-5 pt-5 pb-5"><Pace data={a.pace} /></div>
          </Panel>
        </div>

        <Panel>
          <PanelHeader title="Weekly activity" description="Last 12 weeks." />
          <div className="grid gap-6 px-3 pt-4 pb-5 md:grid-cols-2">
            <WeeklyBars data={a.activity} field="assessments" title="Assessments submitted" />
            <WeeklyBars data={a.activity} field="resources_completed" title="Resources completed" />
          </div>
        </Panel>
      </div>
    </div>
  );
}
