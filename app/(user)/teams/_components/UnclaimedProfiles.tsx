"use client";

// ─────────────────────────────────────────────────────────────────────────────
// UnclaimedProfiles - browse and claim ghost teams / players, OFF the rankings ladder.
//
// WHY THIS EXISTS (owner 2026-08-24): "There is nowhere for teams to request to claim a player
// profile or team profile on the site, even searching for ghost teams doesn't bring them up", and
// then "you should be able to claim a team or player profile regardless of if it's on the rankings".
//
// Both were accurate. ClaimGhostDialog already existed and already handled BOTH kinds, but it was
// mounted only on /rankings, opened from a ghost ROW on the ladder. A ghost that is not on a ladder
// - which is most of them immediately after an import creates them - had no row, therefore no
// button, therefore no route to a claim. /teams never returned a ghost at all.
//
// So this is mostly wiring rather than new machinery: the same dialog, reached from a place that
// does not depend on the ladder, over a browse endpoint that lists unclaimed profiles when the
// search box is empty.
//
// CONNECTS TO:
//   - rankingsClaimApi.browseGhostTeams / browseGhostPlayers -> GET
//     leaderboards/standalone/search-ghost-teams|players/?browse=1&unclaimed_only=1
//   - <ClaimGhostDialog/> (app/(user)/rankings/_components), which POSTs the request-claim
//     endpoints. A team claim needs the user to run a team (owner/captain/manager); the backend
//     re-checks and 403s otherwise, and the dialog says so.
//   - Mounted as the "Unclaimed profiles" tab on app/(user)/teams/page.tsx.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { rankingsClaimApi } from "@/lib/rankings";
import {
  ClaimGhostDialog, type ClaimGhostTarget,
} from "@/app/(user)/rankings/_components/ClaimGhostDialog";

type GhostTeamRow = {
  ghost_team_id: string;
  team_name: string;
  country?: string;
  players_count?: number;
};

type GhostPlayerRow = {
  ghost_player_id: number;
  ign: string;
  ghost_team_name?: string | null;
};

export default function UnclaimedProfiles() {
  const t = useTranslations("teamsplayers.unclaimed");

  const [kind, setKind] = useState<"teams" | "players">("teams");
  const [query, setQuery] = useState("");
  const [teams, setTeams] = useState<GhostTeamRow[]>([]);
  const [players, setPlayers] = useState<GhostPlayerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [target, setTarget] = useState<ClaimGhostTarget | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      if (kind === "teams") {
        const d = await rankingsClaimApi.browseGhostTeams(query);
        setTeams(d.results);
      } else {
        const d = await rankingsClaimApi.browseGhostPlayers(query);
        setPlayers(d.results);
      }
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [kind, query]);

  // Debounced so typing does not fire a request per keystroke. 300ms is the house feel.
  useEffect(() => {
    const id = setTimeout(load, 300);
    return () => clearTimeout(id);
  }, [load]);

  const rows = kind === "teams" ? teams : players;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={kind} onValueChange={(v) => setKind(v as "teams" | "players")}>
          <TabsList>
            <TabsTrigger value="teams">{t("tabTeams")}</TabsTrigger>
            <TabsTrigger value="players">{t("tabPlayers")}</TabsTrigger>
          </TabsList>
        </Tabs>

        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={kind === "teams" ? t("searchTeams") : t("searchPlayers")}
        />

        {/* Loading, empty and error are all written states rather than a blank panel. */}
        {loading ? (
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-md" />
            ))}
          </div>
        ) : failed ? (
          <div className="rounded-md bg-muted/50 p-6 text-center">
            <p className="text-sm text-muted-foreground">{t("loadFailed")}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={load}>
              {t("retry")}
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-md bg-muted/50 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              {query ? t("noMatch", { q: query }) : t("empty")}
            </p>
          </div>
        ) : (
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {kind === "teams"
              ? teams.map((g) => (
                  <div key={g.ghost_team_id} className="rounded-md bg-muted/40 p-3">
                    <p className="text-sm font-semibold">{g.team_name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {g.country || t("countryUnknown")}
                      {typeof g.players_count === "number"
                        ? ` · ${t("playerCount", { count: g.players_count })}`
                        : null}
                    </p>
                    <Button
                      size="sm"
                      className="mt-2"
                      onClick={() =>
                        setTarget({ kind: "team", ghostId: g.ghost_team_id, ghostName: g.team_name })
                      }
                    >
                      {t("claimCta")}
                    </Button>
                  </div>
                ))
              : players.map((p) => (
                  <div key={p.ghost_player_id} className="rounded-md bg-muted/40 p-3">
                    <p className="text-sm font-semibold">{p.ign}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {p.ghost_team_name || t("noTeam")}
                    </p>
                    <Button
                      size="sm"
                      className="mt-2"
                      onClick={() =>
                        setTarget({ kind: "player", ghostId: p.ghost_player_id, ghostName: p.ign })
                      }
                    >
                      {t("claimCta")}
                    </Button>
                  </div>
                ))}
          </div>
        )}
      </CardContent>

      <ClaimGhostDialog
        target={target}
        onOpenChange={(open) => { if (!open) setTarget(null); }}
        onSubmitted={load}
      />
    </Card>
  );
}
