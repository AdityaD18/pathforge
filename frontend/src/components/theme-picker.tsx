"use client";

import * as Popover from "@radix-ui/react-popover";
import { motion } from "framer-motion";
import { Check, Laptop, Palette, Pipette } from "lucide-react";
import { useEffect, useRef } from "react";

import { useTheme } from "@/components/theme";
import { cn } from "@/lib/format";
import { useSaveTheme } from "@/lib/queries";
import { customAccentVars, DEFAULT_ACCENT, THEMES, type ThemeDef } from "@/lib/themes";

const GROUPS: { id: ThemeDef["group"]; title: string }[] = [
  { id: "dark", title: "Dark" },
  { id: "light", title: "Light" },
  { id: "special", title: "Special" },
];

/** Picks a theme locally (instant) and, when signed in, saves it to the account so it follows the learner. */
export function useChooseTheme(signedIn: boolean) {
  const { setTheme, accent } = useTheme();
  const save = useSaveTheme();
  const timer = useRef<number | undefined>(undefined);
  return (theme: string, nextAccent?: string) => {
    const a = nextAccent ?? accent;
    setTheme(theme, theme === "custom" ? a : undefined);
    if (!signedIn) return;
    window.clearTimeout(timer.current);
    // Debounced so dragging the colour picker doesn't send a request per pixel.
    timer.current = window.setTimeout(() => save.mutate({ theme, theme_accent: theme === "custom" ? a.toLowerCase() : null }), 400);
  };
}

/** Adopt the account's saved theme when a signed-in profile loads (the account is the source of truth). */
export function useAccountTheme(profile: { theme?: string; theme_accent?: string | null } | undefined) {
  const { theme, accent, setTheme } = useTheme();
  const save = useSaveTheme();
  const applied = useRef<string | null>(null);
  useEffect(() => {
    if (!profile?.theme) return;
    const key = `${profile.theme}|${profile.theme_accent ?? ""}`;
    if (applied.current === key) return;
    applied.current = key;
    // An account that never chose a theme adopts the one picked on this device (e.g. on the landing page).
    if (profile.theme === "system" && theme !== "system") {
      save.mutate({ theme, theme_accent: theme === "custom" ? accent.toLowerCase() : null });
      return;
    }
    if (profile.theme !== theme || (profile.theme === "custom" && profile.theme_accent && profile.theme_accent !== accent)) {
      setTheme(profile.theme, profile.theme_accent ?? undefined);
    }
  }, [profile?.theme, profile?.theme_accent, theme, accent, setTheme, save]);
}

/** A miniature dashboard rendered in the theme's own palette (data-theme scopes the CSS variables). */
function Preview({ themeId, accent }: { themeId: string; accent?: string }) {
  const style = themeId === "custom" ? (customAccentVars(accent ?? DEFAULT_ACCENT) as React.CSSProperties) : undefined;
  return (
    <div data-theme={themeId} style={style} className="pointer-events-none bg-midnight p-3" aria-hidden>
      <div className="rounded-lg border border-line-soft bg-panel p-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-ink">Mastery</span>
          <span className="text-xs font-semibold text-electric">72%</span>
        </div>
        <div className="mt-2 flex h-10 items-end gap-1">
          {[38, 62, 48, 80, 56, 70].map((h, i) => (
            <span key={i} className={cn("flex-1 rounded-t-[3px]", i % 2 ? "bg-violet" : "bg-electric")} style={{ height: `${h}%` }} />
          ))}
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          <span className="rounded-md bg-electric px-2 py-0.5 text-[11px] font-medium text-on-accent">Start</span>
          <span className="size-2 rounded-full bg-mastered" /><span className="size-2 rounded-full bg-developing" /><span className="size-2 rounded-full bg-beginning" />
        </div>
      </div>
    </div>
  );
}

