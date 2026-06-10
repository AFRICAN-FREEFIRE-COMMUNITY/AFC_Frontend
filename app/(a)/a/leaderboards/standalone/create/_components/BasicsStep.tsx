"use client";

// ── BasicsStep (wizard step 1) ────────────────────────────────────────────────
// Collects the leaderboard header + scoring config, then CREATES the draft leaderboard
// via standaloneLeaderboardsApi.create (POST /leaderboards/standalone/create/). On success
// the parent wizard advances with the returned leaderboard.id so steps 2-4 can attach
// participants/matches/results to it.
//
// Fields:
//   • name              (required)
//   • format            team | solo  (radio — locked once created since participants key off it)
//   • scoring           placement ranks + points-per-kill/assist/damage. This MIRRORS the UI of the
//                       event-flow ConfigurePointSystem component, but is a SELF-CONTAINED light
//                       version: ConfigurePointSystem POSTs to the EVENT create endpoint and needs
//                       event_id/stage_id/group_id, so it can't be reused as-is here. We rebuild just
//                       the placement-ranks + kill/assist/damage inputs and emit plain values.
//   • counts_toward_rankings  AFC-admin ONLY (role admin/head_admin/event_admin). Hidden for organizers
//                       — the backend also forces it false for them (defence in depth).
//
// CONSUMED BY: ../page.tsx (the wizard). Emits the created leaderboard via onCreated().

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { IconPlus, IconX } from "@tabler/icons-react";
import { InfoTip } from "@/components/ui/info-tip";
import { useAuth } from "@/contexts/AuthContext";
import {
  standaloneLeaderboardsApi,
  type StandaloneLeaderboardHeader,
  type StandaloneLeaderboardCreatePayload,
  type RankingTier,
} from "@/lib/standaloneLeaderboards";

type RankEntry = { id: number; val: string };

// Same defaults the event ConfigurePointSystem ships with, so a standalone leaderboard
// scores consistently with event leaderboards out of the box.
const DEFAULT_RANKS: RankEntry[] = [
  { id: 1, val: "12" },
  { id: 2, val: "9" },
  { id: 3, val: "8" },
  { id: 4, val: "7" },
  { id: 5, val: "6" },
  { id: 6, val: "5" },
  { id: 7, val: "4" },
  { id: 8, val: "3" },
  { id: 9, val: "2" },
  { id: 10, val: "1" },
];

// Build the {"1":12, "2":9, ...} placement_points object the backend expects.
function buildPlacementObj(ranks: RankEntry[]): Record<string, number> {
  const obj: Record<string, number> = {};
  ranks.forEach((r, idx) => {
    obj[(idx + 1).toString()] = parseInt(r.val) || 0;
  });
  return obj;
}

