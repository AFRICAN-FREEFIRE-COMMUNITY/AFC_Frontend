"use client";

// ── Esport media download (owner 2026-06-12; sizes + naming 2026-06-21) ──────
// Admins + organizers download team logos and player esport images as a ZIP: either an
// arbitrary SET of teams/players (DownloadEsportMediaDialog) or everything registered for
// one event (DownloadEventMediaButton). Both call POST /events/download-esport-media/ (see
// afc_tournament_and_scrims.views.download_esport_media) and save the returned ZIP, which
// includes a manifest.txt naming anyone whose asset is missing.
//
// Owner 2026-06-21: the downloader now lets you choose the OUTPUT SIZE and the esport-image
// FILE NAMING before exporting:
//   - esport image size: original | role picture (108x130)
//   - team logo size:     original | gloo wallpaper (1000x1000) | head pic (108x130)
//   - esport file name:   in-game name | UID | both (team logos are always named the team)
//
// CONSUMED BY:
//   - app/(a)/a/teams/page.tsx header ("Download media" dialog: pick teams + players).
//   - app/(a)/a/events/[slug]/page.tsx header (per-event button).
//   - app/(organizer)/organizer/events/page.tsx (per-event button on the org's events).
// DESIGN: AFC constants - rounded-md, text-xs/sm, outline badges. No em dashes.

import { useState } from "react";
import { useTranslations } from "next-intl";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { InfoTip } from "@/components/ui/info-tip";
import { TeamSearchSelect, type PickedTeam } from "@/components/ui/team-search-select";
import { UserSearchSelect, type PickedUser } from "@/components/ui/user-search-select";
import { IconDownload, IconLoader2, IconX } from "@tabler/icons-react";
import { env } from "@/lib/env";

// Output size + naming choices (mirror the backend's accepted values).
export type MediaOptions = {
  esportSize: "original" | "role";
  logoSize: "original" | "gloo" | "head";
  esportNaming: "ign" | "uid" | "both";
};

const DEFAULT_OPTIONS: MediaOptions = {
  esportSize: "original",
  logoSize: "original",
  esportNaming: "both",
};

