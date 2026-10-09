"use client";

import { motion } from "framer-motion";
import { Check, Clock, Loader2, Target, Wand2 } from "lucide-react";
import { useState } from "react";

import { CareerIcon } from "@/components/career-icon";
import { FORMAT_ICON } from "@/components/course";
import { Button } from "@/components/ui/button";
import { ErrorState, Skeleton } from "@/components/ui/primitives";
import { cn, FORMAT_LABEL, LEVEL_LABEL } from "@/lib/format";
import { useCareers, useProfile, useUpdateProfile } from "@/lib/queries";
import type { Career, Format, Level, Profile } from "@/lib/types";

const FORMATS: Format[] = ["course", "video", "interactive", "article", "book", "documentation"];
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

function Section({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  return (
    <fieldset className="surface rounded-2xl p-5 sm:p-6">
      <legend className="sr-only">{title}</legend>
      <div className="mb-5 flex items-center gap-3">
        <span className="flex size-8 items-center justify-center rounded-full bg-accent-gradient text-sm font-semibold text-on-accent">{step}</span>
        <h2 className="text-xl font-medium" aria-hidden>{title}</h2>
      </div>
      {children}
    </fieldset>
  );
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
  const intensity = hours <= 4 ? "Light" : hours <= 10 ? "Steady" : hours <= 20 ? "Focused" : "Intensive";

  return (
    <form onSubmit={save} className="flex flex-col gap-6">
      <Section step={1} title="Where are you headed?">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup" aria-label="Target career">
          {careers.map((c, i) => {
            const active = c.id === career;
            return (
              <motion.button type="button" role="radio" aria-checked={active} key={c.id} onClick={() => setCareer(c.id)}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 * i }} whileHover={{ y: -3 }}
                className={cn("relative flex flex-col items-start gap-3 rounded-2xl border-2 p-5 text-left transition-colors",
                  active ? "border-electric bg-electric/[0.08]" : "border-line-soft bg-panel/50 hover:border-line")}>
                <span className={cn("flex size-12 items-center justify-center rounded-xl", active ? "bg-accent-gradient text-on-accent" : "bg-ink/[0.07] text-mist")}>
                  <CareerIcon name={c.icon} className="size-6" />
                </span>
                <span className="text-lg font-medium text-ink">{c.title}</span>
                <span className="line-clamp-2 text-sm leading-snug text-mist">{c.description}</span>
                <span className="flex items-center gap-1.5 text-sm text-haze"><Target className="size-4" /> {c.topics.length} goal topics</span>
                {active && <span className="absolute top-4 right-4 flex size-7 items-center justify-center rounded-full bg-electric text-on-accent"><Check className="size-4" /></span>}
              </motion.button>
            );
          })}
        </div>
        {selected && (
          <div className="mt-4 flex flex-wrap gap-2">
            {selected.topics.filter((t) => t.weight === 3).map((t) => (
              <span key={t.topic_id} className="rounded-full bg-violet/15 px-3 py-1 text-sm text-violet-soft">{t.name}</span>
            ))}
          </div>
        )}
      </Section>

      <div className="grid gap-6 md:grid-cols-2">
        <Section step={2} title="How much time do you have?">
          <div className="flex items-end gap-3">
            <span className="numeral text-6xl leading-none text-ink">{hours}</span>
            <span className="pb-1 text-mist">hours / week</span>
            <span className="ml-auto flex items-center gap-1.5 rounded-full bg-ink/[0.06] px-3 py-1 text-sm text-ink"><Clock className="size-4 text-electric-soft" />{intensity}</span>
          </div>
          <input type="range" min={1} max={40} value={hours} onChange={(e) => setHours(Number(e.target.value))}
            className="mt-5 w-full" aria-label="Hours per week" />
          <div className="mt-1 flex justify-between text-xs text-haze"><span>1 h</span><span>~{(hours / 7).toFixed(1)} h a day</span><span>40 h</span></div>
        </Section>

        <Section step={3} title="Starting level">
          <div className="grid grid-cols-2 gap-2">
            {[null, ...LEVELS].map((l) => (
              <button type="button" key={l ?? "auto"} aria-pressed={level === l} onClick={() => setLevel(l)}
                className={cn("flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-3 text-[15px] transition-colors",
                  level === l ? "border-violet bg-violet/10 text-ink" : "border-line-soft text-mist hover:text-ink")}>
                {l ? LEVEL_LABEL[l] : <><Wand2 className="size-4" /> Let tests decide</>}
              </button>
            ))}
          </div>
          <p className="mt-3 text-sm text-haze">Only for topics you haven&apos;t tested yet.</p>
        </Section>
      </div>

      <Section step={4} title="How do you like to learn?">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {FORMATS.map((f) => {
            const Icon = FORMAT_ICON[f];
            const on = formats.includes(f);
            return (
              <button type="button" key={f} aria-pressed={on} onClick={() => toggleFormat(f)}
                className={cn("flex flex-col items-center gap-2 rounded-xl border-2 px-3 py-4 text-[15px] transition-colors",
                  on ? "border-electric bg-electric/10 text-ink" : "border-line-soft text-mist hover:text-ink")}>
                <Icon className={cn("size-6", on ? "text-electric-soft" : "text-haze")} />{FORMAT_LABEL[f]}
              </button>
            );
          })}
        </div>
      </Section>

      <Section step={5} title="About you (optional)">
        <div className="grid gap-5 md:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className="text-[15px] text-ink">Your goal, in your words</span>
            <textarea value={goal} onChange={(e) => setGoal(e.target.value)} maxLength={500} rows={3}
              placeholder="Build a churn model and explain it to my team"
              className="rounded-xl border border-line bg-abyss/70 p-3 text-base text-ink placeholder:text-haze focus:border-electric focus:outline-none" />
            <span className="text-sm text-haze">Matched against course descriptions.</span>
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-[15px] text-ink">Display name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80}
              className="h-12 rounded-xl border border-line bg-abyss/70 px-3 text-base text-ink focus:border-electric focus:outline-none" />
          </label>
        </div>
      </Section>

      <div className="sticky bottom-4 z-10 flex flex-wrap items-center gap-4 rounded-2xl border border-line-soft bg-panel/90 p-4 backdrop-blur">
        <Button type="submit" size="lg" disabled={!career || update.isPending}>
          {update.isPending && <Loader2 className="animate-spin" />} {submitLabel}
        </Button>
        {!career && <span className="text-mist">Choose a career to continue.</span>}
        {saved && !update.isPending && <span role="status" className="flex items-center gap-1.5 text-mastered"><Check className="size-4" /> Saved. Roadmap updated.</span>}
        {update.error && <span role="alert" className="text-beginning">{update.error.message}</span>}
      </div>
    </form>
  );
}
