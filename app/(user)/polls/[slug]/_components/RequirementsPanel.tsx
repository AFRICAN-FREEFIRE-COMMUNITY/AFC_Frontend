"use client";

/**
 * app/(user)/polls/[slug]/_components/RequirementsPanel.tsx
 * ────────────────────────────────────────────────────────
 * "Who can vote in this poll", shown to EVERYONE, pass or fail.
 *
 * IT IS NOT AN ERROR STATE. That is the whole design (polls spec 2.3): an eligible voter seeing
 * four green ticks learns what kind of poll this is, and a refused visitor gets the same panel
 * with the failing line marked, rather than a greyed-out button and a support ticket. On a phone
 * it stacks ABOVE the ballot so it is read first.
 *
 * EVERY LINE COMES FROM THE SERVER. The shape is
 *   {key, label, requirement_text, passed, your_value, fix_hint, fix_url}
 * built by backend/afc_polls/eligibility.py. Nothing here re-derives a rule, because a panel that
 * computed its own verdict would eventually disagree with the gate it is explaining, and a poll
 * that refuses somebody for a reason the panel says they satisfy is worse than no panel.
 *
 * THREE STATES PER LINE, not two:
 *   passed === true   a tick
 *   passed === false  a cross, plus the fix link when the server sent one
 *   passed === null   undecided. This is what a signed-out visitor sees on every line except
 *                     "sign in": claiming a rule fails for somebody we have not identified would
 *                     be a guess dressed up as a decision.
 */

import Link from "next/link";
import { IconCheck, IconExternalLink, IconMinus, IconX } from "@tabler/icons-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

export type Requirement = {
  key: string;
  label: string;
  requirement_text: string;
  passed: boolean | null;
  your_value: string;
  fix_hint: string;
  fix_url: string;
};

export type Verdict = {
  eligible: boolean;
  /** "all" when every line must pass; "any" once the poll also picked people explicitly. */
  match_rule: "all" | "any";
  requirements: Requirement[];
};

export function RequirementsPanel({ verdict }: { verdict: Verdict }) {
  const t = useTranslations("polls");

  return (
    <Card className="bg-card rounded-md border py-6 shadow-sm">
      <CardContent className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{t("requirements.headingAll")}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {verdict.match_rule === "any"
              ? t("requirements.subtitleAny")
              : t("requirements.subtitleAll")}
          </p>
        </div>

        <ul className="space-y-3">
          {verdict.requirements.map((requirement) => (
            <li key={requirement.key} className="flex items-start gap-2.5">
              <StatusIcon passed={requirement.passed} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-foreground">
                  {requirement.requirement_text}
                </p>
                {/* The second half of every line: what YOURS is. Without it the panel says what is
                    needed and leaves the reader to guess where they stand. */}
                {requirement.your_value && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t("requirements.yours")}: {requirement.your_value}
                  </p>
                )}
                {/* Only rendered when the server sent one. A country rule you fail is not a rule
                    you can fix, and offering a link there would be worse than offering nothing. */}
                {requirement.passed === false && requirement.fix_url && (
                  <Link
                    href={requirement.fix_url}
                    className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    {requirement.fix_hint || requirement.fix_url}
                    <IconExternalLink className="h-3 w-3" />
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>

        <div
          className={cn(
            "rounded-md border px-3 py-2 text-xs font-medium",
            verdict.eligible
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border bg-muted/40 text-muted-foreground",
          )}
        >
          {verdict.eligible ? t("requirements.eligible") : t("requirements.notEligible")}
        </div>
      </CardContent>
    </Card>
  );
}

function StatusIcon({ passed }: { passed: boolean | null }) {
  if (passed === true) {
    return <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />;
  }
  if (passed === false) {
    return <IconX className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />;
  }
  // Undecided. A neutral dash, never a cross.
  return <IconMinus className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />;
}
