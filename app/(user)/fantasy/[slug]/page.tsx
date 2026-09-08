"use client";

/**
 * app/(user)/fantasy/[slug]/page.tsx - one fantasy league: its rules, and the table.
 *
 * WHAT A FAN NEEDS FROM THIS PAGE, IN ORDER
 *   1. Can I still enter, and what do I press.
 *   2. What are the rules of THIS league (they are all per-league settings, so they cannot be
 *      stated once on a help page and left).
 *   3. Where is everybody.
 *
 * WHY THE RULES ARE PRINTED RATHER THAN LINKED
 *   Squad size, the cap per team, the captain multiplier and the pot are chosen per league by
 *   whoever created it. A fan who learned the rules on one league would be wrong about the next
 *   one, so every league states its own.
 *
 * WHY THE TABLE SAYS IT IS LIVE
 *   Scores are recomputed from current match results, never stored (afc_fantasy/scoring.py). AFC
 *   corrects results, so the table can move after a correction. A fan who drops a place deserves
 *   to know that is why, rather than suspecting the site.
 *
 * WHAT IT TALKS TO
 *   GET {BACKEND}/fantasy/<slug>/            -> afc_fantasy.views.league_detail
 *   GET {BACKEND}/fantasy/<slug>/standings/  -> afc_fantasy.views.league_table
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { IconArrowRight, IconInfoCircle, IconLock, IconTrophy } from "@tabler/icons-react";

import { PageHeader } from "@/components/PageHeader";
import { FullLoader } from "@/components/Loader";
import { LocalTime } from "@/components/LocalTime";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { fantasyApi, type FantasyLeague } from "@/lib/fantasy";

type Row = {
  position: number;
  squad_id: number;
  squad_name: string;
  username: string;
  /** Matched against the viewer to highlight their row. By ID, never by name: AFC players rename
   *  themselves often, and a name match would silently stop highlighting the moment one did. */
  user_id: number;
  total: number;
  matches: number;
};

export default function FantasyLeaguePage() {
  const t = useTranslations("fantasy");
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();

  const [league, setLeague] = useState<FantasyLeague | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [detail, table] = await Promise.all([
        fantasyApi.league(slug),
        // The table is fetched alongside rather than after, so the page paints once. It is
        // allowed to fail on its own: a league whose scores have not been computed yet is a
        // normal state, not an error.
        fantasyApi.standings(slug).catch(() => ({ results: [] })),
      ]);
      setLeague(detail);
      setRows(table?.results ?? []);
    } catch {
      setLeague(null);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <FullLoader />;

  if (!league) {
    return (
      <div className="py-8">
        <PageHeader title={t("notFound.title")} description={t("notFound.body")} back />
      </div>
    );
  }

  // What the one button on this page should say and do. Derived here so the three states
  // (enter / edit / signed out) cannot disagree between the header and the table.
  const cta = league.has_entered
    ? { href: `/fantasy/${slug}/build`, label: t("cta.mySquad") }
    : league.can_enter
      ? { href: `/fantasy/${slug}/build`, label: t("cta.enter") }
      : null;

  return (
    <div className="py-8">
      <PageHeader
        back
        title={league.name}
        description={league.description || league.event.event_name}
        action={
          cta ? (
            <Button asChild className="w-full md:w-auto">
              <Link href={cta.href}>
                {cta.label}
                <IconArrowRight className="ml-1.5 size-4" aria-hidden />
              </Link>
            </Button>
          ) : undefined
        }
      />

      {/* Why the button is not there, said plainly. A control that is simply absent teaches
          nothing, and "why can't I enter" is the question this page must not leave hanging. */}
      {!cta && (
        <div className="mt-6 flex items-start gap-2 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
          {league.is_locked ? (
            <IconLock className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden />
          ) : (
            <IconInfoCircle className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          )}
          <span>
            {league.is_locked
              ? t("closed.locked")
              : user
                ? t("closed.notEligible")
                : t("closed.signedOut")}{" "}
            {!user && !league.is_locked && (
              <Link href="/login" className="font-medium text-primary hover:underline">
                {t("closed.signIn")}
              </Link>
            )}
          </span>
        </div>
      )}

      {/* ── the rules of THIS league ── */}
      <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <RuleCard label={t("rules.squadSize")} value={String(league.squad_size)} />
        <RuleCard label={t("rules.maxPerTeam")} value={String(league.max_per_team)} />
        <RuleCard label={t("rules.captain")} value={`${league.captain_multiplier}x`} />
        <RuleCard
          label={t("rules.budget")}
          value={league.use_budget ? t("rules.seeds", { n: league.budget_seeds ?? 0 }) : t("rules.freePick")}
        />
      </section>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline" className="rounded-full px-2 py-0.5 text-xs">
          {t(`entry.${league.entry_type}`)}
        </Badge>
        {league.locks_at && (
          <span>
            {league.is_locked ? t("card.lockedOn") : t("card.locksOn")}{" "}
            <LocalTime value={league.locks_at} mode="datetime" />
          </span>
        )}
        <span>{t("card.entries", { count: league.entries })}</span>
        {/* Placed with the rules rather than at the top: this is the moment a reader is looking at
            numbers and wondering what they mean. */}
        <Link href="/fantasy/how-it-works" className="font-medium text-primary hover:underline">
          {t("guide.readGuide")}
        </Link>
      </div>

      {/* ── the table ── */}
      <Card className="mt-6 bg-card rounded-md border py-6 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-1.5 text-base">
            <IconTrophy className="size-4 text-primary" aria-hidden />
            {t("table.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {league.is_locked ? t("table.noScoresYet") : t("table.notStarted")}
            </p>
          ) : (
            <>
              {/* A table scrolls INSIDE its own container rather than pushing the page wide.
                  Most AFC readers are on a phone. */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="h-10 border-b text-left text-foreground">
                      <th className="p-2 font-medium">{t("table.rank")}</th>
                      <th className="p-2 font-medium">{t("table.squad")}</th>
                      <th className="p-2 text-right font-medium">{t("table.matches")}</th>
                      <th className="p-2 text-right font-medium">{t("table.points")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const mine = user?.user_id === row.user_id;
                      return (
                        <tr
                          key={row.squad_id}
                          className={mine ? "border-b bg-primary/5" : "border-b"}
                        >
                          <td className="p-2 tabular-nums text-muted-foreground">#{row.position}</td>
                          <td className="p-2">
                            <span className={mine ? "font-semibold text-primary" : "text-foreground"}>
                              {row.squad_name}
                            </span>
                            {mine && (
                              <span className="ml-1.5 text-[11px] text-muted-foreground">
                                {t("table.you")}
                              </span>
                            )}
                          </td>
                          <td className="p-2 text-right tabular-nums text-muted-foreground">
                            {row.matches}
                          </td>
                          <td className="p-2 text-right font-semibold tabular-nums text-foreground">
                            {row.total}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="pt-3 text-[11px] text-muted-foreground">{t("table.liveNote")}</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** One rule of the league, stated as a number somebody can act on. */
function RuleCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="bg-card rounded-md border py-6 shadow-sm">
      <CardContent className="space-y-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-bold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}
