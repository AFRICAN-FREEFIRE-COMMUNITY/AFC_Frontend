"use client";

import React, { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
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
  IconArrowsExchange, IconLock, IconClock,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

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

// Pretty date for the transfer-window close (e.g. "Aug 14, 2026, 6:00 PM"). Falls back gracefully.
function fmtDateTime(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  });
}

/**
 * Prominent, impossible-to-miss transfer-window banner. Lives directly under the page
 * header. Driven off the loaded season's transfer_window_is_open + transfer_window_close.
 * Matches the page's card idiom (rounded-md border) using the site's primary (green) /
 * destructive colors. Renders nothing until a season is loaded.
 */
function TransferWindowBanner({ season }: { season: SeasonFlags | null }) {
  if (!season) return null;
  const open = season.transfer_window_is_open === true;
  const closeStr = fmtDateTime(season.transfer_window_close);

  return (
    <div
      className={cn(
        "mb-5 flex items-center gap-3 rounded-md border px-4 py-3.5 sm:px-5",
        open
          ? "border-primary/50 bg-primary/10 text-foreground"
          : "border-destructive/50 bg-destructive/10 text-foreground",
      )}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full",
          open ? "bg-primary/20 text-primary" : "bg-destructive/20 text-destructive",
        )}
      >
        {open ? <IconArrowsExchange className="size-5" /> : <IconLock className="size-5" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-bold sm:text-base">
          <span className={open ? "text-primary" : "text-destructive"}>
            {open ? "🟢 Transfer window is OPEN" : "🔴 Transfer window is CLOSED"}
          </span>
          {open && closeStr && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground sm:text-sm">
              <IconClock className="size-3.5" /> closes {closeStr}
            </span>
          )}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
          {open
            ? "Roster moves are allowed right now."
            : "Roster moves are locked until the window reopens."}
        </p>
      </div>
      <Badge
        variant="outline"
        className={cn(
          "hidden shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold sm:inline-flex",
          open ? "border-primary/60 text-primary" : "border-destructive/60 text-destructive",
        )}
      >
        {open ? "OPEN" : "CLOSED"}
      </Badge>
    </div>
  );
}

