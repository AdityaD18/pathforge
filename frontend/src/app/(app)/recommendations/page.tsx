"use client";

import { Lock, SearchX, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { RecommendationCard } from "@/components/learner";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, PageHeader, Panel, Skeleton } from "@/components/ui/primitives";
import { ApiError } from "@/lib/api";
import { cn, FORMAT_LABEL, LEVEL_LABEL, pct } from "@/lib/format";
import { useMetrics, useMyResources, useRecommendations, useRoadmap, useSetProgress } from "@/lib/queries";
import type { Format, Level } from "@/lib/types";

const FORMATS: Format[] = ["video", "interactive", "course", "article", "book", "documentation"];
const LEVELS: Level[] = ["beginner", "intermediate", "advanced"];

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
      className={cn("rounded-md border px-2.5 py-1 text-[13px] transition-colors", on ? "border-electric bg-electric/10 text-ink" : "border-line-soft text-mist hover:text-ink")}>
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
  const recs = useRecommendations({ topic, format: formats, level: levels, limit: 12 });
  const roadmap = useRoadmap();
  const metrics = useMetrics();
  const mine = useMyResources();
  const setProgress = useSetProgress();

  const setTopic = (t: string | null) => router.replace(t ? `${pathname}?topic=${t}` : pathname, { scroll: false });
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const unlocked = roadmap.data?.steps.filter((s) => s.status !== "locked") ?? [];
  const weights = metrics.data?.policy.ranking_weights;

  return (
    <div>
      <PageHeader title="Recommendations"
        description="Resources for topics you're ready to learn, ranked by content match, roadmap position, level fit, format and time. Open “Why this” on any card to see exactly how its score was built." />

      <div className="grid gap-8 xl:grid-cols-[260px_1fr]">
        <aside className="flex flex-col gap-6">
          <div>
            <p className="mb-2 text-sm font-medium text-ink">Topic</p>
            <div className="flex flex-col gap-1">
              <button onClick={() => setTopic(null)} className={cn("rounded-md px-3 py-1.5 text-left text-sm", !topic ? "bg-white/[0.06] text-ink" : "text-mist hover:text-ink")}>
                Next on my roadmap
              </button>
              {unlocked.map((s) => (
                <button key={s.topic_id} onClick={() => setTopic(s.topic_id)}
                  className={cn("rounded-md px-3 py-1.5 text-left text-sm", topic === s.topic_id ? "bg-white/[0.06] text-ink" : "text-mist hover:text-ink")}>
                  {s.name}
                </button>
              ))}
            </div>
            {roadmap.data && roadmap.data.steps.some((s) => s.status === "locked") && (
              <p className="mt-2 flex gap-1.5 px-3 text-xs text-haze"><Lock className="mt-0.5 size-3 shrink-0" /> Locked topics are hidden until their prerequisites are mastered.</p>
            )}
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-ink">Format</p>
            <div className="flex flex-wrap gap-1.5">
              {FORMATS.map((f) => <Toggle key={f} on={formats.includes(f)} onClick={() => setFormats(toggle(formats, f))}>{FORMAT_LABEL[f]}</Toggle>)}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-ink">Difficulty</p>
            <div className="flex flex-wrap gap-1.5">
              {LEVELS.map((l) => <Toggle key={l} on={levels.includes(l)} onClick={() => setLevels(toggle(levels, l))}>{LEVEL_LABEL[l]}</Toggle>)}
            </div>
          </div>
          {weights && (
            <div className="rounded-lg border border-line-soft p-4 text-xs leading-relaxed text-mist">
              <p className="mb-2 text-sm font-medium text-ink">Ranking formula</p>
              <ul className="space-y-1">
                {[["relevance", "Content match (TF-IDF)"], ["priority", "Roadmap position"], ["level_fit", "Level fit"], ["format_fit", "Format preference"], ["time_fit", "Fits your week"]]
                  .map(([k, l]) => <li key={k} className="flex justify-between gap-2"><span>{l}</span><span className="tabular-nums text-ink">{pct(weights[k])}</span></li>)}
              </ul>
            </div>
          )}
        </aside>

        <div className="min-w-0">
          {recs.data?.focus_topics.length ? (
            <p className="mb-4 text-sm text-mist">
              Showing resources for {recs.data.focus_topics.map((f) => `${f.name}${f.mastery_score !== null ? ` (${pct(f.mastery_score)})` : ""}`).join(", ")}.
            </p>
          ) : null}
          {recs.isPending ? (
            <div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-64" /><Skeleton className="h-64" /><Skeleton className="h-64" /><Skeleton className="h-64" /></div>
          ) : recs.error ? (
            recs.error instanceof ApiError && recs.error.status === 409 ? (
              <EmptyState icon={Lock} title="This topic is locked" body={recs.error.message}
                action={<Button size="sm" variant="secondary" onClick={() => setTopic(null)}>Show my next topics</Button>} />
            ) : <ErrorState error={recs.error} onRetry={() => recs.refetch()} />
          ) : recs.data.items.length === 0 ? (
            recs.data.empty_reason === "no_career" ? (
              <EmptyState icon={Sparkles} title="Choose a target career first" body="Recommendations follow your roadmap, which starts from the career you're aiming for."
                action={<Button asChild size="sm"><Link href="/onboarding">Choose a career</Link></Button>} />
            ) : recs.data.empty_reason === "roadmap_complete" ? (
              <EmptyState icon={Sparkles} title="Your roadmap is complete" body="Every topic on your path is mastered. Pick a new career in your profile to keep going." />
            ) : (
              <EmptyState icon={SearchX} title="No resources match these filters" body="Every matching resource is either completed or filtered out. Clear a format or difficulty filter to see more."
                action={<Button size="sm" variant="secondary" onClick={() => { setFormats([]); setLevels([]); }}>Clear filters</Button>} />
            )
          ) : (
            <div className="grid items-start gap-4 md:grid-cols-2">
              {recs.data.items.map((r, i) => <RecommendationCard key={r.resource_id} rec={r} rank={i + 1} defaultOpen={i === 0} />)}
            </div>
          )}

          <Panel className="mt-10">
            <h2 className="px-5 pt-5 pb-3 text-lg font-medium">Your saved and completed resources</h2>
            {mine.data?.length ? (
              <ul>
                {mine.data.map((r) => (
                  <li key={r.id} className="grid gap-2 border-t border-line-soft px-5 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
                    <div className="min-w-0">
                      <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-sm text-ink hover:text-electric-soft">{r.title}</a>
                      <p className="text-xs text-haze">{r.topic_name}, {FORMAT_LABEL[r.format]}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select aria-label={`Status for ${r.title}`} value={r.progress?.status ?? "saved"} disabled={setProgress.isPending}
                        onChange={(e) => setProgress.mutate({ id: r.id, status: e.target.value as "saved" | "in_progress" | "completed" })}
                        className="h-8 rounded-sm border border-line bg-abyss px-2 text-[13px] text-ink">
                        <option value="saved">Saved</option><option value="in_progress">In progress</option><option value="completed">Completed</option>
                      </select>
                      <Button size="sm" variant="ghost" onClick={() => setProgress.mutate({ id: r.id, status: null })}>Remove</Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 pb-5 text-sm text-mist">Start or save a resource and it will be tracked here. Completed resources drop out of your recommendations.</p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

export default function RecommendationsPage() {
  return <Suspense fallback={<Skeleton className="h-[480px]" />}><Explorer /></Suspense>;
}
