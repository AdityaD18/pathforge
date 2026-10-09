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
          "bg-electric text-[#06102a] hover:bg-electric-soft shadow-[0_0_0_1px_rgb(143_182_255/0.4),0_8px_24px_-8px_rgb(76_141_255/0.6)]",
        secondary: "bg-panel-2 text-ink border border-line hover:border-electric/50 hover:bg-[#18265a]",
        ghost: "text-mist hover:text-ink hover:bg-white/5",
        danger: "bg-beginning/15 text-beginning border border-beginning/30 hover:bg-beginning/25",
      },
      size: {
        sm: "h-8 rounded-sm px-3 text-[13px]",
        md: "h-10 rounded-md px-4 text-sm",
        lg: "h-12 rounded-md px-6 text-[15px]",
        icon: "h-9 w-9 rounded-md",
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
