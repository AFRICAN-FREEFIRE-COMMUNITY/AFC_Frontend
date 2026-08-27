"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { env } from "@/lib/env";
import { matchesSearch } from "@/lib/search";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { IconLoader2, IconSearch, IconUserPlus } from "@tabler/icons-react";

interface Team {
  team_id: number;
  team_name: string;
  team_logo: string | null;
  team_tag: string | null;
  member_count: number;
  country: string;
  is_banned: boolean;
}

// ── WHY A TEAM WAS REFUSED, in words an organizer can act on ─────────────────────────────────
// (owner 2026-08-27) add-teams-to-event answered a blocked add with only "Some teams do not meet
// this event's requirements". The backend has always returned far more than that: a per-team list
// of failing CODES, and now a per-player list of exactly what each player is missing. The modal
// threw all of it away and showed the one sentence, so an admin was told no and given nothing to
// do about it.
//
// Everything below is that payload rendered. No new endpoint, no new check.

/** One player who is missing something, as the backend reports them. */
interface MissingPlayer {
  user_id: number;
  username: string;
  /** e.g. "uid", "whatsapp", "connection:google" */
  fields: string[];
}

/** One team the gate refused, with the codes it failed on. */
interface BlockedTeam {
  team_id: number;
  team_name: string;
  codes: string[];
  /** Present only for registration_requirements_unmet. */
  missing?: MissingPlayer[];
}

// Codes a waiver can get past. MIRRORS afc_tournament_and_scrims/waivers.py WAIVABLE_CODES; the
// backend is the authority and refuses anything else, so a drift here shows up as a refused waive
// rather than as an admitted ban.
const WAIVABLE = new Set([
  "team_logo_required",
  "registration_requirements_unmet",
  "letter_avatars_required",
  "discord_required",
  "roster_size",
  "country_restricted",
  "capacity_full",
  "sponsor_submission_invalid",
]);

const CODE_TEXT: Record<string, string> = {
  team_banned: "This team is banned",
  player_banned: "A player on this team is banned",
  team_logo_required: "The team has no logo, and this event requires one",
  registration_requirements_unmet: "Players are missing things this event requires",
  capacity_full: "This event is already full",
};

// A missing FIELD in plain words. "connection:<slug>" is handled separately below because the slug
// is part of the sentence.
const FIELD_TEXT: Record<string, string> = {
  uid: "Free Fire UID",
  whatsapp: "WhatsApp number",
  esports_image: "esports image",
  profile_image: "profile picture",
};

function fieldLabel(field: string): string {
  if (field.startsWith("connection:")) {
    const slug = field.slice("connection:".length);
    return `${slug.charAt(0).toUpperCase()}${slug.slice(1)} account connected`;
  }
  return FIELD_TEXT[field] || field;
}

/** "3 players have not connected Google" rather than a code. */
function summarise(team: BlockedTeam): string[] {
  const lines = team.codes
    .filter((c) => c !== "registration_requirements_unmet")
    .map((c) => CODE_TEXT[c] || c);

  // Group the per-player detail BY WHAT IS MISSING, because "3 players have no UID" is the
  // sentence an organizer can act on, where six separate player lines is a wall.
  const byField = new Map<string, string[]>();
  for (const player of team.missing || []) {
    for (const field of player.fields) {
      if (!byField.has(field)) byField.set(field, []);
      byField.get(field)!.push(player.username);
    }
  }
  for (const [field, players] of byField) {
    const who = players.length <= 3 ? players.join(", ") : `${players.length} players`;
    lines.push(`${who}: no ${fieldLabel(field)}`);
  }
  return lines;
}

type Mode = "event" | "stage" | "group";

interface AddTeamsModalProps {
  mode: Mode;
  targetId: number;
  targetName: string;
  onSuccess?: () => void;
  /** ids of teams already in the event/stage/group - they'll be greyed out */
  existingTeamIds?: number[];
  /**
   * The event id. When set for a SEEDING mode (stage/group), the picker lists ONLY the event's
   * REGISTERED teams (via /events/seeding/registered-teams/) instead of every team on the platform
   * (owner 2026-07-06: "show only teams that are registered as those you can seed"). Omit it (or use
   * mode="event") to keep the full-roster list used when REGISTERING teams onto the event.
   */
  eventId?: number;
}

