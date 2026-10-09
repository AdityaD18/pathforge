import "@fontsource-variable/fraunces/full.css";
import "@fontsource-variable/schibsted-grotesk/index.css";
import "./globals.css";

import type { Metadata, Viewport } from "next";

import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: { default: "PathForge AI", template: "%s · PathForge AI" },
  description:
    "Adaptive learning paths for technical careers: diagnostic assessments, prerequisite-aware roadmaps and explainable resource recommendations.",
};

export const viewport: Viewport = { themeColor: "#0a1128", colorScheme: "dark" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
