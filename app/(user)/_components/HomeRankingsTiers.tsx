"use client";

// ── HomeRankingsTiers ────────────────────────────────────────────────────────
// The "Rankings and Tiers" card on /home (app/(user)/home/page.tsx).
//
// WHY THIS EXISTS (owner backlog #9 / #20, 2026-08-03: "homepage ranking and tiers
// must show current results and update automatically"):
// this card used to render two HARDCODED arrays from constants/index.ts
// (`teamRankings` + `quarterlyTiers`). They were seed data from a past quarter, so the
// homepage could never change no matter what happened in a tournament: it was not stale
// cache, it was not a job that stopped running, it simply never read the database. Both
// arrays are now deleted and this component reads the SAME public API the /rankings page
// reads, so the two surfaces can never disagree again.
//
// Data sources (identical to app/(user)/rankings/page.tsx, via lib/rankings.ts):
//   GET /rankings/teams/monthly/     -> afc_rankings.views.teams_monthly    (Rankings tab)
//   GET /rankings/teams/quarterly/   -> afc_rankings.views.teams_quarterly  (Tiers tab)
// Both return the canonical { results, pagination, month?/season? } envelope. The rows
// are written by afc_rankings.recalc, which is fired on commit by afc_rankings.signals
// whenever match stats / markers / prizes change, so the numbers here follow live results.
//
// PUBLISH GATES (afc_rankings.views._gated_monthly / _gated_quarterly): the backend hides
// scores until an admin publishes the season (Season.rankings_published), and hides tier
// assignments until Season.tiers_published. When gated it returns an EMPTY result set with
// published:false, so we must render an explicit "not published yet" note rather than an
// empty table. This mirrors the NotPublished / tiersComingSoon states on /rankings; showing
// last quarter's numbers instead would recreate the exact bug this component fixes.
//
// "Updates automatically" is useLiveTick(), the same site-wide heartbeat /rankings uses:
// a background re-pull every 15s while the tab is visible, plus a catch-up on tab focus.

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
// Live refresh (owner 2026-07-02): site-wide heartbeat, so the standings on the home page
// update without the user reloading. Read-only display data only, per the hook's contract.
import { useLiveTick } from "@/hooks/useLiveTick";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Trophy, ArrowRight } from "lucide-react";
import { IconClock, IconAlertTriangle } from "@tabler/icons-react";
// Shared tier pill (0-3 -> "Tier 1".."Tier 4" + colour), the single source of tier
// presentation across /rankings, the team pages and the admin surfaces.
import { TierBadge } from "@/components/rankings/TierBadge";
// Subtle clickable team name -> public team page (unchanged from the old hardcoded table).
import { TeamLink } from "@/components/ui/entity-link";
import { rankingsApi, TeamRow, Season } from "@/lib/rankings";
// Active next-intl locale, so the month heading reads in the viewer's language.
import { getActiveLocale } from "@/lib/i18n/time";

// How many rows the home teaser shows. The full ladder lives on /rankings, which this
// card links to; the backend default page size is 25, so this is a client-side slice.
const HOME_ROWS = 10;

/**
 * Phase-2c publish flags the backend adds to the season object on the rankings envelope.
 * They are not on the shared `Season` type (see the identical local widening in
 * app/(user)/rankings/page.tsx), so read them defensively here too.
 */
type SeasonFlags = Season & {
  rankings_published?: boolean;
  tiers_published?: boolean;
};

/**
 * Format a ranking MONTH ("2026-07-01" from the monthly envelope) as "July 2026".
 *
 * The value is a calendar month, NOT an instant, so it must not go through the viewer's
 * timezone: formatting 2026-07-01T00:00Z in a negative-offset zone would render "June".
 * We therefore build the date from the Y/M parts and format it in UTC.
 */
function monthLabel(iso: string | undefined, locale: string): string {
  if (!iso) return "";
  const [y, m] = iso.split("-").map(Number);
  if (!y || !m) return "";
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, 1)));
}

