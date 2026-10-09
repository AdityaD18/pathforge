import { ArrowRight, Brain, FlaskConical, GraduationCap, Map, Palette, RefreshCcw, Target } from "lucide-react";
import Link from "next/link";

import { LandingThemeStrip } from "@/components/landing-theme-strip";
import { Wordmark } from "@/components/logo";
import { Button } from "@/components/ui/button";

// A real slice of the catalog: the Data Analyst path and its prerequisite edges.
const NODES = [
  { id: "py", label: "Python Fundamentals", x: 10, y: 60, state: "mastered" },
  { id: "stat", label: "Statistics Foundations", x: 10, y: 190, state: "mastered" },
  { id: "sql", label: "SQL Fundamentals", x: 10, y: 320, state: "developing" },
  { id: "pd", label: "Data Wrangling with pandas", x: 225, y: 60, state: "developing" },
  { id: "prob", label: "Probability", x: 225, y: 190, state: "ready" },
  { id: "asql", label: "Advanced SQL", x: 225, y: 320, state: "locked" },
  { id: "viz", label: "Data Visualization", x: 440, y: 100, state: "locked" },
  { id: "eda", label: "Exploratory Data Analysis", x: 440, y: 250, state: "locked" },
] as const;
const EDGES: [string, string][] = [["py", "pd"], ["stat", "prob"], ["sql", "asql"], ["pd", "viz"], ["pd", "eda"], ["stat", "eda"], ["viz", "eda"]];
const NODE_W = 190;
const COLOR = { mastered: "var(--pf-mastered)", developing: "var(--pf-developing)", ready: "var(--pf-accent)", locked: "var(--pf-locked)" } as const;

function RouteIllustration() {
  const pos = Object.fromEntries(NODES.map((n) => [n.id, n]));
  return (
    <svg viewBox="0 0 640 380" className="h-auto w-full" role="img"
      aria-label="Example roadmap: Python and Statistics mastered, pandas and SQL developing, Probability ready, later topics locked until prerequisites are met.">
      <defs>
        <linearGradient id="edge" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="640" y2="0">
          <stop offset="0" stopColor="var(--pf-accent)" /><stop offset="1" stopColor="var(--pf-accent-2)" />
        </linearGradient>
      </defs>
      {EDGES.map(([a, b]) => {
        const s = pos[a], t = pos[b];
        const x1 = s.x + NODE_W, y1 = s.y + 20, x2 = t.x, y2 = t.y + 20, mx = (x1 + x2) / 2;
        const lit = s.state === "mastered";
        return <path key={`${a}-${b}`} d={`M${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`} fill="none"
          stroke={lit ? "url(#edge)" : "var(--pf-line)"} strokeWidth={lit ? 2.4 : 1.6} strokeDasharray={lit ? undefined : "5 6"}
          className={lit ? undefined : "[stroke-dashoffset:0] motion-safe:animate-[dash_1.6s_linear_infinite]"} />;
      })}
      {NODES.map((n) => (
        <g key={n.id} transform={`translate(${n.x} ${n.y})`} opacity={n.state === "locked" ? 0.6 : 1}>
          <rect width={NODE_W} height="40" rx="12" fill="var(--pf-panel)" stroke={n.state === "ready" ? "var(--pf-accent)" : "var(--pf-line)"} strokeWidth={n.state === "ready" ? 2 : 1} />
          <circle cx="17" cy="20" r="5" fill={COLOR[n.state]} />
          <text x="30" y="24.5" fill="var(--pf-ink)" fontSize="13" fontFamily="var(--font-sans)">{n.label}</text>
        </g>
      ))}
    </svg>
  );
}

const LOOP = [
  { icon: Brain, title: "Diagnose", body: "5 quick questions per topic. A trained model estimates your level." },
  { icon: Map, title: "Plan", body: "A roadmap in prerequisite order, paced to your week." },
  { icon: GraduationCap, title: "Learn", body: "Top courses from the web, ranked for you, one click away." },
  { icon: RefreshCcw, title: "Adapt", body: "Every result updates your plan. You always see why." },
];

const FACTS = [
  { value: "6", label: "career paths" },
  { value: "26", label: "topics" },
  { value: "185", label: "hand-picked courses" },
  { value: "15+", label: "themes" },
];

const SOURCES = ["Coursera", "Udemy", "freeCodeCamp", "Khan Academy", "DataCamp", "Harvard CS50", "MIT OpenCourseWare", "Scrimba", "Codecademy", "edX"];

