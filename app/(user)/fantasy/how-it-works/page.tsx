"use client";

/**
 * app/(user)/fantasy/how-it-works/page.tsx - the Fantasy League explained, in plain words.
 *
 * WHY THIS PAGE EXISTS (owner, 2026-08-17)
 *   "There has to be a very detailed and in very simple terms an explainer page for the fantasy
 *   league and how everything works, how points are assigned and the whole thing."
 *
 *   Most people reading it have never played a fantasy league. The three cards on /fantasy say
 *   what it IS in a sentence each; this page is where somebody who wants the whole thing before
 *   committing can get it, including the exact points table and worked examples.
 *
 * THE RULE THIS PAGE HAS TO KEEP
 *   Every number here is a DEFAULT. Squad size, the cap per team, the captain multiplier, the pot
 *   and every points value are per-league settings an admin chooses, so this page states the usual
 *   values and says, more than once, that each league prints its own on its own page. An explainer
 *   that quietly disagreed with the league somebody is actually playing would be worse than none.
 *
 * WHY IT IS ITS OWN ROUTE RATHER THAN AN ACCORDION ON /fantasy
 *   It is long by design, it is the thing to link to from a Discord message or a news post, and it
 *   should be readable by somebody who has not signed in and has no league to look at.
 *
 * Strings: messages/{en,fr,pt}/fantasy.json under `guide`. The section layout carries the page
 * metadata, because a "use client" page cannot export any.
 */

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  IconAlertTriangle,
  IconArrowRight,
  IconCoin,
  IconCrown,
  IconLock,
  IconTrophy,
  IconUsers,
} from "@tabler/icons-react";

import { PageHeader } from "@/components/PageHeader";
import { NewBadge } from "@/components/NewBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const LIVE_SINCE = "2026-08-17";

/** The scoring rows, in the order the points table prints them. Keys resolve to
 *  guide.points.rows.<key>.what and .points, so the numbers are translatable alongside the words
 *  (a language that writes numerals differently should not be forced into English ones). */
const POINT_ROWS = ["kill", "booyah", "top3", "mvp", "played"] as const;

/** The steps of actually playing, in order. */
const STEPS = ["find", "pick", "captain", "lock", "watch", "finish"] as const;

/** The questions people ask, in the order they ask them. */
const FAQ = ["notPlay", "corrected", "sameSquad", "rename", "twoAccounts", "cost"] as const;