// Shared "nothing to show yet" note. `reason` is already-localized copy from the caller,
// so this stays a dumb presentational block (same visual language as the /rankings
// NotPublished / tiersComingSoon states, just compact enough for a home card).
//
// `tone` picks the icon: "waiting" (a clock) for loading / not-yet-published, "error" (a warning
// triangle) for a request that FAILED. The two must not look alike - a clock over a failed fetch
// reads as "results are on their way", which is the opposite of what happened.
function HomeNote({ reason, tone = "waiting" }: { reason: string; tone?: "waiting" | "error" }) {
  const Icon = tone === "error" ? IconAlertTriangle : IconClock;
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <Icon className="size-8 text-muted-foreground" />
      <p className="max-w-sm text-sm text-muted-foreground">{reason}</p>
    </div>
  );
}

/**
 * Banner shown when the API fell back to an older PUBLISHED period because the live season's
 * rankings are still pending (envelope is_current_period === false).
 *
 * This is REQUIRED, not decoration: without it the card would present last quarter's standings as
 * if they were current, which is the same class of bug as the hardcoded arrays this component
 * replaced. Same dashed-strip idiom as the "tiers coming soon" notice on /rankings.
 */
function PreviousPeriodNote({ shown, pending }: { shown: string; pending: string }) {
  const t = useTranslations("home");
  return (
    <div className="mb-4 flex items-center gap-2 rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
      <IconClock className="size-4 shrink-0" />
      <span>
        {t("rankingsTiers.showingPrevious", { shown, pending })}
      </span>
    </div>
  );
}

