"use client";

// ── BoardStatsPanel (owner 2026-11-11, inbox #538 #539 #540) ──────────────────────────────────────────
// The "Stats" tab of the event leaderboard pages: every number the site holds for a group, for teams AND
// players, over the whole group, one map, or any maps picked, plus the map being played right now.
// Owner's words: "damage still doesnt show for each individual player per map and per roup, it only shows for
// total"; "export the leaderboard for not only a grop, but also each map or specific maps in a group that were
// played"; "all other data should be visible in that leaderboard section"; the live overlays and AFC LIVE
// "should pull theri data from what it coimputes".
//
// DATA: GET events/<eventId>/board/?group_id=&match_ids=  (AFC-B views_board.event_board): groups + maps,
//   teams (board.team_board), players (board.player_board, players missing from the roster included),
//   live (board.live_group_table: the official table with the map in progress added; whole group only).
//   GET events/<eventId>/board/export/?group_id=&match_ids=&kind=teams|players -> the same rows as CSV.
// The live part is the SAME table the site's live overlay and AFC LIVE show (one server computation), so what
// an organizer reads here is what is on air. Refreshes every 5 s while a map is live, every 20 s otherwise,
// only while the tab is visible.
// MOUNTED BY: app/(a)/a/leaderboards/[id]/edit/page.tsx and app/(organizer)/organizer/events/[slug]/leaderboard.
// i18n: messages/<locale>/boardStats.json (en, fr, pt by hand).

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { IconDownload, IconLoader2, IconRefresh } from "@tabler/icons-react";

import { env } from "@/lib/env";
import { readJson } from "@/lib/readJson";
import { formatNumber } from "@/lib/i18n/number";
import { useServerMessage } from "@/lib/i18n/serverMessage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NewBadge } from "@/components/NewBadge";

type MapSlot = { match_id: number; match_number: number; map: string; scored: boolean };
type GroupOpt = { group_id: number; group_name: string; stage_id: number; stage_name: string; maps: MapSlot[] };
type TeamRow = {
  rank: number; team_name: string; games_played: number; booyahs: number; kills: number;
  placement_points: number; kill_points: number; bonus: number; penalty: number; total: number; damage: number;
  assists: number; knockdowns: number; knocked: number; headshots: number; deaths: number; revives_received: number;
  grenades_used: number; grenade_kills: number; gloowall_used: number; medkit_used: number; survival_seconds: number;
  most_used_weapon: string;
};
type PlayerRow = {
  key: string; rank: number; in_game_name: string; uid: string; team_name: string; registered: boolean;
  pending: boolean; matches: number; kills: number; damage: number; assists: number; knockdowns: number;
  knocked: number; headshots: number; deaths: number; kdr: number; revives_received: number; grenades_used: number;
  grenade_kills: number; gloowall_used: number; medkit_used: number; survival_seconds: number; most_used_weapon: string;
};
type LivePart = { placement: number; kills: number; points: number; alive_count: number; roster_size: number; eliminated: boolean };
type LiveRow = { rank: number; team_name: string; total: number; kills: number; live: LivePart | null; total_with_live: number; kills_with_live: number };
type LiveKiller = { rank: number; name: string; team_name: string; kills: number; live_kills: number; kills_with_live: number };
type Board = {
  groups: GroupOpt[];
  scope: { group_id: number; match_ids: number[]; all_maps: boolean };
  teams: TeamRow[];
  players: PlayerRow[];
  live: null | {
    map_number: number; teams_alive: number; unmatched: string[]; standings: LiveRow[]; top_killers: LiveKiller[];
    map_mvp?: { name: string; team_name: string; kills: number; assists: number } | null;
  };
};

// Survival time as m:ss (game seconds).
function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const NUM = "p-2 text-center tabular-nums";
const HEAD = "text-foreground h-10 p-2 whitespace-nowrap";

