"use client";

import { motion } from "framer-motion";
import {
  Activity, Award, BarChart3, CalendarDays, CheckCircle2, Clock, Flame, Grid3x3, LineChart as LineIcon, PieChart as PieIcon, Target, Timer, TrendingDown, Trophy,
} from "lucide-react";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AXIS, CURSOR, GRID, PALETTE, TOOLTIP_LABEL, TOOLTIP_STYLE } from "@/components/charts/chart-kit";
import { FORMAT_ICON } from "@/components/course";
import { InfoTip } from "@/components/info-tip";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, PageHeader, Panel, PanelHeader, Skeleton } from "@/components/ui/primitives";
import { ActivityCalendar, BadgeGrid, BurnDown, MasteryLines, StatTile, StatusDonut } from "@/components/viz";
import { C, FORMAT_LABEL, heatColor, heatInk, masteryState, pct, STATE_COLOR } from "@/lib/format";
import { useAnalytics } from "@/lib/queries";
import type { Analytics, Format } from "@/lib/types";

function Heatmap({ data }: { data: Analytics["heatmap"] }) {
  const rows = data.rows.filter((r) => r.cells.some((c) => c.total > 0) || r.mastery_score !== null);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-separate border-spacing-1 text-sm">
        <caption className="sr-only">Accuracy by topic and question difficulty</caption>
        <thead>
          <tr className="text-sm text-mist">
            <th className="px-2 py-1 text-left font-normal">Topic</th>
            {data.difficulties.map((d) => <th key={d} className="w-[100px] px-2 py-1 font-normal capitalize">{d}</th>)}
            <th className="w-[90px] px-2 py-1 font-normal">Mastery</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={r.topic_id}>
              <th scope="row" className="max-w-[220px] truncate px-2 py-1 text-left font-normal text-ink">{r.topic_name}</th>
              {r.cells.map((c, ci) => (
                <motion.td key={c.difficulty} initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.02 * (ri * 3 + ci) }}
                  title={c.total ? `${r.topic_name}, ${c.difficulty}: ${c.correct} of ${c.total} correct` : "No answers yet"}
                  className="h-11 rounded-lg text-center text-sm font-medium tabular-nums"
                  style={{ background: c.total ? heatColor(c.accuracy) : undefined, color: heatInk(c.accuracy), border: c.total ? undefined : `1px dashed ${C.line}` }}>
                  {c.total ? pct(c.accuracy) : <span className="text-haze">—</span>}
                </motion.td>
              ))}
              <td className="px-2 text-center">
                {r.mastery_score === null ? <span className="text-sm text-haze">—</span> : (
                  <span className="inline-flex items-center gap-1.5 text-sm tabular-nums text-ink">
                    <span className="size-2.5 rounded-full" style={{ background: STATE_COLOR[masteryState(r.mastery_score)] }} />{pct(r.mastery_score)}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-mist">
        <span>0%</span>
        <span className="h-2.5 w-40 rounded-full" style={{ background: `linear-gradient(90deg, ${heatColor(0)}, ${heatColor(0.5)}, ${heatColor(1)})` }} />
        <span>100% correct</span>
      </div>
    </div>
  );
}

