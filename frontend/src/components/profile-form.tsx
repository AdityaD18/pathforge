"use client";

import { Check, Loader2 } from "lucide-react";
import { useState } from "react";

import { CareerIcon } from "@/components/career-icon";
import { Button } from "@/components/ui/button";
import { ErrorState, Skeleton } from "@/components/ui/primitives";
import { cn, FORMAT_LABEL, LEVEL_LABEL } from "@/lib/format";
import { useCareers, useProfile, useUpdateProfile } from "@/lib/queries";
import type { Career, Format, Level, Profile } from "@/lib/types";

const FORMATS: Format[] = ["video", "interactive", "course", "article", "book", "documentation"];
const LEVELS: Level[] = ["beginner", "intermediate", "advanced"];

type Props = { submitLabel: string; onSaved?: (p: Profile) => void };

export function ProfileForm(props: Props) {
  const profile = useProfile();
  const careers = useCareers();
  const [saved, setSaved] = useState(false);
  if (profile.isPending || careers.isPending) return <Skeleton className="h-[560px]" />;
  if (profile.error || careers.error) return <ErrorState error={profile.error ?? careers.error} onRetry={() => { profile.refetch(); careers.refetch(); }} />;
  // Keyed so the form re-seeds from the server copy whenever the saved profile changes.
  return <Form key={profile.data.updated_at} initial={profile.data} careers={careers.data} saved={saved} setSaved={setSaved} {...props} />;
}

function Form({ initial, careers, submitLabel, onSaved, saved, setSaved }: Props & {
  initial: Profile; careers: Career[]; saved: boolean; setSaved: (v: boolean) => void;
}) {
  const update = useUpdateProfile();
  const [career, setCareer] = useState<string | null>(initial.target_career_id);
  const [hours, setHours] = useState(initial.weekly_hours);
  const [formats, setFormats] = useState<Format[]>(initial.preferred_formats);
  const [level, setLevel] = useState<Level | null>(initial.preferred_level);
  const [goal, setGoal] = useState(initial.learning_goal ?? "");
  const [name, setName] = useState(initial.display_name ?? "");

  function toggleFormat(f: Format) {
    setFormats((cur) => (cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    const p = await update.mutateAsync({
      display_name: name.trim() || null, target_career_id: career, weekly_hours: hours,
      preferred_formats: formats, preferred_level: level, learning_goal: goal.trim() || null,
    });
    setSaved(true);
    onSaved?.(p);
  }

  const selected = careers.find((c) => c.id === career);

  return (
    <form onSubmit={save} className="flex flex-col gap-10">
      <fieldset>
        <legend className="text-lg font-medium">Target career</legend>
        <p className="mt-1 text-sm text-mist">This decides the goal topics on your roadmap. You can change it later.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup">
          {careers.map((c) => {
            const active = c.id === career;
            return (
              <button type="button" role="radio" aria-checked={active} key={c.id} onClick={() => setCareer(c.id)}
                className={cn("relative flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors",
                  active ? "border-electric bg-electric/[0.08]" : "border-line-soft bg-panel/50 hover:border-line")}>
                <CareerIcon name={c.icon} className={cn("size-5", active ? "text-electric-soft" : "text-haze")} />
                <span className="font-medium text-ink">{c.title}</span>
                <span className="text-[13px] leading-snug text-mist">{c.description}</span>
                {active && <Check className="absolute top-4 right-4 size-4 text-electric-soft" />}
              </button>
            );
          })}
        </div>
        {selected && (
          <p className="mt-3 text-sm text-mist">
            Core topics: {selected.topics.filter((t) => t.weight === 3).map((t) => t.name).join(", ")}.
          </p>
        )}
      </fieldset>

      <fieldset className="grid gap-8 md:grid-cols-2">
        <div>
          <legend className="text-lg font-medium">Study time</legend>
          <label className="mt-3 flex flex-col gap-3 text-sm text-mist">
            <span><span className="numeral text-2xl text-ink">{hours}</span> hours per week</span>
            <input type="range" min={1} max={40} value={hours} onChange={(e) => setHours(Number(e.target.value))}
              className="accent-electric" aria-label="Hours per week" />
          </label>
          <p className="mt-2 text-xs text-haze">Used to turn topic estimates into a week-by-week schedule.</p>
        </div>
        <div>
          <span className="text-lg font-medium">Starting level for new topics</span>
          <div className="mt-3 flex flex-wrap gap-2">
            {[null, ...LEVELS].map((l) => (
              <button type="button" key={l ?? "auto"} aria-pressed={level === l} onClick={() => setLevel(l)}
                className={cn("rounded-md border px-3 py-1.5 text-sm", level === l ? "border-violet bg-violet/10 text-ink" : "border-line text-mist hover:text-ink")}>
                {l ? LEVEL_LABEL[l] : "Let assessments decide"}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-haze">Only applies to topics you haven&apos;t assessed yet.</p>
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-lg font-medium">Preferred formats</legend>
        <p className="mt-1 text-sm text-mist">Matching formats get a boost in recommendations. Leave empty for no preference.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {FORMATS.map((f) => (
            <button type="button" key={f} aria-pressed={formats.includes(f)} onClick={() => toggleFormat(f)}
              className={cn("rounded-md border px-3 py-1.5 text-sm", formats.includes(f) ? "border-electric bg-electric/10 text-ink" : "border-line text-mist hover:text-ink")}>
              {FORMAT_LABEL[f]}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="grid gap-6 md:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className="text-lg font-medium">What do you want to be able to do?</span>
          <span className="text-sm text-mist">Optional. Words here are matched against resource descriptions.</span>
          <textarea value={goal} onChange={(e) => setGoal(e.target.value)} maxLength={500} rows={3}
            placeholder="e.g. Build a churn model and explain it to my product team"
            className="rounded-md border border-line bg-abyss/70 p-3 text-[15px] text-ink placeholder:text-haze focus:border-electric focus:outline-none" />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-lg font-medium">Display name</span>
          <span className="text-sm text-mist">Optional.</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80}
            className="h-11 rounded-md border border-line bg-abyss/70 px-3 text-[15px] text-ink focus:border-electric focus:outline-none" />
        </label>
      </fieldset>

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" size="lg" disabled={!career || update.isPending}>
          {update.isPending && <Loader2 className="animate-spin" />} {submitLabel}
        </Button>
        {!career && <span className="text-sm text-mist">Choose a target career to continue.</span>}
        {saved && !update.isPending && <span role="status" className="text-sm text-mastered">Saved. Your roadmap has been updated.</span>}
        {update.error && <span role="alert" className="text-sm text-beginning">{update.error.message}</span>}
      </div>
    </form>
  );
}
