"use client";

// ── MediaAuditCard (owner 2026-07-02) ────────────────────────────────────────
// Broadcast-media hygiene inside the overlay studio (admin + organizer): see which registered TEAMS
// have no logo and which roster PLAYERS have no esport image; FLAG bad art (the owner gets a
// notification asking for a replacement); SUPPRESS a logo/image from THIS event's broadcast
// surfaces (per-event opt-out, upload untouched) or restore it.
// CONNECTS TO: events/<id>/media-audit|media-flags|media-opt-outs (views_media_audit.py).
// Mounted by EventOverlayStudio. i18n: organizer.mediaAudit.* (en → fr/pt via i18n:translate).
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import axios from "axios";
import { toast } from "sonner";
import Cookies from "js-cookie";

import { env } from "@/lib/env";
import { compressImageForUpload } from "@/lib/imageCompress";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { IconFlag, IconLoader2, IconPhotoOff, IconPhotoCheck, IconUpload } from "@tabler/icons-react";

const authHeaders = () => ({ Authorization: `Bearer ${Cookies.get("auth_token")}` });

interface TeamRow {
  team_id: number;
  team_name: string;
  has_logo: boolean;
  logo_url: string | null;
  suppressed: boolean;
  flagged: boolean;
}
interface PlayerRow {
  user_id: number;
  in_game_name: string;
  team_name: string | null;
  has_image: boolean;
  image_url: string | null;
  suppressed: boolean;
  flagged: boolean;
}

