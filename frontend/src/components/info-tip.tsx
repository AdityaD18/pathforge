"use client";

import * as Popover from "@radix-ui/react-popover";
import { HelpCircle } from "lucide-react";

import { cn } from "@/lib/format";

/** "Why?" disclosure: keeps explanations one click away instead of on the page. */
export function InfoTip({ children, label = "Why?", className, icon = false }: {
  children: React.ReactNode; label?: string; className?: string; icon?: boolean;
}) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button type="button" aria-label={icon ? label : undefined}
          className={cn("inline-flex items-center gap-1 rounded-full text-sm text-electric-soft hover:text-ink", !icon && "px-1", className)}>
          <HelpCircle className="size-4" />{!icon && label}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content side="bottom" align="start" sideOffset={8} collisionPadding={16}
          className="z-50 max-w-[340px] rounded-xl border border-line bg-panel p-4 text-sm leading-relaxed text-mist shadow-[0_18px_50px_-12px_rgb(0_0_0/0.45)]">
          {children}
          <Popover.Arrow className="fill-[var(--pf-line)]" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
