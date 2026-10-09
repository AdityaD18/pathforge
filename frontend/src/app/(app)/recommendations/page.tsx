"use client";

import * as Tabs from "@radix-ui/react-tabs";
import { BadgeCheck, GraduationCap, Library, Lock, SearchX, Sparkles, Star, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { COST_LABEL, CourseCard, CourseRow, FORMAT_ICON } from "@/components/course";
import { InfoTip } from "@/components/info-tip";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, PageHeader, Panel, Skeleton } from "@/components/ui/primitives";
import { ApiError } from "@/lib/api";
import { cn, FORMAT_LABEL, LEVEL_LABEL, pct } from "@/lib/format";
import { useMetrics, useMyResources, useRecommendations, useRoadmap } from "@/lib/queries";
import type { Cost, Format, Level } from "@/lib/types";

const FORMATS: Format[] = ["course", "video", "interactive", "article", "book", "documentation"];
const LEVELS: Level[] = ["beginner", "intermediate", "advanced"];
const COSTS: Cost[] = ["free", "freemium", "paid"];

function Chip({ on, onClick, children, className }: { on: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
      className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-colors",
        on ? "border-electric bg-electric/[0.14] text-ink" : "border-line-soft text-mist hover:border-line hover:text-ink", className)}>
      {children}
    </button>
  );
}