export function HomeRankingsTiers() {
  // Namespace == messages/en/home.json -> "rankingsTiers".
  const t = useTranslations("home");
  const tick = useLiveTick();

  // Monthly ladder (Rankings tab) and quarterly tiers (Tiers tab) are two independent
  // endpoints with two independent publish gates, so they get separate state.
  const [monthly, setMonthly] = useState<TeamRow[]>([]);
  const [monthlySeason, setMonthlySeason] = useState<SeasonFlags | null>(null);
  const [month, setMonth] = useState<string | undefined>(undefined);
  const [quarterly, setQuarterly] = useState<TeamRow[]>([]);
  const [quarterlySeason, setQuarterlySeason] = useState<SeasonFlags | null>(null);
  const [loading, setLoading] = useState(true);
  // Fallback flags (owner 2026-08-03): false => these rows are the last PUBLISHED period, not the
  // live one, and must be labelled. `pendingSeason` is the season still awaiting publication.
  const [monthlyIsCurrent, setMonthlyIsCurrent] = useState(true);
  const [quarterlyIsCurrent, setQuarterlyIsCurrent] = useState(true);
  const [pendingSeason, setPendingSeason] = useState<string | null>(null);
  // The fetch FAILED, as opposed to the API returning nothing. Without this the catch below fell
  // through to the "No teams ranked yet" empty note, so a dead API told the viewer that nobody had
  // been ranked. Different facts, different copy.
  const [failed, setFailed] = useState(false);
  // How many rows this card currently HAS on screen (either tab). A failure is judged against
  // this rather than against `tick === 0`, for the same reason as app/(user)/rankings/page.tsx:
  // "was this the first run?" is a guess about what triggered the fetch, and it guesses wrong
  // whenever a focus tick lands before the first response, which would leave a dead API showing
  // "No teams ranked yet". "Is there anything on screen worth protecting?" cannot guess wrong.
  // A ref, and written from its own effect, so the fetch effect can read the current count
  // without listing the rows as dependencies and re-fetching on every fetch.
  const shownCount = useRef(0);

  useEffect(() => {
    shownCount.current = monthly.length + quarterly.length;
  }, [monthly, quarterly]);

  useEffect(() => {
    let active = true;
    // tick > 0 = a background re-pull: keep the current rows on screen so the live
    // refresh never flashes a loader, per the useLiveTick consumer contract.
    if (tick === 0) setLoading(true);
    Promise.all([rankingsApi.teamsMonthly(), rankingsApi.teamsQuarterly()])
      .then(([m, q]) => {
        if (!active) return;
        setMonthly(m.results);
        setMonthlySeason((m.season as SeasonFlags) ?? null);
        setMonth(m.month);
        setQuarterly(q.results);
        setQuarterlySeason((q.season as SeasonFlags) ?? null);
        // `!== false` so an older backend that omits the flag is treated as current (no banner),
        // rather than labelling every ladder as stale.
        setMonthlyIsCurrent(m.is_current_period !== false);
        setQuarterlyIsCurrent(q.is_current_period !== false);
        setPendingSeason(q.current_season?.name ?? m.current_season?.name ?? null);
        setFailed(false);
      })
      // A failed poll with rows already rendered must not blank the card: keep them and let the
      // next tick recover. A failure with NOTHING on screen has nothing to keep, so it says
      // plainly that it could not load rather than claiming there is nothing to show.
      .catch(() => {
        if (active && shownCount.current === 0) setFailed(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [tick]);

  const locale = getActiveLocale();
  // Gates. `=== false` (not falsy) on purpose: the flag is absent on older payloads and
  // while loading, and "absent" must not read as "unpublished".
  const rankingsGated = monthlySeason?.rankings_published === false;
  const tiersGated = quarterlySeason?.tiers_published === false;
  const quarterlyGated = quarterlySeason?.rankings_published === false;

  const topMonthly = monthly.slice(0, HOME_ROWS);
  // Tier rows only make sense once tiers are published (the backend nulls `tier` until
  // then), so drop untiered rows rather than render a column of blank badges.
  const topQuarterly = quarterly.filter((r) => r.tier != null).slice(0, HOME_ROWS);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("rankingsTiers.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="rankings" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-2">
            <TabsTrigger value="rankings">
              {t("rankingsTiers.tabs.rankings")}
            </TabsTrigger>
            <TabsTrigger value="tiers">
              {t("rankingsTiers.tabs.tiers")}
            </TabsTrigger>
          </TabsList>

          {/* ── Rankings tab: monthly team ladder ── */}
          <TabsContent value="rankings">
            <p className="text-sm text-muted-foreground mb-4">
              {/* Subtitle names the month the numbers actually belong to, instead of the
                  old hardcoded quarter text that silently went out of date. */}
              {month
                ? t("rankingsTiers.rankings.subtitleMonth", {
                    month: monthLabel(month, locale),
                  })
                : t("rankingsTiers.rankings.subtitle")}
            </p>
            {loading ? (
              <HomeNote reason={t("rankingsTiers.loading")} />
            ) : failed ? (
              // Ahead of the gate + empty branches: a broken request is not an unpublished season
              // and is not an empty ladder.
              <HomeNote tone="error" reason={t("rankingsTiers.loadFailed")} />
            ) : rankingsGated ? (
              <HomeNote
                reason={t("rankingsTiers.notPublished", {
                  season: monthlySeason?.name ?? t("rankingsTiers.thisSeason"),
                })}
              />
            ) : topMonthly.length === 0 ? (
              <HomeNote reason={t("rankingsTiers.empty")} />
            ) : (
              <div>
                {/* Not the live period: name the month being shown and the season still pending. */}
                {!monthlyIsCurrent && pendingSeason && (
                  <PreviousPeriodNote
                    shown={monthLabel(month, locale) || (monthlySeason?.name ?? "")}
                    pending={pendingSeason}
                  />
                )}
                <div className="overflow-x-auto rounded-md border max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("rankingsTiers.rankings.rank")}</TableHead>
                      <TableHead>{t("rankingsTiers.rankings.team")}</TableHead>
                      <TableHead>{t("rankingsTiers.rankings.points")}</TableHead>
                      <TableHead>{t("rankingsTiers.rankings.wins")}</TableHead>
                      <TableHead>{t("rankingsTiers.rankings.kills")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topMonthly.map((team) => (
                      <TableRow key={`${team.team_id ?? team.ghost_team_id}-${team.rank}`}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {team.rank != null && team.rank <= 3 && (
                              <Trophy
                                className={`h-4 w-4 ${
                                  team.rank === 1
                                    ? "text-yellow-500"
                                    : team.rank === 2
                                      ? "text-gray-400"
                                      : "text-amber-600"
                                }`}
                              />
                            )}
                            <span className="font-medium">{team.rank}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {/* Ghost rows have no public team page, so they stay plain text
                              (the backend already prefixes the name with "[Ghost] "). */}
                          {team.is_ghost ? (
                            <span className="text-muted-foreground">{team.team_name}</span>
                          ) : (
                            <TeamLink name={team.team_name} />
                          )}
                        </TableCell>
                        <TableCell>{team.total_score}</TableCell>
                        <TableCell>{team.wins ?? 0}</TableCell>
                        <TableCell>{team.kills ?? 0}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ── Tiers tab: quarterly tier standings for the active season ── */}
          <TabsContent value="tiers">
            <p className="text-sm text-muted-foreground mb-4">
              {/* Season name comes from the envelope, so the quarter is never hardcoded. */}
              {quarterlySeason?.name
                ? t("rankingsTiers.tiers.subtitleSeason", { season: quarterlySeason.name })
                : t("rankingsTiers.tiers.subtitle")}
            </p>
            {loading ? (
              <HomeNote reason={t("rankingsTiers.loading")} />
            ) : failed ? (
              <HomeNote tone="error" reason={t("rankingsTiers.loadFailed")} />
            ) : quarterlyGated ? (
              <HomeNote
                reason={t("rankingsTiers.notPublished", {
                  season: quarterlySeason?.name ?? t("rankingsTiers.thisSeason"),
                })}
              />
            ) : tiersGated ? (
              // Scores are public but tiers are not graded/published yet. Say so, rather
              // than showing an empty table that reads as "no teams ranked".
              <HomeNote
                reason={t("rankingsTiers.tiersComingSoon", {
                  season: quarterlySeason?.name ?? t("rankingsTiers.thisSeason"),
                })}
              />
            ) : topQuarterly.length === 0 ? (
              <HomeNote reason={t("rankingsTiers.empty")} />
            ) : (
              <div>
                {/* Not the live season: name the season shown and the one still pending. */}
                {!quarterlyIsCurrent && pendingSeason && quarterlySeason?.name && (
                  <PreviousPeriodNote shown={quarterlySeason.name} pending={pendingSeason} />
                )}
                <div className="overflow-x-auto rounded-md border max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("rankingsTiers.tiers.tier")}</TableHead>
                      <TableHead>{t("rankingsTiers.tiers.team")}</TableHead>
                      <TableHead>{t("rankingsTiers.tiers.points")}</TableHead>
                      {/* The old Apr/May/Jun columns are gone: they were hardcoded month
                          labels over july/august/september mock keys, and the quarterly
                          endpoint carries no per-month split. These three columns are the
                          quarterly totals the API does return. */}
                      <TableHead>{t("rankingsTiers.tiers.wins")}</TableHead>
                      <TableHead>{t("rankingsTiers.tiers.kills")}</TableHead>
                      <TableHead>{t("rankingsTiers.tiers.events")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topQuarterly.map((team) => (
                      <TableRow key={`${team.team_id ?? team.ghost_team_id}-${team.rank}`}>
                        <TableCell>
                          <TierBadge tier={team.tier} />
                        </TableCell>
                        <TableCell className="font-medium">
                          {team.is_ghost ? (
                            <span className="text-muted-foreground">{team.team_name}</span>
                          ) : (
                            <TeamLink name={team.team_name} />
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{team.total_score}</TableCell>
                        <TableCell>{team.wins ?? 0}</TableCell>
                        <TableCell>{team.kills ?? 0}</TableCell>
                        <TableCell>{team.tournaments_played ?? 0}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Home shows only the top rows; the full ladder, search, season picker and
            player rankings live on /rankings. */}
        <div className="mt-4 flex justify-end">
          <Button asChild variant="outline" size="sm">
            <Link href="/rankings">
              {t("rankingsTiers.viewAll")}
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
