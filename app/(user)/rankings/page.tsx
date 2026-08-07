"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { InfoTip } from "@/components/ui/info-tip";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
// Horizontally scrolling tab strip with fade hints, used for the in-game role tabs: there are
// five of them plus the counts, which does not fit on a phone (see the component header).
import { ScrollableTabsList } from "@/components/ui/scrollable-tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FullLoader } from "@/components/Loader";
import { TierBadge, tierMeta } from "@/components/rankings/TierBadge";
import {
  rankingsApi, TeamRow, PlayerRow, PlayerRoleOption, PlayerRoleCoverage, Season,
} from "@/lib/rankings";
import {
  IconHash, IconUsers, IconTrophy, IconChevronDown, IconChevronRight, IconMoodEmpty,
  IconInfoCircle, IconCrown, IconChartBar, IconStairsUp, IconSearch,
  IconClock, IconAlertTriangle, IconRefresh,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { matchesSearch } from "@/lib/search";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
// LocalTime / formatLocalTime helpers: render a stored instant in the viewer's tz + language.
import { getActiveLocale, getBrowserTimeZone } from "@/lib/i18n/time";
import {
  TransferWindowBanner,
} from "@/components/rankings/TransferWindowBanner";
import { PlayerLink, TeamLink } from "@/components/ui/entity-link";
import { useAuth } from "@/contexts/AuthContext";
// Live refresh (owner 2026-07-02): site-wide heartbeat - re-pulls the monthly
// standings / quarterly tiers so the ladders update without a manual reload.
import { useLiveTick } from "@/hooks/useLiveTick";
// The claim-request dialog (logged-in users) + its target shape. Opened from the "Claim" button
// on a ghost row below; it POSTs to the user-facing ghost request-claim endpoints (see the
// component header for the exact endpoints).
import { ClaimGhostDialog, ClaimGhostTarget } from "./_components/ClaimGhostDialog";

type Subject = "teams" | "players";

// The sentinel the role tab strip uses for "everybody". Radix Tabs cannot hold an empty value,
// and the backend accepts "all" for the same reason (afc_rankings/player_roles.py ROLE_ALL).
const ROLE_ALL = "all";

/**
 * Phase-2c runtime fields the backend now puts on the season object (on the rankings
 * envelope + seasons/current/). They aren't on the Season TS type yet, so we widen
 * locally and read them defensively. transfer_window_close is an ISO date string.
 */
type SeasonFlags = Season & {
  transfer_window_is_open?: boolean;
  transfer_window_close?: string | null;
  rankings_published?: boolean;
  tiers_published?: boolean;
};

// Empty state shown when a season's rankings/tiers haven't been published yet (Phase 2c gating).
function NotPublished({ seasonName, what }: { seasonName?: string; what: string }) {
  const t = useTranslations("teamsplayers");
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <IconClock className="size-10 text-muted-foreground" />
      <p className="font-semibold">{t("rankings.notPublishedTitle")}</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        {/* t.rich keeps the highlighted season name (or the "this season" fallback) inline. */}
        {t.rich("rankings.notPublishedBody", {
          what,
          season: seasonName ?? t("rankings.thisSeason"),
          highlight: (chunks) =>
            seasonName ? <span className="text-foreground">{chunks}</span> : <>{chunks}</>,
        })}
      </p>
    </div>
  );
}

/**
 * The request FAILED, which is not the same fact as "there is nothing to show".
 *
 * Both used to land on <Empty/> ("Standings appear once monthly results are recorded"), because
 * neither ladder fetch had a catch: a network error or a 500 simply left the rows empty and the
 * page told the viewer that no results had been recorded. That is a lie about the database. This
 * state is checked BEFORE every empty state in both views so the two can never be confused.
 *
 * Retry idiom (message + outline retry button) matches components/h2h-bracket.tsx loadFailed.
 */
function LoadError({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("teamsplayers");
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <IconAlertTriangle className="size-10 text-muted-foreground" />
      <p className="font-semibold">{t("rankings.loadErrorTitle")}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{t("rankings.loadErrorBody")}</p>
      <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
        <IconRefresh className="mr-1 size-4" /> {t("rankings.retry")}
      </Button>
    </div>
  );
}

/**
 * The period held more rows than the client is willing to walk (lib/rankings.ts MAX_PAGES), so
 * the tail of the ladder is genuinely missing. Rare by design, but it must be stated: a silently
 * cut ladder presented as the whole one is the same lie as an empty one presented as "no results".
 */
function TruncatedNote() {
  const t = useTranslations("teamsplayers");
  return (
    <div className="mb-4 flex items-start gap-2 rounded-md border border-dashed bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
      <IconInfoCircle className="mt-0.5 size-4 shrink-0" />
      <span>{t("rankings.truncatedNote")}</span>
    </div>
  );
}

/**
 * The rows on screen are the last PUBLISHED period, not the live one.
 *
 * The backend keeps serving the most recent published period when the live season is still
 * pending (afc_rankings.views._resolve_month / _resolve_quarterly_season) and flags it with
 * is_current_period=false on the envelope. Without this banner the viewer reads an old month as
 * today's standings, which is the same class of bug as a hardcoded table. Same dashed-strip idiom
 * as the "tiers coming soon" notice below, and as PreviousPeriodNote on the /home card.
 */
function PreviousPeriodNote({ shown, pending }: { shown: string; pending: string }) {
  const t = useTranslations("teamsplayers");
  return (
    <div className="mb-4 flex items-start gap-2 rounded-md border border-dashed bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
      <IconClock className="mt-0.5 size-4 shrink-0" />
      <span>
        {t.rich("rankings.showingPrevious", {
          shown,
          pending,
          highlight: (chunks) => <span className="font-medium text-foreground">{chunks}</span>,
        })}
      </span>
    </div>
  );
}

function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative w-full sm:w-60">
      <IconSearch className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-9 pl-8" />
    </div>
  );
}

