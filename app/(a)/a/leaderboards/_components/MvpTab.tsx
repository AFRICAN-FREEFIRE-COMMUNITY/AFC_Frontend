"use client";

// ── MvpTab (owner 2026-07-02) ────────────────────────────────────────────────
// The "MVPs" tab on the event leaderboard edit page. The admin arranges CRITERIA exactly like
// tie-breakers (kills, damage, assists, deaths, survival time, headshots, KDR — reorder with
// up/down): players are compared on the 1st criterion, ties fall through to the 2nd, and so on.
// Scope picks the candidate pool: the OVERALL event, or only the WINNING TEAM's players.
// Criteria whose data isn't stored yet (deaths / survival / headshots / KDR — they arrive with the
// 3D-room debugger ingest) are shown tagged "needs live 3D-room data" and don't rank until then.
//
// CONNECTS TO: GET/POST events/<event_id>/mvp/ (afc_tournament_and_scrims/views_mvp.py). GET
// computes with the event's saved Event.mvp_config; POST saves {criteria, scope} then returns the
// recomputed ranking, so "Save & recompute" is one round trip. Mounted by
// app/(a)/a/leaderboards/[id]/edit/page.tsx (TabsContent value="mvp"). Admin surface — English.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import Cookies from "js-cookie";
// Live refresh (owner 2026-07-02): site-wide heartbeat; re-pulls the read-only ranking.
import { useLiveTick } from "@/hooks/useLiveTick";
// Scope (whole event / combine selected stages+groups) + "Download through a design" bar, shared with
// the Top Killers tab (owner 2026-07-05, complaint G): lets the MVP be COMBINED across selected
// groups/stages and exported as a PNG. Reuses the leaderboard combine path. See PlayerBoardControls.
import { PlayerBoardControls } from "./PlayerBoardControls";

import { env } from "@/lib/env";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  IconArrowDown,
  IconArrowUp,
  IconCrown,
  IconLoader2,
  IconTrophy,
} from "@tabler/icons-react";

interface CriterionMeta {
  key: string;
  label: string;
  available: boolean;
}

interface MvpPlayer {
  user_id: number;
  username: string;
  in_game_name: string;
  team_name: string | null;
  esports_image: string | null;
  kills: number;
  damage: number;
  assists: number;
  matches: number;
  // Per-map MVP awards (owner 2026-07-02): an MVP is decided for EVERY map; the event MVP is the
  // player with the most. Also the future leaderboard tie-breaker criterion.
  mvp_count: number;
}

interface MapMvp {
  match_id: number;
  match_number: number | null;
  match_map: string | null;
  stage_name: string | null;
  group_name: string | null;
  mvp_user_id: number;
  mvp_name: string;
  kills: number;
  damage: number;
  assists: number;
}

interface MvpResponse {
  criteria: string[];
  rankable_criteria: string[];
  scope: "overall" | "winning_team";
  criteria_meta: CriterionMeta[];
  map_mvps: MapMvp[];
  players: MvpPlayer[];
  mvp: MvpPlayer | null;
}

const authHeaders = () => ({ Authorization: `Bearer ${Cookies.get("auth_token")}` });

