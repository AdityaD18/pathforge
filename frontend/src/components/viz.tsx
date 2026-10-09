"use client";

import { animate, motion, useInView, useReducedMotion } from "framer-motion";
import {
  Award, BookOpen, Compass, Flag, Flame, Footprints, Library, Lock, Medal, Mountain, Target, TrendingUp, Trophy, Zap,
} from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Area, CartesianGrid, Cell, ComposedChart, Line, LineChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import { AXIS, GRID, PALETTE, TOOLTIP_LABEL, TOOLTIP_STYLE } from "@/components/charts/chart-kit";
import { alpha, C, cn } from "@/lib/format";
import type { BadgeView, Insights } from "@/lib/types";

// ---------------------------------------------------------------------------------------------------------
// Animated number
// ---------------------------------------------------------------------------------------------------------
export function CountUp({ value, format = (v) => String(Math.round(v)), duration = 1.1, className }: {
  value: number; format?: (v: number) => string; duration?: number; className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduce || !inView) {
      el.textContent = format(value);
      return;
    }
    const controls = animate(0, value, { duration, ease: [0.25, 1, 0.5, 1], onUpdate: (v) => (el.textContent = format(v)) });
    return () => controls.stop();
  }, [value, inView, reduce, duration, format]);
  return <span ref={ref} className={className}>{format(value)}</span>;
}

