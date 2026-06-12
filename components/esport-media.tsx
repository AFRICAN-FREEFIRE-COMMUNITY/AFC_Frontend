"use client";

// ── Esport media download (owner 2026-06-12) ─────────────────────────────────
// Admins + organizers can download team logos and player esport images as a ZIP: either an
// arbitrary SET of teams/players (DownloadEsportMediaDialog) or everything registered for one
// event (DownloadEventMediaButton). Both call POST /events/download-esport-media/ (see
// afc_tournament_and_scrims.views.download_esport_media) and save the returned ZIP, which
// includes a manifest.txt naming anyone whose asset is missing.
//
// CONSUMED BY:
//   - app/(a)/a/teams/page.tsx header ("Download media" dialog: pick teams + players).
//   - app/(a)/a/events/[slug]/page.tsx header (per-event button).
//   - app/(organizer)/organizer/events/page.tsx (per-event button on the org's events).
// DESIGN: AFC constants - rounded-md, text-xs/sm, outline badges. No em dashes.

import { useState } from "react";
import axios from "axios";
import Cookies from "js-cookie";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { TeamSearchSelect, type PickedTeam } from "@/components/ui/team-search-select";
import { UserSearchSelect, type PickedUser } from "@/components/ui/user-search-select";
import { IconDownload, IconLoader2, IconX } from "@tabler/icons-react";
import { env } from "@/lib/env";

// POST the selector, receive a ZIP blob, hand it to the browser as a file download.
export async function downloadEsportMedia(selector: {
  teamIds?: number[];
  playerIds?: number[];
  eventId?: number;
}): Promise<void> {
  const token = Cookies.get("auth_token");
  const res = await axios.post(
    `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/download-esport-media/`,
    {
      ...(selector.teamIds?.length ? { team_ids: selector.teamIds } : {}),
      ...(selector.playerIds?.length ? { player_ids: selector.playerIds } : {}),
      ...(selector.eventId ? { event_id: selector.eventId } : {}),
    },
    { headers: { Authorization: `Bearer ${token ?? ""}` }, responseType: "blob" },
  );
  // Filename comes from the backend's Content-Disposition; fall back to a generic name.
  const disposition: string = res.headers["content-disposition"] ?? "";
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? "esport-media.zip";
  const url = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** One-click ZIP of every registered team logo + rostered player esport image for an event. */
export function DownloadEventMediaButton({
  eventId,
  size = "sm",
}: {
  eventId: number;
  size?: "sm" | "md";
}) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      await downloadEsportMedia({ eventId });
      toast.success("Media ZIP downloaded. Check manifest.txt for anything missing.");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to download the media ZIP.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button type="button" variant="outline" size={size} onClick={run} disabled={busy}>
      {busy ? (
        <IconLoader2 size={14} className="mr-1 animate-spin" />
      ) : (
        <IconDownload size={14} className="mr-1" />
      )}
      Download media
    </Button>
  );
}

/** Pick any set of teams and/or players, download their logos + esport images as one ZIP. */
export function DownloadEsportMediaDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [teams, setTeams] = useState<PickedTeam[]>([]);
  const [players, setPlayers] = useState<PickedUser[]>([]);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setTeams([]);
    setPlayers([]);
  };

  const run = async () => {
    if (!teams.length && !players.length) {
      toast.error("Pick at least one team or player.");
      return;
    }
    setBusy(true);
    try {
      await downloadEsportMedia({
        teamIds: teams.map((t) => t.team_id),
        playerIds: players.map((p) => p.user_id),
      });
      toast.success("Media ZIP downloaded. Check manifest.txt for anything missing.");
      onOpenChange(false);
      reset();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to download the media ZIP.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Download esport media</DialogTitle>
          <DialogDescription>
            Pick any teams and players. You get one ZIP with the team logos and player esport
            images, plus a manifest naming anyone who has not uploaded theirs yet.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Teams (logos)</Label>
            <TeamSearchSelect
              value={null}
              onChange={(id, team) => {
                if (id == null || !team) return;
                setTeams((prev) =>
                  prev.some((t) => t.team_id === team.team_id) ? prev : [...prev, team],
                );
              }}
              placeholder="Search and add a team..."
            />
            {teams.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {teams.map((t) => (
                  <Badge key={t.team_id} variant="secondary" className="gap-1 pr-1">
                    {t.team_name}
                    <button
                      type="button"
                      aria-label={`Remove ${t.team_name}`}
                      className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                      onClick={() =>
                        setTeams((prev) => prev.filter((x) => x.team_id !== t.team_id))
                      }
                    >
                      <IconX size={12} />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Players (esport images)</Label>
            <UserSearchSelect
              value={null}
              onChange={(_u, user) => {
                if (!user) return;
                setPlayers((prev) =>
                  prev.some((p) => p.user_id === user.user_id) ? prev : [...prev, user],
                );
              }}
              placeholder="Search and add a player..."
            />
            {players.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {players.map((p) => (
                  <Badge key={p.user_id} variant="secondary" className="gap-1 pr-1">
                    {p.username}
                    <button
                      type="button"
                      aria-label={`Remove ${p.username}`}
                      className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                      onClick={() =>
                        setPlayers((prev) => prev.filter((x) => x.user_id !== p.user_id))
                      }
                    >
                      <IconX size={12} />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={run} disabled={busy}>
            {busy ? (
              <span className="flex items-center gap-2">
                <IconLoader2 size={14} className="animate-spin" />
                Preparing...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <IconDownload size={14} />
                Download ZIP
              </span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
