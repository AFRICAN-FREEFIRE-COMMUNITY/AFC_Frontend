"use client";

import { useTransition } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  IconTrophy,
  IconCrosshair,
  IconAward,
  IconStar,
  IconUserCheck,
  IconX,
  IconBrandDiscord,
  IconShieldCheck,
  IconMessage,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { Loader } from "@/components/Loader";
import { DEFAULT_PROFILE_PICTURE } from "@/constants";
import { formatDate } from "@/lib/utils";
import { env } from "@/lib/env";
import axios from "axios";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ApplicationRecord {
  id: number;
  player: string;
  team: string;
  post_id: number;
  status: string;
  contact_unlocked: boolean;
  invite_expires_at: string | null;
  applied_at: string;
  uid: string;
  discord_username: string;
  primary_role: string;
  secondary_role: string;
  country: string | null;
  is_banned: boolean;
  application_message: string | null;
  tournament_wins: number;
  total_tournament_kills: number;
  tournament_finals_appearances: number;
  scrims_kills: number;
  scrims_wins: number;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-900/20 text-yellow-400 border-yellow-800",
  SHORTLISTED: "bg-cyan-900/20 text-cyan-400 border-cyan-800",
  INVITED: "bg-blue-900/20 text-blue-400 border-blue-800",
  ACCEPTED: "bg-green-900/20 text-green-400 border-green-800",
  TRIAL_EXTENDED: "bg-purple-900/20 text-purple-400 border-purple-800",
  TRIAL_ONGOING: "bg-indigo-900/20 text-indigo-400 border-indigo-800",
  REJECTED: "bg-red-900/20 text-red-400 border-red-800",
};