// ---------------------------------------------------------------------------------------------------------
// Progress ring
// ---------------------------------------------------------------------------------------------------------
export function Ring({ value, size = 120, stroke = 10, color, gradient = true, track, children, label, className }: {
  value: number; size?: number; stroke?: number; color?: string; gradient?: boolean; track?: string;
  children?: React.ReactNode; label?: string; className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const r = (size - stroke) / 2;
  const v = Math.min(Math.max(value, 0), 1);
  return (
    <div className={cn("relative inline-flex shrink-0 items-center justify-center", className)} style={{ width: size, height: size }}
      role="img" aria-label={label ?? `${Math.round(v * 100)}%`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <defs>
          <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={C.accent} />
            <stop offset="1" stopColor={C.accent2} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track ?? alpha(C.ink, 8)} strokeWidth={stroke} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeLinecap="round" strokeWidth={stroke} opacity={v === 0 ? 0 : 1}
          stroke={color ?? (gradient ? `url(#g${id})` : C.accent)}
          initial={{ pathLength: 0 }} animate={{ pathLength: v === 0 ? 0.0001 : v }}
          transition={{ duration: 1.2, ease: [0.25, 1, 0.5, 1] }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Semi-circular gauge
// ---------------------------------------------------------------------------------------------------------
export function Gauge({ value, size = 220, children, label }: { value: number; size?: number; children?: React.ReactNode; label?: string }) {
  const id = useId().replace(/:/g, "");
  const stroke = 16;
  const r = (size - stroke) / 2;
  const cx = size / 2, cy = size / 2;
  const v = Math.min(Math.max(value, 0), 1);
  const arc = `M ${stroke / 2} ${cy} A ${r} ${r} 0 0 1 ${size - stroke / 2} ${cy}`;
  const angle = Math.PI * (1 - v);
  const kx = cx + r * Math.cos(angle), ky = cy - r * Math.sin(angle);
  return (
    <div className="relative" style={{ width: size, height: size / 2 + 18 }} role="img" aria-label={label ?? `${Math.round(v * 100)}%`}>
      <svg width={size} height={size / 2 + stroke} viewBox={`0 0 ${size} ${size / 2 + stroke}`} className="overflow-visible">
        <defs>
          <linearGradient id={`gg${id}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={C.beginning} />
            <stop offset="0.5" stopColor={C.developing} />
            <stop offset="1" stopColor={C.mastered} />
          </linearGradient>
        </defs>
        <path d={arc} fill="none" stroke={alpha(C.ink, 8)} strokeWidth={stroke} strokeLinecap="round" />
        <motion.path d={arc} fill="none" stroke={`url(#gg${id})`} strokeWidth={stroke} strokeLinecap="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: v === 0 ? 0.0001 : v }} transition={{ duration: 1.4, ease: [0.25, 1, 0.5, 1] }} />
        <motion.circle r={9} fill={C.panel} stroke={C.ink} strokeWidth={3}
          initial={{ cx: stroke / 2, cy }} animate={{ cx: kx, cy: ky }} transition={{ duration: 1.4, ease: [0.25, 1, 0.5, 1] }} />
      </svg>
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------
// GitHub-style activity calendar
// ---------------------------------------------------------------------------------------------------------
const DAY_LABELS = ["Mon", "", "Wed", "", "Fri", "", ""];

export function ActivityCalendar({ daily, today }: { daily: Insights["daily"]; today: string }) {
  const [hover, setHover] = useState<Insights["daily"][number] | null>(null);
  const weeks = useMemo(() => {
    const out: (Insights["daily"][number] | null)[][] = [];
    for (let i = 0; i < daily.length; i += 7) out.push(daily.slice(i, i + 7));
    const last = out[out.length - 1];
    while (last && last.length < 7) last.push(null);
    return out;
  }, [daily]);
  const max = Math.max(1, ...daily.map((d) => d.total));
  const level = (n: number) => (n === 0 ? 0 : Math.min(4, Math.ceil((n / max) * 4)));
  const fill = [alpha(C.ink, 6), alpha(C.accent, 32), alpha(C.accent, 55), alpha(C.accent, 78), C.accent];
  const fmt = (iso: string, o: Intl.DateTimeFormatOptions) => new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, o);
  const activeDays = daily.filter((d) => d.total > 0).length;

  return (
    <div>
      <div className="overflow-x-auto pb-1">
        <div className="inline-flex gap-[3px]">
          <div className="grid grid-rows-[16px_repeat(7,14px)] gap-[3px] pr-1.5 text-xs leading-[14px] text-haze">
            <span />
            {DAY_LABELS.map((l, i) => <span key={i}>{l}</span>)}
          </div>
          {weeks.map((w, wi) => {
            const first = w[0];
            const showMonth = first && (wi === 0 || new Date(`${first.date}T12:00:00`).getDate() <= 7);
            return (
              <div key={wi} className="grid grid-rows-[16px_repeat(7,14px)] gap-[3px]">
                <span className="w-[14px] overflow-visible text-xs leading-4 whitespace-nowrap text-haze">{showMonth ? fmt(first!.date, { month: "short" }) : ""}</span>
                {w.map((d, di) => d ? (
                  <motion.button type="button" key={d.date} aria-label={`${fmt(d.date, { weekday: "long", month: "long", day: "numeric" })}: ${d.assessments} assessments, ${d.resources} resources completed`}
                    onMouseEnter={() => setHover(d)} onFocus={() => setHover(d)} onMouseLeave={() => setHover(null)}
                    initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: wi * 0.012, duration: 0.25 }}
                    className={cn("size-[14px] rounded-[3px] outline-offset-1", d.date === today && "ring-1 ring-ink/60")}
                    style={{ background: fill[level(d.total)] }} />
                ) : <span key={`x${di}`} />)}
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-mist">
        <span aria-live="polite" className="min-h-6">
          {hover ? (
            <><span className="text-ink">{fmt(hover.date, { weekday: "short", month: "short", day: "numeric" })}</span>
              {hover.total ? `: ${hover.assessments} assessment${hover.assessments === 1 ? "" : "s"}, ${hover.resources} resource${hover.resources === 1 ? "" : "s"} done` : ": no activity"}</>
          ) : <>{activeDays} active day{activeDays === 1 ? "" : "s"} in the last 26 weeks</>}
        </span>
        <span className="flex items-center gap-1.5 text-xs">Less {fill.map((f, i) => <span key={i} className="size-3 rounded-[3px]" style={{ background: f }} />)} More</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------
// This week's active days
// ---------------------------------------------------------------------------------------------------------
export function WeekDots({ week }: { week: Insights["week"] }) {
  const letters = ["M", "T", "W", "T", "F", "S", "S"];
  return (
    <div className="flex items-center gap-1.5" role="img" aria-label={`${week.active_days} of ${week.goal} active days this week`}>
      {week.days.map((d, i) => (
        <motion.span key={d.date} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.05 * i, type: "spring", stiffness: 400, damping: 20 }}
          className={cn("flex size-8 items-center justify-center rounded-full text-xs font-medium",
            d.active ? "bg-accent-gradient text-on-accent" : d.future ? "border border-dashed border-line text-haze" : "bg-ink/[0.06] text-mist")}>
          {letters[i]}
        </motion.span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Topic status donut
// ---------------------------------------------------------------------------------------------------------
export function StatusDonut({ breakdown, size = 168 }: { breakdown: NonNullable<Insights["breakdown"]>; size?: number }) {
  const data = [
    { key: "mastered", name: "Mastered", value: breakdown.mastered, color: C.mastered },
    { key: "developing", name: "Developing", value: breakdown.developing, color: C.developing },
    { key: "beginning", name: "Beginning", value: breakdown.beginning, color: C.beginning },
    { key: "not_assessed", name: "Not assessed", value: breakdown.not_assessed, color: alpha(C.ink, 14) },
  ];
  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative" style={{ width: size, height: size }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data.filter((d) => d.value > 0)} dataKey="value" nameKey="name" innerRadius="68%" outerRadius="100%"
              paddingAngle={2} stroke="none" startAngle={90} endAngle={-270} animationDuration={900}>
              {data.filter((d) => d.value > 0).map((d) => <Cell key={d.key} fill={d.color} />)}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, n) => [`${v} topic${v === 1 ? "" : "s"}`, n]} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="numeral text-3xl text-ink">{breakdown.mastered}<span className="text-lg text-haze">/{breakdown.total}</span></span>
          <span className="text-xs text-mist">mastered</span>
        </div>
      </div>
      <ul className="space-y-1.5 text-sm">
        {data.map((d) => (
          <li key={d.key} className="flex items-center gap-2">
            <span className="size-3 rounded-full" style={{ background: d.color }} />
            <span className="text-mist">{d.name}</span>
            <span className="ml-auto pl-3 tabular-nums text-ink">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Topics remaining over time, with the projection to the finish line
// ---------------------------------------------------------------------------------------------------------
export function BurnDown({ burndown, forecast, today, height = 240 }: {
  burndown: Insights["burndown"]; forecast: Insights["forecast"]; today: string; height?: number;
}) {
  const id = useId().replace(/:/g, "");
  const points = burndown.map((b) => ({ t: new Date(b.at).getTime(), remaining: b.remaining, trigger: b.trigger }));
  if (!points.length && !forecast) return null;
  const now = new Date(`${today}T12:00:00`).getTime();
  const last = points[points.length - 1];
  const finish = forecast ? new Date(`${forecast.finish_date}T12:00:00`).getTime() : null;
  const projection = forecast && finish && forecast.remaining > 0
    ? [{ t: now, projected: forecast.remaining }, { t: finish, projected: 0 }] : [];
  const data = [...points.map((p) => ({ ...p, projected: undefined as number | undefined })),
    ...(last && forecast ? [{ t: now, remaining: forecast.remaining, trigger: "now", projected: undefined }] : []),
    ...projection.map((p) => ({ t: p.t, remaining: undefined as number | undefined, trigger: "projection", projected: p.projected }))];
  if (projection.length && data.length > 1) {
    const nowRow = data.find((d) => d.trigger === "now");
    if (nowRow) nowRow.projected = forecast!.remaining;
  }
  const fmt = (t: number) => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return (
    <div style={{ height }}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 12, right: 18, bottom: 0, left: -14 }}>
          <defs>
            <linearGradient id={`bd${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={C.accent} stopOpacity={0.35} />
              <stop offset="1" stopColor={C.accent} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} tickFormatter={fmt} {...AXIS} minTickGap={36} />
          <YAxis allowDecimals={false} {...AXIS} domain={[0, "dataMax"]} />
          <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL} labelFormatter={(t) => fmt(Number(t))}
            formatter={(v, n) => [`${v} topic${v === 1 ? "" : "s"} left`, n === "projected" ? "Projected" : "Remaining"]} />
          <Area type="stepAfter" dataKey="remaining" stroke={C.accent} strokeWidth={2.5} fill={`url(#bd${id})`} connectNulls animationDuration={1000} />
          <Line type="linear" dataKey="projected" stroke={C.accent2} strokeWidth={2} strokeDasharray="6 6" dot={false} connectNulls animationDuration={1000} />
          {finish && <ReferenceLine x={finish} stroke={C.mastered} strokeDasharray="3 4"
            label={{ value: `Finish ~${fmt(finish)}`, fill: C.mist, fontSize: 13, position: "insideTopRight" }} />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Mastery over time, one line per topic, toggleable
// ---------------------------------------------------------------------------------------------------------
export function MasteryLines({ history, height = 300 }: { history: Insights["topic_history"]; height?: number }) {
  const ranked = useMemo(() => [...history].sort((a, b) => b.points.length - a.points.length), [history]);
  const [shown, setShown] = useState<string[]>(() => ranked.slice(0, 4).map((h) => h.topic_id));
  const color = (tid: string) => PALETTE[history.findIndex((h) => h.topic_id === tid) % PALETTE.length];
  const series = history.filter((h) => shown.includes(h.topic_id));
  const fmt = (t: number) => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const all = series.flatMap((s) => s.points.map((p) => new Date(p.at).getTime()));
  const domain: [number, number] = all.length ? [Math.min(...all), Math.max(...all)] : [0, 1];

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Topics to plot">
        {history.map((h) => {
          const on = shown.includes(h.topic_id);
          return (
            <button key={h.topic_id} type="button" aria-pressed={on}
              onClick={() => setShown(on ? shown.filter((x) => x !== h.topic_id) : [...shown, h.topic_id])}
              className={cn("flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition-colors",
                on ? "border-transparent bg-ink/[0.08] text-ink" : "border-line-soft text-mist hover:text-ink")}>
              <span className="size-2.5 rounded-full" style={{ background: on ? color(h.topic_id) : alpha(C.ink, 20) }} />
              {h.name}
            </button>
          );
        })}
      </div>
      <div style={{ height }}>
        <ResponsiveContainer>
          <LineChart margin={{ top: 10, right: 18, bottom: 0, left: -12 }}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="t" type="number" scale="time" domain={domain} tickFormatter={fmt} {...AXIS} minTickGap={40} allowDuplicatedCategory={false} />
            <YAxis domain={[0, 100]} ticks={[0, 40, 70, 100]} unit="%" {...AXIS} />
            <ReferenceLine y={70} stroke={C.mastered} strokeDasharray="4 4" label={{ value: "Mastered", fill: C.mist, fontSize: 13, position: "insideTopLeft" }} />
            <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL} labelFormatter={(t) => fmt(Number(t))}
              formatter={(v, n) => [`${v}%`, n]} />
            {series.map((s) => (
              <Line key={s.topic_id} name={s.name} data={s.points.map((p) => ({ t: new Date(p.at).getTime(), y: Math.round(p.score * 100) }))}
                dataKey="y" type="monotone" stroke={color(s.topic_id)} strokeWidth={2.5}
                dot={{ r: 4, fill: color(s.topic_id), stroke: C.panel, strokeWidth: 2 }} activeDot={{ r: 6 }} animationDuration={900} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------------------------------------
const BADGE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  footprints: Footprints, medal: Medal, compass: Compass, flame: Flame, zap: Zap, "book-open": BookOpen, library: Library,
  mountain: Mountain, target: Target, "trending-up": TrendingUp, flag: Flag, trophy: Trophy,
};

export function BadgeIcon({ badge, size = 56 }: { badge: BadgeView; size?: number }) {
  const Icon = BADGE_ICONS[badge.icon] ?? Award;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <Ring value={badge.progress} size={size} stroke={4} gradient color={badge.earned ? undefined : C.haze}>
        <span className={cn("flex items-center justify-center rounded-full",
          badge.earned ? "bg-accent-gradient text-on-accent shadow-[0_6px_18px_-6px_var(--pf-accent)]" : "bg-ink/[0.06] text-haze")}
          style={{ width: size - 14, height: size - 14 }}>
          <Icon className="size-[45%]" />
        </span>
      </Ring>
      {!badge.earned && <Lock className="absolute -right-0.5 -bottom-0.5 size-4 rounded-full bg-panel p-0.5 text-haze" />}
    </div>
  );
}

export function BadgeGrid({ badges, limit }: { badges: BadgeView[]; limit?: number }) {
  const sorted = [...badges].sort((a, b) => Number(b.earned) - Number(a.earned) || b.progress - a.progress);
  const list = limit ? sorted.slice(0, limit) : sorted;
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {list.map((b, i) => (
        <motion.li key={b.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 * i }}
          className={cn("flex flex-col items-center gap-2 rounded-xl border p-4 text-center",
            b.earned ? "border-electric/30 bg-electric/[0.05]" : "border-line-soft bg-ink/[0.02]")}
          title={b.description}>
          <BadgeIcon badge={b} />
          <span className={cn("text-sm font-medium", b.earned ? "text-ink" : "text-mist")}>{b.name}</span>
          <span className="text-xs text-haze">
            {b.earned ? (b.earned_at ? new Date(b.earned_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "Earned") : b.progress_label}
          </span>
        </motion.li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Tiny trend line
// ---------------------------------------------------------------------------------------------------------
export function Sparkline({ values, width = 96, height = 32, color = C.accent }: { values: number[]; width?: number; height?: number; color?: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * width},${height - 3 - ((v - min) / span) * (height - 6)}`);
  return (
    <svg width={width} height={height} aria-hidden>
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={width} cy={Number(pts[pts.length - 1].split(",")[1])} r={3} fill={color} />
    </svg>
  );
}

/** Stat tile: icon, big animated number, label. */
export function StatTile({ icon: Icon, value, label, format, hint, tone = "accent" }: {
  icon: React.ComponentType<{ className?: string }>; value: number; label: string; format?: (v: number) => string; hint?: string;
  tone?: "accent" | "accent2" | "mastered" | "developing";
}) {
  const color = { accent: C.accent, accent2: C.accent2, mastered: C.mastered, developing: C.developing }[tone];
  return (
    <div className="surface flex items-center gap-4 rounded-xl p-4" title={hint}>
      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl" style={{ background: alpha(color, 16), color }}>
        <Icon className="size-6" />
      </span>
      <div className="min-w-0">
        <CountUp value={value} format={format} className="numeral block text-3xl leading-none text-ink" />
        <span className="mt-1 block text-sm text-mist">{label}</span>
      </div>
    </div>
  );
}