export default function MvpTab({
  eventId,
  // organizationId scopes the Download dialog's design library (null = AFC-native library). Passed by
  // the admin editor (eventData.organization_id) and the organizer page (their org id).
  organizationId = null,
}: {
  eventId: number | string;
  organizationId?: number | null;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // COMBINE scope (owner 2026-07-05, complaint G): which groups/stages the MVP is computed over. Held
  // in a ref so `load` stays stable (deps [eventId]); a scope change re-fetches in the background.
  const scopeRef = useRef<{ groupIds: number[]; stageIds: number[] }>({
    groupIds: [],
    stageIds: [],
  });
  const scopeInit = useRef(false);
  const [meta, setMeta] = useState<CriterionMeta[]>([]);
  const [criteria, setCriteria] = useState<string[]>([]);
  const [scope, setScope] = useState<"overall" | "winning_team">("overall");
  const [players, setPlayers] = useState<MvpPlayer[]>([]);
  const [mapMvps, setMapMvps] = useState<MapMvp[]>([]);
  const [mvp, setMvp] = useState<MvpPlayer | null>(null);

  // Apply a computed response to the panel: ordered criteria first, then the rest of the catalog
  // (so every criterion is always visible + arrangeable, saved ones on top in their saved order).
  const applyResponse = (d: MvpResponse) => {
    setMeta(d.criteria_meta);
    const rest = d.criteria_meta.map((c) => c.key).filter((k) => !d.criteria.includes(k));
    setCriteria([...d.criteria, ...rest]);
    setScope(d.scope);
    setPlayers(d.players);
    setMapMvps(d.map_mvps ?? []);
    setMvp(d.mvp);
  };

  // Live refresh (owner 2026-07-02): `background` = a tick-driven refresh. It skips the loading
  // spinner + error toast, and only updates the READ-ONLY side (ranking table, per-map winners,
  // MVP header, criteria catalog) - the admin's in-progress criteria arrangement + scope picker
  // are form state and must never be clobbered by a background refetch.
  // CSV query params for the current combine scope (empty => whole event). Sent on the GET + POST so
  // the ranking is computed over exactly the selected groups/stages.
  const scopeParams = () => {
    const s = scopeRef.current;
    const q: Record<string, string> = {};
    if (s.groupIds.length) q.group_ids = s.groupIds.join(",");
    if (s.stageIds.length) q.stage_ids = s.stageIds.join(",");
    return q;
  };

  const load = useCallback(async (background = false) => {
    if (!background) setLoading(true);
    try {
      const res = await axios.get<MvpResponse>(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/${eventId}/mvp/`,
        { headers: authHeaders(), params: scopeParams() },
      );
      if (background) {
        const d = res.data;
        setMeta(d.criteria_meta);
        setPlayers(d.players);
        setMapMvps(d.map_mvps ?? []);
        setMvp(d.mvp);
      } else {
        applyResponse(res.data);
      }
    } catch (err: any) {
      if (!background) {
        toast.error(err?.response?.data?.message || "Could not load the MVP ranking.");
      }
    } finally {
      if (!background) setLoading(false);
    }
  }, [eventId]);

  // Live refresh (owner 2026-07-02): the current-winners list re-pulls on the site-wide tick
  // (tick 0 = the normal first load). Skipped while "Save & recompute" is in flight so a stale
  // GET can't race the POST's recomputed response.
  const tick = useLiveTick();
  useEffect(() => {
    if (tick > 0 && saving) return;
    load(tick > 0);
  }, [tick, load]);

  const move = (idx: number, dir: -1 | 1) => {
    setCriteria((prev) => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  };

  // A scope change reports up here (from PlayerBoardControls). The FIRST call is the initial
  // whole-event selection, already covered by the mount load, so it is skipped; later changes
  // re-fetch in the BACKGROUND (no spinner) with the new scope.
  const handleScope = useCallback(
    (s: { groupIds: number[]; stageIds: number[] }) => {
      scopeRef.current = s;
      if (!scopeInit.current) {
        scopeInit.current = true;
        return;
      }
      load(true);
    },
    [load],
  );

  const saveAndCompute = async () => {
    setSaving(true);
    try {
      const res = await axios.post<MvpResponse>(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/${eventId}/mvp/`,
        { criteria, scope },
        { headers: authHeaders(), params: scopeParams() },
      );
      applyResponse(res.data);
      toast.success("MVP criteria saved.");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Could not save the MVP criteria.");
    } finally {
      setSaving(false);
    }
  };

  const metaByKey = new Map(meta.map((m) => [m.key, m]));

  if (loading) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 py-8 text-sm">
        <IconLoader2 className="size-4 animate-spin" />
        Loading MVP ranking...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Scope (whole event / combine selected stages+groups) + Download the board through a
          design (owner 2026-07-05, complaint G). Reuses the leaderboard combine path. ── */}
      <PlayerBoardControls
        eventId={eventId}
        organizationId={organizationId}
        kind="mvp"
        onScopeChange={handleScope}
      />

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]" data-tour="leaderboard-mvp-panel">
      {/* ── Criteria arrangement + scope. ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">MVP criteria</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-xs">
            An MVP is decided for EVERY MAP using this arrangement (compared on the first criterion;
            ties fall to the next one down). The EVENT MVP is the player with the most per-map MVPs.
          </p>
          <div className="space-y-1.5">
            {criteria.map((key, i) => {
              const m = metaByKey.get(key);
              if (!m) return null;
              return (
                <div
                  key={key}
                  className="bg-muted/40 flex items-center gap-2 rounded-md border px-2 py-1.5"
                >
                  <span className="text-muted-foreground w-5 text-xs font-bold">{i + 1}.</span>
                  <span className="text-sm">{m.label}</span>
                  {!m.available ? (
                    <Badge
                      variant="outline"
                      className="rounded-full border-amber-500/50 px-2 py-0 text-[0.6rem] text-amber-500"
                    >
                      needs live 3D-room data
                    </Badge>
                  ) : null}
                  <div className="ml-auto flex gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-6"
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                    >
                      <IconArrowUp className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-6"
                      onClick={() => move(i, 1)}
                      disabled={i === criteria.length - 1}
                    >
                      <IconArrowDown className="size-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-1">
            <Label className="text-xs">MVP picked from</Label>
            <Select value={scope} onValueChange={(v) => setScope(v as typeof scope)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="overall">Overall event, per map</SelectItem>
                <SelectItem value="winning_team">Winning team of each map</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={saveAndCompute} disabled={saving} className="w-full">
            {saving ? <IconLoader2 className="size-4 animate-spin" /> : <IconTrophy className="size-4" />}
            Save &amp; recompute
          </Button>
        </CardContent>
      </Card>

      {/* ── The ranking. Row 1 = the MVP. ── */}
      <Card className="overflow-hidden p-0">
        {mvp ? (
          <div className="border-b p-4">
            <div className="flex items-center gap-3">
              {mvp.esports_image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={mvp.esports_image}
                  alt=""
                  className="size-12 rounded-md border object-cover"
                />
              ) : null}
              <div>
                <p className="text-gold flex items-center gap-1.5 text-sm font-bold">
                  <IconCrown className="size-4" />
                  MVP: {mvp.in_game_name}
                </p>
                <p className="text-muted-foreground text-xs">
                  {mvp.team_name ? `${mvp.team_name} · ` : ""}
                  <b>{mvp.mvp_count} map MVP{mvp.mvp_count === 1 ? "" : "s"}</b> · {mvp.kills} kills ·{" "}
                  {mvp.damage} damage · {mvp.assists} assists · {mvp.matches} matches
                </p>
              </div>
            </div>
          </div>
        ) : null}
        {players.length === 0 ? (
          <p className="text-muted-foreground p-8 text-center text-sm">
            No player match stats recorded for this event yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="h-10 p-2 text-foreground">#</TableHead>
                <TableHead className="h-10 p-2 text-foreground">Player</TableHead>
                <TableHead className="h-10 p-2 text-foreground">Team</TableHead>
                <TableHead className="h-10 p-2 text-center text-foreground">Map MVPs</TableHead>
                <TableHead className="h-10 p-2 text-center text-foreground">Kills</TableHead>
                <TableHead className="h-10 p-2 text-center text-foreground">Damage</TableHead>
                <TableHead className="h-10 p-2 text-center text-foreground">Assists</TableHead>
                <TableHead className="h-10 p-2 text-center text-foreground">Matches</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {players.map((p, i) => (
                <TableRow key={p.user_id} className="text-xs">
                  <TableCell className={`p-2 font-bold ${i === 0 ? "text-gold" : ""}`}>
                    {i === 0 ? <IconCrown className="mr-1 inline size-3.5" /> : null}#{i + 1}
                  </TableCell>
                  <TableCell className="p-2">{p.in_game_name}</TableCell>
                  <TableCell className="p-2">{p.team_name || "-"}</TableCell>
                  <TableCell className={`p-2 text-center font-bold ${p.mvp_count > 0 ? "text-gold" : ""}`}>
                    {p.mvp_count}
                  </TableCell>
                  <TableCell className="p-2 text-center">{p.kills}</TableCell>
                  <TableCell className="p-2 text-center">{p.damage}</TableCell>
                  <TableCell className="p-2 text-center">{p.assists}</TableCell>
                  <TableCell className="p-2 text-center">{p.matches}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {/* Per-map winners: which player took each map's MVP (the counts above come from these). */}
        {mapMvps.length > 0 ? (
          <div className="border-t p-3">
            <p className="text-muted-foreground mb-2 text-[0.68rem] font-semibold uppercase tracking-wide">
              Per-map MVPs
            </p>
            <div className="grid gap-1 sm:grid-cols-2">
              {mapMvps.map((m) => (
                <p key={m.match_id} className="text-xs">
                  <span className="text-muted-foreground">
                    {[m.stage_name, m.group_name].filter(Boolean).join(" · ")} · Match{" "}
                    {m.match_number ?? "?"} ({m.match_map || "-"}):
                  </span>{" "}
                  <b>{m.mvp_name}</b>
                  <span className="text-muted-foreground"> ({m.kills}k)</span>
                </p>
              ))}
            </div>
          </div>
        ) : null}
      </Card>
      </div>
    </div>
  );
}
