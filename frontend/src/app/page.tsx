import Link from "next/link";

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
const COLOR = { mastered: "#5ed3a8", developing: "#f2c66d", ready: "#4c8dff", locked: "#3a4673" } as const;

function RouteIllustration() {
  const pos = Object.fromEntries(NODES.map((n) => [n.id, n]));
  return (
    <svg viewBox="0 0 640 380" className="h-auto w-full" role="img"
      aria-label="Example roadmap: Python and Statistics mastered, pandas and SQL developing, Probability ready, later topics locked until prerequisites are met.">
      {EDGES.map(([a, b]) => {
        const s = pos[a], t = pos[b];
        const x1 = s.x + NODE_W, y1 = s.y + 20, x2 = t.x, y2 = t.y + 20, mx = (x1 + x2) / 2;
        const lit = s.state === "mastered";
        return <path key={`${a}-${b}`} d={`M${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`} fill="none"
          stroke={lit ? "url(#edge)" : "#24336a"} strokeWidth={lit ? 2 : 1.4} strokeDasharray={lit ? undefined : "4 5"} />;
      })}
      <defs>
        <linearGradient id="edge" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="640" y2="0"><stop offset="0" stopColor="#4c8dff" /><stop offset="1" stopColor="#8b7bff" /></linearGradient>
      </defs>
      {NODES.map((n) => (
        <g key={n.id} transform={`translate(${n.x} ${n.y})`} opacity={n.state === "locked" ? 0.62 : 1}>
          <rect width={NODE_W} height="40" rx="10" fill="#101a3a" stroke={n.state === "ready" ? "#4c8dff" : "#22305c"} />
          <circle cx="16" cy="20" r="4" fill={COLOR[n.state]} />
          <text x="28" y="24.5" fill="#e7ecfa" fontSize="12.5" fontFamily="var(--font-sans)">{n.label}</text>
        </g>
      ))}
    </svg>
  );
}

const LOOP = [
  { title: "Diagnose", body: "Five questions per topic, easy to hard. You mark how sure you are, and response time is recorded. A trained classifier turns that evidence into a proficiency estimate with probabilities, not a raw score." },
  { title: "Plan", body: "Your target career defines the goal topics. A topological sort over the prerequisite graph orders what's left, so nothing appears before the topics it depends on, and your weekly hours set the pace." },
  { title: "Adapt", body: "Each submission updates your estimate, unlocks topics whose prerequisites you've now mastered, and re-ranks resources. Every change is recorded so you can see why the plan moved." },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
      <header className="flex items-center justify-between py-6">
        <Wordmark />
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm"><Link href="/ml">Model evaluation</Link></Button>
          <Button asChild variant="secondary" size="sm"><Link href="/login">Sign in</Link></Button>
        </nav>
      </header>

      <section className="grid items-center gap-12 pt-12 pb-20 lg:grid-cols-[1fr_1.15fr] lg:pt-20">
        <div>
          <h1 className="text-[2.6rem] leading-[1.05] font-medium sm:text-[3.6rem]">
            Learn the next thing you&apos;re actually ready for.
          </h1>
          <p className="mt-6 max-w-[34rem] text-[17px] leading-relaxed text-mist">
            PathForge diagnoses what you know one topic at a time, builds a roadmap that respects prerequisites,
            and recommends resources with the reasons behind each pick.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Button asChild size="lg"><Link href="/signup">Create your roadmap</Link></Button>
            <Button asChild size="lg" variant="secondary"><Link href="/ml">How the model is evaluated</Link></Button>
          </div>
          <p className="mt-6 text-sm text-haze">Six career paths across data, machine learning, frontend and backend engineering.</p>
        </div>
        <div className="glass rounded-xl p-4 sm:p-6">
          <RouteIllustration />
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 px-1 text-xs text-mist">
            {(["mastered", "developing", "ready", "locked"] as const).map((s) => (
              <span key={s} className="flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ background: COLOR[s] }} />
                {{ mastered: "Mastered", developing: "Developing", ready: "Ready to start", locked: "Waiting on prerequisites" }[s]}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-line-soft py-16">
        <h2 className="max-w-xl text-[1.9rem] leading-tight font-medium">A loop, not a syllabus</h2>
        <ol className="mt-10 grid gap-10 md:grid-cols-3">
          {LOOP.map((s, i) => (
            <li key={s.title}>
              <span className="numeral text-[2.4rem] leading-none text-violet-soft/70">{i + 1}</span>
              <h3 className="mt-3 text-xl font-medium">{s.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-mist">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mb-20 rounded-xl border border-line-soft bg-panel/50 px-6 py-8 sm:px-10">
        <h2 className="text-xl font-medium">What the numbers mean</h2>
        <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-mist">
          There is no historical learner data yet, so the proficiency model is trained on simulated learners answering
          PathForge&apos;s real question bank. It&apos;s evaluated on held-out learners against simple baselines, and every metric
          on the evaluation page comes straight from that run. Treat its estimates as a starting point that your own results refine.
        </p>
        <Link href="/ml" className="mt-4 inline-block text-sm text-electric-soft underline-offset-4 hover:underline">
          Read the evaluation and its limitations
        </Link>
      </section>

      <footer className="border-t border-line-soft py-8 text-sm text-haze">
        PathForge AI. Resources link to their original publishers.
      </footer>
    </div>
  );
}
