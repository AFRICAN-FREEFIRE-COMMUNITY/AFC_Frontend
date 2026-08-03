"use client";

/**
 * /a/rankings/ladders - the admin view of the actual RANKINGS.
 *
 * WHY THIS PAGE EXISTS (owner 2026-08-03): the Rankings admin section had nine configuration
 * pages (scoring config, tournament tiers, result markers, seasons, ghost teams, social, prize,
 * overrides, audit) and a team ladder buried on the Overview, but no place at all to READ the
 * player rankings, and no way to look at a period other than the newest. Meanwhile the public
 * rankings page stays empty until an admin publishes the season, so an admin was being asked to
 * publish standings they had never been able to see. This page is that missing preview.
 *
 * WHAT IT SHOWS
 *   subject   TEAM or PLAYER ladder (players are the half that existed nowhere before)
 *   period    MONTHLY or QUARTERLY
 *   scope     any season, and any month inside it, not just the newest
 *
 * HOW IT CONNECTS
 *   - Reads the four UNGATED admin draft endpoints through lib/rankingsAdmin.ts:
 *       adminTeamsMonthly / adminPlayersMonthly     -> afc_rankings.admin_publish (new)
 *       adminTeamsQuarterly / adminPlayersQuarterly -> afc_rankings.admin_publish (existing)
 *     The PUBLIC endpoints in afc_rankings.views are deliberately NOT used: they hide unpublished
 *     rows and fall back to the last published period, which is right for the public and exactly
 *     wrong here.
 *   - Season list comes from the public GET /rankings/seasons/ (lib/rankings.ts rankingsApi.seasons),
 *     the same source the Overview season picker uses. Each season carries the publish flags.
 *   - Preview vs published marking is _components/PublishNotice.tsx; the tables are
 *     _components/LadderTable.tsx. Publishing itself is NOT duplicated here, the notice links to
 *     the Overview (/a/rankings) where the "Publish to public" card lives.
 *   - Mounted in the Rankings sub-nav by components/rankings/RankingsSubNav.tsx.
 *
 * i18n: every string comes from the rankings namespace, admin.ladders.* block
 * (messages/{en,fr,pt}/rankings.json).
 */

import React, { useEffect, useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FullLoader } from "@/components/Loader";
import { rankingsApi, Season, TeamRow, PlayerRow } from "@/lib/rankings";
import { rankingsAdminApi } from "@/lib/rankingsAdmin";
import { matchesSearch } from "@/lib/search";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { IconSearch, IconUsers, IconUser, IconCalendarMonth, IconCalendarStats } from "@tabler/icons-react";
import { TeamLadderTable, PlayerLadderTable, LadderPeriod } from "./_components/LadderTable";
import { PublishNotice, PublishBadge } from "./_components/PublishNotice";

// The seasons endpoint returns the Phase-2c publish flags as runtime fields; the shared Season
// type does not declare them, so widen locally (same idiom as app/(a)/a/rankings/page.tsx).
type AdminSeason = Season & {
  rankings_published?: boolean;
  tiers_published?: boolean;
};

type Subject = "teams" | "players";

/* ------------------------------------------------------------------ month helpers */
/**
 * The months that belong to `season`, as "YYYY-MM", oldest first.
 *
 * Season windows TOUCH at the boundary (a quarter ending 1 July shares that day with the quarter
 * starting 1 July) and the backend gives the shared day to the LATER season
 * (afc_rankings.views._owning_season). So a window ending on the 1st of a month must NOT offer
 * that month, otherwise the picker would show a month whose ladder is gated by a different season
 * than the one selected here.
 */