export function BasicsStep({
  onCreated,
}: {
  onCreated: (lb: StandaloneLeaderboardHeader) => void;
}) {
  const { user } = useAuth();

  // AFC admin = the only role allowed to flip counts_toward_rankings. Mirrors the
  // backend can_set_rankings_flag gate (_is_event_admin): role admin OR head_admin/event_admin.
  const isAfcAdmin = useMemo(() => {
    if (!user) return false;
    if (user.role === "admin") return true;
    const roles = user.roles || [];
    return roles.some((r) =>
      ["head_admin", "event_admin"].includes(r.toLowerCase()),
    );
  }, [user]);

  const [name, setName] = useState("");
  const [format, setFormat] = useState<"team" | "solo">("team");
  const [ranks, setRanks] = useState<RankEntry[]>(DEFAULT_RANKS.map((r) => ({ ...r })));
  const [killPoint, setKillPoint] = useState("1");
  const [assistPoint, setAssistPoint] = useState("0.5");
  const [damagePoint, setDamagePoint] = useState("0.5");
  const [countsTowardRankings, setCountsTowardRankings] = useState(false);
  // Stream P3 (AFC-admin-only) ranking inputs, only meaningful when the toggle above is on.
  // playedOn binds to the leaderboard.played_on field (ISO date the results bucket under, "" = null).
  // rankingTier binds to leaderboard.ranking_tier (weight band, defaults to tier_3 per the backend).
  const [playedOn, setPlayedOn] = useState<string>("");
  const [rankingTier, setRankingTier] = useState<RankingTier>("tier_3");
  const [submitting, setSubmitting] = useState(false);

  // ── Placement rank mutators (mirror ConfigurePointSystem) ──
  const updateRank = (idx: number, val: string) =>
    setRanks((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], val };
      return next;
    });
  const addRank = () => setRanks((prev) => [...prev, { id: Date.now(), val: "0" }]);
  const removeRank = (id: number) => setRanks((prev) => prev.filter((r) => r.id !== id));

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Give the leaderboard a name.");
      return;
    }
    setSubmitting(true);
    try {
      const body: StandaloneLeaderboardCreatePayload = {
        name: name.trim(),
        format,
        placement_points: buildPlacementObj(ranks),
        kill_point: parseFloat(killPoint) || 0,
        points_per_assist: parseFloat(assistPoint) || 0,
        points_per_1000_damage: parseFloat(damagePoint) || 0,
      };
      // Only an AFC admin may set the flag; for everyone else it's omitted (backend forces false).
      if (isAfcAdmin) {
        body.counts_toward_rankings = countsTowardRankings;
        // Stream P3: the ranking date + tier are only meaningful when the leaderboard is ranked,
        // so only attach them when the toggle is on. played_on sends null when left blank.
        if (countsTowardRankings) {
          body.played_on = playedOn || null; // -> leaderboard.played_on
          body.ranking_tier = rankingTier; // -> leaderboard.ranking_tier
        }
      }

      const res = await standaloneLeaderboardsApi.create(body);
      toast.success("Draft leaderboard created.");
      onCreated(res.leaderboard);
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Failed to create the leaderboard.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="gap-0">
      <CardHeader>
        <CardTitle className="flex items-center">
          Basics and scoring
          <InfoTip
            text="Name the leaderboard, pick team or solo, and set how points are awarded. The format cannot be changed after creation."
            className="ml-1.5"
          />
        </CardTitle>
        <CardDescription>
          Create the draft. You can add participants and results in the next steps.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Name */}
        <div className="space-y-1.5">
          <Label>Leaderboard name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Lagos Showdown Finals"
          />
        </div>

        {/* Format radio */}
        <div className="space-y-2">
          <Label className="flex items-center">
            Format
            <InfoTip
              text="Team leaderboards score teams (real or ghost). Solo leaderboards score individual players."
              className="ml-1"
            />
          </Label>
          <RadioGroup
            value={format}
            onValueChange={(v) => setFormat(v as "team" | "solo")}
            className="flex gap-6"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="team" id="format-team" />
              <Label htmlFor="format-team" className="cursor-pointer font-normal">
                Team
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="solo" id="format-solo" />
              <Label htmlFor="format-solo" className="cursor-pointer font-normal">
                Solo
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Placement points */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="font-medium">
              Placement points
              <InfoTip
                text="Points awarded for each finishing position. Place 1 is the winner."
                className="ml-1"
              />
            </Label>
            <Button type="button" variant="outline" size="sm" onClick={addRank}>
              <IconPlus size={13} className="mr-1" /> Add placement
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-5">
            {ranks.map((r, i) => (
              <div key={r.id} className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Place {i + 1}</Label>
                  {/* Keep the first 10 fixed; extras (added by the button) are removable. */}
                  {i > 9 && (
                    <button
                      type="button"
                      onClick={() => removeRank(r.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <IconX size={12} />
                    </button>
                  )}
                </div>
                <Input
                  type="number"
                  value={r.val}
                  onChange={(e) => updateRank(i, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Kill / assist / damage */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label>
              Points per kill
              <InfoTip text="Points added per kill. Kills are always shown on the standings." className="ml-1" />
            </Label>
            <Input
              type="number"
              step="0.5"
              value={killPoint}
              onChange={(e) => setKillPoint(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>
              Points per assist
              <InfoTip text="Points added per assist. Used for team-format scoring." className="ml-1" />
            </Label>
            <Input
              type="number"
              step="0.5"
              value={assistPoint}
              onChange={(e) => setAssistPoint(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>
              Points per damage (per 1000)
              <InfoTip text="Points added per 1000 damage. Used for team-format scoring." className="ml-1" />
            </Label>
            <Input
              type="number"
              step="0.5"
              value={damagePoint}
              onChange={(e) => setDamagePoint(e.target.value)}
            />
          </div>
        </div>

        {/* counts_toward_rankings — AFC admins only (organizers never see it). */}
        {isAfcAdmin && (
          <div className="space-y-4 rounded-md border p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-0.5">
                <Label htmlFor="counts-rankings" className="flex items-center font-medium">
                  Counts toward AFC rankings
                  <InfoTip
                    text="When on, this leaderboard's results will feed the AFC rankings engine. Stored now, wired into rankings later."
                    className="ml-1"
                  />
                </Label>
                <p className="text-xs text-muted-foreground">
                  AFC admin only. Leave off unless this is an official ranked event.
                </p>
              </div>
              <Switch
                id="counts-rankings"
                checked={countsTowardRankings}
                onCheckedChange={setCountsTowardRankings}
              />
            </div>

            {/* Stream P3: ranking date + tier. Revealed only when the toggle is on (these are
                meaningless otherwise and the backend ignores them when the flag is off). The date
                binds to leaderboard.played_on, the Select to leaderboard.ranking_tier (default tier_3). */}
            {countsTowardRankings && (
              <div className="grid grid-cols-1 gap-4 border-t pt-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="played-on" className="flex items-center">
                    Played on (optional)
                    <InfoTip
                      text="Date and tier used when feeding the AFC rankings engine. Tier sets how much these results weigh."
                      className="ml-1"
                    />
                  </Label>
                  {/* Bound to played_on. Empty string is sent as null in handleCreate. */}
                  <Input
                    id="played-on"
                    type="date"
                    value={playedOn}
                    onChange={(e) => setPlayedOn(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ranking-tier">Ranking tier</Label>
                  {/* Bound to ranking_tier. Mirrors the tier Select idiom on the rankings pages. */}
                  <Select
                    value={rankingTier}
                    onValueChange={(v) => setRankingTier(v as RankingTier)}
                  >
                    <SelectTrigger id="ranking-tier" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tier_1">Tier 1</SelectItem>
                      <SelectItem value="tier_2">Tier 2</SelectItem>
                      <SelectItem value="tier_3">Tier 3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button onClick={handleCreate} disabled={submitting}>
            {submitting ? "Creating..." : "Create and continue"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