// Empty state shown when a season's rankings/tiers haven't been published yet (Phase 2c gating).
function NotPublished({ seasonName, what }: { seasonName?: string; what: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <IconClock className="size-10 text-muted-foreground" />
      <p className="font-semibold">Not published yet</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        {what} for {seasonName ? <span className="text-foreground">{seasonName}</span> : "this season"} haven&apos;t
        been published yet — check back soon.
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

/* explainer */
function HowItWorks() {
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
          <IconInfoCircle className="mr-1 size-4" /> How it works
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-primary">How Rankings & Tiers work</DialogTitle>
          <DialogDescription>Two different things, built from the same match data.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Section icon={<IconChartBar className="size-5" />} title="Rankings = standings">
            A live leaderboard for <b>teams and players</b>, ordered by score. Monthly rankings reset on the
            1st. It answers “who&apos;s #1 right now.”
          </Section>
          <Section icon={<IconStairsUp className="size-5" />} title="Tiers = your team's grade">
            Each quarter, <b>teams</b> are graded into four tiers (players aren&apos;t tiered). It answers
            “which league is my team in.” A team&apos;s tier holds for the whole next quarter.
          </Section>
          <Separator />
          <div>
            <p className="mb-2 text-sm font-semibold">The four team tiers</p>
            <div className="space-y-1.5">
              {[0, 1, 2, 3].map((t) => (
                <div key={t} className="flex items-center gap-2 text-sm">
                  <TierBadge tier={t as 0 | 1 | 2 | 3} />
                  <span className="text-muted-foreground">{tierMeta[t].min}+ points</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              A team must play at least <b>2 tournaments</b> in the quarter to rank above Entry.
            </p>
          </div>
          <Separator />
          <div className="space-y-1.5 text-sm text-muted-foreground">
            <p className="text-sm font-semibold text-foreground">How points are earned</p>
            <p>• Kills and placements from every match (compressed, so more isn&apos;t infinitely better).</p>
            <p>• Bigger tournaments multiply your points (Tier 1 ×2, Tier 2 ×1.5, Tier 3 ×1).</p>
            <p>• Bonuses for tournament wins and reaching finals.</p>
            <p>• Quarterly only: prize money + social following (capped).</p>
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
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <IconSearch className="size-9 text-muted-foreground" />
      <p className="font-semibold">No matches for “{q}”</p>
      <p className="text-sm text-muted-foreground">Try a different name.</p>
    </div>
  );
}

/* RANKINGS (standings, teams & players) */
function RankingsView() {
  const [subject, setSubject] = useState<Subject>("teams");
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [month, setMonth] = useState("");
  // Season returned on the envelope — carries the rankings_published flag (Phase 2c gating).
  const [season, setSeason] = useState<SeasonFlags | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [q, setQ] = useState("");

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
  const rows = all.filter((r) =>
    (subject === "teams" ? r.team_name : r.username).toLowerCase().includes(q.toLowerCase()));
  const monthLabel = month ? new Date(month).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "This month";

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-sm text-muted-foreground">
          Live monthly standings, ordered by score · <span className="text-foreground">{monthLabel}</span>
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchBar value={q} onChange={setQ} placeholder={subject === "teams" ? "Search teams" : "Search players"} />
          <Tabs value={subject} onValueChange={(v) => { setSubject(v as Subject); setQ(""); }}>
            <TabsList>
              <TabsTrigger value="teams"><IconUsers className="mr-1 size-3.5" /> Teams</TabsTrigger>
              <TabsTrigger value="players"><IconTrophy className="mr-1 size-3.5" /> Players</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <Card>
        <CardContent>
          {loading ? (
            <div className="py-16"><FullLoader text="Loading standings" /></div>
          ) : all.length === 0 && season && season.rankings_published === false ? (
            <NotPublished seasonName={season.name} what="Rankings" />
          ) : all.length === 0 ? (
            <Empty period="monthly" />
          ) : rows.length === 0 ? (
            <NoMatch q={q} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Rank</TableHead>
                  <TableHead>{subject === "teams" ? "Team" : "Player"}</TableHead>
                  {subject === "teams" ? (
                    <>
                      <TableHead className="text-right">Wins</TableHead>
                      <TableHead className="text-right">Kills</TableHead>
                    </>
                  ) : (
                    <>
                      <TableHead className="text-right">Kills</TableHead>
                      <TableHead className="text-right">MVPs</TableHead>
                    </>
                  )}
                  <TableHead className="text-right">Score</TableHead>
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
                        <TableCell className="font-medium">{name}</TableCell>
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
                                  <StatTile label="Tournament" value={(r.tournament_pts ?? 0).toFixed(1)} />
                                  <StatTile label="Scrims" value={(r.scrim_pts ?? 0).toFixed(1)} />
                                  <StatTile label="Tournaments" value={r.tournaments_played ?? 0} />
                                </>
                              ) : (
                                <>
                                  <StatTile label="Kills" value={(r.kill_pts ?? 0).toFixed(1)} />
                                  <StatTile label="MVP" value={(r.mvp_pts ?? 0).toFixed(1)} />
                                  <StatTile label="Finals" value={(r.finals_pts ?? 0).toFixed(1)} />
                                  <StatTile label="Team Win" value={(r.team_win_pts ?? 0).toFixed(1)} />
                                  <StatTile label="Participation" value={(r.participation_pts ?? 0).toFixed(1)} />
                                  <StatTile label="Scrims" value={(r.scrim_pts ?? 0).toFixed(1)} />
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
    </div>
  );
}

/* TIERS (teams only, expandable bands) */
function TierTeamRow({ row, elite }: { row: any; elite?: boolean }) {
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
        {!row.meets_participation_floor && (
          <Badge variant="outline" className="rounded-full text-[10px] text-muted-foreground">
            {row.tournaments_played ?? 0}/2 tournaments
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
          <StatTile label="Total kills" value={row.kills ?? 0} />
          <StatTile label="Tournament pts" value={(row.tournament_pts ?? 0).toFixed(1)} />
          <StatTile label="Scrim pts" value={(row.scrim_pts ?? 0).toFixed(1)} />
          <StatTile label="Prize pts" value={(row.prize_money_pts ?? 0).toFixed(1)} />
          <StatTile label="Social pts" value={(row.social_media_pts ?? 0).toFixed(1)} />
          <StatTile label="Wins" value={row.wins ?? 0} />
          <StatTile label="Tournaments" value={row.tournaments_played ?? 0} />
          <StatTile label="Total score" value={(row.total_score ?? 0).toFixed(1)} />
        </div>
      )}
    </div>
  );
}

function TierSection({ tier, rows, searching }: { tier: 0 | 1 | 2 | 3; rows: any[]; searching: boolean }) {
  const elite = tier === 0;
  if (!rows.length && (tier !== 0 || searching)) return null;
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        {elite && <IconCrown className="size-4 text-amber-400" />}
        <TierBadge tier={tier} />
        <span className="text-xs text-muted-foreground">{rows.length} {rows.length === 1 ? "team" : "teams"}</span>
        <span className="ml-auto text-[11px] text-muted-foreground">{tierMeta[tier].min}+ pts</span>
      </div>
      {rows.length === 0 ? (
        <Card className={cn(elite && "border-amber-500/40")}>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            No teams have reached Elite this season yet.
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

function TiersView() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [seasonId, setSeasonId] = useState<number | undefined>(undefined);
  const [q, setQ] = useState("");
  const [teams, setTeams] = useState<TeamRow[]>([]);
  // Season returned on the quarterly envelope — carries rankings_published + tiers_published.
  const [season, setSeason] = useState<SeasonFlags | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    rankingsApi.seasons().then((r) => {
      setSeasons(r.results);
      const active = r.results.find((s) => s.is_active) ?? r.results[0];
      setSeasonId(active?.season_id);
    }).catch(() => {});
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
      .filter((r) => r.team_name.toLowerCase().includes(q.toLowerCase()))
      .forEach((r) => { if (r.tier != null) g[r.tier].push(r); });
    return g;
  }, [teams, q]);
  const filteredTotal = byTier[0].length + byTier[1].length + byTier[2].length + byTier[3].length;
  const searching = q.trim().length > 0;

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <p className="max-w-xl text-sm text-muted-foreground">
          Team grade for the season. Only teams are tiered. Reach the top to become{" "}
          <span className="font-semibold text-amber-400">Elite</span>. Tap a team for its full breakdown.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchBar value={q} onChange={setQ} placeholder="Search teams" />
          <Select value={seasonId ? String(seasonId) : undefined} onValueChange={(v) => setSeasonId(Number(v))}>
            <SelectTrigger className="h-9 w-[170px]"><SelectValue placeholder="Season" /></SelectTrigger>
            <SelectContent>
              {seasons.map((s) => (
                <SelectItem key={s.season_id} value={String(s.season_id)}>
                  {s.name}{s.is_active ? " · current" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {tiersHidden && (
        // Rankings are published but tiers aren't graded/published yet — say so instead of
        // dropping every (null-tier) team and showing a misleading empty state.
        <div className="mb-4 flex items-center gap-2 rounded-md border border-dashed bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          <IconClock className="size-4 shrink-0" />
          Tiers coming soon — team grades for{" "}
          <span className="font-medium text-foreground">{season?.name ?? "this season"}</span> haven&apos;t been
          published yet.
        </div>
      )}

      {loading ? (
        <Card><CardContent><div className="py-16"><FullLoader text="Loading tiers" /></div></CardContent></Card>
      ) : teams.length === 0 && season?.rankings_published === false ? (
        <Card><CardContent><NotPublished seasonName={season?.name} what="Rankings" /></CardContent></Card>
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
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <IconMoodEmpty className="size-10 text-muted-foreground" />
      <p className="font-semibold">Nothing here yet</p>
      <p className="text-sm text-muted-foreground">Standings appear once {period} results are recorded.</p>
    </div>
  );
}

/* page */
export default function RankingsPage() {
  // Current season drives the prominent transfer-window banner (Phase 2c runtime flags).
  const [season, setSeason] = useState<SeasonFlags | null>(null);

  useEffect(() => {
    rankingsApi.currentSeason()
      .then((s) => setSeason((s as SeasonFlags) ?? null))
      .catch(() => {});
  }, []);

  return (
    <div>
      <PageHeader
        title="Rankings & Tiers"
        description="Two views of AFC performance: live standings, and seasonal team tiers."
        action={<HowItWorks />}
      />

      <TransferWindowBanner season={season} />

      <Tabs defaultValue="rankings">
        <TabsList className="mb-5 h-10">
          <TabsTrigger value="rankings" className="text-sm">
            <IconChartBar className="mr-1.5 size-4" /> Rankings
          </TabsTrigger>
          <TabsTrigger value="tiers" className="text-sm">
            <IconStairsUp className="mr-1.5 size-4" /> Tiers
          </TabsTrigger>
        </TabsList>
        <TabsContent value="rankings"><RankingsView /></TabsContent>
        <TabsContent value="tiers"><TiersView /></TabsContent>
      </Tabs>
    </div>
  );
}
