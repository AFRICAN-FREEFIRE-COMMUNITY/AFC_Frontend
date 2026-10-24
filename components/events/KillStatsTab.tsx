"use client";

// ─────────────────────────────────────────────────────────────────────────────
// KillStatsTab: the event page's "Kill stats" view (inbox #392). Built from the approved mockup
// mockups/kill-feed-tab/ with the owner's notes: the third party shown (#383), who killed and knocked
// who per fight and a player head to head (#384), knocks counted beside kills (#385).
//
// What it shows, for the whole event or one stage (chips):
//   * Sniper kills recorded: bolt-action kills whose weapon the game reported (the award's rule).
//   * Head to head: every team pair that fought, met / wins / draws / how often a third team came in.
//     A pair opens to who killed and knocked who between their players, then each fight: where and
//     when, who started it, who came in as the third party, players left, every kill and knock, result.
//   * Player head to head: pick a player, every opponent they met, kills and knocks each way.
//   * The CSV for the graphics team, when the event switched it on.
// Shown only when the event's kill_feed_tab switch is on (EventDetailsWrapper decides). Players left
// drops only on a finished kill; a knock is counted as a knock (owner answer 4 of #350, #385).
//
// Data: lib/killStats.ts -> AFC-B GET events/kill-stats/ (views_kill_feed.py); a pair's fights are
// fetched when it is opened. Strings: messages/{en,fr,pt}/killStats.json.
// ─────────────────────────────────────────────────────────────────────────────
import { Fragment, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { IconChevronRight, IconDownload } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader } from "@/components/Loader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumber } from "@/lib/i18n/number";
import { cn } from "@/lib/utils";
import { killStatsApi, type Duel, type KillStats, type PairFights } from "@/lib/killStats";

