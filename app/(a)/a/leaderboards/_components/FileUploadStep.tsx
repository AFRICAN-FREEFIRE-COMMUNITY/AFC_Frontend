"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  IconUpload,
  IconFile,
  IconX,
  IconLoader2,
  IconAlertTriangle,
  IconCircleCheck,
  IconStack2,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
// i18n: this upload step is reused inside the ORGANIZER leaderboard flow (a non-exempt surface),
// so the new booyah "map winner missing" banner below is internationalized. Keys live in the
// flaggedKills namespace, the same one the sibling FlaggedKillsPanel uses (same feature area).
import { useTranslations } from "next-intl";
// "All maps at once" mode (owner 2026-06-25): the 3D Room File picker can upload a single map OR
// every map in the group at once. The multi-map panel is the same one the standalone "Upload all
// maps (.log)" button uses — reused here so the all-maps option lives INSIDE the 3D Room File flow.
import { MultiMapLogPanel, type MatchOption } from "./MultiMapLogUpload";
// Shared watchlist client (lib/watchlist.ts). The upload review lets admins flag teams/players
// straight from the off-roster flags here; entries land on the AFC-wide advisory watchlist that
// powers <WatchTag> elsewhere (registered teams, leaderboard standings, /a/watchlist).
import { watchlistApi } from "@/lib/watchlist";
import { IconEye, IconCheck } from "@tabler/icons-react";
// Flagged-kill approval client (name-matching feature). The review panel can approve a name-matched
// or cross-team player's kills inline via the SAME PATCH the <FlaggedKillsPanel/> uses
// (events/flagged-kills/flag/). No new endpoint: flaggedKillsApi.setFlag(flag_id, count, token).
import { flaggedKillsApi } from "@/lib/flaggedKills";

interface Props {
  match: { match_id: number; match_name: string };
  formData: any;
  onNext: () => void;
  onBack: () => void;
  /** Skips the event-details fetch when participant type is already known */
  participantTypeOverride?: "solo" | "team";
  /** The current group's matches (map slots). When provided, the "All maps at once" toggle shows
   *  so admins/orgs can upload every map's .log in one pass (reuses MultiMapLogPanel). */
  groupMatches?: MatchOption[];
  /** Called after the all-maps panel applies, so the parent can refresh the leaderboard + flags. */
  onAllMapsApplied?: () => void;
  /** Called after a flag is approved/excluded inline (name-matching feature), so the parent can
   *  refetch the leaderboard + bump the FlaggedKillsPanel refresh key. Same body as onAllMapsApplied. */
  onFlagsChanged?: () => void;
  /** Gates the all-maps Review/Apply buttons (organizer passes can_upload_results). Default true. */
  canManage?: boolean;
}

