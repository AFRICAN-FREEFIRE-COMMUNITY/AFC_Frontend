"use client";
import * as React from "react";
import { IconInfoCircle } from "@tabler/icons-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { HELP, type HelpId } from "@/lib/help-content";
import { cn } from "@/lib/utils";

type InfoTipProps = {
  id?: HelpId;                 // looks up centralized copy
  text?: string;               // inline override
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
};

// Small ⓘ that reveals a one-liner. Hover opens on desktop, tap toggles on mobile,
// focusable + Escape-closable for a11y. Renders nothing when there's no copy.
export function InfoTip({ id, text, side = "top", className }: InfoTipProps) {
  const content = text ?? (id ? HELP[id] : "");
  const [open, setOpen] = React.useState(false);
  if (!content) return null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="More info"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "inline-flex align-middle text-muted-foreground hover:text-primary focus:text-primary focus:outline-none",
            className,
          )}
        >
          <IconInfoCircle className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side={side}
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="max-w-xs text-xs leading-relaxed"
      >
        {content}
      </PopoverContent>
    </Popover>
  );
}