// ── MediaRow: one team-logo / player-image line. MODULE-LEVEL on purpose (owner bug 2026-07-02):
// defined inside the card it was recreated on every state change (lightbox open, upload refetch),
// remounting all rows and resetting the list's scroll to the top. Stable identity + stable keys
// keep the scroll position through zooms and uploads. ──
const MediaRow = ({
    label,
    sub,
    img,
    missing,
    suppressedState,
    flaggedState,
    onFlag,
    onSuppress,
    onUpload,
    uploadingState,
    t,
    onZoom,
  }: {
    label: string;
    sub?: string | null;
    img: string | null;
    missing: boolean;
    suppressedState: boolean;
    flaggedState: boolean;
    onFlag: () => void;
    onSuppress: (remove: boolean) => void;
    onUpload?: (file: File) => void;
    uploadingState?: boolean;
    t: ReturnType<typeof useTranslations>;
    onZoom: (src: string, label: string) => void;
  }) => (
    <div className="flex items-center gap-2 py-1.5">
      {img ? (
        // Click-to-enlarge (owner 2026-07-02): small thumbs are hard to judge; clicking opens the
        // full-size image in a lightbox dialog so logos/esport images can be checked clearly.
        <button
          type="button"
          onClick={() => onZoom(img, label)}
          className="cursor-zoom-in"
          aria-label={`${t("mediaAudit.viewLarger")}: ${label}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img} alt="" className="size-7 rounded border object-contain" />
        </button>
      ) : (
        <IconPhotoOff className="text-muted-foreground size-7 rounded border p-1" />
      )}
      <div className="min-w-0">
        <p className="truncate text-xs font-medium">{label}</p>
        {sub ? <p className="text-muted-foreground truncate text-[0.65rem]">{sub}</p> : null}
      </div>
      <div className="ml-auto flex items-center gap-1">
        {/* Admin upload (owner 2026-07-02): replace or add the media in place. Hidden file input
            triggered by the button; the backend re-encodes + the audit refetches. */}
        {onUpload ? (
          <label className="inline-flex">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUpload(f);
                e.target.value = "";
              }}
            />
            <span
              role="button"
              title={t("mediaAudit.upload")}
              className="hover:bg-accent inline-flex h-6 cursor-pointer items-center rounded-md px-1.5 text-[0.65rem]"
            >
              {uploadingState ? (
                <IconLoader2 className="size-3 animate-spin" />
              ) : (
                <IconUpload className="size-3" />
              )}
            </span>
          </label>
        ) : null}
        {missing ? (
          <Badge variant="outline" className="rounded-full border-amber-500/50 px-2 py-0 text-[0.6rem] text-amber-500">
            {t("mediaAudit.missing")}
          </Badge>
        ) : (
          <>
            {flaggedState ? (
              <Badge variant="outline" className="rounded-full border-red-500/50 px-2 py-0 text-[0.6rem] text-red-500">
                {t("mediaAudit.flaggedBadge")}
              </Badge>
            ) : (
              <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[0.65rem]" onClick={onFlag}>
                <IconFlag className="size-3" />
                {t("mediaAudit.flag")}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-[0.65rem]"
              onClick={() => onSuppress(suppressedState)}
            >
              {suppressedState ? t("mediaAudit.restore") : t("mediaAudit.suppress")}
            </Button>
          </>
        )}
      </div>
    </div>
  );

export function MediaAuditCard({ eventId }: { eventId: number }) {
  const t = useTranslations("organizer");
  // Lightbox (owner 2026-07-02): the clicked thumb's full-size image; null = closed.
  const [lightbox, setLightbox] = useState<{ src: string; label: string } | null>(null);
  // ADMIN media upload (owner 2026-07-02): AFC admins can set a team's logo / a player's esport
  // image right here (POST events/<id>/media-upload/, admin-gated server-side too). Organizers
  // see the panel but not the Upload buttons.
  const { isAdminByRoleOrRoles } = useAuth();
  const [uploading, setUploading] = useState<string | null>(null);

  const uploadMedia = async (
    kind: "team_logo" | "player_image",
    id: number,
    file: File,
  ) => {
    const key = `${kind}-${id}`;
    setUploading(key);
    try {
      const fd = new FormData();
      fd.append("kind", kind);
      fd.append(kind === "team_logo" ? "team_id" : "user_id", String(id));
      fd.append("file", await compressImageForUpload(file));
      await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/${eventId}/media-upload/`,
        fd,
        { headers: { Authorization: `Bearer ${Cookies.get("auth_token")}` } },
      );
      toast.success(t("mediaAudit.uploaded"));
      load();
    } catch {
      toast.error(t("mediaAudit.uploadFailed"));
    } finally {
      setUploading(null);
    }
  };
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [players, setPlayers] = useState<PlayerRow[]>([]);

  const base = `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/${eventId}`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${base}/media-audit/`, { headers: authHeaders() });
      setTeams(res.data.teams ?? []);
      setPlayers(res.data.players ?? []);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("mediaAudit.loadError"));
    } finally {
      setLoading(false);
    }
  }, [base, t]);

  useEffect(() => {
    load();
  }, [load]);

  const flag = async (kind: "team_logo" | "esports_image", id: number) => {
    const reason = window.prompt(t("mediaAudit.flagReasonPrompt")) ?? "";
    try {
      await axios.post(
        `${base}/media-flags/`,
        { kind, team_id: kind === "team_logo" ? id : undefined, user_id: kind === "esports_image" ? id : undefined, reason },
        { headers: authHeaders() },
      );
      toast.success(t("mediaAudit.flagged"));
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("mediaAudit.flagError"));
    }
  };

  const suppress = async (
    kind: "team_logo" | "esports_image",
    id: number,
    remove: boolean,
  ) => {
    try {
      await axios.post(
        `${base}/media-opt-outs/`,
        { kind, team_id: kind === "team_logo" ? id : undefined, user_id: kind === "esports_image" ? id : undefined, remove },
        { headers: authHeaders() },
      );
      toast.success(remove ? t("mediaAudit.restored") : t("mediaAudit.suppressed"));
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("mediaAudit.suppressError"));
    }
  };

  if (loading) {
    return (
      <div className="bg-card rounded-md border p-4 shadow-sm">
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <IconLoader2 className="size-4 animate-spin" />
          {t("mediaAudit.loading")}
        </div>
      </div>
    );
  }

  const missingTeams = teams.filter((x) => !x.has_logo);
  const missingPlayers = players.filter((x) => !x.has_image);


  return (
    <div className="bg-card rounded-md border p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <IconPhotoCheck className="text-primary size-4" />
        <h3 className="text-primary text-sm font-semibold">{t("mediaAudit.title")}</h3>
        <span className="text-muted-foreground ml-auto text-xs">
          {t("mediaAudit.summary", {
            teams: missingTeams.length,
            players: missingPlayers.length,
          })}
        </span>
      </div>
      <p className="text-muted-foreground mb-3 text-xs">{t("mediaAudit.description")}</p>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-muted-foreground mb-1 text-[0.68rem] font-semibold uppercase tracking-wide">
            {t("mediaAudit.teamLogos")}
          </p>
          <div className="divide-border max-h-64 divide-y overflow-y-auto pr-1">
            {teams.length === 0 ? (
              <p className="text-muted-foreground py-3 text-xs italic">{t("mediaAudit.noTeams")}</p>
            ) : (
              teams.map((x) => (
                <MediaRow
                  key={x.team_id}
                  label={x.team_name}
                  img={x.logo_url}
                  missing={!x.has_logo}
                  suppressedState={x.suppressed}
                  flaggedState={x.flagged}
                  onFlag={() => flag("team_logo", x.team_id)}
                  onSuppress={(remove) => suppress("team_logo", x.team_id, remove)}
                  onUpload={isAdminByRoleOrRoles ? (f) => uploadMedia("team_logo", x.team_id, f) : undefined}
                  uploadingState={uploading === `team_logo-${x.team_id}`}
                  t={t}
                  onZoom={(src, label) => setLightbox({ src, label })}
                />
              ))
            )}
          </div>
        </div>
        <div>
          <p className="text-muted-foreground mb-1 text-[0.68rem] font-semibold uppercase tracking-wide">
            {t("mediaAudit.playerImages")}
          </p>
          <div className="divide-border max-h-64 divide-y overflow-y-auto pr-1">
            {players.length === 0 ? (
              <p className="text-muted-foreground py-3 text-xs italic">{t("mediaAudit.noPlayers")}</p>
            ) : (
              players.map((x) => (
                <MediaRow
                  key={x.user_id}
                  label={x.in_game_name}
                  sub={x.team_name}
                  img={x.image_url}
                  missing={!x.has_image}
                  suppressedState={x.suppressed}
                  flaggedState={x.flagged}
                  onFlag={() => flag("esports_image", x.user_id)}
                  onSuppress={(remove) => suppress("esports_image", x.user_id, remove)}
                  onUpload={isAdminByRoleOrRoles ? (f) => uploadMedia("player_image", x.user_id, f) : undefined}
                  uploadingState={uploading === `player_image-${x.user_id}`}
                  t={t}
                  onZoom={(src, label) => setLightbox({ src, label })}
                />
              ))
            )}
          </div>
        </div>
      </div>
      {/* Full-size media lightbox (owner 2026-07-02). */}
      <Dialog open={!!lightbox} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm">{lightbox?.label}</DialogTitle>
          </DialogHeader>
          {lightbox ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={lightbox.src}
              alt={lightbox.label}
              className="max-h-[70vh] w-full rounded-md border object-contain"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