// ── Response contract from /events/upload-team-match-result/ (see views.upload_team_match_result) ──
// The room-file upload attributes kills BY in-game UID. The backend now returns, alongside the
// counts, which players were credited (attributed) and which UIDs could NOT be credited
// (unknown_uids) so this component can FLAG them to the admin/organizer instead of silently
// dropping them (the old bug). roster_no_uid = registered players who never set a UID.
interface AttributedRow {
  team_name: string;
  site_team_name: string;
  username: string;
  uid: string;
  kills: number;
}
interface UnknownRow {
  team_name: string;
  site_team_name: string | null;
  tournament_team_id: number | null;
  // The site team this UID's block resolved to (when the team exists on the site). Drives the
  // per-row "Watch team" button so an admin can flag the offending team straight from the review.
  site_team_id?: number | null;
  uid: string;
  name: string;
  kills: number;
  reason: string;
  other_team_name?: string;
  // belongs_to_other_team rows carry the registered identity of the player who showed up under
  // the wrong team, so we can offer a "Watch player" button (watch the user, not the team).
  registered_user_id?: number | null;
  other_team_id?: number | null;
  // Name-matching feature (reasons name_matched_uid_changed / name_matched_other_team): the roster
  // member this file player matched BY NAME, plus the pending MatchKillFlag's id so we can approve
  // it inline. scope tells whether the matched member is on THIS team or another one.
  matched_user_id?: number | null;
  matched_username?: string | null;
  flag_id?: number | null;
  scope?: "same_team" | "other_team";
}
interface RosterNoUidRow {
  tournament_team_id: number;
  user_id: number;
  username: string;
}
// A team that EXISTS on the site but whose uploaded players' UIDs are off-roster (ringers / alt
// accounts). Surfaced as its own review section with an "Add to watchlist" button (TASK 1b).
interface RosterMismatchTeam {
  team_name: string;          // in-game / uploaded block name
  site_team_name: string;     // the matched team's name on the site
  site_team_id: number;       // afc team PK -> watchlistApi.add({ team_id })
  tournament_team_id: number;
}
// Booyah "map winner missing" flag from /events/upload-team-match-result/. When the uploaded map
// has no stored 1st-place team it contributes 0 booyahs, so the backend tells us WHY:
//   • winner_unmatched      — a 1st-place block existed but did not match a registered team (team_name set)
//   • no_first_place_in_file — the file had no 1st place at all
// Surfaced as a heads-up banner in the review panel below so the undercount is visible, not silent.
interface MissingWinner {
  reason: "winner_unmatched" | "no_first_place_in_file";
  team_name?: string;
  placement?: number;
}
interface UploadResult {
  parsed_teams: number;
  saved_teams: number;
  saved_players: number;
  missing_teams: string[];
  attributed: AttributedRow[];
  unknown_uids: UnknownRow[];
  roster_no_uid: RosterNoUidRow[];
  // Teams present on the site but flagged for off-roster players (see RosterMismatchTeam).
  roster_mismatch_teams: RosterMismatchTeam[];
  // Booyah undercount flag: null when the map's 1st place is properly attributed (see MissingWinner).
  missing_winner: MissingWinner | null;
  unmatched_count: number;
  // Every team registered for this event (owner 2026-06-30): options for the missing-teams resolver,
  // so the admin can attribute an unmatched in-game block to a registered team (or leave it dropped).
  event_teams?: { tournament_team_id: number; team_name: string }[];
}

// Human label for each unknown-UID reason the backend can return.
const REASON_LABEL: Record<string, string> = {
  not_on_roster: "Not on this team's roster",
  belongs_to_other_team: "On another team",
  team_not_on_site: "Team not on the site",
  duplicate_in_file: "Listed twice (counted once)",
  no_team_stats: "Could not save, re-upload",
  team_exists_roster_mismatch: "Team exists, players not on roster",
  // Name-matching feature: pending flags an admin approves inline below.
  name_matched_uid_changed: "Name matched, UID changed",
  name_matched_other_team: "Name matches another team",
};

// Reasons whose flag can be approved/excluded inline (name-matching feature). Each arrives pending
// (count_kills=false on the backend); the admin flips it via flaggedKillsApi.setFlag. Rows without a
// flag_id (e.g. dry-run preview, or genuinely unknown UIDs) get the Watch button instead.
const APPROVABLE_REASONS = new Set<string>([
  "name_matched_uid_changed",
  "name_matched_other_team",
  "belongs_to_other_team",
]);