export default function FantasyGuidePage() {
  const t = useTranslations("fantasy");

  return (
    <div className="py-8">
      <PageHeader
        back
        title={
          <span className="inline-flex flex-wrap items-center gap-2">
            {t("guide.title")}
            <NewBadge since={LIVE_SINCE} />
          </span>
        }
        description={t("guide.subtitle")}
        action={
          <Button asChild className="w-full md:w-auto">
            <Link href="/fantasy">
              {t("guide.seeLeagues")}
              <IconArrowRight className="ml-1.5 size-4" aria-hidden />
            </Link>
          </Button>
        }
      />

      {/* ── 1. what it is ─────────────────────────────────────────────────────── */}
      <Section icon={IconUsers} title={t("guide.what.title")}>
        <p>{t("guide.what.p1")}</p>
        <p>{t("guide.what.p2")}</p>
        <p className="font-medium text-foreground">{t("guide.what.p3")}</p>
      </Section>

      {/* ── 2. how to play, step by step ──────────────────────────────────────── */}
      <Section icon={IconTrophy} title={t("guide.steps.title")}>
        <ol className="space-y-3">
          {STEPS.map((key, i) => (
            <li key={key} className="flex gap-3">
              <span
                className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-primary/50 text-xs font-semibold text-primary"
                aria-hidden
              >
                {i + 1}
              </span>
              <span>
                <span className="block font-medium text-foreground">
                  {t(`guide.steps.${key}.title`)}
                </span>
                <span className="block">{t(`guide.steps.${key}.body`)}</span>
              </span>
            </li>
          ))}
        </ol>
      </Section>

      {/* ── 3. the squad rules ────────────────────────────────────────────────── */}
      <Section icon={IconUsers} title={t("guide.squad.title")}>
        <p>{t("guide.squad.intro")}</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="h-10 border-b text-left text-foreground">
                <th className="p-2 font-medium">{t("guide.squad.colRule")}</th>
                <th className="p-2 font-medium">{t("guide.squad.colUsual")}</th>
                <th className="p-2 font-medium">{t("guide.squad.colWhy")}</th>
              </tr>
            </thead>
            <tbody>
              {(["size", "perTeam", "captain"] as const).map((key) => (
                <tr key={key} className="border-b align-top">
                  <td className="p-2 font-medium text-foreground">
                    {t(`guide.squad.${key}.rule`)}
                  </td>
                  <td className="p-2 whitespace-nowrap text-foreground">
                    {t(`guide.squad.${key}.usual`)}
                  </td>
                  <td className="p-2 text-muted-foreground">{t(`guide.squad.${key}.why`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Note>{t("guide.squad.perLeague")}</Note>
      </Section>

      {/* ── 4. the points table. The section the owner asked for by name. ─────── */}
      <Section icon={IconTrophy} title={t("guide.points.title")}>
        <p>{t("guide.points.intro")}</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="h-10 border-b text-left text-foreground">
                <th className="p-2 font-medium">{t("guide.points.colWhat")}</th>
                <th className="p-2 text-right font-medium">{t("guide.points.colPoints")}</th>
              </tr>
            </thead>
            <tbody>
              {POINT_ROWS.map((key) => (
                <tr key={key} className="border-b">
                  <td className="p-2 text-foreground">{t(`guide.points.rows.${key}.what`)}</td>
                  <td className="p-2 text-right font-semibold tabular-nums text-primary">
                    {t(`guide.points.rows.${key}.points`)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-start gap-2 rounded-md border border-gold/40 bg-gold/5 p-3">
          <IconCrown className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden />
          <span>
            <span className="font-semibold text-gold">{t("guide.points.captainTitle")}</span>{" "}
            {t("guide.points.captainBody")}
          </span>
        </div>

        <p className="font-medium text-foreground">{t("guide.points.examplesTitle")}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Example
            title={t("guide.points.big.title")}
            lines={["l1", "l2", "l3", "l4"].map((l) => t(`guide.points.big.${l}`))}
            total={t("guide.points.big.total")}
          />
          <Example
            title={t("guide.points.small.title")}
            lines={["l1", "l2"].map((l) => t(`guide.points.small.${l}`))}
            total={t("guide.points.small.total")}
          />
        </div>

        <Note>{t("guide.points.whyThese")}</Note>
        <Note>{t("guide.points.onlyWhatWeRecord")}</Note>
      </Section>

      {/* ── 5. prices and AFC SEEDS ───────────────────────────────────────────── */}
      <Section icon={IconCoin} title={t("guide.prices.title")}>
        <p>{t("guide.prices.intro")}</p>
        <p>{t("guide.prices.why")}</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="h-10 border-b text-left text-foreground">
                <th className="p-2 font-medium">{t("guide.prices.colSquad")}</th>
                <th className="p-2 font-medium">{t("guide.prices.colCost")}</th>
                <th className="p-2 font-medium">{t("guide.prices.colCan")}</th>
              </tr>
            </thead>
            <tbody>
              {(["best5", "two", "average", "cheap"] as const).map((key) => (
                <tr key={key} className="border-b">
                  <td className="p-2 text-foreground">{t(`guide.prices.${key}.squad`)}</td>
                  <td className="p-2 whitespace-nowrap tabular-nums text-muted-foreground">
                    {t(`guide.prices.${key}.cost`)}
                  </td>
                  <td className="p-2 text-muted-foreground">{t(`guide.prices.${key}.can`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>{t("guide.prices.team")}</p>
        <p>{t("guide.prices.unproven")}</p>
        <Note>{t("guide.prices.checkable")}</Note>
      </Section>

      {/* ── 6. when picks lock ────────────────────────────────────────────────── */}
      <Section icon={IconLock} title={t("guide.lock.title")}>
        <p>{t("guide.lock.p1")}</p>
        <p>{t("guide.lock.p2")}</p>
      </Section>

      {/* ── 7. the questions people actually ask ──────────────────────────────── */}
      <Section icon={IconAlertTriangle} title={t("guide.faq.title")}>
        <dl className="space-y-4">
          {FAQ.map((key) => (
            <div key={key}>
              <dt className="font-medium text-foreground">{t(`guide.faq.${key}.q`)}</dt>
              <dd>{t(`guide.faq.${key}.a`)}</dd>
            </div>
          ))}
        </dl>
      </Section>

      {/* ── 8. prizes ─────────────────────────────────────────────────────────── */}
      <Section icon={IconTrophy} title={t("guide.prizes.title")}>
        <p>{t("guide.prizes.intro")}</p>
        <div className="flex flex-wrap gap-2">
          {(["free", "sponsored", "paid"] as const).map((key) => (
            <Badge key={key} variant="outline" className="rounded-full px-2 py-0.5 text-xs">
              {t(`entry.${key}`)}
            </Badge>
          ))}
        </div>
        <p>{t("guide.prizes.body")}</p>
      </Section>

      <div className="mt-8 flex justify-center">
        <Button asChild size="lg">
          <Link href="/fantasy">
            {t("guide.seeLeagues")}
            <IconArrowRight className="ml-1.5 size-4" aria-hidden />
          </Link>
        </Button>
      </div>
    </div>
  );
}

/** One titled block of the guide. All the prose in one type scale, so a long page stays readable
 *  rather than turning into a wall of competing headings. */
function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="mt-6 bg-card rounded-md border py-6 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="size-4 text-primary" aria-hidden />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">{children}</CardContent>
    </Card>
  );
}

/** A worked example: the sum written out, then the answer. Somebody who does not trust a points
 *  table will trust an arithmetic they can follow. */
function Example({ title, lines, total }: { title: string; lines: string[]; total: string }) {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <p className="text-xs font-medium text-foreground">{title}</p>
      <ul className="mt-2 space-y-1 text-xs">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="mt-2 border-t pt-2 text-sm font-semibold text-primary">{total}</p>
    </div>
  );
}

/** A quieter aside: true, worth knowing, not the main thread of the section. */
function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">{children}</p>
  );
}