// ─── How-it-works explainer (rankings vs tiers) ──────────────────────────────
function HowItWorks() {
  const t = useTranslations("teamsplayers");
  // Shared rich-text tag map: <b>bold</b> chunks used across the explainer bodies.
  const bold = (chunks: React.ReactNode) => <b>{chunks}</b>;
  const Section = ({ icon, title, children }: any) => (
    <div className="flex gap-3">
      <div className="mt-0.5 text-primary">{icon}</div>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-sm text-muted-foreground">{children}</p>
      </div>
    </div>
  );
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <IconInfoCircle className="mr-1 size-4" /> {t("rankings.howItWorks")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-primary">{t("rankings.howItWorksTitle")}</DialogTitle>
          <DialogDescription>{t("rankings.howItWorksDescription")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Section icon={<IconChartBar className="size-5" />} title={t("rankings.rankingsStandings")}>
            {t.rich("rankings.rankingsStandingsBody", { b: bold })}
          </Section>
          <Section icon={<IconStairsUp className="size-5" />} title={t("rankings.tiersGrade")}>
            {t.rich("rankings.tiersGradeBody", { b: bold })}
          </Section>
          <Separator />
          <div>
            <p className="mb-2 text-sm font-semibold">{t("rankings.fourTeamTiers")}</p>
            <div className="space-y-1.5">
              {[0, 1, 2, 3].map((tier) => (
                <div key={tier} className="flex items-center gap-2 text-sm">
                  <TierBadge tier={tier as 0 | 1 | 2 | 3} />
                  <span className="text-muted-foreground">
                    {t("rankings.tierMinPoints", { min: tierMeta[tier].min })}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {t.rich("rankings.participationFloor", { b: bold })}
            </p>
          </div>
          <Separator />
          <div className="space-y-1.5 text-sm text-muted-foreground">
            <p className="text-sm font-semibold text-foreground">{t("rankings.howPointsEarned")}</p>
            <p>{"•"} {t("rankings.pointsKills")}</p>
            <p>{"•"} {t("rankings.pointsTournaments")}</p>
            <p>{"•"} {t("rankings.pointsBonuses")}</p>
            <p>{"•"} {t("rankings.pointsQuarterly")}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-muted/40 rounded-lg p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold">{value}</p>
    </div>
  );
}

// Empty state for a role table on a period that IS published: the role simply has nobody on the
// ladder yet. Kept separate from <Empty/> and <NotPublished/> so the reason is never guessed at.
function RoleEmpty({ role }: { role: string }) {
  const t = useTranslations("teamsplayers");
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <IconMoodEmpty className="size-10 text-muted-foreground" />
      <p className="font-semibold">{t("rankings.roleEmptyTitle", { role })}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{t("rankings.roleEmptyBody")}</p>
    </div>
  );
}

// The honesty notice for a period that carries NO stored in-game role at all (owner 2026-08-04).
//
// The role a player is filed under is now recorded when the points are earned and stored on the
// period's score row, so an old month keeps the roles it was actually played under. Months recorded
// BEFORE that stamping existed have nothing stored, and this database holds no evidence of what
// anyone's role was back then, so the backfill deliberately leaves them empty rather than stamping
// today's role onto them. Without this notice those months would render four role tabs reading 0,
// which looks like "nobody played these roles" instead of "this was not recorded".
//
// Driven by role_coverage.has_role_data from GET /rankings/players/by-role/ (backend
// afc_rankings/player_roles.py _role_coverage). Never shown for a gated period: the backend zeroes
// the whole coverage block there so it cannot leak what a hidden season holds.
function RoleDataNotice() {
  const t = useTranslations("teamsplayers");
  return (
    <div className="mb-4 flex items-start gap-2.5 rounded-md border bg-muted/40 p-3">
      <IconInfoCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="space-y-0.5">
        <p className="text-sm font-semibold">{t("rankings.roleNoDataTitle")}</p>
        <p className="text-xs text-muted-foreground">{t("rankings.roleNoDataBody")}</p>
      </div>
    </div>
  );
}

function NoMatch({ q }: { q: string }) {
  const t = useTranslations("teamsplayers");
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <IconSearch className="size-9 text-muted-foreground" />
      <p className="font-semibold">{t("rankings.noMatchesFor", { query: q })}</p>
      <p className="text-sm text-muted-foreground">{t("rankings.tryDifferentName")}</p>
    </div>
  );
}

// ─── Rankings view - live standings, teams & players ─────────────────────────
// Reads rankingsApi.teamsMonthly() / playersMonthly() → /rankings/teams|players/monthly/;
// rankings_published gates the empty-vs-NotPublished branch (false → "Not published yet").
function RankingsView() {
  // i18n: live-standings view copy (messages/en/teamsplayers.json -> "rankings").
  const t = useTranslations("teamsplayers");
  // isAuthenticated gates the "Claim" button on ghost rows (only logged-in users can request a claim).
  const { isAuthenticated } = useAuth();
  const [subject, setSubject] = useState<Subject>("teams");
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [month, setMonth] = useState("");
  // Season returned on the envelope - carries the rankings_published flag (Phase 2c gating).
  const [season, setSeason] = useState<SeasonFlags | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [q, setQ] = useState("");
  // Country filter (owner 2026-06-30): view the rankings for one country. "" = all countries.
  // Client-side (every row already carries r.country for the flag), so no extra request.
  const [countryFilter, setCountryFilter] = useState("");
  // Season + month picker (owner 2026-07-04: "when i click on ranking i cant change seasons").
  // Monthly rankings are per-MONTH, and a season spans up to 3 months, so a season pick drives a
  // month list and the monthly endpoint is fetched for the chosen month.
  //
  // BOTH PICKS START undefined ON PURPOSE, and undefined means "no pick, let the backend choose
  // the period". The backend already resolves that to the most recent PUBLISHED month and reports
  // which one it served on the envelope (afc_rankings.views._resolve_month), so the page lands on
  // standings a visitor can actually read.
  //
  // Preselecting the ACTIVE season here instead is what broke this page (owner backlog #14,
  // "public ranking page shows no PLAYER rankings"): the live season's rankings are not published
  // yet, so snapping the picker to its newest month sent an explicit ?month=<live month>, the
  // publish gate returned an empty set, and BOTH the Teams and Players ladders rendered
  // "Not published yet" to everyone. The pickers still drive the request the moment the user
  // actually picks something.
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [seasonPick, setSeasonPick] = useState<number | undefined>(undefined);
  const [monthPick, setMonthPick] = useState<string | undefined>(undefined);
  // Whether the served rows are the LIVE period. false = the backend fell back to the last
  // published one and <PreviousPeriodNote/> must say so; pendingSeason names the season still
  // awaiting publication. Both read off the envelope (owner 2026-08-03).
  const [isCurrentPeriod, setIsCurrentPeriod] = useState(true);
  const [pendingSeason, setPendingSeason] = useState<string | null>(null);
  // The request FAILED, as opposed to returning nothing. Held apart from the row state so the
  // empty states below can never be shown for a broken request (see <LoadError/>).
  const [failed, setFailed] = useState(false);
  // Bumped by the LoadError retry button to re-run the fetch effect.
  const [retry, setRetry] = useState(0);
  // The client stopped walking pages before the period ran out (see <TruncatedNote/>).
  const [truncated, setTruncated] = useState(false);
  // The ghost the user is requesting to claim (null = dialog closed). Set by the per-row "Claim"
  // button; consumed by <ClaimGhostDialog/> at the bottom of this view.
  const [claimTarget, setClaimTarget] = useState<ClaimGhostTarget | null>(null);
  // ── per-role player ladders (owner: "sniper rankings, rusher rankings, etc") ──
  // A role table is a FILTER over the player ladder, not a second scoring system: same scores,
  // the subset of players who play that role, ranks renumbered WITHIN the role by the backend
  // (afc_rankings/player_roles.py). ROLE_ALL = the unfiltered ladder. `roleOptions` is the tab
  // bar itself, served on the same response so the counts can never disagree with the rows.
  const [roleFilter, setRoleFilter] = useState<string>(ROLE_ALL);
  const [roleOptions, setRoleOptions] = useState<PlayerRoleOption[]>([]);
  // How much of this period actually HAS a stored role. Drives <RoleDataNotice/>: a month recorded
  // before roles were stamped has none, and the page has to say so rather than show empty role tabs
  // as if nobody played those roles. Zeroed by the backend behind the publish gate.
  const [roleCoverage, setRoleCoverage] = useState<PlayerRoleCoverage | null>(null);
  // Live refresh (owner 2026-07-02): shared tick re-runs the standings fetch below.
  const tick = useLiveTick();
  // The query the last run of the fetch effect asked for ("teams|2026-06|all|0"). Used to tell a
  // USER ACTION (subject / month / role / retry changed) from a live-tick re-pull, so only the
  // former flashes a loader. A ref, not state, because writing it must not re-run the effect.
  const lastQuery = useRef<string | null>(null);
  // How many rows are currently ON SCREEN for the active subject.
  //
  // This is what a failed request is judged against, and it is deliberately a fact about the
  // SCREEN rather than about what triggered the run. The obvious version of this ("a re-pull the
  // tick fired is background, so swallow its errors") is wrong in a way that is easy to miss:
  // React StrictMode mounts every component twice in dev, so the second mount-time run finds the
  // query key already written by the first, calls itself a background poll, and throws its failure
  // away - leaving a dead API rendering "Nothing here yet", the exact lie <LoadError/> exists to
  // prevent. Asking "is there anything on screen to protect?" has no such blind spot.
  //
  // A ref, and updated from its own effect, because the fetch effect must read the CURRENT count
  // without listing the rows as a dependency, which would re-run the fetch on every fetch.
  const shownCount = useRef(0);

  useEffect(() => {
    shownCount.current = (subject === "teams" ? teams : players).length;
  }, [subject, teams, players]);

  useEffect(() => {
    let active = true;
    // Live refresh (owner 2026-07-02): a live-tick re-pull keeps the current rows on screen (no
    // loader flash) and leaves the expanded row open. Search / country filter / claim dialog live
    // in separate state and are untouched either way.
    //
    // The loader is driven off the QUERY, not off `tick > 0`: by the time a user switches to
    // Players or picks another month the tick has long since advanced past 0, so `tick > 0` called
    // their click a background poll and they got no loader at all.
    const queryKey = `${subject}|${monthPick ?? ""}|${roleFilter}|${retry}`;
    const queryChanged = queryKey !== lastQuery.current;
    lastQuery.current = queryKey;
    if (queryChanged) { setLoading(true); setOpen(null); }
    (async () => {
      try {
        if (subject === "teams") {
          const r = await rankingsApi.teamsMonthly(monthPick); if (!active) return;
          setTeams(r.results); setMonth(r.month ?? ""); setSeason((r.season as SeasonFlags) ?? null);
          setIsCurrentPeriod(r.is_current_period !== false);
          setPendingSeason(r.current_season?.name ?? null);
          setTruncated(r.truncated);
        } else {
          // The by-role endpoint serves the ladder AND the role tab bar in one call, and with
          // role=all it returns exactly what players/monthly/ returns, so this replaces the old
          // call rather than sitting beside it.
          const r = await rankingsApi.playersByRole({
            role: roleFilter, period: "monthly", month: monthPick,
          });
          if (!active) return;
          setPlayers(r.results); setMonth(r.month ?? ""); setSeason((r.season as SeasonFlags) ?? null);
          setRoleOptions(r.roles ?? []);
          setRoleCoverage(r.role_coverage ?? null);
          setIsCurrentPeriod(r.is_current_period !== false);
          setPendingSeason(r.current_season?.name ?? null);
          setTruncated(r.truncated);
        }
        if (active) setFailed(false);
      } catch {
        // A failed request must NOT fall through to the empty state below: "we could not ask" and
        // "no results were recorded" are different facts and the page has to say which one it is.
        //
        // The one case where a failure is swallowed instead is a live-tick re-pull over rows the
        // viewer is already reading: blanking a ladder mid-read is worse than briefly showing one
        // tick-old, and the next tick recovers it. That is the ONLY exemption, hence both
        // conditions: rows for a query the user has since changed describe a different period, so
        // they cannot be kept either, even though they are still on screen.
        if (!active) return;
        if (queryChanged || shownCount.current === 0) {
          setTeams([]); setPlayers([]); setFailed(true);
        }
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [subject, tick, monthPick, roleFilter, retry]);

  // Load the season list (owner 2026-07-04 season picker). It populates the dropdown ONLY: it
  // deliberately does not preselect a season, per the seasonPick comment above.
  //
  // Keyed on `retry` as well as mount, because "Try again" has to restore the WHOLE view. When the
  // API is down at load time this list fails alongside the ladder, and retrying only the ladder
  // brought the rows back under an empty, unusable season dropdown.
  useEffect(() => {
    rankingsApi.seasons()
      .then((r) => setSeasons(r.results))
      .catch(() => { /* season picker just stays empty if the list can't load */ });
  }, [retry]);

  // ISO months ("2026-05") spanned by a season, newest first, capped at the current month so we
  // never offer a future month with no data. A plain callback rather than a memo over the current
  // selection because the season dropdown also needs the months of the season it is switching TO.
  const monthsForSeason = useCallback((id: number | undefined) => {
    const s = seasons.find((x) => x.season_id === id);
    if (!s) return [] as string[];
    const out: string[] = [];
    const d = new Date(s.start_date + "T00:00:00");
    const end = new Date(s.end_date + "T00:00:00");
    const nowKey = new Date().toISOString().slice(0, 7);
    // The end date is EXCLUSIVE, and reading it as inclusive made consecutive seasons overlap by a
    // month. Real data: SEASON 2 runs 2026-04-01 to 2026-07-01 and SEASON 3 runs 2026-07-01 to
    // 2026-10-01, so `d <= end` offered July 2026 under BOTH. Picking July under SEASON 2 then
    // fetched a ladder the backend files under SEASON 3, and the empty state named SEASON 3 while
    // the picker still read SEASON 2, which looked like the page had lost track of itself.
    while (d < end) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (key <= nowKey) out.push(key);
      d.setMonth(d.getMonth() + 1);
    }
    return out.reverse();
  }, [seasons]);

  // What the two pickers DISPLAY: the user's own pick when they made one, otherwise the period the
  // backend actually served. Deriving it (rather than storing a preselection) is what keeps the
  // controls describing the rows on screen without the controls dictating which rows are fetched.
  const shownSeasonId = seasonPick ?? season?.season_id;
  const shownMonth = monthPick ?? (month ? month.slice(0, 7) : undefined);
  const seasonMonths = useMemo(() => monthsForSeason(shownSeasonId), [monthsForSeason, shownSeasonId]);

  const all: any[] = subject === "teams" ? teams : players;
  // Distinct countries present in the current rows (for the filter dropdown), sorted.
  const countryOptions = useMemo(
    () => Array.from(new Set(all.map((r) => r.country).filter(Boolean))).sort() as string[],
    [all],
  );
  // Use the shared matchesSearch() helper (lib/search.ts) instead of a raw .includes so the
  // search box is punctuation/space/accent-insensitive and folds stylized "fancy font" IGNs
  // (typing "ve" finds "V-E"). The searched field is the team_name or username for the active tab.
  //
  // Country RE-RANK (owner 2026-07-04): when a country is picked, number rows 1..N WITHIN that
  // country - a team 8th overall may be 3rd among its own country. `all` already arrives in global
  // rank order, so the country-scoped index + 1 IS the country rank; with no country filter we keep
  // the backend's global r.rank. Search only filters what's shown, it never changes the rank, so the
  // rank is assigned on the country-scoped list BEFORE the search filter is applied.
  const countryScoped: any[] = countryFilter
    ? all.filter((r) => r.country === countryFilter)
    : all;
  const rows = countryScoped
    .map((r, i) => ({ ...r, _rank: countryFilter ? i + 1 : r.rank }))
    .filter((r) => matchesSearch(subject === "teams" ? r.team_name : r.username, q));
  // Month label ("June 2026"): no <LocalTime> month-year mode exists, so format inline in the
  // VIEWER's locale, so the month name follows the active language.
  //
  // The month is a CALENDAR MONTH, not an instant, so it must NOT be put through the viewer's
  // timezone. `month` arrives as "2026-06-01", which new Date() reads as midnight UTC; rendering
  // that in a negative-offset zone lands on 31 May and labelled the whole ladder "May 2026" for
  // every viewer west of London. Build the date from the year/month parts and format it in UTC
  // instead, matching monthLabel() in app/(user)/_components/HomeRankingsTiers.tsx. Falls back to
  // "This month" when unset.
  const monthLabel = useMemo(() => {
    if (!month) return t("rankings.thisMonth");
    const [y, m] = month.split("-").map(Number);
    if (!y || !m) return t("rankings.thisMonth");
    return new Intl.DateTimeFormat(getActiveLocale(), {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(y, m - 1, 1)));
  }, [month, t]);

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-sm text-muted-foreground">
          {t("rankings.liveStandings")} <InfoTip id="rankings.public.monthly_standings" /> · <span className="text-foreground">{monthLabel}</span>
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchBar value={q} onChange={setQ} placeholder={subject === "teams" ? t("rankings.searchTeams") : t("rankings.searchPlayers")} />
          {/* Season + month picker (owner 2026-07-04): change which period's monthly rankings show. */}
          {seasons.length > 0 && (
            <Select
              value={shownSeasonId ? String(shownSeasonId) : undefined}
              onValueChange={(v) => {
                // Picking a season is an explicit pick, so it also pins the month: jump to that
                // season's newest available month. Done in the handler rather than in an effect
                // keyed on the season, because that effect is exactly what used to overwrite the
                // backend's published-period default on first load and empty the page.
                const id = Number(v);
                setSeasonPick(id);
                setMonthPick(monthsForSeason(id)[0]);
              }}
            >
              {/* The trigger is given EXPLICIT children so it shows the season NAME only.
                  Radix otherwise clones the selected SelectItem's content into the trigger, which
                  dragged the " · current" marker in with it; that does not fit w-40 and rendered as
                  a dangling "SEASON 3 2026 ·". The marker belongs in the open list, where it tells
                  the user which season is live, not in the closed control. */}
              <SelectTrigger className="h-9 w-full sm:w-40">
                <SelectValue placeholder={t("rankings.season")}>
                  {seasons.find((s) => s.season_id === shownSeasonId)?.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {seasons.map((s) => (
                  <SelectItem key={s.season_id} value={String(s.season_id)}>
                    {s.name}{s.is_active ? t("rankings.seasonCurrent") : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {seasonMonths.length > 1 && (
            <Select value={shownMonth} onValueChange={setMonthPick}>
              <SelectTrigger className="h-9 w-full sm:w-36"><SelectValue placeholder={t("rankings.month")} /></SelectTrigger>
              <SelectContent>
                {seasonMonths.map((m) => (
                  <SelectItem key={m} value={m}>
                    {new Intl.DateTimeFormat(getActiveLocale(), { month: "long", year: "numeric", timeZone: getBrowserTimeZone() }).format(new Date(m + "-01T00:00:00"))}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {/* Country filter (owner 2026-06-30): see the rankings for one country. Only shown when the
              data has countries to choose from. "__all" sentinel = all countries (Radix Select can't
              use an empty-string value). */}
          {countryOptions.length > 0 && (
            <Select
              value={countryFilter || "__all"}
              onValueChange={(v) => setCountryFilter(v === "__all" ? "" : v)}
            >
              <SelectTrigger className="h-9 w-full sm:w-44">
                <SelectValue placeholder={t("rankings.allCountries")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">{t("rankings.allCountries")}</SelectItem>
                {countryOptions.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Tabs value={subject} onValueChange={(v) => {
            setSubject(v as Subject); setQ(""); setCountryFilter(""); setRoleFilter(ROLE_ALL);
          }}>
            <TabsList>
              <TabsTrigger value="teams"><IconUsers className="mr-1 size-3.5" /> {t("rankings.teams")}</TabsTrigger>
              <TabsTrigger value="players"><IconTrophy className="mr-1 size-3.5" /> {t("rankings.players")}</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* ── in-game role tabs, players only ──
          The ladder is the same ladder; picking a role narrows it to the players who play that
          role and renumbers them 1..N within it, which is why the caption below spells out what
          the numbers mean. The strip scrolls sideways inside itself on a phone (fade hints from
          ScrollableTabsList) rather than pushing the page. */}
      {subject === "players" && roleOptions.length > 0 && (
        <div className="mb-4 space-y-1.5">
          <Tabs value={roleFilter} onValueChange={setRoleFilter}>
            <ScrollableTabsList aria-label={t("rankings.roleTabsLabel")}>
              <TabsTrigger value={ROLE_ALL} className="text-xs">
                {t("rankings.roleAll")}
              </TabsTrigger>
              {roleOptions.map((option) => (
                <TabsTrigger key={option.role} value={option.role} className="text-xs">
                  {/* Known roles are translated; anything new falls back to the label the
                      backend sends, so a role added to the model is still readable. */}
                  {t.has(`rankings.roles.${option.role}`)
                    ? t(`rankings.roles.${option.role}`)
                    : option.label}
                  <Badge variant="outline"
                    className="ml-1.5 rounded-full px-1.5 py-0 text-[10px] tabular-nums text-muted-foreground">
                    {option.player_count}
                  </Badge>
                </TabsTrigger>
              ))}
            </ScrollableTabsList>
          </Tabs>
          <p className="text-xs text-muted-foreground">
            {roleFilter === ROLE_ALL
              ? t("rankings.roleAllCaption")
              : t("rankings.roleCaption", {
                  role: t.has(`rankings.roles.${roleFilter}`)
                    ? t(`rankings.roles.${roleFilter}`)
                    : roleFilter,
                })}
          </p>
        </div>
      )}

      {/* This period stores no in-game role for anybody, so say so. Only for a PUBLISHED period:
          behind the gate the coverage block is zeroed by the backend and the NotPublished state
          below is the right message, not this one. */}
      {subject === "players" && season?.rankings_published !== false && !loading
        && roleCoverage != null && !roleCoverage.has_role_data && <RoleDataNotice />}

      {/* These rows are the last PUBLISHED period, not the live one. Say so, or an old month
          reads as today's standings. Only meaningful once there are rows to mislabel. */}
      {!loading && !failed && !isCurrentPeriod && pendingSeason && all.length > 0 && (
        <PreviousPeriodNote shown={monthLabel} pending={pendingSeason} />
      )}
      {!loading && !failed && truncated && <TruncatedNote />}

      <Card>
        <CardContent>
          {loading ? (
            <div className="py-16"><FullLoader text={t("rankings.loadingStandings")} /></div>
          ) : failed ? (
            // Checked BEFORE every empty state below: a broken request must never be presented
            // as "no results have been recorded".
            <LoadError onRetry={() => setRetry((n) => n + 1)} />
          ) : all.length === 0 && subject === "players" && roleFilter !== ROLE_ALL
              && season?.rankings_published !== false ? (
            // A published period where this ROLE simply has nobody yet. Distinct from the
            // "nothing published" and "no data at all" states, both handled below.
            <RoleEmpty role={t.has(`rankings.roles.${roleFilter}`)
              ? t(`rankings.roles.${roleFilter}`) : roleFilter} />
          ) : all.length === 0 && season && season.rankings_published === false ? (
            <NotPublished seasonName={season.name} what={t("rankings.rankingsLabel")} />
          ) : all.length === 0 ? (
            <Empty period="monthly" />
          ) : rows.length === 0 ? (
            <NoMatch q={q} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">{t("rankings.rank")}</TableHead>
                  <TableHead>{subject === "teams" ? t("rankings.team") : t("rankings.player")}</TableHead>
                  {subject === "teams" ? (
                    <>
                      <TableHead className="text-right">{t("rankings.wins")}</TableHead>
                      <TableHead className="text-right">{t("rankings.kills")}</TableHead>
                    </>
                  ) : (
                    <>
                      <TableHead className="text-right">{t("rankings.kills")}</TableHead>
                      <TableHead className="text-right">{t("rankings.mvps")}</TableHead>
                    </>
                  )}
                  <TableHead className="text-right">{t("rankings.score")} <InfoTip id="rankings.public.score_column" /></TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const id = subject === "teams" ? `t${r.team_id}` : `p${r.player_id}`;
                  const isOpen = open === id;
                  const name = subject === "teams" ? r.team_name : r.username;
                  return (
                    <React.Fragment key={id}>
                      <TableRow className="cursor-pointer" onClick={() => setOpen(isOpen ? null : id)}>
                        <TableCell className="font-semibold text-muted-foreground">
                          <span className="inline-flex items-center"><IconHash className="size-3" />{r._rank ?? r.rank}</span>
                        </TableCell>
                        <TableCell className="font-medium">
                          {/* Ghost rows (is_ghost) have NO public profile, so they must
                              NOT be wrapped in a TeamLink/PlayerLink (that would link to a
                              non-existent /teams|/players page). The backend already prefixes
                              the name with "[Ghost] ...", so we render that name as plain text
                              and add a small outline Ghost badge in ADDITION (no double-prefix).
                              Real rows keep the existing profile link + row-toggle behaviour:
                              the name links to the public profile and stopPropagation keeps a
                              name click from also expanding/collapsing the breakdown row. */}
                          {r.is_ghost ? (
                            <span className="inline-flex items-center gap-1.5">
                              {name}
                              <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[10px] text-muted-foreground">
                                {t("rankings.ghost")}
                              </Badge>
                              {/* Claim action, logged-in users only. We can only target the request
                                  endpoint when the ladder row carries the ghost's own id (ghost_team_id
                                  / ghost_player_id, emitted by the serializer); hide otherwise. We also
                                  hide once the ghost is no longer "unclaimed" (claim_status) so a
                                  pending/claimed ghost can't be re-requested (the backend is still the
                                  source of truth and 400s if it slips through). stopPropagation keeps the
                                  button click from toggling this row's breakdown. */}
                              {isAuthenticated &&
                                (subject === "teams" ? r.ghost_team_id : r.ghost_player_id) &&
                                (r.claim_status == null || r.claim_status === "unclaimed") && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 px-2 text-[11px]"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setClaimTarget(
                                        subject === "teams"
                                          ? { kind: "team", ghostId: r.ghost_team_id as string, ghostName: name }
                                          : { kind: "player", ghostId: r.ghost_player_id as number, ghostName: name },
                                      );
                                    }}
                                  >
                                    {t("rankings.claim")}
                                  </Button>
                                )}
                              {/* A ghost already awaiting review shows a small status pill instead of Claim. */}
                              {r.claim_status === "pending" && (
                                <Badge
                                  variant="outline"
                                  className="rounded-full px-2 py-0.5 text-[10px] border-orange-500/40 text-orange-400"
                                >
                                  {t("rankings.claimPending")}
                                </Badge>
                              )}
                            </span>
                          ) : subject === "teams" ? (
                            <TeamLink name={name} country={r.country} stopPropagation />
                          ) : (
                            <span className="inline-flex items-center gap-1.5">
                              <PlayerLink name={name} stopPropagation />
                              {/* MIXED-ROLE disclosure. A player who played more than one role this
                                  period is still listed exactly once, under the role they played
                                  most, so the role tables stay a clean split of the ladder with
                                  nobody counted twice. This pill is how that call is disclosed
                                  rather than hidden; the expanded row shows the role-scoped
                                  matches and kills behind it. */}
                              {roleFilter !== ROLE_ALL && r.role_is_mixed && (
                                <Badge
                                  variant="outline"
                                  className="rounded-full px-2 py-0.5 text-[10px] text-muted-foreground"
                                  title={t("rankings.roleMixedHint")}
                                >
                                  {t("rankings.roleMixed")}
                                </Badge>
                              )}
                            </span>
                          )}
                        </TableCell>
                        {subject === "teams" ? (
                          <>
                            <TableCell className="text-right tabular-nums">{r.wins ?? 0}</TableCell>
                            <TableCell className="text-right tabular-nums">{r.kills ?? 0}</TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell className="text-right tabular-nums">{r.kills ?? 0}</TableCell>
                            <TableCell className="text-right tabular-nums">{r.mvps ?? 0}</TableCell>
                          </>
                        )}
                        <TableCell className="text-right font-semibold text-primary tabular-nums">{r.total_score.toFixed(1)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {isOpen ? <IconChevronDown className="size-4" /> : <IconChevronRight className="size-4" />}
                        </TableCell>
                      </TableRow>
                      {isOpen && (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={6} className="bg-muted/20">
                            <div className="grid grid-cols-2 gap-2 py-1 sm:grid-cols-3 md:grid-cols-4">
                              {subject === "teams" ? (
                                <>
                                  <StatTile label={t("rankings.tournament")} value={(r.tournament_pts ?? 0).toFixed(1)} />
                                  <StatTile label={t("rankings.scrims")} value={(r.scrim_pts ?? 0).toFixed(1)} />
                                  <StatTile label={t("rankings.tournaments")} value={r.tournaments_played ?? 0} />
                                </>
                              ) : (
                                <>
                                  {/* Inside a role table the rank column counts within the role,
                                      so the position on the full ladder is shown here instead of
                                      being lost. */}
                                  {roleFilter !== ROLE_ALL && r.overall_rank != null && (
                                    <StatTile label={t("rankings.overallRank")} value={`#${r.overall_rank}`} />
                                  )}
                                  {/* ── what they really did IN THIS ROLE ──
                                      Role-scoped, so a player who split the month between two
                                      roles sees their sniper games here, not the month total
                                      sitting beside it. Matches and kills are the only per-player
                                      facts the match pipeline records, so they are the whole of
                                      what a role column can honestly show; the SCORE is the same
                                      one the main ladder shows, never a role-specific one. */}
                                  {roleFilter !== ROLE_ALL && (
                                    <>
                                      <StatTile label={t("rankings.roleMatches")} value={r.role_matches ?? 0} />
                                      <StatTile label={t("rankings.roleKills")} value={r.role_kills ?? 0} />
                                    </>
                                  )}
                                  {/* On the UNFILTERED ladder, name the role the period was played
                                      in. "Not recorded" is a real answer (staff, ghosts, solo-only
                                      months, anything from before roles were stamped) and is shown
                                      as such rather than left blank, which would read as "none". */}
                                  {roleFilter === ROLE_ALL && !r.is_ghost && (
                                    <StatTile
                                      label={t("rankings.roleLabel")}
                                      value={r.role
                                        ? (t.has(`rankings.roles.${r.role}`) ? t(`rankings.roles.${r.role}`) : r.role)
                                        : t("rankings.roleNotRecorded")}
                                    />
                                  )}
                                  <StatTile label={t("rankings.kills")} value={(r.kill_pts ?? 0).toFixed(1)} />
                                  <StatTile label={t("rankings.mvp")} value={(r.mvp_pts ?? 0).toFixed(1)} />
                                  <StatTile label={t("rankings.finals")} value={(r.finals_pts ?? 0).toFixed(1)} />
                                  <StatTile label={t("rankings.teamWin")} value={(r.team_win_pts ?? 0).toFixed(1)} />
                                  <StatTile label={t("rankings.participation")} value={(r.participation_pts ?? 0).toFixed(1)} />
                                  <StatTile label={t("rankings.scrims")} value={(r.scrim_pts ?? 0).toFixed(1)} />
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Ghost claim-request dialog. Opened by the per-row "Claim" button above; on a successful
          request it closes itself (the row keeps its claim_status until the next fetch; a refresh
          will reflect "pending"). We don't auto-refetch the whole ladder to avoid a jarring reflow;
          the toast confirms the request landed. */}
      <ClaimGhostDialog
        target={claimTarget}
        onOpenChange={(o) => { if (!o) setClaimTarget(null); }}
      />
    </div>
  );
}

// ─── Tiers view - teams only, expandable per-tier bands ──────────────────────
function TierTeamRow({ row, elite }: { row: any; elite?: boolean }) {
  const t = useTranslations("teamsplayers");
  const [open, setOpen] = useState(false);
  return (
    <div className={cn("border-t first:border-t-0", elite && "border-amber-500/20")}>
      <button
        onClick={() => setOpen(!open)}
        className={cn("flex w-full items-center gap-3 px-4 text-left", elite ? "py-3.5" : "py-2.5")}
      >
        <span className={cn("inline-flex w-9 shrink-0 items-center font-semibold",
          elite ? "text-amber-400" : "text-muted-foreground")}>
          {elite ? <IconCrown className="size-5" /> : <><IconHash className="size-3" />{(row as any)._rank ?? row.rank}</>}
        </span>
        <span className={cn("flex-1 truncate font-medium", elite && "text-lg font-bold")}>{row.team_name}</span>
        {/* Ghost teams have no profile. The tier row renders the name as plain text
            already (no TeamLink here), and the backend prefixes it "[Ghost] ...", so we
            only ADD a small outline Ghost badge to mark the row. No double-prefix. */}
        {row.is_ghost && (
          <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[10px] text-muted-foreground">
            {t("rankings.ghost")}
          </Badge>
        )}
        {!row.meets_participation_floor && (
          <Badge variant="outline" className="rounded-full text-[10px] text-muted-foreground">
            {t("rankings.tournamentsPlayed", { count: row.tournaments_played ?? 0 })}
          </Badge>
        )}
        <span className={cn("font-bold tabular-nums", elite ? "text-2xl text-amber-300" : "text-primary")}>
          {row.total_score.toFixed(0)}
        </span>
        {open ? <IconChevronDown className="size-4 shrink-0 text-muted-foreground" />
              : <IconChevronRight className="size-4 shrink-0 text-muted-foreground" />}
      </button>
      {open && (
        <div className="grid grid-cols-2 gap-2 px-4 pb-3 sm:grid-cols-3 md:grid-cols-4">
          <StatTile label={t("rankings.totalKills")} value={row.kills ?? 0} />
          <StatTile label={t("rankings.tournamentPts")} value={(row.tournament_pts ?? 0).toFixed(1)} />
          <StatTile label={t("rankings.scrimPts")} value={(row.scrim_pts ?? 0).toFixed(1)} />
          <StatTile label={t("rankings.prizePts")} value={(row.prize_money_pts ?? 0).toFixed(1)} />
          <StatTile label={t("rankings.socialPts")} value={(row.social_media_pts ?? 0).toFixed(1)} />
          <StatTile label={t("rankings.wins")} value={row.wins ?? 0} />
          <StatTile label={t("rankings.tournaments")} value={row.tournaments_played ?? 0} />
          <StatTile label={t("rankings.totalScore")} value={(row.total_score ?? 0).toFixed(1)} />
        </div>
      )}
    </div>
  );
}

function TierSection({ tier, rows, searching }: { tier: 0 | 1 | 2 | 3; rows: any[]; searching: boolean }) {
  const t = useTranslations("teamsplayers");
  const elite = tier === 0;
  if (!rows.length && (tier !== 0 || searching)) return null;
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        {elite && <IconCrown className="size-4 text-amber-400" />}
        <TierBadge tier={tier} />
        <span className="text-xs text-muted-foreground">{t("rankings.teamCount", { count: rows.length })}</span>
        <span className="ml-auto text-[11px] text-muted-foreground">{t("rankings.minPts", { min: tierMeta[tier].min })}</span>
      </div>
      {rows.length === 0 ? (
        <Card className={cn(elite && "border-amber-500/40")}>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            {t("rankings.noEliteYet")}
          </CardContent>
        </Card>
      ) : (
        <Card className={cn(elite &&
          "border-amber-500/50 bg-gradient-to-br from-amber-500/10 via-amber-500/[0.03] to-transparent shadow-[0_0_40px_-18px] shadow-amber-500/40")}>
          <CardContent className="p-0">
            {rows.map((r, i) => <TierTeamRow key={i} row={r} elite={elite} />)}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Reads rankingsApi.teamsQuarterly(seasonId). tiers_published can be false while
// rankings_published is true (backend returns tier null), so we show the tiers-coming-soon
// notice instead of dropping teams; grouping into bands uses TierBadge.
function TiersView() {
  // i18n: seasonal tiers view copy (messages/en/teamsplayers.json -> "rankings").
  const t = useTranslations("teamsplayers");
  const [seasons, setSeasons] = useState<Season[]>([]);
  // The user's EXPLICIT season pick; undefined = no pick, let the backend serve the most recent
  // PUBLISHED season (afc_rankings.views._resolve_quarterly_season) and tell us which one that was
  // on the envelope. Preselecting the ACTIVE season here is what made this tab read "Not published
  // yet" for every visitor: the live season's tiers have not been graded yet. Same fix, and same
  // reasoning, as seasonPick/monthPick in RankingsView above.
  const [seasonPick, setSeasonPick] = useState<number | undefined>(undefined);
  const [q, setQ] = useState("");
  // Country filter for the tiers view (owner 2026-06-30): see tiers for one country. "" = all.
  const [countryFilter, setCountryFilter] = useState("");
  const [teams, setTeams] = useState<TeamRow[]>([]);
  // Season returned on the quarterly envelope - carries rankings_published + tiers_published.
  const [season, setSeason] = useState<SeasonFlags | null>(null);
  const [loading, setLoading] = useState(true);
  // Envelope honesty flags, same contract as RankingsView: false = these are the last published
  // season's tiers, not the live one, and the banner must say so.
  const [isCurrentPeriod, setIsCurrentPeriod] = useState(true);
  const [pendingSeason, setPendingSeason] = useState<string | null>(null);
  // Request failed, kept apart from "this season has no tiered teams" (see <LoadError/>).
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [truncated, setTruncated] = useState(false);
  // Live refresh (owner 2026-07-02): shared tick re-runs the quarterly fetch below.
  // The seasons() effect is deliberately NOT wired - the dropdown list does not change
  // between ticks, so re-pulling it every 15s would be pure noise.
  const tick = useLiveTick();
  // Same two refs, same contract, same reasons as RankingsView above: `lastQuery` drives the
  // loader (a season pick must show one; a tick must not), and `shownCount` decides what a failure
  // means (keep bands the viewer is reading, never present a dead API as an untiered season).
  const lastQuery = useRef<string | null>(null);
  const shownCount = useRef(0);

  useEffect(() => { shownCount.current = teams.length; }, [teams]);

  // Populates the season dropdown ONLY. It no longer preselects the active season: see seasonPick.
  // Keyed on `retry` for the same reason as RankingsView: "Try again" restores the whole view,
  // dropdown included, not just the tier bands.
  useEffect(() => {
    rankingsApi.seasons()
      .then((r) => setSeasons(r.results))
      .catch((error) => toast.error(error?.response?.data?.message || t("rankings.loadFailed")));
  }, [retry]);

  useEffect(() => {
    let active = true;
    // Live refresh (owner 2026-07-02): a tick re-pull keeps the tier bands on screen (no loader
    // flash); search and country filter live in separate state and stay untouched either way.
    const queryKey = `${seasonPick ?? ""}|${retry}`;
    const queryChanged = queryKey !== lastQuery.current;
    lastQuery.current = queryKey;
    if (queryChanged) setLoading(true);
    rankingsApi.teamsQuarterly(seasonPick)
      .then((r) => {
        if (!active) return;
        setTeams(r.results); setSeason((r.season as SeasonFlags) ?? null);
        setIsCurrentPeriod(r.is_current_period !== false);
        setPendingSeason(r.current_season?.name ?? null);
        setTruncated(r.truncated);
        setFailed(false);
      })
      // Same rule as the ladder: a failed request gets its own state so it can never be read as a
      // season that simply has no tiered teams. Only a tick re-pull over bands already on screen
      // is swallowed, and bands belonging to a season the user has since changed are not kept.
      .catch(() => {
        if (!active) return;
        if (queryChanged || shownCount.current === 0) { setTeams([]); setFailed(true); }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [seasonPick, tick, retry]);

  // What the dropdown DISPLAYS: the user's pick, else the season the backend actually served.
  const shownSeasonId = seasonPick ?? season?.season_id;

  // Tiers not published yet → backend sends tier=null on every row even though rankings are published.
  const tiersHidden = season?.tiers_published === false;

  const countryOptions = useMemo(
    () => Array.from(new Set(teams.map((r) => r.country).filter(Boolean))).sort() as string[],
    [teams],
  );
  const byTier = useMemo(() => {
    const g: Record<number, any[]> = { 0: [], 1: [], 2: [], 3: [] };
    teams
      // Shared matchesSearch() helper (lib/search.ts): punctuation/space/accent-insensitive
      // and folds stylized "fancy font" team names, unlike the old .toLowerCase().includes().
      // Country filter applied alongside ("" = all countries).
      .filter((r) => matchesSearch(r.team_name, q) && (!countryFilter || r.country === countryFilter))
      .forEach((r) => { if (r.tier != null) g[r.tier].push(r); });
    return g;
  }, [teams, q, countryFilter]);
  const filteredTotal = byTier[0].length + byTier[1].length + byTier[2].length + byTier[3].length;
  const searching = q.trim().length > 0;

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <p className="max-w-xl text-sm text-muted-foreground">
          {t("rankings.tiersIntro")} <InfoTip id="rankings.public.tiers_intro" /> {t("rankings.tiersIntroElite")}{" "}
          <span className="font-semibold text-amber-400">{t("rankings.elite")}</span>. {t("rankings.tiersIntroTap")}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchBar value={q} onChange={setQ} placeholder={t("rankings.searchTeams")} />
          {countryOptions.length > 0 && (
            <Select value={countryFilter || "__all"} onValueChange={(v) => setCountryFilter(v === "__all" ? "" : v)}>
              <SelectTrigger className="h-9 w-full sm:w-44"><SelectValue placeholder={t("rankings.allCountries")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">{t("rankings.allCountries")}</SelectItem>
                {countryOptions.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
              </SelectContent>
            </Select>
          )}
          <Select value={shownSeasonId ? String(shownSeasonId) : undefined} onValueChange={(v) => setSeasonPick(Number(v))}>
            {/* Name-only trigger, same reason as the ladder's season picker above: the
                " · current" marker is for the open list, not the closed control. */}
            <SelectTrigger className="h-9 w-[170px]">
              <SelectValue placeholder={t("rankings.season")}>
                {seasons.find((s) => s.season_id === shownSeasonId)?.name}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {seasons.map((s) => (
                <SelectItem key={s.season_id} value={String(s.season_id)}>
                  {s.name}{s.is_active ? t("rankings.seasonCurrent") : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {tiersHidden && (
        // Rankings are published but tiers aren't graded/published yet - say so instead of
        // dropping every (null-tier) team and showing a misleading empty state.
        <div className="mb-4 flex items-center gap-2 rounded-md border border-dashed bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          <IconClock className="size-4 shrink-0" />
          {t("rankings.tiersComingSoon")}{" "}
          <span className="font-medium text-foreground">{season?.name ?? t("rankings.thisSeason")}</span> {t("rankings.tiersComingSoonNotPublished")}
        </div>
      )}

      {/* Not the live season: name the season on screen and the one still pending. */}
      {!loading && !failed && !isCurrentPeriod && pendingSeason && teams.length > 0 && season?.name && (
        <PreviousPeriodNote shown={season.name} pending={pendingSeason} />
      )}
      {!loading && !failed && truncated && <TruncatedNote />}

      {loading ? (
        <Card><CardContent><div className="py-16"><FullLoader text={t("rankings.loadingTiers")} /></div></CardContent></Card>
      ) : failed ? (
        // Before every empty state below, for the same reason as on the ladder.
        <Card><CardContent><LoadError onRetry={() => setRetry((n) => n + 1)} /></CardContent></Card>
      ) : teams.length === 0 && season?.rankings_published === false ? (
        <Card><CardContent><NotPublished seasonName={season?.name} what={t("rankings.rankingsLabel")} /></CardContent></Card>
      ) : teams.length === 0 ? (
        <Card><CardContent><Empty period="quarterly" /></CardContent></Card>
      ) : tiersHidden ? null : searching && filteredTotal === 0 ? (
        <Card><CardContent><NoMatch q={q} /></CardContent></Card>
      ) : (
        <div className="space-y-6">
          <TierSection tier={0} rows={byTier[0]} searching={searching} />
          <TierSection tier={1} rows={byTier[1]} searching={searching} />
          <TierSection tier={2} rows={byTier[2]} searching={searching} />
          <TierSection tier={3} rows={byTier[3]} searching={searching} />
        </div>
      )}
    </div>
  );
}

function Empty({ period }: { period: string }) {
  const t = useTranslations("teamsplayers");
  // period is a code value ("monthly" / "quarterly") from the caller; localize the
  // word itself so the sentence reads in the active language.
  const periodLabel =
    period === "quarterly" ? t("rankings.periodQuarterly") : t("rankings.periodMonthly");
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <IconMoodEmpty className="size-10 text-muted-foreground" />
      <p className="font-semibold">{t("rankings.nothingHereYet")}</p>
      <p className="text-sm text-muted-foreground">{t("rankings.standingsAppear", { period: periodLabel })}</p>
    </div>
  );
}

// ─── Page - header + transfer-window banner + Rankings/Tiers tabs ────────────
export default function RankingsPage() {
  // i18n: page header + top-level tabs (messages/en/teamsplayers.json -> "rankings").
  const t = useTranslations("teamsplayers");
  // The transfer-window banner self-fetches the current season (Phase 2c flags); the
  // per-view RankingsView/TiersView fetch their own standings data independently.
  return (
    <div>
      <PageHeader
        title={t("rankings.pageTitle")}
        description={t("rankings.pageDescription")}
        action={<HowItWorks />}
        dataTour="rankings-header"
      />

      <TransferWindowBanner className="mb-5" />

      <Tabs defaultValue="rankings">
        {/* data-tour anchor (rankings-tabs): guided-tour "Rankings" stop explains the Rankings vs
            Tiers tabs so a player knows where the AFC ladder + tier system live. */}
        <TabsList className="mb-5 h-10" data-tour="rankings-tabs">
          <TabsTrigger value="rankings" className="text-sm">
            <IconChartBar className="mr-1.5 size-4" /> {t("rankings.rankingsTabLabel")}
          </TabsTrigger>
          <TabsTrigger value="tiers" className="text-sm">
            <IconStairsUp className="mr-1.5 size-4" /> {t("rankings.tiersTabLabel")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="rankings"><RankingsView /></TabsContent>
        <TabsContent value="tiers"><TiersView /></TabsContent>
      </Tabs>
    </div>
  );
}
