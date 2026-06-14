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
} from "@tabler/icons-react";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Props {
  match: { match_id: number; match_name: string };
  formData: any;
  onNext: () => void;
  onBack: () => void;
  /** Skips the event-details fetch when participant type is already known */
  participantTypeOverride?: "solo" | "team";
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
  uid: string;
  name: string;
  kills: number;
  reason: string;
  other_team_name?: string;
}
interface RosterNoUidRow {
  tournament_team_id: number;
  user_id: number;
  username: string;
}
interface UploadResult {
  parsed_teams: number;
  saved_teams: number;
  saved_players: number;
  missing_teams: string[];
  attributed: AttributedRow[];
  unknown_uids: UnknownRow[];
  roster_no_uid: RosterNoUidRow[];
  unmatched_count: number;
}

// Human label for each unknown-UID reason the backend can return.
const REASON_LABEL: Record<string, string> = {
  not_on_roster: "Not on this team's roster",
  belongs_to_other_team: "On another team",
  team_not_on_site: "Team not on the site",
  duplicate_in_file: "Listed twice (counted once)",
  no_team_stats: "Could not save, re-upload",
};

export function FileUploadStep({ match, formData, onNext, onBack, participantTypeOverride }: Props) {
  const { token } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileType, setFileType] = useState("match_result_file");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [participantType, setParticipantType] = useState<"team" | "solo" | null>(null);
  const [loadingType, setLoadingType] = useState(true);
  const [uploading, setUploading] = useState(false);
  // When the team upload returns flagged players (unknown UIDs / missing teams / players with no
  // UID), we hold the drawer open on a review panel instead of auto-advancing, so the admin sees
  // exactly which kills were credited and which UIDs need reconciling.
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

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
      const hasFlags =
        participantType === "team" &&
        (unknownUids.length > 0 ||
          missingTeams.length > 0 ||
          rosterNoUid.length > 0);

      if (hasFlags) {
        setUploadResult({
          parsed_teams: data.parsed_teams ?? 0,
          saved_teams: data.saved_teams ?? 0,
          saved_players: data.saved_players ?? 0,
          missing_teams: missingTeams,
          attributed: Array.isArray(data.attributed) ? data.attributed : [],
          unknown_uids: unknownUids,
          roster_no_uid: rosterNoUid,
          unmatched_count: data.unmatched_count ?? unknownUids.length,
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
                      {rows.map((r, i) => (
                        <div
                          key={`${r.uid}-${i}`}
                          className="flex items-center gap-2 px-3 py-2 text-xs"
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
                            {r.reason === "belongs_to_other_team" &&
                            r.other_team_name
                              ? `: ${r.other_team_name}`
                              : ""}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
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

          {/* Team blocks where NO player UID matched any roster member */}
          {uploadResult.missing_teams.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                Teams not found on the site (
                {uploadResult.missing_teams.length})
              </div>
              <p className="text-xs text-muted-foreground">
                None of the players in these teams matched a registered roster,
                so the teams were skipped.
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
          Choose the data source type and upload the file for leaderboard
          extraction.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2 space-y-6">
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

        {/* File picker */}
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
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-lg border border-dashed p-8 flex flex-col items-center gap-2 text-muted-foreground hover:border-primary/60 hover:text-primary transition-colors"
            >
              <IconUpload size={24} />
              <span className="text-sm font-medium">Click to select file</span>
              <span className="text-xs">.txt or debugger files</span>
            </button>
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
            onClick={handleUpload}
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
      </CardContent>
    </Card>
  );
}
