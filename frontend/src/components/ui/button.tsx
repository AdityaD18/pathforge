import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/format";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-electric text-on-accent hover:brightness-110 shadow-[0_0_0_1px_color-mix(in_oklab,var(--pf-accent-soft)_40%,transparent),0_8px_24px_-8px_color-mix(in_oklab,var(--pf-accent)_60%,transparent)]",
        secondary: "bg-panel-2 text-ink border border-line hover:border-electric/50 hover:bg-electric/10",
        ghost: "text-mist hover:text-ink hover:bg-ink/5",
        danger: "bg-beginning/15 text-beginning border border-beginning/30 hover:bg-beginning/25",
      },
      size: {
        sm: "h-9 rounded-md px-3.5 text-sm",
        md: "h-11 rounded-md px-5 text-[15px]",
        lg: "h-13 rounded-lg px-7 text-base",
        icon: "h-10 w-10 rounded-md",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
