"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { customAccentVars, DEFAULT_ACCENT, SYSTEM_DARK, SYSTEM_LIGHT, THEME_STORAGE_KEY, themeById } from "@/lib/themes";

type Stored = { theme: string; accent: string | null };
type Ctx = {
  theme: string;
  accent: string;
  /** The palette actually showing (resolves "system" and "custom"). */
  resolved: string;
  scheme: "dark" | "light";
  setTheme: (theme: string, accent?: string | null) => void;
};

const ThemeContext = createContext<Ctx | null>(null);

function readStored(): Stored {
  try {
    const s = JSON.parse(localStorage.getItem(THEME_STORAGE_KEY) || "{}");
    return { theme: typeof s.theme === "string" ? s.theme : "system", accent: typeof s.accent === "string" ? s.accent : null };
  } catch {
    return { theme: "system", accent: null };
  }
}

function prefersLight() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches;
}

/** Writes the theme onto <html>. Mirrors THEME_BOOT_SCRIPT, which does the same before first paint. */
function apply(theme: string, accent: string | null, animate: boolean) {
  const el = document.documentElement;
  if (animate) {
    el.classList.add("theme-switching");
    window.setTimeout(() => el.classList.remove("theme-switching"), 450);
  }
  el.setAttribute("data-theme", theme);
  const vars = customAccentVars(accent && /^#[0-9a-f]{6}$/i.test(accent) ? accent : DEFAULT_ACCENT);
  for (const [k, v] of Object.entries(vars)) {
    if (theme === "custom") el.style.setProperty(k, v);
    else el.style.removeProperty(k);
  }
  // Keep the browser UI colour in step with the page background.
  const bg = getComputedStyle(el).getPropertyValue("--pf-bg").trim();
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", bg));
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Stored>({ theme: "system", accent: null });
  const [systemLight, setSystemLight] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    // Sync React state with what the boot script already applied.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of browser-only state after hydration
    setState(readStored());
    setSystemLight(prefersLight());
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => setSystemLight(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    apply(state.theme, state.accent, !first.current);
    first.current = false;
  }, [state, systemLight]);

  const setTheme = useCallback((theme: string, accent?: string | null) => {
    setState((cur) => {
      const next = { theme, accent: accent === undefined ? cur.accent : accent };
      try {
        localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable: the choice still applies for this visit */
      }
      return next;
    });
  }, []);

  const value = useMemo<Ctx>(() => {
    const resolved = state.theme === "system" ? (systemLight ? SYSTEM_LIGHT : SYSTEM_DARK)
      : state.theme === "custom" ? "custom" : themeById(state.theme) ? state.theme : SYSTEM_DARK;
    const scheme = resolved === "custom" ? "dark" : themeById(resolved)?.scheme ?? "dark";
    return { theme: state.theme, accent: state.accent ?? DEFAULT_ACCENT, resolved, scheme, setTheme };
  }, [state, systemLight, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
