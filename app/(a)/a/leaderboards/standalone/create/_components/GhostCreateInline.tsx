"use client";

// ── GhostCreateInline ─────────────────────────────────────────────────────────
// The "not found, create as ghost" mini-form shown inside the Participants step. A
// ghost is a placeholder entity (afc_rankings.GhostTeam / GhostPlayer) for a team or
// player that is NOT on the platform yet — it can be picked in standings now and
// claimed by the real entity later. This form ONLY collects the fields; it does NOT
// call the API itself. On submit it hands a ready-to-send `ghost_new` body up to the
// parent (ParticipantsStep), which calls standaloneLeaderboardsApi.addParticipant.
//
// Shape of the emitted body (matches POST /leaderboards/standalone/<id>/participants/):
//   team format -> {kind:"ghost_new", name, country?, players?:[ign, ...]}
//   solo format -> {kind:"ghost_new", ign}
//
// CONSUMED BY: ParticipantsStep.tsx (rendered when the user clicks "Create as ghost").

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { IconPlus, IconX } from "@tabler/icons-react";

export function GhostCreateInline({
  format,
  onCreate,
  onCancel,
  submitting,
}: {
  format: "team" | "solo";
  // Emits the `ghost_new` participant body (see header). Parent does the API call.
  onCreate: (body: Record<string, any>) => void;
  onCancel: () => void;
  submitting?: boolean;
}) {
  // Team-format fields.
  const [teamName, setTeamName] = useState("");
  const [country, setCountry] = useState("");
  const [playerInput, setPlayerInput] = useState("");
  const [players, setPlayers] = useState<string[]>([]);
  // Solo-format field.
  const [ign, setIgn] = useState("");

  const addPlayer = () => {
    const v = playerInput.trim();
    if (!v) return;
    if (!players.includes(v)) setPlayers((prev) => [...prev, v]);
    setPlayerInput("");
  };
  const removePlayer = (name: string) =>
    setPlayers((prev) => prev.filter((p) => p !== name));

  const handleSubmit = () => {
    if (format === "team") {
      if (!teamName.trim()) return;
      onCreate({
        kind: "ghost_new",
        name: teamName.trim(),
        ...(country.trim() ? { country: country.trim() } : {}),
        ...(players.length ? { players } : {}),
      });
    } else {
      if (!ign.trim()) return;
      onCreate({ kind: "ghost_new", ign: ign.trim() });
    }
  };

  const canSubmit =
    format === "team" ? teamName.trim().length > 0 : ign.trim().length > 0;

  return (
    // rounded-md bordered panel (AFC card idiom) so the inline form reads as a sub-section.
    <div className="space-y-3 rounded-md border bg-muted/30 p-4">
      <p className="text-sm font-medium">
        Create a ghost {format === "team" ? "team" : "player"}
      </p>

      {format === "team" ? (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">Team name</Label>
            <Input
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="e.g. Team Phoenix"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Country (optional)</Label>
            <Input
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="e.g. Nigeria"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Players (optional)</Label>
            <div className="flex items-center gap-2">
              <Input
                value={playerInput}
                onChange={(e) => setPlayerInput(e.target.value)}
                onKeyDown={(e) => {
                  // Enter adds the typed IGN as a chip (no form submit).
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addPlayer();
                  }
                }}
                placeholder="Type an in-game name, press Enter"
              />
              <Button type="button" variant="outline" size="sm" onClick={addPlayer}>
                <IconPlus size={14} className="mr-1" /> Add
              </Button>
            </div>
            {players.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {players.map((p) => (
                  <Badge key={p} variant="secondary" className="gap-1 pr-1">
                    {p}
                    <button
                      type="button"
                      onClick={() => removePlayer(p)}
                      className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                      aria-label={`Remove ${p}`}
                    >
                      <IconX size={12} />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="space-y-1.5">
          <Label className="text-xs">In-game name (IGN)</Label>
          <Input
            value={ign}
            onChange={(e) => setIgn(e.target.value)}
            placeholder="e.g. SkullKing"
          />
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="button" size="sm" onClick={handleSubmit} disabled={!canSubmit || submitting}>
          {submitting ? "Adding..." : "Add ghost"}
        </Button>
      </div>
    </div>
  );
}