export function getStatusBadge(status: string) {
  return (
    <Badge
      variant="outline"
      className={`text-xs ${STATUS_COLORS[status] ?? ""}`}
    >
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  app: ApplicationRecord | null;
  token: string | null | undefined;
  onClose: () => void;
  onStatusUpdated: (updatedApp: ApplicationRecord) => void;
}

export function ReviewApplicationDialog({
  app,
  token,
  onClose,
  onStatusUpdated,
}: Props) {
  const [pending, startTransition] = useTransition();

  const handleUpdateStatus = (action: "SHORTLIST" | "INVITE" | "REJECT") => {
    if (!app) return;
    startTransition(async () => {
      try {
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/player-market/update-application-status/`,
          { application_id: app.id, action },
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const label =
          action === "SHORTLIST"
            ? "Shortlisted"
            : action === "INVITE"
              ? "Invited to trial"
              : "Rejected";
        toast.success(`${label} successfully!`);
        // Pass back the updated record (use API response if available, else patch locally)
        const updated: ApplicationRecord = res.data?.application ?? {
          ...app,
          status:
            action === "SHORTLIST"
              ? "SHORTLISTED"
              : action === "INVITE"
                ? "INVITED"
                : "REJECTED",
        };
        onStatusUpdated(updated);
        onClose();
      } catch (error: any) {
        toast.error(
          error?.response?.data?.message || "Failed to update status.",
        );
      }
    });
  };

  const isTrialOngoing = app?.status === "TRIAL_ONGOING";

  return (
    <Dialog open={!!app} onOpenChange={(open) => { if (!open) onClose(); }}>
      {app && (
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          {/* ── Header ── */}
          <DialogHeader>
            <div className="flex items-start gap-3">
              <Avatar className="h-12 w-12 shrink-0">
                <AvatarImage
                  src={DEFAULT_PROFILE_PICTURE}
                  alt={app.player}
                />
                <AvatarFallback>
                  {app.player.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <DialogTitle className="text-lg">{app.player}</DialogTitle>
                  {getStatusBadge(app.status)}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Applied on {formatDate(app.applied_at)}
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-5">
            {/* ── Player Overview ── */}
            <div>
              <h4 className="text-sm font-semibold mb-3">Player Overview</h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">IGN</p>
                  <p className="font-medium">{app.player}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">UID</p>
                  <p className="font-medium font-mono text-xs">{app.uid}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <IconBrandDiscord className="h-3 w-3" /> Discord
                  </p>
                  <p className="font-medium text-xs">
                    {app.contact_unlocked ? (
                      app.discord_username || "—"
                    ) : (
                      <span className="italic text-muted-foreground">
                        Unlocks after trial invite
                      </span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Country</p>
                  <p className="font-medium">{app.country || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Primary Role</p>
                  <p className="font-medium">{app.primary_role || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Secondary Role
                  </p>
                  <p className="font-medium">{app.secondary_role || "—"}</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* ── Performance Snapshot ── */}
            <div>
              <h4 className="text-sm font-semibold mb-3">
                Performance Snapshot
              </h4>
              <div className="grid grid-cols-3 gap-2 mb-2">
                <div className="bg-muted/40 rounded-lg p-3 text-center">
                  <IconTrophy className="h-4 w-4 mx-auto mb-1 text-yellow-400" />
                  <p className="text-xl font-bold">{app.tournament_wins}</p>
                  <p className="text-xs text-muted-foreground leading-tight">
                    Tournament Wins
                  </p>
                </div>
                <div className="bg-muted/40 rounded-lg p-3 text-center">
                  <IconCrosshair className="h-4 w-4 mx-auto mb-1 text-red-400" />
                  <p className="text-xl font-bold">
                    {app.total_tournament_kills}
                  </p>
                  <p className="text-xs text-muted-foreground leading-tight">
                    Tournament Kills
                  </p>
                </div>
                <div className="bg-muted/40 rounded-lg p-3 text-center">
                  <IconAward className="h-4 w-4 mx-auto mb-1 text-blue-400" />
                  <p className="text-xl font-bold">
                    {app.tournament_finals_appearances}
                  </p>
                  <p className="text-xs text-muted-foreground leading-tight">
                    Finals Appearances
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-muted/40 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Scrim Kills</p>
                  <p className="text-xl font-bold">{app.scrims_kills}</p>
                </div>
                <div className="bg-muted/40 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Scrim Wins</p>
                  <p className="text-xl font-bold">{app.scrims_wins}</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* ── Eligibility ── */}
            <div>
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                <IconShieldCheck className="h-4 w-4" />
                Eligibility & Compliance
              </h4>
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  Ban Status
                </p>
                <Badge
                  variant="outline"
                  className={
                    app.is_banned
                      ? "text-red-400 border-red-800"
                      : "text-green-400 border-green-800"
                  }
                >
                  {app.is_banned ? "Banned" : "Clear"}
                </Badge>
              </div>
            </div>

            {/* ── Application Message ── */}
            {app.application_message && (
              <>
                <Separator />
                <div>
                  <h4 className="text-sm font-semibold mb-2">
                    Application Message
                  </h4>
                  <p className="text-sm text-muted-foreground italic">
                    &ldquo;{app.application_message}&rdquo;
                  </p>
                </div>
              </>
            )}
          </div>

          {/* ── Actions ── */}
          <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
            {!isTrialOngoing && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                disabled={pending}
                onClick={() => handleUpdateStatus("SHORTLIST")}
              >
                {pending ? (
                  <Loader text="Shortlisting..." />
                ) : (
                  <>
                    <IconStar className="h-4 w-4 mr-1.5" />
                    Shortlist
                  </>
                )}
              </Button>
            )}

            {isTrialOngoing ? (
              <Button size="sm" className="flex-1" asChild>
                <Link href={`/player-markets/applications/${app.id}`}>
                  <IconMessage className="h-4 w-4 mr-1.5" />
                  View & Chat
                </Link>
              </Button>
            ) : (
              <Button
                size="sm"
                className="flex-1"
                disabled={pending}
                onClick={() => handleUpdateStatus("INVITE")}
              >
                {pending ? (
                  <Loader text="Inviting..." />
                ) : (
                  <>
                    <IconUserCheck className="h-4 w-4 mr-1.5" />
                    Invite to Trial
                  </>
                )}
              </Button>
            )}

            <Button
              variant="destructive"
              size="sm"
              className="flex-1"
              disabled={pending}
              onClick={() => handleUpdateStatus("REJECT")}
            >
              {pending ? (
                <Loader text="Rejecting..." />
              ) : (
                <>
                  <IconX className="h-4 w-4 mr-1.5" />
                  Reject
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