function ThemeCard({ id, name, mood, active, onPick, children }: {
  id: string; name: string; mood: string; active: boolean; onPick: () => void; children?: React.ReactNode;
}) {
  return (
    <motion.div whileHover={{ y: -3 }} transition={{ type: "spring", stiffness: 400, damping: 26 }}
      className={cn("relative overflow-hidden rounded-xl border-2 bg-panel text-left transition-colors",
        active ? "border-electric shadow-[0_10px_30px_-12px_var(--pf-accent)]" : "border-line-soft hover:border-line")}>
      <button type="button" role="radio" aria-checked={active} onClick={onPick} className="block w-full text-left">
        {id === "system" ? (
          <div className="grid grid-cols-2" aria-hidden><Preview themeId="midnight" /><Preview themeId="sky" /></div>
        ) : <Preview themeId={id} />}
        <span className="flex items-center justify-between gap-2 px-3 pt-2.5 pb-3">
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 text-[15px] font-medium text-ink">
              {id === "system" && <Laptop className="size-4 text-mist" />}{name}
            </span>
            <span className="block truncate text-xs text-haze">{mood}</span>
          </span>
          {active && <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-electric text-on-accent"><Check className="size-4" /></span>}
        </span>
      </button>
      {children}
    </motion.div>
  );
}

export function ThemeGallery({ signedIn }: { signedIn: boolean }) {
  const { theme, accent } = useTheme();
  const choose = useChooseTheme(signedIn);
  return (
    <div className="space-y-7" role="radiogroup" aria-label="Theme">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ThemeCard id="system" name="Match my device" mood="Midnight at night, Sky by day" active={theme === "system"} onPick={() => choose("system")} />
        <ThemeCard id="custom" name="Your colour" mood="Pick any accent" active={theme === "custom"} onPick={() => choose("custom")}>
          <label className="absolute top-3 right-3 flex cursor-pointer items-center gap-1.5 rounded-full border border-line bg-panel/90 px-2 py-1 text-xs text-ink backdrop-blur">
            <Pipette className="size-3.5" /> Pick
            <input type="color" value={accent} onChange={(e) => choose("custom", e.target.value)}
              className="size-5 cursor-pointer rounded border-0 bg-transparent p-0" aria-label="Accent colour" />
          </label>
        </ThemeCard>
      </div>
      {GROUPS.map((g) => (
        <div key={g.id}>
          <p className="mb-3 text-sm font-medium tracking-wide text-mist uppercase">{g.title}</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {THEMES.filter((t) => t.group === g.id).map((t) => (
              <ThemeCard key={t.id} id={t.id} name={t.name} mood={t.mood} active={theme === t.id} onPick={() => choose(t.id)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Sidebar button: a compact swatch grid for switching themes from anywhere. */
export function ThemeQuickSwitch({ signedIn, className }: { signedIn: boolean; className?: string }) {
  const { theme, accent } = useTheme();
  const choose = useChooseTheme(signedIn);
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button type="button" className={cn("flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm text-mist hover:bg-ink/[0.04] hover:text-ink", className)}>
          <Palette className="size-[18px] text-haze" /> Theme
          <span className="ml-auto flex -space-x-1" aria-hidden>
            <span className="size-3.5 rounded-full border border-midnight bg-electric" />
            <span className="size-3.5 rounded-full border border-midnight bg-violet" />
          </span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content side="right" align="end" sideOffset={10} collisionPadding={12}
          className="z-50 w-[330px] rounded-2xl border border-line bg-panel p-4 shadow-[0_24px_60px_-16px_rgb(0_0_0/0.5)]">
          <p className="mb-3 text-sm font-medium text-ink">Theme</p>
          <div className="grid grid-cols-4 gap-2.5" role="radiogroup" aria-label="Theme">
            {[{ id: "system", name: "Device" }, ...THEMES].map((t) => {
              const active = theme === t.id;
              return (
                <button key={t.id} type="button" role="radio" aria-checked={active} title={t.name} onClick={() => choose(t.id)}
                  className="group flex flex-col items-center gap-1">
                  <span data-theme={t.id === "system" ? undefined : t.id}
                    className={cn("relative flex size-12 items-center justify-center overflow-hidden rounded-xl border-2 bg-midnight transition-transform group-hover:scale-105",
                      active ? "border-electric" : "border-line-soft")}>
                    {t.id === "system" ? <Laptop className="size-5 text-mist" /> : (
                      <>
                        <span className="absolute inset-y-0 left-0 w-1/2 bg-panel" />
                        <span className="relative size-4 rounded-full bg-electric" />
                        <span className="relative -ml-1 size-3 rounded-full bg-violet" />
                      </>
                    )}
                  </span>
                  <span className={cn("max-w-full truncate text-xs", active ? "text-ink" : "text-haze")}>{t.name}</span>
                </button>
              );
            })}
            <label title="Your colour" className="group flex cursor-pointer flex-col items-center gap-1">
              <span className={cn("relative flex size-12 items-center justify-center rounded-xl border-2 transition-transform group-hover:scale-105",
                theme === "custom" ? "border-electric" : "border-line-soft")} style={{ background: accent }}>
                <Pipette className="size-5 text-white mix-blend-difference" />
                <input type="color" value={accent} onChange={(e) => choose("custom", e.target.value)} className="absolute inset-0 cursor-pointer opacity-0"
                  aria-label="Custom accent colour" />
              </span>
              <span className={cn("text-xs", theme === "custom" ? "text-ink" : "text-haze")}>Custom</span>
            </label>
          </div>
          <Popover.Arrow className="fill-[var(--pf-line)]" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