function Calibration({ data }: { data: Analytics["confidence_calibration"] }) {
  const rows = data.map((d) => ({ ...d, acc: d.accuracy === null ? 0 : Math.round(d.accuracy * 100) }));
  const colors = [C.beginning, C.developing, C.mastered];
  return (
    <div className="h-[260px]">
      <ResponsiveContainer>
        <BarChart data={rows} margin={{ top: 22, right: 8, bottom: 0, left: -18 }} barCategoryGap="26%">
          <CartesianGrid {...GRID} />
          <XAxis dataKey="label" {...AXIS} tickFormatter={(l: string) => { const r = rows.find((x) => x.label === l); return r ? `${l} (${r.answers})` : l; }} />
          <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} unit="%" {...AXIS} />
          <ReferenceLine y={25} stroke={C.haze} strokeDasharray="4 4" label={{ value: "chance", fill: C.haze, fontSize: 13, position: "right" }} />
          <Tooltip cursor={CURSOR} contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL}
            formatter={(_v, _n, item) => {
              const p = item.payload as (typeof rows)[number];
              return [p.answers ? `${p.acc}% correct over ${p.answers} answers` : "No answers", "Accuracy"];
            }} />
          <Bar dataKey="acc" radius={[8, 8, 0, 0]} maxBarSize={72} animationDuration={900}>
            {rows.map((r, i) => <Cell key={r.label} fill={colors[i]} />)}
            <LabelList dataKey="acc" position="top" fill={C.ink} fontSize={14} formatter={(v) => `${v}%`} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function Pace({ data }: { data: Analytics["pace"] }) {
  const max = Math.max(90, ...data.map((d) => Math.max(d.median_seconds ?? 0, d.expected_seconds)));
  return (
    <ul className="space-y-6">
      {data.map((d, i) => (
        <li key={d.difficulty}>
          <div className="mb-2 flex items-baseline justify-between text-sm">
            <span className="capitalize text-ink">{d.difficulty}</span>
            <span className="text-mist">{d.median_seconds === null ? "no answers" : <><span className="numeral text-xl text-ink">{d.median_seconds}s</span> / {d.expected_seconds}s budget</>}</span>
          </div>
          <div className="relative h-3 rounded-full bg-ink/[0.07]">
            {d.median_seconds !== null && (
              <motion.div className="h-full rounded-full bg-accent-gradient" initial={{ width: 0 }}
                animate={{ width: `${(d.median_seconds / max) * 100}%` }} transition={{ duration: 0.9, delay: 0.1 * i }} />
            )}
            <span className="absolute -top-1.5 h-6 w-1 rounded bg-ink/80" style={{ left: `${(d.expected_seconds / max) * 100}%` }} title={`Budget: ${d.expected_seconds} s`} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function FormatPie({ data }: { data: Record<string, number> }) {
  const rows = Object.entries(data).map(([k, v]) => ({ key: k as Format, name: FORMAT_LABEL[k as Format] ?? k, value: v })).sort((a, b) => b.value - a.value);
  if (!rows.length) return <p className="py-10 text-center text-mist">Finish a course to see your mix.</p>;
  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="size-[170px]">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={rows} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="100%" paddingAngle={3} stroke="none" animationDuration={900}>
              {rows.map((r, i) => <Cell key={r.key} fill={PALETTE[i % PALETTE.length]} />)}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="space-y-2 text-sm">
        {rows.map((r, i) => {
          const Icon = FORMAT_ICON[r.key];
          return (
            <li key={r.key} className="flex items-center gap-2">
              <span className="size-3 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
              {Icon && <Icon className="size-4 text-mist" />}<span className="text-mist">{r.name}</span>
              <span className="ml-auto pl-4 tabular-nums text-ink">{r.value}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Readiness({ r }: { r: NonNullable<Analytics["insights"]["readiness"]> }) {
  return (
    <ul className="space-y-3">
      {r.topics.map((t, i) => (
        <li key={t.topic_id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 sm:grid-cols-[200px_1fr_auto]">
          <span className="truncate text-sm text-ink">{t.name} <span className="text-haze">{"●".repeat(t.weight)}</span></span>
          <span className="col-span-2 h-2.5 overflow-hidden rounded-full bg-ink/[0.07] sm:col-span-1 sm:row-start-1 sm:col-start-2">
            <motion.span className="block h-full rounded-full" style={{ background: STATE_COLOR[masteryState(t.mastery_score)] }}
              initial={{ width: 0 }} animate={{ width: `${Math.max(t.credit * 100, t.mastery_score === null ? 0 : 3)}%` }} transition={{ duration: 0.8, delay: 0.04 * i }} />
          </span>
          <span className="row-start-1 text-right text-sm tabular-nums text-mist sm:col-start-3">{t.mastery_score === null ? "—" : pct(t.mastery_score)}</span>
        </li>
      ))}
    </ul>
  );
}

export default function AnalyticsPage() {
  const q = useAnalytics();
  if (q.isPending) return <div className="grid gap-4"><Skeleton className="h-16 w-1/2" /><Skeleton className="h-56" /><Skeleton className="h-80" /></div>;
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const a = q.data;
  const ins = a.insights;

  if (a.totals.assessments === 0) {
    return (
      <div>
        <PageHeader icon={BarChart3} title="Progress" />
        <EmptyState icon={LineIcon} title="Nothing to chart yet" body="Every chart here is built from your own answers. Take a quick test and this page lights up."
          action={<Button asChild><Link href="/assessments">Take a test</Link></Button>} />
      </div>
    );
  }

  const t = a.totals;
  const earned = ins.badges.filter((b) => b.earned).length;
  return (
    <div>
      <PageHeader icon={BarChart3} title="Progress" description="Everything here is built from your own activity." />

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile icon={CheckCircle2} value={(t.overall_accuracy ?? 0) * 100} format={(v) => `${Math.round(v)}%`} label={`accuracy · ${t.answers} answers`} tone="mastered" />
        <StatTile icon={Target} value={t.topics_assessed} label="topics assessed" />
        <StatTile icon={Clock} value={t.hours_completed} format={(v) => `${Math.round(v)} h`} label="of course material done" tone="accent2" />
        <StatTile icon={Flame} value={ins.streak.longest} label="longest streak (days)" tone="developing" />
      </div>

      <div className="grid gap-6">
        <Panel id="activity" className="scroll-mt-24">
          <PanelHeader icon={CalendarDays} title="Activity"
            action={<span className="flex items-center gap-1.5 rounded-full bg-developing/15 px-3 py-1 text-sm text-developing"><Flame className="size-4" /> {ins.streak.current}-day streak</span>} />
          <div className="px-5 pt-5 pb-6 sm:px-6"><ActivityCalendar daily={ins.daily} today={ins.today} /></div>
        </Panel>

        <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          <Panel>
            <PanelHeader icon={TrendingDown} title="Topics left to master"
              action={<InfoTip>Each step is a recorded plan change. The dashed line projects your finish date from your weekly hours.</InfoTip>} />
            <div className="px-3 pt-4 pb-4"><BurnDown burndown={ins.burndown} forecast={ins.forecast} today={ins.today} /></div>
          </Panel>
          {ins.breakdown && (
            <Panel>
              <PanelHeader icon={PieIcon} title="Your roadmap at a glance" />
              <div className="px-5 pt-5 pb-6 sm:px-6"><StatusDonut breakdown={ins.breakdown} /></div>
            </Panel>
          )}
        </div>

        <Panel>
          <PanelHeader icon={LineIcon} title="Mastery over time" action={<InfoTip>One line per topic; each dot is a counted assessment. Toggle topics above the chart.</InfoTip>} />
          <div className="px-3 pt-4 pb-5 sm:px-5">
            {ins.topic_history.length ? <MasteryLines history={ins.topic_history} /> : <p className="text-mist">No counted assessments yet.</p>}
          </div>
        </Panel>

        {ins.readiness && (
          <Panel>
            <PanelHeader icon={Trophy} title={`Readiness for ${ins.readiness.career_title}: ${pct(ins.readiness.score)}`}
              action={<InfoTip>{ins.readiness.formula} Dots show each topic&apos;s weight.</InfoTip>} />
            <div className="px-5 pt-5 pb-6 sm:px-6"><Readiness r={ins.readiness} /></div>
          </Panel>
        )}

        <Panel>
          <PanelHeader icon={Grid3x3} title="Accuracy by topic and difficulty" />
          <div className="px-3 pt-4 pb-5 sm:px-5"><Heatmap data={a.heatmap} /></div>
        </Panel>

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel>
            <PanelHeader icon={Activity} title="Does your confidence match?"
              action={<InfoTip>Accuracy grouped by how sure you said you were. Guesses should sit near chance (25%); &ldquo;sure&rdquo; answers should be mostly right.</InfoTip>} />
            <div className="px-3 pt-4 pb-4"><Calibration data={a.confidence_calibration} /></div>
          </Panel>
          <Panel>
            <PanelHeader icon={Timer} title="Answer pace" action={<InfoTip>Median seconds per question; the white marker is the time budget the model treats as typical.</InfoTip>} />
            <div className="px-5 pt-6 pb-6 sm:px-6"><Pace data={a.pace} /></div>
          </Panel>
        </div>

        <Panel>
          <PanelHeader icon={PieIcon} title="Courses completed by format" />
          <div className="px-5 pt-5 pb-6 sm:px-6"><FormatPie data={a.resources.completed_by_format} /></div>
        </Panel>

        <section id="badges" className="scroll-mt-24">
          <h2 className="mb-4 flex items-center gap-2 text-2xl font-medium"><Award className="size-6 text-developing" /> Badges <span className="text-lg text-haze">{earned}/{ins.badges.length}</span></h2>
          <BadgeGrid badges={ins.badges} />
        </section>
      </div>
    </div>
  );
}