// Game seconds -> "mm:ss" (the in-game clock of the map, not a time of day).
const clock = (s: number) => {
  const total = Math.max(0, Math.round(s));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

// A pair's two numbers, the leader in green (the mockup's "2 - 0" with the winning side lit).
function Score({ a, b }: { a: number; b: number }) {
  return (
    <span className="tabular-nums">
      <span className={cn(a > b && "font-bold text-primary")}>{formatNumber(a)}</span>
      {" - "}
      <span className={cn(b > a && "font-bold text-primary")}>{formatNumber(b)}</span>
    </span>
  );
}

export function KillStatsTab({ slug, exportOn }: { slug: string; exportOn: boolean }) {
  const t = useTranslations("killStats");
  const [stage, setStage] = useState<number | null>(null);
  const [data, setData] = useState<KillStats | null>(null);
  const [failed, setFailed] = useState(false);
  const [openPair, setOpenPair] = useState<string | null>(null);
  const [pairs, setPairs] = useState<Record<string, PairFights | "loading" | "error">>({});
  const [picked, setPicked] = useState<string | null>(null);

  // ── the tab's answer, again when the stage chip changes ──
  useEffect(() => {
    let alive = true;
    setFailed(false);
    killStatsApi
      .get(slug, stage)
      .then((d) => alive && setData(d))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [slug, stage]);

  const nameOf = (uid: string) => data?.players[uid]?.name || uid;
  const teamOf = (id: number | string) => data?.teams[String(id)] || "";

  // ── a pair's fights, fetched the first time it is opened (per stage) ──
  const togglePair = (a: number, b: number) => {
    const key = `${stage ?? "all"}|${a}-${b}`;
    setOpenPair((cur) => (cur === key ? null : key));
    if (pairs[key] && pairs[key] !== "error") return;
    setPairs((p) => ({ ...p, [key]: "loading" }));
    killStatsApi
      .pair(slug, a, b, stage)
      .then((d) => setPairs((p) => ({ ...p, [key]: d })))
      .catch(() => setPairs((p) => ({ ...p, [key]: "error" })));
  };

  // ── player head to head: every player in a duel, then the picked player's opponents ──
  const playersInDuels = useMemo(() => {
    const ids = new Set<string>();
    data?.player_pairs.forEach(([a, b]) => ids.add(a).add(b));
    return [...ids].sort((x, y) => (data?.players[x]?.name || x).localeCompare(data?.players[y]?.name || y));
  }, [data]);
  const current = picked && playersInDuels.includes(picked) ? picked : playersInDuels[0] ?? null;
  const opponents = useMemo(() => {
    if (!data || !current) return [];
    return data.player_pairs
      .filter(([a, b]) => a === current || b === current)
      .map(([a, b, kab, kba, nab, nba]: Duel) =>
        a === current
          ? { uid: b, k: kab, x: kba, nk: nab, nx: nba }
          : { uid: a, k: kba, x: kab, nk: nba, nx: nab },
      );
  }, [data, current]);

  if (failed) return <p className="py-10 text-center text-sm text-muted-foreground">{t("loadError")}</p>;
  if (!data) return <Loader />;

  const nothing = data.coverage.kills === 0 && data.player_pairs.length === 0;

  return (
    <div className="mt-4 space-y-4">
      {/* ── stage chips + what share of kills carried a weapon ── */}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant={stage === null ? "default" : "outline"} className="text-xs" onClick={() => setStage(null)}>
          {t("allStages")}
        </Button>
        {data.stages.map((s) => (
          <Button
            key={s.id}
            size="sm"
            variant={stage === s.id ? "default" : "outline"}
            className="text-xs"
            onClick={() => setStage(s.id)}
          >
            {s.name}
          </Button>
        ))}
        {data.coverage.kills > 0 && (
          <span className="w-full text-xs text-muted-foreground sm:ml-auto sm:w-auto">
            {t("coverage", { known: data.coverage.kills_with_weapon, total: data.coverage.kills })}
          </span>
        )}
      </div>

      {nothing ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
            {/* ── sniper kills recorded ── */}
            <Card className="min-w-0">
              <CardContent>
                <h2 className="text-lg font-bold">{t("sniper.title")}</h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t("sniper.lead")}</p>
                {data.sniper.length === 0 ? (
                  <p className="mt-4 text-sm text-muted-foreground">{t("sniper.empty")}</p>
                ) : (
                  <Table className="mt-3">
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>{t("sniper.player")}</TableHead>
                        <TableHead>{t("sniper.team")}</TableHead>
                        <TableHead className="text-right">{t("sniper.kills")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.sniper.map((r, i) => (
                        <TableRow key={r.uid}>
                          <TableCell className={cn("text-muted-foreground", i === 0 && "font-bold text-gold")}>#{i + 1}</TableCell>
                          <TableCell className={cn("font-semibold", i === 0 && "text-gold")}>{r.username || r.uid}</TableCell>
                          <TableCell className="text-muted-foreground">{r.team_name}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(r.sniper_kills)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* ── team head to head; a pair opens to its players and its fights ── */}
            <Card className="min-w-0">
              <CardContent>
                <h2 className="text-lg font-bold">{t("h2h.title")}</h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t("h2h.lead")}</p>
                {data.head_to_head.length === 0 ? (
                  <p className="mt-4 text-sm text-muted-foreground">{t("h2h.empty")}</p>
                ) : (
                  <Table className="mt-3">
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("h2h.teams")}</TableHead>
                        <TableHead className="text-right">{t("h2h.met")}</TableHead>
                        <TableHead className="text-right">{t("h2h.wins")}</TableHead>
                        <TableHead className="text-right">{t("h2h.draws")}</TableHead>
                        {/* Wraps to two lines so the column fits a phone (the table still scrolls if a language needs it). */}
                        <TableHead className="w-16 whitespace-normal text-right leading-tight">{t("h2h.thirdParty")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.head_to_head.map((r) => {
                        const a = r.team_a.id;
                        const b = r.team_b.id;
                        const key = `${stage ?? "all"}|${a}-${b}`;
                        const open = openPair === key;
                        const detail = pairs[key];
                        return (
                          <Fragment key={key}>
                            <TableRow
                              role="button"
                              tabIndex={0}
                              aria-expanded={open}
                              className="cursor-pointer"
                              onClick={() => togglePair(a, b)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  togglePair(a, b);
                                }
                              }}
                            >
                              {/* Long team names wrap rather than push the table past a phone's width. */}
                              <TableCell className="whitespace-normal">
                                <IconChevronRight
                                  aria-hidden
                                  className={cn("mr-1 inline size-3.5 text-muted-foreground transition-transform motion-reduce:transition-none", open && "rotate-90")}
                                />
                                <span className={cn(r.wins_a > r.wins_b && "font-bold text-primary")}>{r.team_a.name}</span>
                                <span className="px-1 text-[11px] text-muted-foreground">v</span>
                                <span className={cn(r.wins_b > r.wins_a && "font-bold text-primary")}>{r.team_b.name}</span>
                              </TableCell>
                              <TableCell className="text-right tabular-nums">{formatNumber(r.met)}</TableCell>
                              <TableCell className="text-right"><Score a={r.wins_a} b={r.wins_b} /></TableCell>
                              <TableCell className="text-right tabular-nums">{formatNumber(r.draws)}</TableCell>
                              <TableCell className="text-right tabular-nums">{formatNumber(r.third_party)}</TableCell>
                            </TableRow>
                            {open && (
                              <TableRow className="hover:bg-transparent">
                                <TableCell colSpan={5} className="whitespace-normal bg-background/40 p-3">
                                  {detail === "loading" || !detail ? (
                                    <p className="text-xs text-muted-foreground">{t("fight.loading")}</p>
                                  ) : detail === "error" ? (
                                    <p className="text-xs text-muted-foreground">{t("loadError")}</p>
                                  ) : (
                                    <PairDetail detail={detail} a={a} b={b} nameOf={nameOf} teamOf={teamOf} />
                                  )}
                                </TableCell>
                              </TableRow>
                            )}
                          </Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── player head to head ── */}
          {playersInDuels.length > 0 && current && (
            <Card>
              <CardContent>
                <h2 className="text-lg font-bold">{t("players.title")}</h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t("players.lead")}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                  <span id="ks-player-label">{t("players.pick")}</span>
                  <Select value={current} onValueChange={setPicked}>
                    <SelectTrigger className="w-60 max-w-full" aria-labelledby="ks-player-label">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {playersInDuels.map((uid) => (
                        <SelectItem key={uid} value={uid}>
                          {nameOf(uid)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Table className="mt-3">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("players.opponent")}</TableHead>
                      <TableHead>{t("players.team")}</TableHead>
                      <TableHead className="text-right">{t("h2h.kills")}</TableHead>
                      <TableHead className="text-right">{t("h2h.knocks")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {opponents.map((o) => (
                      <TableRow key={o.uid}>
                        <TableCell className="font-semibold">{nameOf(o.uid)}</TableCell>
                        <TableCell className="text-muted-foreground">{teamOf(data.players[o.uid]?.team_id ?? "")}</TableCell>
                        <TableCell className="text-right"><Score a={o.k} b={o.x} /></TableCell>
                        <TableCell className="text-right"><Score a={o.nk} b={o.nx} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {exportOn && (
        <Button asChild variant="secondary">
          <a href={killStatsApi.csvUrl(slug, stage)} download>
            <IconDownload aria-hidden className="size-4" />
            {t("csv")}
          </a>
        </Button>
      )}
    </div>
  );
}

// ── one team pair opened: their players against each other, then each fight ──
function PairDetail({
  detail,
  a,
  b,
  nameOf,
  teamOf,
}: {
  detail: PairFights;
  a: number;
  b: number;
  nameOf: (uid: string) => string;
  teamOf: (id: number | string) => string;
}) {
  const t = useTranslations("killStats");
  // Each player's team in these fights, read from the fights' own events.
  const teamOfPlayer = new Map<string, number>();
  detail.fights.forEach((f) =>
    f.events.forEach(([, , killer, victim, killerTeam, victimTeam]) => {
      teamOfPlayer.set(killer, killerTeam);
      teamOfPlayer.set(victim, victimTeam);
    }),
  );
  // Duels with team a's player first, most meetings on top.
  const duels = detail.duels
    .map(([p, q, kpq, kqp, npq, nqp]) =>
      teamOfPlayer.get(p) === a
        ? { x: p, y: q, k: kpq, kk: kqp, n: npq, nn: nqp }
        : { x: q, y: p, k: kqp, kk: kpq, n: nqp, nn: npq },
    )
    .sort((u, v) => v.k + v.kk + v.n + v.nn - (u.k + u.kk + u.n + u.nn));

  return (
    <div className="space-y-4">
      {duels.length > 0 && (
        <div>
          <h3 className="text-xs font-bold">{t("h2h.whoTitle", { a: teamOf(a), b: teamOf(b) })}</h3>
          <Table className="mt-1">
            <TableHeader>
              <TableRow>
                <TableHead />
                <TableHead className="text-right">{t("h2h.kills")}</TableHead>
                <TableHead className="text-right">{t("h2h.knocks")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {duels.map((d) => (
                <TableRow key={`${d.x}-${d.y}`}>
                  <TableCell className="whitespace-nowrap">
                    <span className={cn(d.k > d.kk && "font-bold text-primary")}>{nameOf(d.x)}</span>
                    <span className="px-1 text-[11px] text-muted-foreground">v</span>
                    <span className={cn(d.kk > d.k && "font-bold text-primary")}>{nameOf(d.y)}</span>
                  </TableCell>
                  <TableCell className="text-right"><Score a={d.k} b={d.kk} /></TableCell>
                  <TableCell className="text-right"><Score a={d.n} b={d.nn} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div>
        <h3 className="text-xs font-bold">{t("h2h.eachFight")}</h3>
        <ol className="mt-1 space-y-3">
          {detail.fights.map((f, i) => (
            <li key={`${f.match_id}-${i}`} className="space-y-1 rounded-md bg-muted/40 p-3 text-xs">
              <p className="text-muted-foreground">
                {t("fight.where", {
                  stage: f.stage,
                  group: f.group,
                  number: f.match_number ?? "",
                  time: clock(f.start),
                })}
              </p>
              <p className="font-semibold">
                {t("fight.started", { a: teamOf(f.started_by[0]), b: teamOf(f.started_by[1]) })}
                {f.third_parties.map((team) => (
                  <span key={team} className="font-normal">
                    {", "}
                    {t("fight.cameIn", { team: teamOf(team) })}
                    <span className="ml-1 whitespace-nowrap rounded-full bg-gold/15 px-1.5 py-0.5 text-[11px] font-semibold text-gold">
                      {t("fight.thirdParty")}
                    </span>
                  </span>
                ))}
              </p>
              <p className="text-muted-foreground">
                {t("fight.left", {
                  list: Object.entries(f.left)
                    .map(([team, n]) => `${teamOf(team)} ${n}`)
                    .join(", "),
                })}
              </p>
              <ul className="space-y-0.5 text-muted-foreground">
                {f.events.map(([time, kind, killer, victim], j) => (
                  <li key={j}>
                    <span className="tabular-nums">{clock(time)}</span>{" "}
                    {t.rich(kind === "kill" ? "fight.killed" : "fight.knocked", {
                      killer: nameOf(killer),
                      victim: nameOf(victim),
                      b: (chunks) => <b className="font-semibold text-foreground">{chunks}</b>,
                    })}
                  </li>
                ))}
              </ul>
              <p>
                {t("fight.result", { a: teamOf(a), b: teamOf(b) })}{" "}
                {f.winner == null ? (
                  t("fight.draw")
                ) : (
                  <span className="font-bold text-primary">{t("fight.won", { team: teamOf(f.winner) })}</span>
                )}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