function Explorer() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const topic = params.get("topic");
  const [formats, setFormats] = useState<Format[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [costs, setCosts] = useState<Cost[]>([]);
  const recs = useRecommendations({ topic, format: formats, level: levels, cost: costs, limit: 12 });
  const roadmap = useRoadmap();
  const metrics = useMetrics();
  const mine = useMyResources();

  const setTopic = (t: string | null) => router.replace(t ? `${pathname}?topic=${t}` : pathname, { scroll: false });
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const unlocked = roadmap.data?.steps.filter((s) => s.status !== "locked") ?? [];
  const weights = metrics.data?.policy.ranking_weights;
  const filtered = formats.length + levels.length + costs.length > 0;
  const freeOnly = costs.length === 1 && costs[0] === "free";

  const byStatus = (s: "in_progress" | "saved" | "completed") => (mine.data ?? []).filter((r) => r.progress?.status === s);

  return (
    <div>
      <PageHeader icon={GraduationCap} title="Courses for you"
        description="Picked for what you're ready to learn next, from Coursera, Udemy, freeCodeCamp, Khan Academy and more."
        action={weights && (
          <InfoTip label="How we rank">
            <p className="mb-2 font-medium text-ink">Ranking score</p>
            <ul className="space-y-1">
              {[["relevance", "Content match (TF-IDF)"], ["priority", "Roadmap position"], ["level_fit", "Level fit"], ["format_fit", "Format you like"], ["time_fit", "Fits your week"]]
                .map(([k, l]) => <li key={k} className="flex justify-between gap-6"><span>{l}</span><span className="tabular-nums text-ink">{pct(weights[k])}</span></li>)}
            </ul>
          </InfoTip>
        )} />

      {/* Topic switcher */}
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0" role="group" aria-label="Topic">
        <Chip on={!topic} onClick={() => setTopic(null)}><Sparkles className="size-4" /> Next on my roadmap</Chip>
        {unlocked.map((s) => <Chip key={s.topic_id} on={topic === s.topic_id} onClick={() => setTopic(s.topic_id)}>{s.name}</Chip>)}
        {roadmap.data?.steps.some((s) => s.status === "locked") && (
          <span className="flex shrink-0 items-center gap-1.5 px-2 text-sm text-haze" title="Topics unlock once their prerequisites are mastered"><Lock className="size-3.5" /> more unlock later</span>
        )}
      </div>

      {/* Filters */}
      <div className="surface mb-8 flex flex-col gap-4 rounded-2xl p-4 sm:p-5 lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-8">
        <button type="button" role="switch" aria-checked={freeOnly} onClick={() => setCosts(freeOnly ? [] : ["free"])}
          className="flex items-center gap-3 text-[15px] text-ink">
          <span className={cn("relative h-7 w-12 rounded-full transition-colors", freeOnly ? "bg-mastered" : "bg-ink/[0.12]")}>
            <span className={cn("absolute top-1 size-5 rounded-full bg-white shadow transition-[left]", freeOnly ? "left-6" : "left-1")} />
          </span>
          <BadgeCheck className="size-5 text-mastered" /> Free only
        </button>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Price">
          {COSTS.map((c) => <Chip key={c} on={costs.includes(c)} onClick={() => setCosts(toggle(costs, c))}>{COST_LABEL[c]}</Chip>)}
        </div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Format">
          {FORMATS.map((f) => {
            const Icon = FORMAT_ICON[f];
            return <Chip key={f} on={formats.includes(f)} onClick={() => setFormats(toggle(formats, f))}><Icon className="size-4" />{FORMAT_LABEL[f]}</Chip>;
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Level">
          {LEVELS.map((l) => <Chip key={l} on={levels.includes(l)} onClick={() => setLevels(toggle(levels, l))}>{LEVEL_LABEL[l]}</Chip>)}
        </div>
        {filtered && (
          <button type="button" onClick={() => { setFormats([]); setLevels([]); setCosts([]); }}
            className="flex items-center gap-1 text-sm text-electric-soft hover:text-ink lg:ml-auto"><X className="size-4" /> Clear</button>
        )}
      </div>

      {recs.data?.focus_topics.length ? (
        <div className="mb-5 flex flex-wrap items-center gap-2 text-sm text-mist">
          For
          {recs.data.focus_topics.map((f) => (
            <span key={f.topic_id} className="rounded-full bg-ink/[0.06] px-3 py-1 text-ink">
              {f.name}{f.mastery_score !== null && <span className="ml-1.5 text-mist">{pct(f.mastery_score)}</span>}
            </span>
          ))}
        </div>
      ) : null}

      {recs.isPending ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-72" />)}</div>
      ) : recs.error ? (
        recs.error instanceof ApiError && recs.error.status === 409 ? (
          <EmptyState icon={Lock} title="This topic is still locked" body={recs.error.message}
            action={<Button size="sm" variant="secondary" onClick={() => setTopic(null)}>Show my next topics</Button>} />
        ) : <ErrorState error={recs.error} onRetry={() => recs.refetch()} />
      ) : recs.data.items.length === 0 ? (
        recs.data.empty_reason === "no_career" ? (
          <EmptyState icon={Sparkles} title="Choose a target career first" body="Courses follow your roadmap, which starts from your career goal."
            action={<Button asChild size="sm"><Link href="/onboarding">Choose a career</Link></Button>} />
        ) : recs.data.empty_reason === "roadmap_complete" ? (
          <EmptyState icon={Sparkles} title="Your roadmap is complete" body="Every topic on your path is mastered. Pick a new career in your profile to keep going." />
        ) : (
          <EmptyState icon={SearchX} title="Nothing matches these filters" body="Try clearing a filter to see more courses."
            action={<Button size="sm" variant="secondary" onClick={() => { setFormats([]); setLevels([]); setCosts([]); }}>Clear filters</Button>} />
        )
      ) : (
        <div className="grid items-start gap-5 md:grid-cols-2 xl:grid-cols-3">
          {recs.data.items.map((r, i) => <CourseCard key={r.resource_id} rec={r} rank={i} featured={i === 0} />)}
        </div>
      )}

      <Panel className="mt-12">
        <Tabs.Root defaultValue="in_progress">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 sm:px-6">
            <h2 className="flex items-center gap-2 text-xl font-medium"><Library className="size-5 text-electric-soft" /> My courses</h2>
            <Tabs.List className="inline-flex rounded-full border border-line p-1" aria-label="My courses">
              {([["in_progress", "In progress"], ["saved", "Saved"], ["completed", "Completed"]] as const).map(([v, l]) => (
                <Tabs.Trigger key={v} value={v}
                  className="rounded-full px-4 py-1.5 text-sm text-mist data-[state=active]:bg-electric data-[state=active]:text-on-accent">
                  {l} <span className="ml-1 tabular-nums opacity-80">{byStatus(v).length}</span>
                </Tabs.Trigger>
              ))}
            </Tabs.List>
          </div>
          {(["in_progress", "saved", "completed"] as const).map((s) => (
            <Tabs.Content key={s} value={s} className="px-5 pb-3 sm:px-6">
              {byStatus(s).length ? (
                <div className="divide-y divide-line-soft">
                  {byStatus(s).map((r) => (
                    <CourseRow key={r.id} r={r} subtitle={`${r.provider} · ${r.topic_name}${r.progress?.rating ? ` · ${"★".repeat(r.progress.rating)}` : ""}`} />
                  ))}
                </div>
              ) : (
                <p className="flex items-center gap-2 py-6 text-mist">
                  <Star className="size-4 text-haze" />
                  {s === "in_progress" ? "Start a course and it shows up here." : s === "saved" ? "Bookmark courses to come back to them." : "Finished courses land here."}
                </p>
              )}
            </Tabs.Content>
          ))}
        </Tabs.Root>
      </Panel>
    </div>
  );
}

export default function RecommendationsPage() {
  return <Suspense fallback={<Skeleton className="h-[480px]" />}><Explorer /></Suspense>;
}
