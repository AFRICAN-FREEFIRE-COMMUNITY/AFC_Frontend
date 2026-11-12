"use client";

// ── components/howto/HowtoGuideCard.tsx ─────────────────────────────────────────────────────────
// One guide: the clip beside its written steps (inbox #255, mockups/help-page/ approved 2026-10-16).
//
// The title, summary and steps are the clip's own captions (howto.json, clips.<key>), so the words
// beside the video are the words in it, in the viewer's language. Badges say how many steps, how
// long the video runs and who it is for; "Open this screen" goes to where the task starts.
//
// USED BY: components/howto/HelpGuides.tsx (every guide on /help) and
// components/howto/WatchHowTip.tsx (the dialog behind "Watch how", without its title, which the
// dialog already shows, and without the link, which would leave the page the viewer is on).
// Design: a filled card (components/ui/card.tsx), video left and steps right on wide screens,
// stacked on a phone; no outlines (owner rule).
// ─────────────────────────────────────────────────────────────────────────────────────────────────

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { IconArrowRight } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { HowtoVideo } from "@/components/howto/HowtoVideo";
import { howtoSeconds, type HowtoGuide } from "@/lib/howto-guides";
import { cn } from "@/lib/utils";

export function useGuideSteps(guide: HowtoGuide): string[] {
  const t = useTranslations("howto");
  // sql-safe: next-intl t.raw reads a message object, not SQL
  const steps = t.raw(`clips.${guide.messages}.steps`) as Record<string, string>;
  return Object.values(steps);
}

export function HowtoGuideCard({ guide, inDialog = false }: { guide: HowtoGuide; inDialog?: boolean }) {
  const t = useTranslations("helpPage");
  const tc = useTranslations("howto");
  const locale = useLocale();
  const steps = useGuideSteps(guide);
  const title = tc(`clips.${guide.messages}.title`);
  const seconds = howtoSeconds(guide.clip, locale);

  const body = (
    <>
      <HowtoVideo clip={guide.clip} title={title} />
      <div className="min-w-0">
        {!inDialog && <h2 className="font-semibold text-primary">{title}</h2>}
        <p className="mt-0.5 text-sm text-muted-foreground">{tc(`clips.${guide.messages}.summary`)}</p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <Badge variant="outline" className="rounded-full">{t("card.steps", { count: steps.length })}</Badge>
          {seconds && <Badge variant="outline" className="rounded-full">{t("card.seconds", { seconds })}</Badge>}
          <Badge variant="outline" className="rounded-full">{t(`who.${guide.who}`)}</Badge>
        </div>
        {/* An ordered list, so the numbering is the browser's and stays right if a step changes. */}
        <ol className="mt-3.5 flex list-none flex-col gap-2.5">
          {steps.map((step, i) => (
            <li key={i} className="flex gap-2.5 text-sm">
              <span className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[0.65rem] font-semibold text-primary">
                {i + 1}
              </span>
              <span className="min-w-0">{step}</span>
            </li>
          ))}
        </ol>
        {!inDialog && (
          <Link
            href={guide.href}
            className="mt-3.5 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            {t("card.open")}
            <IconArrowRight className="size-3.5" />
          </Link>
        )}
      </div>
    </>
  );

  const grid = "grid gap-4 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] md:gap-6";
  if (inDialog) return <div className={grid}>{body}</div>;
  return <Card className={cn(grid, "p-3 md:p-4")} data-guide={guide.clip}>{body}</Card>;
}
