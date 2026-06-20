"use client";

import React, { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { InfoTip } from "@/components/ui/info-tip";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import { rankingsApi, TeamRow, PlayerRow, Season } from "@/lib/rankings";
import {
  IconHash, IconUsers, IconTrophy, IconChevronDown, IconChevronRight, IconMoodEmpty,
  IconInfoCircle, IconCrown, IconChartBar, IconStairsUp, IconSearch,
  IconClock,
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
// The claim-request dialog (logged-in users) + its target shape. Opened from the "Claim" button
// on a ghost row below; it POSTs to the user-facing ghost request-claim endpoints (see the
// component header for the exact endpoints).
import { ClaimGhostDialog, ClaimGhostTarget } from "./_components/ClaimGhostDialog";

type Subject = "teams" | "players";

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
  // The ghost the user is requesting to claim (null = dialog closed). Set by the per-row "Claim"
  // button; consumed by <ClaimGhostDialog/> at the bottom of this view.
  const [claimTarget, setClaimTarget] = useState<ClaimGhostTarget | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true); setOpen(null);
    (async () => {
      try {
        if (subject === "teams") {
          const r = await rankingsApi.teamsMonthly(); if (!active) return;
          setTeams(r.results); setMonth(r.month ?? ""); setSeason((r.season as SeasonFlags) ?? null);
        } else {
          const r = await rankingsApi.playersMonthly(); if (!active) return;
          setPlayers(r.results); setMonth(r.month ?? ""); setSeason((r.season as SeasonFlags) ?? null);
        }
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [subject]);

  const all: any[] = subject === "teams" ? teams : players;
  // Use the shared matchesSearch() helper (lib/search.ts) instead of a raw .includes so the
  // search box is punctuation/space/accent-insensitive and folds stylized "fancy font" IGNs
  // (typing "ve" finds "V-E"). The searched field is the team_name or username for the active tab.
  const rows = all.filter((r) =>
    matchesSearch(subject === "teams" ? r.team_name : r.username, q));
  // Month label ("June 2026"): no <LocalTime> month-year mode exists, so format inline
  // but in the VIEWER's locale (month names follow the language) + their timezone,
  // instead of the old hardcoded "en-US" / UTC. Falls back to "This month" when unset.
  const monthLabel = month
    ? new Intl.DateTimeFormat(getActiveLocale(), {
        month: "long",
        year: "numeric",
        timeZone: getBrowserTimeZone(),
      }).format(new Date(month))
    : t("rankings.thisMonth");

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-sm text-muted-foreground">
          {t("rankings.liveStandings")} <InfoTip id="rankings.public.monthly_standings" /> · <span className="text-foreground">{monthLabel}</span>
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchBar value={q} onChange={setQ} placeholder={subject === "teams" ? t("rankings.searchTeams") : t("rankings.searchPlayers")} />
          <Tabs value={subject} onValueChange={(v) => { setSubject(v as Subject); setQ(""); }}>
            <TabsList>
              <TabsTrigger value="teams"><IconUsers className="mr-1 size-3.5" /> {t("rankings.teams")}</TabsTrigger>
              <TabsTrigger value="players"><IconTrophy className="mr-1 size-3.5" /> {t("rankings.players")}</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <Card>
        <CardContent>
          {loading ? (
            <div className="py-16"><FullLoader text={t("rankings.loadingStandings")} /></div>
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
                          <span className="inline-flex items-center"><IconHash className="size-3" />{r.rank}</span>
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
                            <PlayerLink name={name} stopPropagation />
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
          {elite ? <IconCrown className="size-5" /> : <><IconHash className="size-3" />{row.rank}</>}
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
  const [seasonId, setSeasonId] = useState<number | undefined>(undefined);
  const [q, setQ] = useState("");
  const [teams, setTeams] = useState<TeamRow[]>([]);
  // Season returned on the quarterly envelope - carries rankings_published + tiers_published.
  const [season, setSeason] = useState<SeasonFlags | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    rankingsApi.seasons().then((r) => {
      setSeasons(r.results);
      const active = r.results.find((s) => s.is_active) ?? r.results[0];
      setSeasonId(active?.season_id);
    }).catch((error) => toast.error(error?.response?.data?.message || t("rankings.loadFailed")));
  }, []);

  useEffect(() => {
    let active = true; setLoading(true);
    rankingsApi.teamsQuarterly(seasonId)
      .then((r) => { if (active) { setTeams(r.results); setSeason((r.season as SeasonFlags) ?? null); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [seasonId]);

  // Tiers not published yet → backend sends tier=null on every row even though rankings are published.
  const tiersHidden = season?.tiers_published === false;

  const byTier = useMemo(() => {
    const g: Record<number, any[]> = { 0: [], 1: [], 2: [], 3: [] };
    teams
      // Shared matchesSearch() helper (lib/search.ts): punctuation/space/accent-insensitive
      // and folds stylized "fancy font" team names, unlike the old .toLowerCase().includes().
      .filter((r) => matchesSearch(r.team_name, q))
      .forEach((r) => { if (r.tier != null) g[r.tier].push(r); });
    return g;
  }, [teams, q]);
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
          <Select value={seasonId ? String(seasonId) : undefined} onValueChange={(v) => setSeasonId(Number(v))}>
            <SelectTrigger className="h-9 w-[170px]"><SelectValue placeholder={t("rankings.season")} /></SelectTrigger>
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

      {loading ? (
        <Card><CardContent><div className="py-16"><FullLoader text={t("rankings.loadingTiers")} /></div></CardContent></Card>
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
      />

      <TransferWindowBanner className="mb-5" />

      <Tabs defaultValue="rankings">
        <TabsList className="mb-5 h-10">
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
