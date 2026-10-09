"use client";

import { Check } from "lucide-react";

import { useTheme } from "@/components/theme";
import { cn } from "@/lib/format";
import { THEMES } from "@/lib/themes";

/** Clickable theme swatches on the landing page (applies locally; saved to the account after sign-in). */
export function LandingThemeStrip() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-8" role="radiogroup" aria-label="Theme">
      {THEMES.map((t) => {
        const active = theme === t.id;
        return (
          <button key={t.id} type="button" role="radio" aria-checked={active} onClick={() => setTheme(t.id)}
            className={cn("group overflow-hidden rounded-2xl border-2 text-left transition-transform hover:-translate-y-1",
              active ? "border-electric" : "border-line-soft")}>
            <span data-theme={t.id} className="relative flex h-20 items-end gap-1 bg-midnight p-2.5">
              <span className="h-full w-1/3 rounded-md bg-panel" />
              <span className="h-2/3 w-1/4 rounded-md bg-electric" />
              <span className="h-1/2 w-1/4 rounded-md bg-violet" />
              {active && <span className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-electric text-on-accent"><Check className="size-4" /></span>}
            </span>
            <span className="block truncate bg-panel px-2.5 py-2 text-sm text-ink">{t.name}</span>
          </button>
        );
      })}
    </div>
  );
}