const ENDPOINT: Record<Mode, string> = {
  event: "/events/add-teams-to-event/",
  stage: "/events/add-teams-to-stage/",
  group: "/events/add-teams-to-group/",
};

const BODY_KEY: Record<Mode, string> = {
  event: "event_id",
  stage: "stage_id",
  group: "group_id",
};

const LABEL: Record<Mode, string> = {
  event: "Add Teams to Event",
  stage: "Add Teams to Stage",
  group: "Add Teams to Group",
};

export function AddTeamsModal({
  mode,
  targetId,
  targetName,
  onSuccess,
  existingTeamIds = [],
  eventId,
}: AddTeamsModalProps) {
  // Seeding into a stage/group draws from the event's REGISTERED teams only; registering onto the
  // event itself (mode "event", or no eventId) still offers the full team roster.
  const registeredOnly = mode !== "event" && !!eventId;
  const { token } = useAuth();
  const [open, setOpen] = useState(false);

  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Fetch teams when modal opens
  useEffect(() => {
    if (!open || !token) return;
    setLoading(true);
    setSelected([]);
    setSearch("");
    // registered-teams/ (event's registered pool) for seeding; get-all-teams/ (whole roster) for
    // registering teams onto the event. Both return the same {teams:[...]} shape.
    const url = registeredOnly
      ? `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/seeding/registered-teams/?event_id=${eventId}`
      : `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/get-all-teams/`;
    axios
      .get(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => setTeams(res.data.teams ?? []))
      .catch(() => toast.error("Failed to load teams."))
      .finally(() => setLoading(false));
  }, [open, token, registeredOnly, eventId]);

  // Filter the loaded teams list against the search box using the shared matchesSearch helper
  // (punctuation/space/accent insensitive, folds stylized fancy-font names), so a team like "V-E"
  // is found by typing "ve". Match across name and tag.
  const filtered = teams.filter((t) =>
    matchesSearch([t.team_name, t.team_tag], search),
  );

  const toggle = (id: number) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  // The refusal, kept in state so it can be SHOWN rather than toasted away.
  const [blocked, setBlocked] = useState<BlockedTeam[] | null>(null);
  const [waiveReason, setWaiveReason] = useState("");

  // A waiver can only cover codes the backend treats as waivable. A ban is never waivable, so the
  // offer is hidden entirely rather than shown and then refused.
  const allWaivable =
    !!blocked && blocked.length > 0 &&
    blocked.every((t) => t.codes.every((c) => WAIVABLE.has(c)));

  const handleSubmit = async (waive = false) => {
    if (selected.length === 0) return;
    if (waive && !waiveReason.trim()) {
      toast.error("Give a reason for the waiver. It is recorded against your name.");
      return;
    }
    setSubmitting(true);
    try {
      await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}${ENDPOINT[mode]}`,
        {
          [BODY_KEY[mode]]: targetId,
          team_ids: selected,
          ...(waive ? { waive: true, reason: waiveReason.trim() } : {}),
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(
        waive
          ? `${selected.length} team${selected.length > 1 ? "s" : ""} added with a recorded waiver.`
          : `${selected.length} team${selected.length > 1 ? "s" : ""} added to ${targetName}.`,
      );
      setBlocked(null);
      setWaiveReason("");
      setOpen(false);
      onSuccess?.();
    } catch (err: any) {
      const data = err?.response?.data;
      // The gate refused, and it told us exactly why. Show it instead of a shrug.
      if (data?.code === "requirements_unmet" && Array.isArray(data.blocked)) {
        setBlocked(data.blocked);
      } else {
        toast.error(data?.message || data?.detail || "Failed to add teams.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        <IconUserPlus className="size-4 mr-1.5" />
        {LABEL[mode]}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{LABEL[mode]}</DialogTitle>
            <DialogDescription>
              {registeredOnly ? (
                <>
                  Select from teams <strong>registered for this event</strong> to add to{" "}
                  <strong>{targetName}</strong>. Teams already added are disabled.
                </>
              ) : (
                <>
                  Select teams to add to <strong>{targetName}</strong>. Teams already added are
                  disabled.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            {/* Search */}
            <div className="relative">
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search teams..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Team list */}
            {loading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground gap-2 text-sm">
                <IconLoader2 className="size-4 animate-spin" />
                Loading teams...
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">
                {teams.length === 0
                  ? registeredOnly
                    ? "No registered teams for this event yet. Teams register first, then you seed them."
                    : "No teams found."
                  : "No teams match your search."}
              </p>
            ) : (
              <ScrollArea className="h-72 rounded-md border">
                <div className="p-1">
                  {filtered.map((team) => {
                    const alreadyAdded = existingTeamIds.includes(team.team_id);
                    const isSelected = selected.includes(team.team_id);
                    return (
                      <label
                        key={team.team_id}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-md select-none transition-colors ${
                          alreadyAdded
                            ? "opacity-40 cursor-not-allowed"
                            : "hover:bg-muted cursor-pointer"
                        }`}
                      >
                        <Checkbox
                          checked={isSelected}
                          disabled={alreadyAdded}
                          onCheckedChange={() =>
                            !alreadyAdded && toggle(team.team_id)
                          }
                        />
                        <div className="size-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0 uppercase">
                          {team.team_name.charAt(0)}
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="text-sm font-medium truncate">
                            {team.team_name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {team.member_count} member
                            {team.member_count !== 1 ? "s" : ""} •{" "}
                            {team.country}
                          </span>
                        </div>
                        {alreadyAdded && (
                          <Badge variant="secondary" className="text-xs shrink-0">
                            Added
                          </Badge>
                        )}
                      </label>
                    );
                  })}
                </div>
              </ScrollArea>
            )}

            {/* ── WHY THE ADD WAS REFUSED ────────────────────────────────────────────────────
                Shown in place of the old one-line toast. Filled surface, no outline: the house
                rule bans building structure out of hairlines. */}
            {blocked && blocked.length > 0 && (
              <div className="rounded-md bg-muted/60 p-3 space-y-3">
                <p className="text-sm font-semibold">
                  {blocked.length === 1
                    ? "1 team cannot be added yet"
                    : `${blocked.length} teams cannot be added yet`}
                </p>

                {/* Capped and scrollable: on a phone a dozen blocked teams would otherwise push
                    the reason box and the waive button off the bottom of the dialog, which is the
                    one place this panel could recreate the dead end it exists to remove. */}
                <div className="space-y-2.5 max-h-48 overflow-y-auto">
                  {blocked.map((team) => (
                    <div key={team.team_id} className="space-y-1">
                      <p className="text-sm font-medium">{team.team_name}</p>
                      <ul className="space-y-0.5">
                        {summarise(team).map((line, i) => (
                          <li key={i} className="text-xs text-muted-foreground">
                            {line}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

                {allWaivable ? (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      You can add them anyway. The waiver is recorded against your name, with your
                      reason, so the decision stays visible afterwards.
                    </p>
                    <Input
                      placeholder="Why are you waiving this?"
                      value={waiveReason}
                      onChange={(e) => setWaiveReason(e.target.value)}
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      className="w-full"
                      onClick={() => handleSubmit(true)}
                      disabled={submitting || !waiveReason.trim()}
                    >
                      {submitting && (
                        <IconLoader2 className="size-4 animate-spin mr-2" />
                      )}
                      Waive and add anyway
                    </Button>
                  </div>
                ) : (
                  // A ban is never waivable, at any price, so say so rather than offering a button
                  // the backend would refuse.
                  <p className="text-xs text-muted-foreground">
                    This cannot be waived. Remove the affected team from your selection, or lift
                    the ban first.
                  </p>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-sm text-muted-foreground">
                {selected.length > 0
                  ? `${selected.length} selected`
                  : "None selected"}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    // Clear any previous refusal so the panel reflects THIS attempt.
                    setBlocked(null);
                    handleSubmit();
                  }}
                  disabled={submitting || selected.length === 0}
                >
                  {submitting && (
                    <IconLoader2 className="size-4 animate-spin mr-2" />
                  )}
                  Add {selected.length > 0 ? `(${selected.length})` : ""}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
