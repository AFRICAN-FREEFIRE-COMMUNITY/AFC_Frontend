"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { IconLoader2, IconMap, IconUserPlus } from "@tabler/icons-react";
import { Loader } from "@/components/Loader";
import { InfoTip } from "@/components/ui/info-tip";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { readJson } from "@/lib/readJson";
// Absent-vs-zero for the manual score boxes (owner bug 2026-08-06). A blank placement stays null
// so the backend rejects it instead of scoring 0; a blank kills box collapses to 0. Rendering also
// goes through here so a typed 0 stays visible instead of redrawing as an empty box.
import {
  parseScoreInput,
  rowsMissingPlacement,
  scoreInputValue,
  scoreOrZero,
  type ScoreValue,
} from "@/lib/scoreInput";
import { toast } from "sonner";
// Add-player picker (Roster Rules, owner 2026-06-15): a per-team dialog that lists the
// team's PLAYING-role members who are NOT yet on this event's roster, then POSTs the
// chosen one to /events/add-player-to-event-roster/.
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ── Roster Rules (Feature B, owner 2026-06-15) ──────────────────────────────────
// Only PLAYING-role team members (team_captain/vice_captain/member) may be added to an
// event roster; STAFF (coach/manager/analyst) are rejected by the backend. The team's
// roles live in TeamMembers.management_role, exposed by team/get-team-details/ ->
// team.members[].management_role (the get-event-details roster members carry NO role,
// so the add-player picker has to read roles from get-team-details/). These sets match
// afc_team/views.py PLAYER_ROLES / STAFF_ROLES.
const PLAYER_ROLES = ["team_captain", "vice_captain", "member"];

// One selectable candidate for the add-player dialog: a PLAYING-role team member who is
// not already on this event's roster. id comes from get-team-details/ member.id.
interface AddPlayerCandidate {
  id: number;
  username: string;
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface TournamentMember {
  player_id: number;
  username: string;
}

interface TournamentTeam {
  tournament_team_id: number;
  team_id: number;
  team_name: string;
  team_logo: string | null;
  members: TournamentMember[];
}

// Every numeric field is a ScoreValue (number | null). null means "this box is empty", which is
// a DIFFERENT thing from 0 and must survive to handleSubmit below (see lib/scoreInput.ts).
interface PlayerResult {
  user_id: number;
  username: string;
  kills: ScoreValue;
  damage: ScoreValue;
  assists: ScoreValue;
  played: boolean;
}

interface TeamResult {
  tournament_team_id: number;
  team_name: string;
  team_logo: string | null;
  placement: ScoreValue;
  played: boolean;
  players: PlayerResult[];
}

interface SoloResult {
  competitor_id: number;
  username: string;
  placement: ScoreValue;
  kills: ScoreValue;
  bonus_points: ScoreValue;
  penalty_points: ScoreValue;
  played: boolean;
}

interface Props {
  match: { match_id: number; match_name: string };
  formData: any;
  onComplete: (matchId: number) => void;
  onBack: () => void;
  /** Pass match.stats from the leaderboard API to pre-populate with existing values */
  initialStats?: any[];
  /** Skips participant-type detection when already known (e.g. from eventData.participant_type) */
  participantTypeOverride?: "solo" | "team";
  /**
   * When the active stage is a Champion-Point stage, the entry ORDER decides the
   * champion (first competitor to Booyah while already at/above the threshold).
   * Parents that know the active stage thread its `champion_point_enabled` flag here
   * so we can warn the admin to enter matches in play order. Optional: flows without
   * stage context (e.g. the create wizard) simply omit it and no banner shows.
   */
  championPointEnabled?: boolean;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ManualMatchResultStep({
  match,
  formData,
  onComplete,
  onBack,
  initialStats,
  participantTypeOverride,
  championPointEnabled,
}: Props) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [participantType, setParticipantType] = useState<"team" | "solo">(
    "team",
  );
  const [teamResults, setTeamResults] = useState<TeamResult[]>([]);
  const [soloResults, setSoloResults] = useState<SoloResult[]>([]);