export function FileUploadStep({
  match,
  formData,
  onNext,
  onBack,
  participantTypeOverride,
  groupMatches,
  onAllMapsApplied,
  onFlagsChanged,
  canManage = true,
}: Props) {
  const { token } = useAuth();
  // Translations for the booyah "map winner missing" banner (flaggedKills namespace).
  const t = useTranslations("flaggedKills");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileType, setFileType] = useState("match_result_file");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  // Drag-and-drop highlight for the single-file dropzone (native HTML5, no library).
  const [isDragging, setIsDragging] = useState(false);
  // Single map vs every map in the group. "all" renders MultiMapLogPanel (only offered when
  // groupMatches is supplied by the parent leaderboard page).
  const [scope, setScope] = useState<"single" | "all">("single");
  const [participantType, setParticipantType] = useState<"team" | "solo" | null>(null);
  const [loadingType, setLoadingType] = useState(true);
  const [uploading, setUploading] = useState(false);
  const canChooseAllMaps = (groupMatches?.length ?? 0) > 0;
  // When the team upload returns flagged players (unknown UIDs / missing teams / players with no
  // UID), we hold the drawer open on a review panel instead of auto-advancing, so the admin sees
  // exactly which kills were credited and which UIDs need reconciling.
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  // Track which watchlist subjects have already been added from this review so we can disable the
  // button (and stop double-adds). Keyed by a stable string so teams + players never collide:
  // `team:<id>` / `player:<id>`. busyWatchKey marks the one in-flight add.
  const [addedWatchKeys, setAddedWatchKeys] = useState<Set<string>>(new Set());
  const [busyWatchKey, setBusyWatchKey] = useState<string | null>(null);
  // ── Inline flag approval state (name-matching feature) ───────────────────────
  // Mirrors the watchlist add pattern above: approvedKeys records which flags the admin already
  // resolved here (keyed `approve:<flag_id>` -> true=counted / false=excluded) so the row flips to a
  // disabled "Counted"/"Excluded" pill; busyApproveKey marks the one in-flight PATCH.
  const [approvedKeys, setApprovedKeys] = useState<Map<string, boolean>>(new Map());
  const [busyApproveKey, setBusyApproveKey] = useState<string | null>(null);


  // ── "Add to watchlist" from the upload review ────────────────────────────────
  // Calls the shared watchlistApi.add (lib/watchlist.ts -> POST auth/watchlist/, Bearer inside).
  // On success the row's button flips to "Added" and stays disabled. source is always "upload" so
  // the watchlist entry records it came from a leaderboard file upload.
  const addToWatch = async (
    key: string,
    input: Parameters<typeof watchlistApi.add>[0],
    successMsg: string,
  ) => {
    if (addedWatchKeys.has(key) || busyWatchKey) return;
    setBusyWatchKey(key);
    try {
      await watchlistApi.add(input);
      setAddedWatchKeys((prev) => new Set(prev).add(key));
      toast.success(successMsg);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Could not add to watchlist");
    } finally {
      setBusyWatchKey(null);
    }
  };

  // ── Approve / exclude a pending flag inline (name-matching feature) ───────────
  // Calls the SAME endpoint the FlaggedKillsPanel uses: flaggedKillsApi.setFlag(flag_id, count) ->
  // PATCH events/flagged-kills/flag/ -> _recompute_team_kills_for_event re-totals the team. count
  // true = approve (kills count), false = exclude. On success the row flips to a disabled pill and we
  // notify the parent (onFlagsChanged) so the leaderboard + FlaggedKillsPanel refresh. Only reachable
  // for rows with a real flag_id (dry-run preview returns flag_id=null -> button hidden).
  const approveCount = async (flagId: number, count: boolean) => {
    if (!token) return;
    const key = `approve:${flagId}`;
    if (approvedKeys.has(key) || busyApproveKey) return;
    setBusyApproveKey(key);
    try {
      await flaggedKillsApi.setFlag(flagId, count, token);
      setApprovedKeys((prev) => new Map(prev).set(key, count));
      toast.success(
        count
          ? "Approved. These kills now count for the team."
          : "Excluded. These kills will not count.",
      );
      onFlagsChanged?.();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Could not update this flag.");
    } finally {
      setBusyApproveKey(null);
    }
  };

  // Resolve participant type - use override if provided, otherwise fetch from event details
  useEffect(() => {
    if (participantTypeOverride) {
      setParticipantType(participantTypeOverride);
      setLoadingType(false);
      return;
    }

    const fetchParticipantType = async () => {
      try {
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
        setParticipantType(
          details.participant_type === "solo" ? "solo" : "team",
        );
      } catch (err) {
        console.error(err);
        setParticipantType("team");
      } finally {
        setLoadingType(false);
      }
    };

    fetchParticipantType();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
  };

  // Native HTML5 file drop for the single-map picker (mirrors the OCR image dropzones). Takes the
  // first dropped file; no type filter (.log/.txt has no reliable MIME and the backend validates).
  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0] ?? null;
    if (file) setSelectedFile(file);
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Please select a file to upload");
      return;
    }
    if (!participantType) return;

    const endpoint =
      participantType === "solo"
        ? `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/upload-solo-match-result/`
        : `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/upload-team-match-result/`;

    const formPayload = new FormData();
    formPayload.append("match_id", match.match_id.toString());
    formPayload.append("file", selectedFile);
    formPayload.append("file_type", fileType);

    setUploading(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          // Do NOT set Content-Type - browser sets it with the boundary
        },
        body: formPayload,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.detail || "Upload failed");
      }

      // Team uploads return the UID-attribution contract; solo does not. If anything was
      // flagged (unknown UIDs, unmatched teams, or rostered players with no UID), keep the
      // drawer open on a review panel rather than silently advancing.
      const unknownUids: UnknownRow[] = Array.isArray(data.unknown_uids)
        ? data.unknown_uids
        : [];
      const missingTeams: string[] = Array.isArray(data.missing_teams)
        ? data.missing_teams
        : [];
      const rosterNoUid: RosterNoUidRow[] = Array.isArray(data.roster_no_uid)
        ? data.roster_no_uid
        : [];
      // Teams on the site whose uploaded players are off-roster (ringers/alts). Surfaced as its
      // own "Add to watchlist" section below (TASK 1b).
      const rosterMismatchTeams: RosterMismatchTeam[] = Array.isArray(
        data.roster_mismatch_teams,
      )
        ? data.roster_mismatch_teams
        : [];
      // Booyah "map winner missing" flag (see MissingWinner). Truthy = this map's 1st place is not
      // attributed to a registered team, so it scores 0 booyahs. Kept in the review panel so the
      // undercount is visible even when it is the ONLY issue (otherwise the drawer would auto-advance).
      const missingWinner: MissingWinner | null =
        data.missing_winner && typeof data.missing_winner === "object"
          ? (data.missing_winner as MissingWinner)
          : null;
      const hasFlags =
        participantType === "team" &&
        (unknownUids.length > 0 ||
          missingTeams.length > 0 ||
          rosterNoUid.length > 0 ||
          rosterMismatchTeams.length > 0 ||
          !!missingWinner);

      if (hasFlags) {
        setUploadResult({
          parsed_teams: data.parsed_teams ?? 0,
          saved_teams: data.saved_teams ?? 0,
          saved_players: data.saved_players ?? 0,
          missing_teams: missingTeams,
          attributed: Array.isArray(data.attributed) ? data.attributed : [],
          unknown_uids: unknownUids,
          roster_no_uid: rosterNoUid,
          roster_mismatch_teams: rosterMismatchTeams,
          missing_winner: missingWinner,
          unmatched_count: data.unmatched_count ?? unknownUids.length,
          event_teams: Array.isArray(data.event_teams) ? data.event_teams : [],
        });
        toast.success(
          unknownUids.length > 0
            ? `Results saved. ${unknownUids.length} unknown UID${
                unknownUids.length === 1 ? "" : "s"
              } flagged, review below.`
            : "Results saved. Some players need review, see below.",
        );
        return; // do NOT auto-advance: let the admin reconcile the flags
      }

      toast.success("Match results uploaded successfully!");
      onNext();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  if (loadingType) {
    return (
      <Card className="gap-0">
        <CardContent className="flex items-center justify-center py-20">
          <IconLoader2 className="animate-spin size-8 text-primary" />
        </CardContent>
      </Card>
    );
  }

  // ── Review panel: shown after a team upload that flagged players ──────────────
  // The file was saved; this panel lets the admin/organizer confirm who got credited and
  // reconcile any UID that played in-game but is not on the team's site roster.
  if (uploadResult) {
    // Group flagged UIDs under the team they played with (in-game block name).
    const unknownByTeam = uploadResult.unknown_uids.reduce<
      Record<string, UnknownRow[]>
    >((acc, row) => {
      const key = row.site_team_name || row.team_name || "Unknown team";
      (acc[key] ||= []).push(row);
      return acc;
    }, {});

    return (
      <Card className="gap-0">
        <CardHeader>
          <CardTitle>{match.match_name} - Review uploaded results</CardTitle>
          <CardDescription>
            Saved {uploadResult.saved_players} player
            {uploadResult.saved_players === 1 ? "" : "s"} across{" "}
            {uploadResult.saved_teams} team
            {uploadResult.saved_teams === 1 ? "" : "s"}. Kills are matched by
            in-game UID. The items below could not be matched and need your
            attention.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2 space-y-5">
          {/* Unknown UIDs: played with a team in-game but not on its site roster */}
          {Object.keys(unknownByTeam).length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-500">
                <IconAlertTriangle size={16} />
                Unrecognised UIDs ({uploadResult.unknown_uids.length})
              </div>
              <p className="text-xs text-muted-foreground">
                These UIDs played in-game but are not on the team&apos;s roster
                on the site, so their kills were not credited to anyone. Add the
                player to the team&apos;s roster (or fix their UID) and
                re-upload.
              </p>
              <div className="space-y-3">
                {Object.entries(unknownByTeam).map(([teamName, rows]) => (
                  <div
                    key={teamName}
                    className="rounded-lg border overflow-hidden"
                  >
                    <div className="px-3 py-2 bg-muted/30 text-xs font-medium">
                      {teamName}
                    </div>
                    <div className="divide-y">
                      {rows.map((r, i) => {
                        // A name-matched / cross-team row whose pending flag can be approved inline
                        // (name-matching feature). flag_id is null in a dry-run preview -> no approve.
                        const canApprove =
                          r.flag_id != null &&
                          APPROVABLE_REASONS.has(r.reason);
                        // The roster member this file player matched by name (same team or other).
                        const isNameMatch =
                          r.reason === "name_matched_uid_changed" ||
                          r.reason === "name_matched_other_team";
                        return (
                          <div
                            key={`${r.uid}-${i}`}
                            className="flex flex-wrap items-center gap-2 px-3 py-2 text-xs"
                          >
                            <span className="font-medium flex-1 truncate">
                              {r.name || "(no name)"}
                            </span>
                            <span className="text-muted-foreground tabular-nums">
                              UID {r.uid}
                            </span>
                            <span className="text-muted-foreground tabular-nums">
                              {r.kills} kill{r.kills === 1 ? "" : "s"}
                            </span>
                            <Badge
                              variant="outline"
                              className="rounded-full px-2 py-0.5 text-[10px] border-amber-500/60 text-amber-500"
                            >
                              {REASON_LABEL[r.reason] ?? r.reason}
                              {/* Append the other team for both legacy cross-team and the new
                                  name_matched_other_team reason. */}
                              {(r.reason === "belongs_to_other_team" ||
                                r.reason === "name_matched_other_team") &&
                              r.other_team_name
                                ? `: ${r.other_team_name}`
                                : ""}
                            </Badge>
                            {/* Name-matching feature: show which roster player this name matched. */}
                            {isNameMatch && r.matched_username ? (
                              <span className="text-[10px] text-muted-foreground truncate">
                                matches {r.matched_username}
                              </span>
                            ) : null}
                            {/* Inline approve / exclude for a pending name-matched or cross-team flag.
                                Once resolved it flips to a disabled pill. */}
                            {canApprove ? (
                              <ApproveRowButtons
                                flagId={r.flag_id!}
                                decision={approvedKeys.get(
                                  `approve:${r.flag_id}`,
                                )}
                                busy={busyApproveKey === `approve:${r.flag_id}`}
                                onApprove={() =>
                                  approveCount(r.flag_id!, true)
                                }
                                onExclude={() =>
                                  approveCount(r.flag_id!, false)
                                }
                              />
                            ) : null}
                            {/* TASK 1c: per-row watchlist shortcuts. Watch the registered PLAYER
                                when this UID belongs to someone on another team; otherwise watch the
                                resolved site TEAM when we know which one this block matched. Kept for
                                genuinely-unknown rows even when an approve control is also shown. */}
                            {r.reason === "belongs_to_other_team" &&
                            r.registered_user_id ? (
                              <WatchRowButton
                                label="Watch player"
                                busy={
                                  busyWatchKey ===
                                  `player:${r.registered_user_id}`
                                }
                                added={addedWatchKeys.has(
                                  `player:${r.registered_user_id}`,
                                )}
                                onClick={() =>
                                  addToWatch(
                                    `player:${r.registered_user_id}`,
                                    {
                                      subject_type: "player",
                                      player_id: r.registered_user_id!,
                                      reason: `Played for ${
                                        r.team_name
                                      } but registered on ${
                                        r.other_team_name ?? "another team"
                                      }`,
                                      source: "upload",
                                      context: `uid ${r.uid}`,
                                    },
                                    "Player added to watchlist",
                                  )
                                }
                              />
                            ) : r.site_team_id ? (
                              <WatchRowButton
                                label="Watch team"
                                busy={busyWatchKey === `team:${r.site_team_id}`}
                                added={addedWatchKeys.has(
                                  `team:${r.site_team_id}`,
                                )}
                                onClick={() =>
                                  addToWatch(
                                    `team:${r.site_team_id}`,
                                    {
                                      subject_type: "team",
                                      team_id: r.site_team_id!,
                                      reason: `Off-roster players in an uploaded result for ${r.team_name}`,
                                      source: "upload",
                                      context: `team ${
                                        r.site_team_name ?? r.team_name
                                      }`,
                                    },
                                    "Team added to watchlist",
                                  )
                                }
                              />
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TASK 1b: Teams that EXIST on the site but whose uploaded players are off-roster
              (ringers / alt accounts). One "Add to watchlist" button per team -> watches the
              resolved site team (subject_type "team", site_team_id). */}
          {uploadResult.roster_mismatch_teams.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-500">
                <IconAlertTriangle size={16} />
                Teams on the site with off-roster players (
                {uploadResult.roster_mismatch_teams.length})
              </div>
              <p className="text-xs text-muted-foreground">
                These teams are registered on the site, but the players who
                showed up in the file are not on their roster. Add the team to
                the watchlist so they are flagged for review.
              </p>
              <div className="rounded-lg border overflow-hidden divide-y">
                {uploadResult.roster_mismatch_teams.map((t) => {
                  const key = `team:${t.site_team_id}`;
                  return (
                    <div
                      key={key}
                      className="flex items-center gap-2 px-3 py-2 text-xs"
                    >
                      <span className="font-medium flex-1 truncate">
                        {t.team_name}
                      </span>
                      {/* The matched site team name (the in-game block name may differ). */}
                      <span className="text-muted-foreground truncate max-w-[40%]">
                        {t.site_team_name}
                      </span>
                      <WatchRowButton
                        label="Add to watchlist"
                        busy={busyWatchKey === key}
                        added={addedWatchKeys.has(key)}
                        onClick={() =>
                          addToWatch(
                            key,
                            {
                              subject_type: "team",
                              team_id: t.site_team_id,
                              reason: `Off-roster players in an uploaded result for ${t.team_name}`,
                              source: "upload",
                              context: `team ${t.site_team_name}`,
                            },
                            "Team added to watchlist",
                          )
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Registered players who have no in-game UID set: cannot be UID-matched */}
          {uploadResult.roster_no_uid.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                Registered players with no UID (
                {uploadResult.roster_no_uid.length})
              </div>
              <p className="text-xs text-muted-foreground">
                These players are on a roster but have no in-game UID on their
                profile, so they can never be matched from a file. Add their UID
                and re-upload.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {uploadResult.roster_no_uid.map((p) => (
                  <Badge
                    key={p.user_id}
                    variant="outline"
                    className="rounded-full px-2 py-0.5 text-xs"
                  >
                    {p.username}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Team blocks that matched NO registered team (owner 2026-06-30): tell the admin they exist;
              the actual attribute/skip resolution lives in ONE place - the "Flagged player kills" panel
              on the leaderboard, where each unmatched team is now listed with an attribute/skip dropdown
              (alongside the per-player flags). So this is just a heads-up, not a second resolver. */}
          {uploadResult.missing_teams.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-orange-400">
                <IconAlertTriangle size={16} />
                Teams not found on the site (
                {uploadResult.missing_teams.length})
              </div>
              <p className="text-xs text-muted-foreground">
                These in-game teams did not match any registered team. Resolve them in the
                &quot;Flagged player kills&quot; panel on the leaderboard: attribute each one to a team,
                or leave it uncounted.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {uploadResult.missing_teams.map((t, i) => (
                  <Badge
                    key={`${t}-${i}`}
                    variant="outline"
                    className="rounded-full px-2 py-0.5 text-xs"
                  >
                    {t}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Booyah "map winner missing" heads-up (backend missing_winner on
              upload-team-match-result): this map has no stored 1st-place team, so it contributes 0
              booyahs and the count is silently short. Same amber warning idiom as the missing_teams
              block above. winner_unmatched names the unmatched 1st-place team; no_first_place_in_file
              means the file itself had no 1st place. */}
          {uploadResult.missing_winner && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-500">
                <IconAlertTriangle size={16} />
                {t("missingWinnerTitle")}
              </div>
              <p className="text-xs text-muted-foreground">
                {uploadResult.missing_winner.reason === "winner_unmatched"
                  ? t("missingWinnerUnmatched", {
                      team: uploadResult.missing_winner.team_name ?? "",
                    })
                  : t("missingWinnerNoFirst")}
              </p>
            </div>
          )}

          {/* Confirmation: players whose kills WERE credited */}
          {uploadResult.attributed.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                <IconCircleCheck size={16} />
                Credited ({uploadResult.attributed.length})
              </div>
              <div className="rounded-lg border max-h-48 overflow-auto divide-y">
                {uploadResult.attributed.map((a, i) => (
                  <div
                    key={`${a.uid}-${i}`}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs"
                  >
                    <span className="font-medium flex-1 truncate">
                      {a.username}
                    </span>
                    <span className="text-muted-foreground truncate max-w-[40%]">
                      {a.site_team_name}
                    </span>
                    <span className="text-muted-foreground tabular-nums">
                      {a.kills} kill{a.kills === 1 ? "" : "s"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-between pt-2">
            <Button
              variant="ghost"
              onClick={() => {
                // Re-upload: clear the result + file, return to the picker.
                setUploadResult(null);
                handleRemoveFile();
              }}
            >
              Upload another file
            </Button>
            <Button onClick={onNext}>Done</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="gap-0">
      <CardHeader>
        <CardTitle>{match.match_name} - 3D Room File Upload</CardTitle>
        <CardDescription>
          {scope === "all"
            ? "Upload every map's room file for this group at once: assign each file to its match, review, then apply."
            : "Choose the data source type and upload the file for leaderboard extraction."}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2 space-y-6">
        {/* Scope toggle (owner 2026-06-25): "This map only" vs "All maps at once". Only shown when
            the parent leaderboard page supplied the group's matches (groupMatches). */}
        {canChooseAllMaps && (
          <div className="space-y-2">
            <Label className="font-medium">Upload scope</Label>
            <div className="inline-flex w-full rounded-lg bg-muted p-1 sm:w-auto">
              <button
                type="button"
                onClick={() => setScope("single")}
                className={cn(
                  "flex-1 rounded-md px-4 py-1.5 text-sm font-medium transition-colors sm:flex-none",
                  scope === "single"
                    ? "bg-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                This map only
              </button>
              <button
                type="button"
                onClick={() => setScope("all")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium transition-colors sm:flex-none",
                  scope === "all"
                    ? "bg-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <IconStack2 size={15} /> All maps at once
              </button>
            </div>
          </div>
        )}

        {scope === "all" && canChooseAllMaps ? (
          /* All-maps mode: reuse MultiMapLogPanel, scoped to this group's matches. participantType
             is resolved by now (loadingType=false), so the panel hits the right endpoint. */
          <div className="space-y-4">
            <MultiMapLogPanel
              matches={groupMatches ?? []}
              token={token}
              participantType={participantType ?? "team"}
              canManage={canManage}
              onChanged={() => onAllMapsApplied?.()}
            />
            <div className="pt-1">
              <Button variant="ghost" onClick={onBack}>
                Back
              </Button>
            </div>
          </div>
        ) : (
          <>
        {/* File type selection */}
        <div className="space-y-2">
          <Label className="font-medium">File Type</Label>
          <RadioGroup
            value={fileType}
            onValueChange={setFileType}
            className="space-y-0"
          >
            <Label
              htmlFor="match"
              className={`flex items-start gap-2 p-4 rounded-lg border cursor-pointer transition-colors ${
                fileType === "match_result_file"
                  ? "border-primary bg-primary/10"
                  : ""
              }`}
            >
              <RadioGroupItem
                value="match_result_file"
                id="match"
                className="mt-1"
              />
              <div className="grid gap-0.5">
                <span className="font-semibold text-sm">Match Results File</span>
                <span className="text-xs text-muted-foreground">
                  Extracts Rank and Kills only.
                </span>
              </div>
            </Label>

            <Label
              htmlFor="debug"
              className={`flex items-start gap-2 p-4 rounded-lg border cursor-pointer transition-colors ${
                fileType === "debugger_file"
                  ? "border-primary bg-primary/10"
                  : ""
              }`}
            >
              <RadioGroupItem
                value="debugger_file"
                id="debug"
                className="mt-1"
              />
              <div className="grid gap-0.5">
                <span className="font-semibold text-sm">Debugger File</span>
                <span className="text-xs text-muted-foreground">
                  Extracts all metrics (Kills, Assists, Damage, etc).
                </span>
              </div>
            </Label>
          </RadioGroup>
        </div>

        {/* File picker (drag-and-drop + click-to-browse) */}
        <div className="space-y-2">
          <Label className="font-medium">Upload File</Label>
          {selectedFile ? (
            <div className="flex items-center gap-3 rounded-lg border px-4 py-3">
              <IconFile size={20} className="text-primary shrink-0" />
              <span className="text-sm flex-1 truncate">{selectedFile.name}</span>
              <button
                onClick={handleRemoveFile}
                className="text-muted-foreground hover:text-destructive"
              >
                <IconX size={16} />
              </button>
            </div>
          ) : (
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleFileDrop}
              className={cn(
                "w-full rounded-lg border border-dashed p-8 flex flex-col items-center gap-2 cursor-pointer transition-colors",
                isDragging
                  ? "border-primary bg-primary/5 text-primary"
                  : "text-muted-foreground hover:border-primary/60 hover:text-primary",
              )}
            >
              <IconUpload size={24} />
              <span className="text-sm font-medium">
                Drag &amp; drop a file here, or click to browse
              </span>
              <span className="text-xs">.txt or debugger files</span>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        <div className="flex justify-between pt-2">
          <Button variant="ghost" onClick={onBack} disabled={uploading}>
            Back
          </Button>
          <Button
            onClick={() => handleUpload()}
            disabled={!selectedFile || uploading}
          >
            {uploading ? (
              <span className="flex items-center gap-2">
                <IconLoader2 size={16} className="animate-spin" />
                Uploading…
              </span>
            ) : (
              "Upload & Continue"
            )}
          </Button>
        </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── WatchRowButton ───────────────────────────────────────────────────────────
// Tiny amber "Add to watchlist" / "Watch team" / "Watch player" button used by the upload review
// rows above. Presentational + stateless: the parent owns the busy/added state and the actual
// watchlistApi.add call (addToWatch). After a successful add it flips to a disabled "Added" pill.
function WatchRowButton({
  label,
  busy,
  added,
  onClick,
}: {
  label: string;
  busy: boolean;
  added: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={busy || added}
      onClick={onClick}
      className="h-6 shrink-0 gap-1 rounded-full border-amber-500/60 px-2 text-[10px] text-amber-600 hover:bg-amber-500/10 dark:text-amber-400"
    >
      {busy ? (
        <IconLoader2 size={12} className="animate-spin" />
      ) : (
        <IconEye size={12} />
      )}
      {added ? "Added" : label}
    </Button>
  );
}

// ── ApproveRowButtons ─────────────────────────────────────────────────────────
// Inline approve / exclude control for a pending name-matched or cross-team flag (name-matching
// feature). Presentational + stateless: the parent (FileUploadStep) owns the busy/decided state and
// the flaggedKillsApi.setFlag call (approveCount). `decision` undefined = not yet resolved (show the
// two buttons); true = approved -> "Counted" pill; false = excluded -> "Excluded" pill.
function ApproveRowButtons({
  flagId,
  decision,
  busy,
  onApprove,
  onExclude,
}: {
  flagId: number;
  decision: boolean | undefined;
  busy: boolean;
  onApprove: () => void;
  onExclude: () => void;
}) {
  // Resolved: collapse to a single disabled pill reflecting the choice.
  if (decision !== undefined) {
    return (
      <Badge
        variant="outline"
        className={
          "h-6 shrink-0 rounded-full px-2 text-[10px] " +
          (decision
            ? "border-green-500/50 text-green-600 dark:text-green-400"
            : "border-muted-foreground/30 text-muted-foreground")
        }
      >
        {decision ? "Counted" : "Excluded"}
      </Badge>
    );
  }
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={onApprove}
        className="h-6 gap-1 rounded-full border-green-500/60 px-2 text-[10px] text-green-600 hover:bg-green-500/10 dark:text-green-400"
        title={`Approve flag #${flagId} to count`}
      >
        {busy ? (
          <IconLoader2 size={12} className="animate-spin" />
        ) : (
          <IconCheck size={12} />
        )}
        Approve to count
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={busy}
        onClick={onExclude}
        className="h-6 shrink-0 rounded-full px-2 text-[10px] text-muted-foreground hover:text-destructive"
      >
        Exclude
      </Button>
    </div>
  );
}