export default function BoardStatsPanel({
  eventId,
  token,
  initialGroupId,
}: {
  eventId: number | string;
  token?: string;
  initialGroupId?: number | null;
}) {
  const t = useTranslations("boardStats");
  const serverMessage = useServerMessage();
  const [groupId, setGroupId] = useState<number | null>(initialGroupId ?? null);
  const [picked, setPicked] = useState<number[]>([]);           // [] = all maps of the group
  const [board, setBoard] = useState<Board | null>(null);
  const [groups, setGroups] = useState<GroupOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [downloading, setDownloading] = useState<"" | "teams" | "players" | "graphic">("");

  const api = `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/${eventId}/board`;
  const auth = useMemo(() => ({ Authorization: `Bearer ${token ?? ""}` }), [token]);
  const query = useCallback(
    (gid: number) => {
      const p = new URLSearchParams({ group_id: String(gid) });
      if (picked.length) p.set("match_ids", picked.join(","));
      return p;
    },
    [picked],
  );

  // With no group chosen yet the server answers the event's groups and maps only; the panel then takes the
  // page's group if it is one of them, else the latest group that has a result, else the first group.
  const load = useCallback(
    async (background = false) => {
      if (!background) setLoading(true);
      try {
        const gid = groupId;
        if (gid == null) {
          const first = await fetch(`${api}/`, { headers: auth });
          const fdata = await readJson(first);
          if (!first.ok) throw new Error(serverMessage(fdata, t("errors.load")));
          const list: GroupOpt[] = fdata.groups ?? [];
          setGroups(list);
          const withResult = [...list].reverse().find((g) => g.maps.some((m) => m.scored));
          const chosen = list.find((g) => g.group_id === initialGroupId) ?? withResult ?? list[0];
          if (chosen) setGroupId(chosen.group_id);   // the effect below loads that group
          setError("");
          return;
        }
        const res = await fetch(`${api}/?${query(gid)}`, { headers: auth });
        const data = await readJson(res);
        if (!res.ok) throw new Error(serverMessage(data, t("errors.load")));
        setBoard(data as Board);
        setGroups((data as Board).groups ?? []);
        setError("");
      } catch (e: any) {
        if (!background) setError(e?.message || t("errors.load"));
      } finally {
        if (!background) setLoading(false);
      }
    },
    [api, auth, groupId, initialGroupId, query, serverMessage, t],
  );

  useEffect(() => {
    load(false);
  }, [load]);

  // Refresh: every 5 s while a map is live, every 20 s otherwise; only while the page is visible.
  const live = board?.live ?? null;
  useEffect(() => {
    const every = live ? 5000 : 20000;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") load(true);
    }, every);
    return () => clearInterval(id);
  }, [live, load]);

  const group = groups.find((g) => g.group_id === groupId) ?? null;
  const scoredMaps = (group?.maps ?? []).filter((m) => m.scored);
  const toggleMap = (id: number) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id].sort((a, b) => a - b)));

  const download = async (kind: "teams" | "players") => {
    if (groupId == null) return;
    setDownloading(kind);
    try {
      const p = query(groupId);
      p.set("kind", kind);
      const res = await fetch(`${api}/export/?${p}`, { headers: auth });
      if (!res.ok) throw new Error(serverMessage(await readJson(res), t("errors.download")));
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") || "")?.[1] || `${kind}.csv`;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e: any) {
      setError(e?.message || t("errors.download"));
    } finally {
      setDownloading("");
    }
  };

  // The leaderboard GRAPHIC for the same scope (AFC-B views_event_graphic, ?match_ids= since inbox #539): the
  // event's own design, one map or the maps picked or the whole group, as a PNG (a ZIP when it has pages).
  const downloadGraphic = async () => {
    if (groupId == null || !group) return;
    setDownloading("graphic");
    try {
      const p = new URLSearchParams({ group_id: String(groupId) });
      const mapNames = scoredMaps.filter((m) => picked.includes(m.match_id)).map((m) => t("mapN", { n: m.match_number }));
      if (picked.length) p.set("match_ids", picked.join(","));
      // The subtitle says what the board covers: the group, and the maps when only some are picked.
      p.set("subtitle", [group.stage_name, group.group_name, mapNames.join(", ")].filter(Boolean).join(" · "));
      const res = await fetch(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/${eventId}/stages/${group.stage_id}/graphic/?${p}`,
        { headers: auth },
      );
      if (!res.ok) throw new Error(serverMessage(await readJson(res), t("errors.download")));
      const blob = await res.blob();
      const which = picked.length
        ? scoredMaps.filter((m) => picked.includes(m.match_id)).map((m) => `map${m.match_number}`).join("-")
        : "all-maps";
      const ext = blob.type.includes("zip") ? "zip" : "png";
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${group.stage_name}-${group.group_name}-${which}.${ext}`.replace(/[^\w.-]+/g, "-");
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e: any) {
      setError(e?.message || t("errors.download"));
    } finally {
      setDownloading("");
    }
  };

  const players = (board?.players ?? []).filter((p) => {
    const q = search.trim().toLowerCase();
    return !q || p.in_game_name.toLowerCase().includes(q) || p.team_name.toLowerCase().includes(q) || p.uid.includes(q);
  });

  return (
    <div className="space-y-4">
      {/* ── scope: group + maps ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            {t("title")}
            <NewBadge since="2026-11-12" />
          </CardTitle>
          <p className="text-muted-foreground text-xs">{t("intro")}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={groupId != null ? String(groupId) : undefined}
              onValueChange={(v) => {
                setGroupId(Number(v));
                setPicked([]);
              }}
            >
              <SelectTrigger className="h-9 w-full sm:w-72" aria-label={t("group")}>
                <SelectValue placeholder={t("pickGroup")} />
              </SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  <SelectItem key={g.group_id} value={String(g.group_id)}>
                    {g.stage_name} · {g.group_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" onClick={() => load(false)} aria-label={t("refresh")}>
              <IconRefresh className="size-4" aria-hidden />
            </Button>
          </div>
          {group ? (
            <div className="flex flex-wrap gap-2" role="group" aria-label={t("maps")}>
              {/* filled chips, never outlined (design rule); the picked ones take the primary fill */}
              <button
                type="button"
                onClick={() => setPicked([])}
                aria-pressed={picked.length === 0}
                className={`min-h-9 rounded-full px-3 text-xs font-medium ${picked.length === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}
              >
                {t("allMaps")}
              </button>
              {scoredMaps.map((m) => {
                const on = picked.includes(m.match_id);
                return (
                  <button
                    key={m.match_id}
                    type="button"
                    onClick={() => toggleMap(m.match_id)}
                    aria-pressed={on}
                    className={`min-h-9 rounded-full px-3 text-xs font-medium ${on ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}
                  >
                    {t("mapN", { n: m.match_number })}
                    {m.map ? <span className="opacity-70"> · {m.map}</span> : null}
                  </button>
                );
              })}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" disabled={!board || !!downloading} onClick={() => download("teams")}>
              {downloading === "teams" ? <IconLoader2 className="size-4 animate-spin" aria-hidden /> : <IconDownload className="size-4" aria-hidden />}
              {t("downloadTeams")}
            </Button>
            <Button size="sm" variant="secondary" disabled={!board || !!downloading} onClick={() => download("players")}>
              {downloading === "players" ? <IconLoader2 className="size-4 animate-spin" aria-hidden /> : <IconDownload className="size-4" aria-hidden />}
              {t("downloadPlayers")}
            </Button>
            <Button size="sm" variant="secondary" disabled={!board || !!downloading} onClick={downloadGraphic}>
              {downloading === "graphic" ? <IconLoader2 className="size-4 animate-spin" aria-hidden /> : <IconDownload className="size-4" aria-hidden />}
              {t("downloadGraphic")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-2 py-4 text-sm">
            <span className="text-destructive">{error}</span>
            <Button size="sm" variant="secondary" onClick={() => load(false)}>{t("retry")}</Button>
          </CardContent>
        </Card>
      ) : null}

      {groupId == null ? (
        <p className="text-muted-foreground py-8 text-center text-sm">
          {loading ? t("loading") : groups.length ? t("pickGroupFirst") : t("noGroups")}
        </p>
      ) : loading && !board ? (
        <div className="space-y-2" aria-busy="true" aria-label={t("loading")}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-muted/40 h-9 rounded-md" />
          ))}
        </div>
      ) : board ? (
        <>
          {/* ── the map being played right now: the same table the live overlay and AFC LIVE show ── */}
          {live ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                  <span className="bg-primary inline-block size-2 rounded-full" aria-hidden />
                  {t("live.title", { n: live.map_number })}
                  <Badge variant="outline" className="rounded-full px-2 py-0.5 text-xs text-primary">
                    {t("live.alive", { count: live.teams_alive })}
                  </Badge>
                </CardTitle>
                <p className="text-muted-foreground text-xs">{t("live.intro")}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="overflow-x-auto rounded-md">
                  <Table className="text-xs">
                    <TableHeader>
                      <TableRow>
                        <TableHead className={HEAD}>#</TableHead>
                        <TableHead className={HEAD}>{t("col.team")}</TableHead>
                        <TableHead className={`${HEAD} text-center`}>{t("live.before")}</TableHead>
                        <TableHead className={`${HEAD} text-center`}>{t("live.thisMap")}</TableHead>
                        <TableHead className={`${HEAD} text-center`}>{t("live.now")}</TableHead>
                        <TableHead className={`${HEAD} text-center`}>{t("col.kills")}</TableHead>
                        <TableHead className={`${HEAD} text-center`}>{t("live.status")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {live.standings.map((r) => (
                        <TableRow key={`${r.rank}-${r.team_name}`}>
                          <TableCell className="p-2 font-bold">#{r.rank}</TableCell>
                          <TableCell className="p-2 whitespace-nowrap">{r.team_name}</TableCell>
                          <TableCell className={NUM}>{formatNumber(r.total)}</TableCell>
                          <TableCell className={NUM}>{r.live ? `+${formatNumber(r.live.points)}` : "-"}</TableCell>
                          <TableCell className={`${NUM} font-bold`}>{formatNumber(r.total_with_live)}</TableCell>
                          <TableCell className={NUM}>{formatNumber(r.kills_with_live)}</TableCell>
                          <TableCell className={`${NUM} whitespace-nowrap`}>
                            {!r.live ? t("live.notInMap") : r.live.eliminated ? t("live.out") : t("live.aliveOf", { alive: r.live.alive_count, of: r.live.roster_size || r.live.alive_count })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {live.top_killers?.length ? (
                  <div>
                    <p className="mb-2 text-sm font-semibold">{t("live.killers")}</p>
                    <ol className="grid gap-1 text-xs sm:grid-cols-2">
                      {live.top_killers.slice(0, 10).map((k) => (
                        <li key={`${k.rank}-${k.name}`} className="bg-muted/40 flex items-center justify-between gap-2 rounded-md px-3 py-2">
                          <span className="truncate">#{k.rank} {k.name} <span className="text-muted-foreground">{k.team_name}</span></span>
                          <span className="tabular-nums font-bold">
                            {formatNumber(k.kills_with_live)}
                            {k.live_kills ? <span className="text-primary"> (+{k.live_kills})</span> : null}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : null}
                {live.map_mvp ? (
                  <p className="text-xs">
                    <span className="font-semibold">{t("live.mapMvp")}</span>{" "}
                    {live.map_mvp.name} <span className="text-muted-foreground">{live.map_mvp.team_name}</span>{" "}
                    <span className="tabular-nums">{t("live.mvpKills", { count: live.map_mvp.kills })}</span>
                  </p>
                ) : null}
                {live.unmatched?.length ? (
                  <p className="text-muted-foreground text-xs">{t("live.unmatched", { names: live.unmatched.join(", ") })}</p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          <Tabs defaultValue="teams">
            <TabsList className="h-9">
              <TabsTrigger value="teams">{t("tabs.teams", { count: board.teams.length })}</TabsTrigger>
              <TabsTrigger value="players">{t("tabs.players", { count: board.players.length })}</TabsTrigger>
            </TabsList>

            <TabsContent value="teams" className="mt-3">
              {board.teams.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center text-sm">{t("empty")}</p>
              ) : (
                <div className="overflow-x-auto rounded-md bg-muted/20">
                  <Table className="text-xs">
                    <TableHeader>
                      <TableRow>
                        <TableHead className={HEAD}>#</TableHead>
                        <TableHead className={HEAD}>{t("col.team")}</TableHead>
                        <TableHead className={`${HEAD} text-center`}>{t("col.maps")}</TableHead>
                        <TableHead className={`${HEAD} text-center`}>{t("col.booyahs")}</TableHead>
                        <TableHead className={`${HEAD} text-center`}>{t("col.kills")}</TableHead>
                        <TableHead className={`${HEAD} text-center`}>{t("col.placePts")}</TableHead>
                        <TableHead className={`${HEAD} text-center`}>{t("col.killPts")}</TableHead>
                        <TableHead className={`${HEAD} text-center`}>{t("col.total")}</TableHead>
                        <TableHead className={`${HEAD} text-center`}>{t("col.damage")}</TableHead>
                        <TableHead className={`${HEAD} text-center`}>{t("col.assists")}</TableHead>
                        <TableHead className={`${HEAD} text-center`}>{t("col.knockdowns")}</TableHead>
                        <TableHead className={`${HEAD} text-center`}>{t("col.headshots")}</TableHead>
                        <TableHead className={`${HEAD} text-center`}>{t("col.revives")}</TableHead>
                        <TableHead className={`${HEAD} text-center`}>{t("col.gloo")}</TableHead>
                        <TableHead className={`${HEAD} text-center`}>{t("col.grenades")}</TableHead>
                        <TableHead className={`${HEAD} text-center`}>{t("col.medkits")}</TableHead>
                        <TableHead className={`${HEAD} text-center`}>{t("col.survival")}</TableHead>
                        <TableHead className={HEAD}>{t("col.gun")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {board.teams.map((r) => (
                        <TableRow key={`${r.rank}-${r.team_name}`}>
                          <TableCell className="p-2 font-bold">#{r.rank}</TableCell>
                          <TableCell className="p-2 whitespace-nowrap">{r.team_name}</TableCell>
                          <TableCell className={NUM}>{r.games_played}</TableCell>
                          <TableCell className={NUM}>{r.booyahs}</TableCell>
                          <TableCell className={NUM}>{formatNumber(r.kills)}</TableCell>
                          <TableCell className={NUM}>{formatNumber(r.placement_points)}</TableCell>
                          <TableCell className={NUM}>{formatNumber(r.kill_points)}</TableCell>
                          <TableCell className={`${NUM} font-bold`}>{formatNumber(r.total)}</TableCell>
                          <TableCell className={NUM}>{formatNumber(r.damage)}</TableCell>
                          <TableCell className={NUM}>{formatNumber(r.assists)}</TableCell>
                          <TableCell className={NUM}>{formatNumber(r.knockdowns)}</TableCell>
                          <TableCell className={NUM}>{formatNumber(r.headshots)}</TableCell>
                          <TableCell className={NUM}>{formatNumber(r.revives_received)}</TableCell>
                          <TableCell className={NUM}>{formatNumber(r.gloowall_used)}</TableCell>
                          <TableCell className={NUM}>{formatNumber(r.grenades_used)}</TableCell>
                          <TableCell className={NUM}>{formatNumber(r.medkit_used)}</TableCell>
                          <TableCell className={NUM}>{clock(r.survival_seconds)}</TableCell>
                          <TableCell className="p-2 whitespace-nowrap">{r.most_used_weapon || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="players" className="mt-3 space-y-3">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("search")}
                aria-label={t("search")}
                className="h-9 w-full sm:w-72"
              />
              {players.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center text-sm">{search ? t("noMatch") : t("empty")}</p>
              ) : (
                <div className="overflow-x-auto rounded-md bg-muted/20">
                  <Table className="text-xs">
                    <TableHeader>
                      <TableRow>
                        <TableHead className={HEAD}>#</TableHead>
                        <TableHead className={HEAD}>{t("col.player")}</TableHead>
                        <TableHead className={HEAD}>{t("col.team")}</TableHead>
                        <TableHead className={`${HEAD} text-center`}>{t("col.maps")}</TableHead>
                        <TableHead className={`${HEAD} text-center`}>{t("col.kills")}</TableHead>
                        <TableHead className={`${HEAD} text-center`}>{t("col.damage")}</TableHead>
                        <TableHead className={`${HEAD} text-center`}>{t("col.assists")}</TableHead>
                        <TableHead className={`${HEAD} text-center`}>{t("col.knockdowns")}</TableHead>
                        <TableHead className={`${HEAD} text-center`}>{t("col.knocked")}</TableHead>
                        <TableHead className={`${HEAD} text-center`}>{t("col.headshots")}</TableHead>
                        <TableHead className={`${HEAD} text-center`}>{t("col.deaths")}</TableHead>
                        <TableHead className={`${HEAD} text-center`}>{t("col.kd")}</TableHead>
                        <TableHead className={`${HEAD} text-center`}>{t("col.revives")}</TableHead>
                        <TableHead className={`${HEAD} text-center`}>{t("col.gloo")}</TableHead>
                        <TableHead className={`${HEAD} text-center`}>{t("col.grenades")}</TableHead>
                        <TableHead className={`${HEAD} text-center`}>{t("col.medkits")}</TableHead>
                        <TableHead className={`${HEAD} text-center`}>{t("col.survival")}</TableHead>
                        <TableHead className={HEAD}>{t("col.gun")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {players.map((p) => (
                        <TableRow key={p.key}>
                          <TableCell className="p-2 font-bold">#{p.rank}</TableCell>
                          <TableCell className="p-2 whitespace-nowrap">
                            {p.in_game_name}
                            {!p.registered ? (
                              <Badge variant="outline" className="ml-2 rounded-full px-2 py-0.5 text-xs text-gold" title={t("notOnRosterWhy", { uid: p.uid })}>
                                {t("notOnRoster")}
                              </Badge>
                            ) : p.pending ? (
                              <Badge variant="outline" className="ml-2 rounded-full px-2 py-0.5 text-xs text-blue-400" title={t("pendingWhy")}>
                                {t("pending")}
                              </Badge>
                            ) : null}
                          </TableCell>
                          <TableCell className="p-2 whitespace-nowrap">{p.team_name || "-"}</TableCell>
                          <TableCell className={NUM}>{p.matches}</TableCell>
                          <TableCell className={`${NUM} font-bold`}>{formatNumber(p.kills)}</TableCell>
                          <TableCell className={NUM}>{formatNumber(p.damage)}</TableCell>
                          <TableCell className={NUM}>{formatNumber(p.assists)}</TableCell>
                          <TableCell className={NUM}>{formatNumber(p.knockdowns)}</TableCell>
                          <TableCell className={NUM}>{formatNumber(p.knocked)}</TableCell>
                          <TableCell className={NUM}>{formatNumber(p.headshots)}</TableCell>
                          <TableCell className={NUM}>{formatNumber(p.deaths)}</TableCell>
                          <TableCell className={NUM}>{formatNumber(p.kdr)}</TableCell>
                          <TableCell className={NUM}>{formatNumber(p.revives_received)}</TableCell>
                          <TableCell className={NUM}>{formatNumber(p.gloowall_used)}</TableCell>
                          <TableCell className={NUM}>{formatNumber(p.grenades_used)}</TableCell>
                          <TableCell className={NUM}>{formatNumber(p.medkit_used)}</TableCell>
                          <TableCell className={NUM}>{clock(p.survival_seconds)}</TableCell>
                          <TableCell className="p-2 whitespace-nowrap">{p.most_used_weapon || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
          <p className="text-muted-foreground text-xs">
            {board.scope.all_maps ? t("scope.all", { count: board.scope.match_ids.length }) : t("scope.some", { count: board.scope.match_ids.length })}
          </p>
        </>
      ) : null}
    </div>
  );
}
