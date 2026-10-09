import "@fontsource-variable/fraunces/full.css";
import "@fontsource-variable/schibsted-grotesk/index.css";
import "./globals.css";

import type { Metadata, Viewport } from "next";

import { Providers } from "@/components/providers";
import { THEME_BOOT_SCRIPT, themeCss } from "@/lib/themes";

export const metadata: Metadata = {
  title: { default: "PathForge AI", template: "%s · PathForge AI" },
  description:
    "Adaptive learning paths for technical careers: diagnostic assessments, prerequisite-aware roadmaps and explainable resource recommendations.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a1128" },
    { media: "(prefers-color-scheme: light)", color: "#f5f8ff" },
  ],
};

// Theme palettes are generated from src/lib/themes.ts at build time.
const THEME_CSS = themeCss();

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="system" suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: THEME_CSS }} />
        {/* Applies the saved theme before first paint (no flash of the default palette). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-dvh">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