// POST the selector + options, receive a ZIP blob, hand it to the browser as a file download.
export async function downloadEsportMedia(
  selector: { teamIds?: number[]; playerIds?: number[]; eventId?: number },
  options: MediaOptions = DEFAULT_OPTIONS,
): Promise<void> {
  const token = Cookies.get("auth_token");
  const res = await axios.post(
    `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/download-esport-media/`,
    {
      ...(selector.teamIds?.length ? { team_ids: selector.teamIds } : {}),
      ...(selector.playerIds?.length ? { player_ids: selector.playerIds } : {}),
      ...(selector.eventId ? { event_id: selector.eventId } : {}),
      esport_size: options.esportSize,
      logo_size: options.logoSize,
      esport_naming: options.esportNaming,
    },
    { headers: { Authorization: `Bearer ${token ?? ""}` }, responseType: "blob" },
  );
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

/** The shared size + naming controls, used by both download surfaces.
 *  `showLogo` / `showEsport` hide the sections that don't apply (e.g. an event has both). */
function MediaOptionFields({
  value,
  onChange,
  showLogo = true,
  showEsport = true,
}: {
  value: MediaOptions;
  onChange: (next: MediaOptions) => void;
  showLogo?: boolean;
  showEsport?: boolean;
}) {
  // i18n: "media" ns (messages/en/media.json -> download.*). InfoTip ids stay as-is (they key the
  // help-content registry, not the visible label).
  const t = useTranslations("media");
  const set = (patch: Partial<MediaOptions>) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-3 rounded-md border p-3">
      {showEsport && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">{t("download.esportSizeLabel")}<InfoTip id="media.download.esportSize" className="ml-1" /></Label>
            <Select value={value.esportSize} onValueChange={(v) => set({ esportSize: v as MediaOptions["esportSize"] })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="original">{t("download.originalSize")}</SelectItem>
                <SelectItem value="role">{t("download.esportSizeRole")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("download.esportNamingLabel")}<InfoTip id="media.download.esportNaming" className="ml-1" /></Label>
            <Select value={value.esportNaming} onValueChange={(v) => set({ esportNaming: v as MediaOptions["esportNaming"] })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ign">{t("download.namingIgn")}</SelectItem>
                <SelectItem value="uid">{t("download.namingUid")}</SelectItem>
                <SelectItem value="both">{t("download.namingBoth")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
      {showLogo && (
        <div className="space-y-1">
          <Label className="text-xs">{t("download.logoSizeLabel")}<InfoTip id="media.download.logoSize" className="ml-1" /></Label>
          <Select value={value.logoSize} onValueChange={(v) => set({ logoSize: v as MediaOptions["logoSize"] })}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="original">{t("download.originalSize")}</SelectItem>
              <SelectItem value="gloo">{t("download.logoSizeGloo")}</SelectItem>
              <SelectItem value="head">{t("download.logoSizeHead")}</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">{t("download.logosNamedNote")}</p>
        </div>
      )}
    </div>
  );
}

/** One-click trigger that opens a small dialog to pick size/naming, then downloads the
 *  whole event's logos + esport images. */
export function DownloadEventMediaButton({
  eventId,
  size = "sm",
}: {
  eventId: number;
  size?: "sm" | "md";
}) {
  // i18n: "media" ns (download.*). Consumed on the admin + organizer per-event surfaces.
  const t = useTranslations("media");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [options, setOptions] = useState<MediaOptions>(DEFAULT_OPTIONS);

  const run = async () => {
    setBusy(true);
    try {
      await downloadEsportMedia({ eventId }, options);
      toast.success(t("download.downloaded"));
      setOpen(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("download.downloadFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button type="button" variant="outline" size={size} onClick={() => setOpen(true)}>
        <IconDownload size={14} className="mr-1" />
        {t("download.eventButton")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("download.eventTitle")}</DialogTitle>
            <DialogDescription>
              {t("download.eventDescription")}
            </DialogDescription>
          </DialogHeader>
          <MediaOptionFields value={options} onChange={setOptions} />
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t("download.cancel")}</Button>
            <Button type="button" onClick={run} disabled={busy}>
              {busy ? (
                <span className="flex items-center gap-2"><IconLoader2 size={14} className="animate-spin" />{t("download.preparing")}</span>
              ) : (
                <span className="flex items-center gap-2"><IconDownload size={14} />{t("download.downloadZip")}</span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Pick any set of teams and/or players, choose size/naming, download as one ZIP. */
export function DownloadEsportMediaDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  // i18n: "media" ns (download.*). Consumed on the admin Teams page "Download media" dialog.
  const t = useTranslations("media");
  const [teams, setTeams] = useState<PickedTeam[]>([]);
  const [players, setPlayers] = useState<PickedUser[]>([]);
  const [options, setOptions] = useState<MediaOptions>(DEFAULT_OPTIONS);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setTeams([]);
    setPlayers([]);
    setOptions(DEFAULT_OPTIONS);
  };

  const run = async () => {
    if (!teams.length && !players.length) {
      toast.error(t("download.pickAtLeastOne"));
      return;
    }
    setBusy(true);
    try {
      await downloadEsportMedia(
        { teamIds: teams.map((tm) => tm.team_id), playerIds: players.map((p) => p.user_id) },
        options,
      );
      toast.success(t("download.downloaded"));
      onOpenChange(false);
      reset();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("download.downloadFailed"));
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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("download.setTitle")}</DialogTitle>
          <DialogDescription>
            {t("download.setDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("download.teamsLabel")}</Label>
            <TeamSearchSelect
              value={null}
              onChange={(id, team) => {
                if (id == null || !team) return;
                setTeams((prev) =>
                  prev.some((tm) => tm.team_id === team.team_id) ? prev : [...prev, team],
                );
              }}
              placeholder={t("download.teamsPlaceholder")}
            />
            {teams.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {teams.map((tm) => (
                  <Badge key={tm.team_id} variant="secondary" className="gap-1 pr-1">
                    {tm.team_name}
                    <button
                      type="button"
                      aria-label={t("download.removeTeam", { name: tm.team_name })}
                      className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                      onClick={() =>
                        setTeams((prev) => prev.filter((x) => x.team_id !== tm.team_id))
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
            <Label>{t("download.playersLabel")}</Label>
            <UserSearchSelect
              value={null}
              onChange={(_u, user) => {
                if (!user) return;
                setPlayers((prev) =>
                  prev.some((p) => p.user_id === user.user_id) ? prev : [...prev, user],
                );
              }}
              placeholder={t("download.playersPlaceholder")}
            />
            {players.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {players.map((p) => (
                  <Badge key={p.user_id} variant="secondary" className="gap-1 pr-1">
                    {p.username}
                    <button
                      type="button"
                      aria-label={t("download.removePlayer", { name: p.username })}
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

          {/* Size + naming options (owner 2026-06-21). */}
          <MediaOptionFields value={options} onChange={setOptions} />
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("download.cancel")}
          </Button>
          <Button type="button" onClick={run} disabled={busy}>
            {busy ? (
              <span className="flex items-center gap-2">
                <IconLoader2 size={14} className="animate-spin" />
                {t("download.preparing")}
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <IconDownload size={14} />
                {t("download.downloadZip")}
              </span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
