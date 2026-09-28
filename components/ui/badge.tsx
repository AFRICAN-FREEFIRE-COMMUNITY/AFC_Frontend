import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// ── No stroke, on any variant (owner design rule 2026-08-17, fixed site-wide 2026-09-28) ──
// Badges are filled pills. The base class carries NO `border`, so a `border-<colour>` a call
// site still passes draws nothing; hierarchy comes from the fill and the text colour.
// `outline` keeps its name (439 call sites use it) but is now a flat tint of its OWN text
// colour (`bg-current/10`): a badge that says `text-green-500` gets a faint green fill, one
// with no colour gets a faint foreground fill. A call site that sets its own `bg-*` wins,
// because cn() merges it over this. The focus ring below is the one allowed line (a11y).
const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive:
          "bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        pending:
          "bg-yellow-500 text-white [a&]:hover:bg-yellow-500/90 focus-visible:ring-yellow-500/20 dark:focus-visible:ring-yellow-500/40 dark:bg-yellow-500/60",
        outline:
          "bg-current/10 text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