export default function Home() {
  return (
    <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
      <style>{"@keyframes dash{to{stroke-dashoffset:-22}}"}</style>
      <header className="flex items-center justify-between py-6">
        <Wordmark />
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex"><Link href="/ml">Model evaluation</Link></Button>
          <Button asChild variant="secondary" size="sm"><Link href="/login">Sign in</Link></Button>
        </nav>
      </header>

      <section className="grid items-center gap-12 pt-10 pb-16 lg:grid-cols-[1fr_1.1fr] lg:pt-16">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-line-soft bg-panel/60 px-3 py-1 text-sm text-mist">
            <Target className="size-4 text-electric-soft" /> Adaptive learning paths for tech careers
          </p>
          <h1 className="mt-5 text-[2.8rem] leading-[1.04] font-medium sm:text-[4rem]">
            Learn the next thing you&apos;re <span className="text-gradient">actually ready for.</span>
          </h1>
          <p className="mt-5 max-w-[32rem] text-lg leading-relaxed text-mist">
            Find your level, get a roadmap, and jump straight into the right course.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg"><Link href="/signup">Build my roadmap <ArrowRight /></Link></Button>
            <Button asChild size="lg" variant="secondary"><Link href="/login">Try a demo account</Link></Button>
          </div>
          <dl className="mt-10 grid max-w-md grid-cols-4 gap-4">
            {FACTS.map((f) => (
              <div key={f.label}>
                <dt className="sr-only">{f.label}</dt>
                <dd className="numeral text-3xl text-ink">{f.value}</dd>
                <dd className="text-sm leading-tight text-mist">{f.label}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="glass relative rounded-3xl p-4 sm:p-6">
          <span className="absolute -top-10 -right-10 size-48 rounded-full bg-violet/25 blur-3xl" aria-hidden />
          <RouteIllustration />
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 px-1 text-sm text-mist">
            {(["mastered", "developing", "ready", "locked"] as const).map((s) => (
              <span key={s} className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full" style={{ background: COLOR[s] }} />
                {{ mastered: "Mastered", developing: "Developing", ready: "Ready", locked: "Locked" }[s]}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-line-soft py-16">
        <h2 className="text-[2rem] leading-tight font-medium">A loop, not a syllabus</h2>
        <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {LOOP.map((s, i) => (
            <li key={s.title} className="surface relative rounded-2xl p-6">
              <span className="absolute top-5 right-5 numeral text-3xl text-haze/60">{i + 1}</span>
              <span className="flex size-12 items-center justify-center rounded-xl bg-accent-gradient text-on-accent"><s.icon className="size-6" /></span>
              <h3 className="mt-4 text-xl font-medium">{s.title}</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-mist">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="py-10">
        <p className="text-center text-sm tracking-wide text-haze uppercase">Links straight to courses on</p>
        <ul className="mt-5 flex flex-wrap justify-center gap-2.5">
          {SOURCES.map((s) => <li key={s} className="rounded-full border border-line-soft bg-panel/60 px-4 py-2 text-[15px] text-mist">{s}</li>)}
        </ul>
        <p className="mt-3 text-center text-sm text-haze">Independent project; not affiliated with these platforms.</p>
      </section>

      <section className="py-14">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h2 className="flex items-center gap-3 text-[2rem] leading-tight font-medium"><Palette className="size-8 text-violet-soft" /> Make it yours</h2>
            <p className="mt-2 text-lg text-mist">Tap a theme to try it now.</p>
          </div>
        </div>
        <LandingThemeStrip />
      </section>

      <section className="mb-16 flex flex-col items-start gap-5 rounded-3xl border border-line-soft bg-panel/50 p-6 sm:flex-row sm:items-center sm:p-8">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-developing/15 text-developing"><FlaskConical className="size-7" /></span>
        <div className="flex-1">
          <h2 className="text-xl font-medium">Honest numbers</h2>
          <p className="mt-1 text-[15px] leading-relaxed text-mist">The model is trained on simulated learners and every metric is published, including where it falls short.</p>
        </div>
        <Button asChild variant="secondary"><Link href="/ml">See the evaluation <ArrowRight /></Link></Button>
      </section>

      <footer className="border-t border-line-soft py-8 text-sm text-haze">
        PathForge AI. Courses link to their original publishers.
      </footer>
    </div>
  );
}