  // ── Add-player dialog state (Roster Rules, owner 2026-06-15) ───────────────────
  // The team whose "Add player" dialog is open (its TeamResult), the loaded list of
  // eligible candidates (PLAYING-role members not yet rostered), and per-phase flags.
  const [addPlayerTeam, setAddPlayerTeam] = useState<TeamResult | null>(null);
  const [addPlayerCandidates, setAddPlayerCandidates] = useState<
    AddPlayerCandidate[]
  >([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [addingPlayerId, setAddingPlayerId] = useState<number | null>(null);

  const isEditing = (formData.completed_match_ids ?? []).includes(
    match.match_id,
  );

  useEffect(() => {
    fetchParticipants();
  }, []);

  const fetchParticipants = async () => {
    setLoading(true);
    try {
      // ── Fast path: use pre-built stats passed from the details page ──────────
      // API stats structure has tournament_team_id (team) or competitor_id (solo)
      // Fast path for SOLO only: solo initialStats carry full data (kills inline). For TEAM we do
      // NOT fast-path off initialStats, because the leaderboard's saved stats often have NO
      // per-player breakdown (players[] empty) -> the result form showed "0 players". The player
      // list MUST come from the team's REGISTERED ROSTER (tt.members, fetched below) with any saved
      // stats overlaid, so a team's registered players always show, pre-filled. (bug fix 2026-06-15)
      if (participantTypeOverride === "solo" && initialStats && initialStats.length > 0) {
        setParticipantType("solo");
        setSoloResults(
          initialStats.map((s: any) => ({
            competitor_id: s.competitor_id,
            username: s.username,
            placement: s.placement ?? null,
            kills: s.kills ?? 0,
            bonus_points: s.bonus_points ?? 0,
            penalty_points: s.penalty_points ?? 0,
            played: s.played ?? true,
          })),
        );
        return;
      }

      // ── Normal path: fetch participant roster from event details ─────────────
      const res = await fetch(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-event-details/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ slug: formData.event_slug }),
        },
      );
      const data = await res.json();
      const details = data.event_details ?? data;

      const pType: "team" | "solo" =
        participantTypeOverride ??
        (details.participant_type === "solo" ? "solo" : "team");
      setParticipantType(pType);

      const teams: TournamentTeam[] = details.tournament_teams ?? [];

      if (pType === "team") {
        // Overlay any SAVED stats (placement + per-player kills) onto the REGISTERED ROSTER, so the
        // team's registered players always show, pre-filled with whatever was already entered.
        const statByTeam = new Map<number, any>();
        for (const s of initialStats ?? []) {
          if (s?.tournament_team_id != null) statByTeam.set(s.tournament_team_id, s);
        }
        if (teams.length > 0) {
          setTeamResults(
            teams.map((tt) => {
              const stat = statByTeam.get(tt.tournament_team_id);
              const savedByUid = new Map<number, any>();
              for (const p of stat?.players ?? []) {
                const uid = p?.player_id ?? p?.user_id;
                if (uid != null) savedByUid.set(uid, p);
              }
              return {
                tournament_team_id: tt.tournament_team_id,
                team_name: tt.team_name,
                team_logo: tt.team_logo ?? null,
                // No saved stat for this team yet -> the placement box starts EMPTY, not at a
                // fake 0. A 0 here used to be indistinguishable from a real entry and saved as a
                // played row worth 0 placement points (owner bug 2026-08-06).
                placement: stat?.placement ?? null,
                played: stat?.played ?? true,
                players: (tt.members ?? []).map((m) => {
                  const sp = savedByUid.get(m.player_id);
                  return {
                    user_id: m.player_id,
                    username: m.username,
                    // No saved row for this member on this map means nothing has been entered
                    // for them yet, so their boxes start EMPTY; a member WITH a saved row keeps
                    // its real value, including a deliberate 0 (bug 2026-08-06).
                    kills: sp?.kills ?? null,
                    damage: sp?.damage ?? null,
                    assists: sp?.assists ?? null,
                    // Squad matches allow max 4 PLAYED players (the backend rejects >4).
                    // Registered rosters can hold 5-6 (substitutes), so a member counts as
                    // played by DEFAULT only when they have a saved stat for this map; subs
                    // default to NOT played and the admin ticks "Played" / enters their stats
                    // for anyone who actually played. Before this every roster member defaulted
                    // to played=true, so 5-6 member squads failed to save. (bug fix 2026-06-15)
                    played: sp != null,
                  };
                }),
              };
            }),
          );
        } else if (initialStats && initialStats.length > 0) {
          // Fallback: roster fetch returned nothing (e.g. no event slug) - use saved stats as-is.
          setTeamResults(
            initialStats.map((s: any) => ({
              tournament_team_id: s.tournament_team_id,
              team_name: s.team_name,
              team_logo: s.team_logo ?? null,
              placement: s.placement ?? null,
              played: s.played ?? true,
              players: (s.players ?? []).map((p: any) => ({
                user_id: p.player_id ?? p.user_id,
                username: p.username,
                kills: p.kills ?? 0,
                damage: p.damage ?? 0,
                assists: p.assists ?? 0,
                played: p.played ?? true,
              })),
            })),
          );
        }
      } else {
        const competitors: string[] = formData.competitors_in_group ?? [];
        if (competitors.length > 0) {
          setSoloResults(
            competitors.map((name, idx) => ({
              competitor_id: idx + 1,
              username: name,
              placement: null,
              kills: 0,
              bonus_points: 0,
              penalty_points: 0,
              played: true,
            })),
          );
        } else {
          setSoloResults(
            teams.flatMap((tt) =>
              (tt.members ?? []).map((m) => ({
                competitor_id: m.player_id,
                username: m.username,
                placement: null,
                kills: 0,
                bonus_points: 0,
                penalty_points: 0,
                played: true,
              })),
            ),
          );
        }
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to load participant data");
      if (participantTypeOverride) setParticipantType(participantTypeOverride);
    } finally {
      setLoading(false);
    }
  };