function seasonMonths(season: Season): string[] {
  const start = new Date(`${season.start_date}T00:00:00Z`);
  const end = new Date(`${season.end_date}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];

  const out: string[] = [];
  let year = start.getUTCFullYear();
  let month = start.getUTCMonth();
  // A season is a quarter, so this loops 3 times in practice; the cap is only a runaway guard
  // for a mis-entered season window.
  for (let i = 0; i < 24; i++) {
    const first = Date.UTC(year, month, 1);
    if (first > end.getTime()) break;
    if (first === end.getTime() && end.getUTCDate() === 1) break; // boundary month, next season owns it
    out.push(`${year}-${String(month + 1).padStart(2, "0")}`);
    month += 1;
    if (month > 11) { month = 0; year += 1; }
  }
  return out;
}

/**
 * Which month of `season` to land on: the one containing today when the season is live, otherwise
 * its last month (the most complete one). Always inside the season, so the season and month
 * pickers can never disagree about which period is on screen.
 */
function defaultMonth(season: Season): string | undefined {
  const months = seasonMonths(season);
  if (months.length === 0) return undefined;
  const now = new Date();
  const current = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  return months.includes(current) ? current : months[months.length - 1];
}

/* ------------------------------------------------------------------ page */
export default function RankingsLaddersPage() {
  const t = useTranslations("rankings.admin.ladders");
  const locale = useLocale();

  const [seasons, setSeasons] = useState<AdminSeason[]>([]);
  const [seasonId, setSeasonId] = useState<number | undefined>(undefined);
  const [subject, setSubject] = useState<Subject>("teams");
  const [period, setPeriod] = useState<LadderPeriod>("monthly");
  const [month, setMonth] = useState<string | undefined>(undefined);
  const [q, setQ] = useState("");

  // Rows for the ladder currently on screen. Only one of the four combinations is fetched at a
  // time (subject x period), so switching either control refetches rather than caching all four.
  const [teamRows, setTeamRows] = useState<TeamRow[]>([]);
  const [playerRows, setPlayerRows] = useState<PlayerRow[]>([]);
  // The season the SERVER attributed the returned period to. Authoritative for the publish badge,
  // because for a monthly read it is resolved from the month itself (views._season_of_month).
  const [envelopeSeason, setEnvelopeSeason] = useState<AdminSeason | null>(null);
  const [loading, setLoading] = useState(true);

  /* season list, then default the pickers to the live season */
  useEffect(() => {
    rankingsApi.seasons().then((r) => {
      const rows = r.results as AdminSeason[];
      setSeasons(rows);
      const active = rows.find((s) => s.is_active) ?? rows[0];
      setSeasonId(active?.season_id);
      setMonth(active ? defaultMonth(active) : undefined);
      // No seasons configured: the fetch effect below early-returns, so clear the loader here or
      // the page would sit on FullLoader forever (same guard as the Overview page).
      if (!active) setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const season = useMemo(
    () => seasons.find((s) => s.season_id === seasonId) ?? null,
    [seasons, seasonId],
  );

  /* keep the month inside the selected season whenever the season changes */
  useEffect(() => {
    if (!season) return;
    setMonth((prev) => (prev && seasonMonths(season).includes(prev) ? prev : defaultMonth(season)));
  }, [season]);

  /* the ladder itself: one request per (subject, period, season|month) */
  useEffect(() => {
    if (!seasonId) return;
    if (period === "monthly" && !month) return;
    let active = true;
    setLoading(true);
    const request = period === "monthly"
      ? (subject === "teams"
        ? rankingsAdminApi.adminTeamsMonthly(month)
        : rankingsAdminApi.adminPlayersMonthly(month))
      : (subject === "teams"
        ? rankingsAdminApi.adminTeamsQuarterly(seasonId)
        : rankingsAdminApi.adminPlayersQuarterly(seasonId));

    request.then((r) => {
      if (!active) return;
      if (subject === "teams") setTeamRows(r.results ?? []);
      else setPlayerRows(r.results ?? []);
      setEnvelopeSeason(r.season ?? null);
    }).catch((err: any) => {
      if (!active) return;
      toast.error(err?.response?.data?.message || t("loadFailed"));
      setTeamRows([]);
      setPlayerRows([]);
    }).finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seasonId, subject, period, month]);

  /* search, using the shared matcher so stylized in-game names fold (typing "ve" finds "V-E") */
  const visibleTeams = useMemo(
    () => teamRows.filter((r) => matchesSearch(r.team_name, q)),
    [teamRows, q],
  );
  const visiblePlayers = useMemo(
    () => playerRows.filter((r) => matchesSearch(r.username, q)),
    [playerRows, q],
  );

  const months = season ? seasonMonths(season) : [];
  /**
   * A ranking month is a CALENDAR label ("June 2026"), not an instant, so it is formatted with a
   * pinned UTC timeZone rather than the viewer's local zone: converting 2026-06-01T00:00Z into a
   * negative-offset zone would render "May". The locale still comes from next-intl, so the month
   * name is localized (juin / junho) and identical on server and client.
   */
  const monthLabel = (ym: string) => {
    const [y, m] = ym.split("-").map(Number);
    return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" })
      .format(new Date(Date.UTC(y, m - 1, 1)));
  };

  // Publish state for the period on screen. The envelope season wins (for a monthly read the
  // server resolves it from the month), with the picked season as the pre-load fallback.
  const shownSeason = envelopeSeason ?? season;
  const rankingsPublished = !!shownSeason?.rankings_published;
  const tiersPublished = !!shownSeason?.tiers_published;
  const shownSeasonName = shownSeason?.name ?? "";

  const rowCount = subject === "teams" ? visibleTeams.length : visiblePlayers.length;
  const hasRows = subject === "teams" ? teamRows.length > 0 : playerRows.length > 0;
  // Three different empty states: still fetching, the search matched nothing, or the period has
  // genuinely never been scored. Saying "no scores" mid-fetch would read as a data problem.
  const emptyText = loading
    ? t("loading")
    : q && hasRows
      ? t("noMatch", { q })
      : t(subject === "teams" ? "emptyTeams" : "emptyPlayers");

  if (loading && !teamRows.length && !playerRows.length && seasons.length === 0) {
    return <FullLoader text={t("loading")} />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("title")}
        description={t("description")}
        action={
          <Select
            value={seasonId ? String(seasonId) : undefined}
            onValueChange={(v) => setSeasonId(Number(v))}
          >
            <SelectTrigger className="h-9 w-full md:w-[200px]">
              <SelectValue placeholder={t("season")} />
            </SelectTrigger>
            <SelectContent>
              {seasons.map((s) => (
                <SelectItem key={s.season_id} value={String(s.season_id)}>
                  {s.is_active ? t("seasonCurrent", { name: s.name }) : s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {seasons.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {t("noSeasons")}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* preview / published state for the period on screen, plus the link to publishing */}
          <PublishNotice
            published={rankingsPublished}
            // No tier exists at the monthly level, so the tier flag is only meaningful quarterly.
            tiersPublished={period === "quarterly" ? tiersPublished : undefined}
            seasonName={shownSeasonName}
          />

          {/* controls: subject, period, month. Stacks on a phone so nothing overflows sideways. */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {/* subject: the player ladder is the half that had no admin surface at all */}
              <SegmentedControl
                value={subject}
                onChange={(v) => setSubject(v as Subject)}
                options={[
                  { key: "teams", label: t("teams"), icon: IconUsers },
                  { key: "players", label: t("players"), icon: IconUser },
                ]}
              />
              <SegmentedControl
                value={period}
                onChange={(v) => setPeriod(v as LadderPeriod)}
                options={[
                  { key: "monthly", label: t("monthly"), icon: IconCalendarMonth },
                  { key: "quarterly", label: t("quarterly"), icon: IconCalendarStats },
                ]}
              />
              {/* month picker only applies to the monthly ladders; quarterly is the season itself */}
              {period === "monthly" && (
                <Select value={month} onValueChange={setMonth} disabled={months.length === 0}>
                  <SelectTrigger className="h-9 w-full sm:w-[180px]">
                    <SelectValue placeholder={t("month")} />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((m) => (
                      <SelectItem key={m} value={m}>{monthLabel(m)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="relative w-full sm:w-64">
              <IconSearch className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={subject === "teams" ? t("searchTeams") : t("searchPlayers")}
                className="h-9 pl-8"
              />
            </div>
          </div>

          <Card>
            {/* `flex` overrides CardHeader's default grid so the title and the row count sit on
                one wrapping line instead of two grid rows. */}
            <CardHeader className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                {subject === "teams" ? t("teamLadder") : t("playerLadder")}
                <PublishBadge published={rankingsPublished} />
                <span className="text-xs font-normal text-muted-foreground">
                  {period === "monthly" && month ? monthLabel(month) : shownSeasonName}
                </span>
              </CardTitle>
              <span className="text-xs text-muted-foreground">{t("rowCount", { count: rowCount })}</span>
            </CardHeader>
            <CardContent className="p-0">
              {subject === "teams" ? (
                <TeamLadderTable rows={visibleTeams} period={period} emptyText={emptyText} />
              ) : (
                <PlayerLadderTable rows={visiblePlayers} period={period} emptyText={emptyText} />
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ segmented control */
// The shadcn pill/segment idiom used by the neighbouring admin ranking pages (overrides/page.tsx
// builds the same thing inline). Extracted here only because this page needs two of them.
function SegmentedControl({
  value, onChange, options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: ReadonlyArray<{ key: string; label: string; icon: React.ElementType }>;
}) {
  return (
    <div className="inline-flex h-9 w-fit items-center justify-center rounded-lg bg-muted p-[3px] text-muted-foreground">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={cn(
            "inline-flex h-full items-center justify-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors",
            value === o.key
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <o.icon className="size-4" /> {o.label}
        </button>
      ))}
    </div>
  );
}
