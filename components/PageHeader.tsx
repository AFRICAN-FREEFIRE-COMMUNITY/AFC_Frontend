"use client";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Button } from "./ui/button";
import { IconArrowLeft } from "@tabler/icons-react";

interface PageHeaderProps {
  title: string | React.ReactNode;
  description?: string | any;
  action?: ReactNode;
  back?: boolean;
  // Optional guided-tour anchor (owner 2026-07-13): when set, stamps data-tour on the header
  // root so the comprehensive welcome tour (guided-tour-stops.ts + PageGuide.tsx) can spotlight
  // "you are on the <page> page" as its first step on each route. Attribute-only, no layout change.
  dataTour?: string;
}

export function PageHeader({
  title,
  description,
  action,
  back,
  dataTour,
}: PageHeaderProps) {
  const router = useRouter();

  return (
    <div className="mb-4" data-tour={dataTour}>
      {/* flex-wrap and min-w-0 (2026-08-05): this row could not wrap, and the action block below
          is w-full on mobile, so a header with buttons pushed the PAGE wider than the viewport and
          the whole admin screen scrolled sideways. Measured on /a/rankings/tournament-tiers at a
          390px viewport: 517px of content in a 390px window, from the Reset and Save rules pair.
          This is the SHARED header, so the same thing happened on every admin page with an action.
          Wrapping lets the action drop onto its own line on a phone, which is what w-full was
          always asking for, and min-w-0 lets the title column shrink instead of refusing to. */}
      <div className="flex flex-wrap items-start justify-start gap-2">
        {back && (
          <Button
            onClick={() => router.back()}
            size="icon"
            variant={"secondary"}
          >
            <IconArrowLeft />
          </Button>
        )}
        <div className="flex min-w-0 flex-1 flex-col md:flex-row justify-between items-start gap-4 md:gap-0 md:items-center">
          <div className="min-w-0">
            {/* break-words: a long event or organisation name in a heading this size is otherwise
                a single unbreakable run that widens the page on a phone. */}
            <h1 className="text-3xl md:text-4xl font-bold text-primary break-words">
              {title}
            </h1>
            {description && (
              <p className="mt-2 text-sm md:text-base text-muted-foreground">
                {description}
              </p>
            )}
          </div>
        </div>
        {action && <div className="w-full md:w-auto">{action}</div>}
      </div>
    </div>
  );
}