  // ── Team helpers ───────────────────────────────────────────────────────────

  const updateTeamPlacement = (idx: number, val: ScoreValue) => {
    setTeamResults((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], placement: val };
      return next;
    });
  };

  const updateTeamPlayed = (idx: number, val: boolean) => {
    setTeamResults((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], played: val };
      return next;
    });
  };

  const updatePlayerField = (
    teamIdx: number,
    playerIdx: number,
    field: "kills" | "damage" | "assists" | "played",
    value: ScoreValue | boolean,
  ) => {
    setTeamResults((prev) => {
      const next = [...prev];
      const players = [...next[teamIdx].players];
      const updated = { ...players[playerIdx], [field]: value };
      // Entering any stat for a player implies they played (a non-player has no stats), so
      // auto-tick "Played". The submit only sends played=true players to respect the squad
      // 4-played cap, so this stops typed kills from being silently dropped. (bug fix 2026-06-15)
      // Typing 0 counts as entering a stat (owner bug 2026-08-06). This used to be `value > 0`,
      // so the one player deliberately scored at 0 kills was never ticked and was then dropped by
      // the .filter(p => p.played) in handleSubmit.
      if (field !== "played" && typeof value === "number") {
        updated.played = true;
      }
      players[playerIdx] = updated;
      next[teamIdx] = { ...next[teamIdx], players };
      return next;
    });
  };

  // ── Add player to event roster (Roster Rules, owner 2026-06-15) ──────────────
  // Opens the per-team dialog and loads candidates. The roster shown on this card comes
  // from get-event-details/ (which carries no role per member), so to know which of the
  // team's members are PLAYING-role AND not yet rostered we fetch the team's full member
  // list from team/get-team-details/ {team_name} -> team.members[]{id, username,
  // management_role}, keep only PLAYER_ROLES, and drop anyone whose id already appears in
  // this team card's players[] (those user_ids are the current roster). The picked member
  // is added via POST /events/add-player-to-event-roster/ below.
  const openAddPlayer = async (team: TeamResult) => {
    setAddPlayerTeam(team);
    setAddPlayerCandidates([]);
    setLoadingCandidates(true);
    try {
      const res = await fetch(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/get-team-details/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ team_name: team.team_name }),
        },
      );
      const data = await readJson(res);
      if (!res.ok) {
        throw new Error(data.message || data.detail || "Failed to load team");
      }
      const members: any[] = data.team?.members ?? [];
      // user_ids already on this event's roster (from the card's players list).
      const rosteredIds = new Set(team.players.map((p) => p.user_id));
      const candidates: AddPlayerCandidate[] = members
        // PLAYING roles only; default a missing role to "member" (a PLAYING role).
        .filter((m) => PLAYER_ROLES.includes(m.management_role ?? "member"))
        // Not already on the event roster.
        .filter((m) => !rosteredIds.has(m.id))
        .map((m) => ({ id: m.id, username: m.username }));
      setAddPlayerCandidates(candidates);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to load team members");
    } finally {
      setLoadingCandidates(false);
    }
  };

  // POST the chosen member to the new add-player endpoint, then reload this step's
  // rosters (fetchParticipants reads get-event-details/ again) so the card shows the
  // newly added player. Request body: { event_id, tournament_team_id, user_id }.
  const handleAddPlayer = async (userId: number) => {
    if (!addPlayerTeam) return;
    setAddingPlayerId(userId);
    try {
      const res = await fetch(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/add-player-to-event-roster/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            event_id: formData.event_id,
            tournament_team_id: addPlayerTeam.tournament_team_id,
            user_id: userId,
          }),
        },
      );
      const data = await readJson(res);
      if (!res.ok) {
        throw new Error(
          data.message || data.detail || "Failed to add player to roster",
        );
      }
      toast.success(data.message || "Player added to the roster.");
      setAddPlayerTeam(null);
      // Re-pull rosters so the new player appears in this team card pre-filled.
      await fetchParticipants();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to add player to roster");
    } finally {
      setAddingPlayerId(null);
    }
  };

  // ── Solo helpers ───────────────────────────────────────────────────────────

  const updateSoloField = (
    idx: number,
    field: "placement" | "kills" | "bonus_points" | "penalty_points" | "played",
    value: ScoreValue | boolean,
  ) => {
    setSoloResults((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    // Name the rows that played this map but have no finishing position entered. The backend
    // rejects this case (validate_placements) but cannot say WHICH rows are at fault, and in a
    // 12-team lobby that is the difference between fixable and not. (owner bug 2026-08-06)
    const missingPlacement =
      participantType === "team"
        ? rowsMissingPlacement(
            teamResults.map((t) => ({
              name: t.team_name,
              placement: t.placement,
              played: t.played,
            })),
          )
        : rowsMissingPlacement(
            soloResults.map((s) => ({
              name: s.username,
              placement: s.placement,
              played: s.played,
            })),
          );
    if (missingPlacement.length > 0) {
      toast.error(
        `No finishing position entered for: ${missingPlacement.join(", ")}. ` +
          "Type each one's position (1 for the winner, then 2, 3, and so on), " +
          "or untick them, then submit again.",
      );
      return;
    }

    setSubmitting(true);
    try {
      let endpoint: string;
      let body: any;

      if (participantType === "team") {
        endpoint = isEditing
          ? `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/edit-match-result/`
          : `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/enter-team-match-result-manual/`;

        body = {
          match_id: match.match_id,
          results: teamResults.map((t) => ({
            tournament_team_id: t.tournament_team_id,
            // RAW: a placement box left empty arrives as null so the backend rejects the save
            // instead of storing a played row at 0 placement points.
            placement: t.placement,
            played: t.played,
            // Only players who actually played (≤4 for squad). Omitting not-played subs keeps
            // the payload within the cap and avoids persisting subs that would re-appear as
            // "played" on the next load (the API carries no per-player played flag). (fix 2026-06-15)
            players: t.players
              .filter((p) => p.played)
              .map((p) => ({
                user_id: p.user_id,
                // A blank kills/damage/assists box legitimately means none.
                kills: scoreOrZero(p.kills),
                damage: scoreOrZero(p.damage),
                assists: scoreOrZero(p.assists),
                played: true,
              })),
          })),
        };
      } else {
        endpoint = isEditing
          ? `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/edit-match-result/`
          : `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/enter-solo-match-result-manual/`;

        body = {
          match_id: match.match_id,
          results: soloResults.map((s) => ({
            competitor_id: s.competitor_id,
            // RAW placement (see the team branch above); counts collapse a blank box to 0.
            placement: s.placement,
            kills: scoreOrZero(s.kills),
            played: s.played,
            bonus_points: scoreOrZero(s.bonus_points),
            penalty_points: scoreOrZero(s.penalty_points),
          })),
        };
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || err.detail || "Submission failed");
      }

      toast.success(
        isEditing ? "Results updated!" : "Results submitted successfully!",
      );
      onComplete(match.match_id);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to submit results");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Card className="gap-0">
        <CardContent className="flex items-center justify-center py-20">
          <IconLoader2 className="animate-spin size-8 text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="gap-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconMap size={20} className="text-muted-foreground" />
          {match.match_name} - Manual Input
          <InfoTip id="leaderboards.manual_result._section" />
        </CardTitle>
        <CardDescription>
          Enter results for each{" "}
          {participantType === "team" ? "team" : "player"} on {match.match_name}
          .
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* ── Champion-Point ordered-entry warning ──────────────────────────
            On a Champion-Point stage the order results are entered IS the play
            order the backend replays to crown the champion, so the admin must
            enter matches in the order they were actually played. Amber-tinted
            alert div (matches the repo's inline-alert idiom). */}
        {championPointEnabled && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
            Champion-Point stage: enter matches in the order they were played -
            the entry order decides the champion.
          </div>
        )}

        {participantType === "team" ? (
          /* ── TEAM MODE ─────────────────────────────────────────────────── */
          teamResults.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No teams found for this match.
            </p>
          ) : (
            teamResults.map((team, ti) => (
              <div
                key={team.tournament_team_id}
                className="rounded-lg border p-4 space-y-4"
              >
                <div className="flex items-center gap-3">
                  <Checkbox
                    id={`team-played-${ti}`}
                    checked={team.played}
                    onCheckedChange={(v) => updateTeamPlayed(ti, !!v)}
                  />
                  <label
                    htmlFor={`team-played-${ti}`}
                    className="font-semibold cursor-pointer select-none"
                  >
                    {team.team_name}
                  </label>
                </div>

                <div className="space-y-1.5">
                  <Label>
                    Placement
                    <InfoTip id="leaderboards.result_placement" className="ml-1" />
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    className="max-w-xs"
                    value={scoreInputValue(team.placement)}
                    disabled={!team.played}
                    onChange={(e) =>
                      updateTeamPlacement(ti, parseScoreInput(e.target.value))
                    }
                  />
                </div>

                {team.players.length > 0 && (
                  <div className="space-y-2">
                    <Label>Players</Label>
                    <div className="space-y-2">
                      {team.players.map((player, pi) => (
                        <div
                          key={player.user_id}
                          className="rounded-md border px-3 py-2 space-y-2"
                        >
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id={`p-${ti}-${pi}`}
                              checked={player.played}
                              onCheckedChange={(v) =>
                                updatePlayerField(ti, pi, "played", !!v)
                              }
                            />
                            <label
                              htmlFor={`p-${ti}-${pi}`}
                              className="text-sm font-medium cursor-pointer select-none"
                            >
                              {player.username}
                            </label>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">
                                Kills
                                <InfoTip
                                  id="leaderboards.result_kills"
                                  className="ml-1"
                                />
                              </Label>
                              <Input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={scoreInputValue(player.kills)}
                                disabled={!player.played}
                                onChange={(e) =>
                                  updatePlayerField(
                                    ti,
                                    pi,
                                    "kills",
                                    parseScoreInput(e.target.value),
                                  )
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">
                                Damage
                                <InfoTip
                                  id="leaderboards.result_damage"
                                  className="ml-1"
                                />
                              </Label>
                              <Input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={scoreInputValue(player.damage)}
                                disabled={!player.played}
                                onChange={(e) =>
                                  updatePlayerField(
                                    ti,
                                    pi,
                                    "damage",
                                    parseScoreInput(e.target.value),
                                  )
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">
                                Assists
                                <InfoTip
                                  id="leaderboards.result_assists"
                                  className="ml-1"
                                />
                              </Label>
                              <Input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={scoreInputValue(player.assists)}
                                disabled={!player.played}
                                onChange={(e) =>
                                  updatePlayerField(
                                    ti,
                                    pi,
                                    "assists",
                                    parseScoreInput(e.target.value),
                                  )
                                }
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Add player to event roster (Roster Rules, owner 2026-06-15) ──
                    Opens a picker of this team's PLAYING-role members who are not yet
                    on the event roster, then POSTs the choice to
                    /events/add-player-to-event-roster/ and refetches. Only PLAYING
                    roles are offered (STAFF are filtered out in openAddPlayer). */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => openAddPlayer(team)}
                >
                  <IconUserPlus size={14} className="mr-1" />
                  Add player
                </Button>
              </div>
            ))
          )
        ) : (
          /* ── SOLO MODE ─────────────────────────────────────────────────── */
          <div className="space-y-2">
            <Label>Players</Label>
            <div className="space-y-2">
              {soloResults.map((solo, si) => (
                <div
                  key={solo.competitor_id}
                  className="rounded-md border px-3 py-2 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`solo-${si}`}
                      checked={solo.played}
                      onCheckedChange={(v) =>
                        updateSoloField(si, "played", !!v)
                      }
                    />
                    <label
                      htmlFor={`solo-${si}`}
                      className="text-sm font-medium cursor-pointer select-none flex-1 truncate"
                    >
                      {solo.username}
                    </label>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Placement
                        <InfoTip
                          id="leaderboards.result_placement"
                          className="ml-1"
                        />
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={scoreInputValue(solo.placement)}
                        disabled={!solo.played}
                        onChange={(e) =>
                          updateSoloField(
                            si,
                            "placement",
                            parseScoreInput(e.target.value),
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Kills
                        <InfoTip id="leaderboards.result_kills" className="ml-1" />
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={scoreInputValue(solo.kills)}
                        disabled={!solo.played}
                        onChange={(e) =>
                          updateSoloField(
                            si,
                            "kills",
                            parseScoreInput(e.target.value),
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Bonus Points
                        <InfoTip
                          id="leaderboards.result_bonus_points"
                          className="ml-1"
                        />
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={scoreInputValue(solo.bonus_points)}
                        disabled={!solo.played}
                        onChange={(e) =>
                          updateSoloField(
                            si,
                            "bonus_points",
                            parseScoreInput(e.target.value),
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Penalty Points
                        <InfoTip
                          id="leaderboards.result_penalty_points"
                          className="ml-1"
                        />
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={scoreInputValue(solo.penalty_points)}
                        disabled={!solo.played}
                        onChange={(e) =>
                          updateSoloField(
                            si,
                            "penalty_points",
                            parseScoreInput(e.target.value),
                          )
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={onBack} disabled={submitting}>
            Back
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <Loader text={isEditing ? "Updating..." : "Submitting..."} />
            ) : isEditing ? (
              "Save Changes"
            ) : (
              "Submit Results"
            )}
          </Button>
        </div>
      </CardContent>

      {/* ── Add-player dialog (Roster Rules, owner 2026-06-15) ──────────────────
          Driven by openAddPlayer/handleAddPlayer above. Lists eligible PLAYING-role
          team members not yet on the event roster; clicking one adds them via
          /events/add-player-to-event-roster/. Closes by clearing addPlayerTeam. */}
      <Dialog
        open={!!addPlayerTeam}
        onOpenChange={(o) => !o && setAddPlayerTeam(null)}
      >
        <DialogContent className="flex flex-col max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Add player to roster</DialogTitle>
            <DialogDescription>
              {addPlayerTeam
                ? `Add a player to ${addPlayerTeam.team_name} for this event.`
                : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto space-y-2 py-1">
            {loadingCandidates ? (
              <div className="flex items-center justify-center py-8">
                <IconLoader2 className="animate-spin size-6 text-primary" />
              </div>
            ) : addPlayerCandidates.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">
                No eligible players to add. Every playing member of this team is
                already on the roster.
              </p>
            ) : (
              addPlayerCandidates.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2"
                >
                  <span className="text-xs font-medium">{c.username}</span>
                  <Button
                    type="button"
                    size="sm"
                    className="text-xs"
                    disabled={addingPlayerId !== null}
                    onClick={() => handleAddPlayer(c.id)}
                  >
                    {addingPlayerId === c.id ? (
                      <Loader text="Adding..." />
                    ) : (
                      "Add"
                    )}
                  </Button>
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setAddPlayerTeam(null)}
              disabled={addingPlayerId !== null}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
