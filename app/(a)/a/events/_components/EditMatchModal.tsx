"use client";

// Per-MATCH (per-map) room details editor (owner 2026-06-18).
// Behaviour the owner asked for:
//   • Room ID / Room name / Room password start EMPTY when nothing is set for that map (NO browser
//     autofill of the saved login email/password - blocked via autoComplete + off-screen decoys).
//   • On reopen the SAVED values show (we seed from the match's stored room fields).
//   • AUTO-SAVE: typing persists after a short debounce (no Save button); a "Saved" hint confirms it.
//   • "Send to players" broadcasts THIS map's room details to the group (per-map, not whole-group),
//     flushing any pending edit first so the latest values go out.
// Backs POST /events/edit-match-details/ (save) and POST /events/broadcast-match-room-details/ (send).
// Rendered per match row in StagesGroupsTab (admin + organizer event edit pages).

import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { EyeOffIcon, EyeIcon, Check, Loader2, Send } from "lucide-react";
import { IconPencil } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { RoomDeliveryPanel } from "./RoomDeliveryPanel";

export const EditMatchModal = ({
  matchId,
  onSuccess,
  roomId,
  roomName,
  roomPassword,
  roomIs3d,
  matchLabel,
}: {
  matchId: string;
  onSuccess?: () => void;
  roomId: string | null;
  roomName: string | null;
  roomPassword: string | null;
  /** Whether this map's room is a 3D custom room. When on, the player-facing surfaces print the
   *  joining steps under the room id and password, because a 3D room is not joined the same way. */
  roomIs3d?: boolean;
  // Optional map/match label for the dialog title (e.g. "Match 1 - Bermuda").
  matchLabel?: string;
}) => {
  const [open, setOpen] = useState(false);
  const { token } = useAuth();
  // Same namespace the delivery panel below uses. The rest of this modal is still
  // hardcoded English, part of the wider admin translation backlog, but anything added
  // from 2026-08-03 onward is internationalized from creation.
  const t = useTranslations("evEditStages");
  const [isVisible, setIsVisible] = useState(false);

  const [rId, setRId] = useState("");
  const [rName, setRName] = useState("");
  const [rPass, setRPass] = useState("");
  const [r3d, setR3d] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [broadcasting, setBroadcasting] = useState(false);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false); // only auto-save after the user actually edits (not on the seed)
  // Always POST the latest values (avoids stale closure inside the debounce timer).
  const latest = useRef({ rId: "", rName: "", rPass: "", r3d: false });
  latest.current = { rId, rName, rPass, r3d };

  // Seed from the match's SAVED values when the modal opens (owner 2026-06-18: reopen shows what was
  // saved; blank when unset). Deliberately NOT keyed on the room props, so a refetch mid-typing can't
  // clobber the field the user is editing - fresh props are only read on the next open.
  useEffect(() => {
    if (open) {
      setRId(roomId || "");
      setRName(roomName || "");
      setRPass(roomPassword || "");
      setR3d(!!roomIs3d);
      setSaveState("idle");
      dirty.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, matchId]);

  // POST the current values to edit-match-details. Returns true on success.
  const persist = async () => {
    const { rId, rName, rPass, r3d } = latest.current;
    const res = await axios.post(
      `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/edit-match-details/`,
      { match_id: matchId, room_id: rId, room_name: rName, room_password: rPass, room_is_3d: r3d },
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return res;
  };

  // Debounced AUTO-SAVE: 700ms after the last keystroke once the user has edited.
  useEffect(() => {
    if (!open || !dirty.current) return;
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await persist();
        setSaveState("saved");
        // NOTE: do NOT refetch here - a full event refetch re-renders the match list and would
        // close this modal mid-edit. We sync the parent on CLOSE instead (onOpenChange below), so
        // the next open seeds from the freshly-saved values.
      } catch (e: any) {
        setSaveState("idle");
        toast.error(e.response?.data?.message || "Failed to save room details");
      }
    }, 700);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rId, rName, rPass, r3d]);

  // Generic over the value type since the 3D switch sets a boolean while the three room fields set
  // strings. Everything still goes through here so the auto-save only fires once the user has
  // actually edited, rather than on the seed when the modal opens.
  const edit = <T,>(setter: (v: T) => void) => (v: T) => {
    dirty.current = true;
    setter(v);
  };

  // Broadcast THIS map's room details to the group. Flush any pending edit first so the values that
  // go out match what's on screen, then call the per-match broadcast endpoint.
  const broadcastThisMap = async () => {
    setBroadcasting(true);
    try {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (dirty.current) {
        await persist(); // make sure the latest typed values are saved before sending
        setSaveState("saved");
        dirty.current = false;
      }
      const res = await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/broadcast-match-room-details/`,
        { match_id: matchId },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      // Report what actually went out per channel. The backend used to return a WhatsApp
      // count that nobody surfaced, so an organizer could not tell whether the players who
      // rely on WhatsApp got anything. `whatsapp_skipped` counts players with no number on
      // file or who opted out, which is a profile problem, not a delivery failure.
      const d = res.data || {};
      const channels = t("waDelivery.channels", {
        pushed: d.pushed ?? 0,
        emailed: d.emailed ?? 0,
        whatsapped: d.whatsapped ?? 0,
      });
      const skipped = d.whatsapp_skipped
        ? t("waDelivery.skippedNoNumber", { count: d.whatsapp_skipped })
        : "";
      toast.success(
        `${d.message || t("waDelivery.sentFallback")} (${channels}${skipped})`,
      );
      setDeliveryKey((k) => k + 1); // make the delivery panel re-read after a send
      // No refetch here either (keeps the modal open after sending); parent syncs on close.
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Failed to send room details");
    } finally {
      setBroadcasting(false);
    }
  };

  // Bumped after a send so RoomDeliveryPanel re-reads instead of showing pre-send state.
  const [deliveryKey, setDeliveryKey] = useState(0);

  // Release the room ID+PASS to the WAITLIST (owner 2026-07-04): when a registered team no-shows,
  // send this map's room to the waitlist per the event's waitlist mode (or the manual-pick prompt).
  const [releasing, setReleasing] = useState(false);
  const releaseToWaitlist = async () => {
    setReleasing(true);
    try {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (dirty.current) { await persist(); setSaveState("saved"); dirty.current = false; }
      const res = await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/room/release-to-waitlist/`,
        { match_id: matchId },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(res.data?.message || "Room details sent to the waitlist.");
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Failed to release room to the waitlist");
    } finally {
      setReleasing(false);
    }
  };

  // Sync the parent when the modal closes so the next open seeds from the just-saved values
  // (the per-keystroke save deliberately skips the refetch to avoid closing the modal mid-edit).
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      onSuccess?.();
    }
  };

  const nothingEntered = !rId.trim() && !rName.trim() && !rPass.trim();

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <IconPencil className="size-3" />
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[400px]">
        <DialogTitle>
          Room details{matchLabel ? ` - ${matchLabel}` : ""}
        </DialogTitle>

        {/* autoComplete="off" + the off-screen decoys stop Chrome's password manager treating this as
            a LOGIN form and injecting the saved email into Room ID + the saved password into Room
            password (owner 2026-06-18: that browser autofill was the "default that kept coming back"). */}
        <form
          autoComplete="off"
          onSubmit={(e) => e.preventDefault()}
          className="space-y-4 mt-2"
        >
          <input
            type="text"
            name="afc_decoy_username"
            autoComplete="username"
            tabIndex={-1}
            aria-hidden="true"
            className="absolute h-0 w-0 opacity-0 -z-10 pointer-events-none"
          />
          <input
            type="password"
            name="afc_decoy_password"
            autoComplete="new-password"
            tabIndex={-1}
            aria-hidden="true"
            className="absolute h-0 w-0 opacity-0 -z-10 pointer-events-none"
          />

          <div className="space-y-1.5">
            <Label>Room ID</Label>
            <Input
              value={rId}
              onChange={(e) => edit(setRId)(e.target.value)}
              placeholder="Enter room ID"
              autoComplete="off"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Room name</Label>
            <Input
              value={rName}
              onChange={(e) => edit(setRName)(e.target.value)}
              placeholder="Enter room name"
              autoComplete="off"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Room password</Label>
            <div className="relative">
              <Input
                type={isVisible ? "text" : "password"}
                value={rPass}
                onChange={(e) => edit(setRPass)(e.target.value)}
                placeholder="Enter room password"
                autoComplete="new-password"
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-1/2 -translate-y-1/2 end-1 text-muted-foreground/80"
                onClick={() => setIsVisible((v) => !v)}
                aria-label={isVisible ? "Hide password" : "Show password"}
              >
                {isVisible ? (
                  <EyeOffIcon className="size-4" />
                ) : (
                  <EyeIcon className="size-4" />
                )}
              </Button>
            </div>
          </div>

          {/* 3D custom room (owner 2026-08-04). Sits with the credentials because it describes the
              same room. When on, the joining steps are printed under the room id and password on
              the event page and appended to the room-details broadcast, since a 3D room is not
              joined the way an ordinary custom room is. Auto-saves with everything else here. */}
          <div className="flex items-start justify-between gap-3 rounded-md border p-3">
            <div className="space-y-0.5">
              <Label htmlFor={`room-3d-${matchId}`}>{t("room3d.label")}</Label>
              <p className="text-muted-foreground text-xs">{t("room3d.help")}</p>
            </div>
            <Switch
              id={`room-3d-${matchId}`}
              checked={r3d}
              onCheckedChange={(v) => edit(setR3d)(v)}
            />
          </div>

          {/* Auto-save hint + per-map broadcast. */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              {saveState === "saving" && (
                <>
                  <Loader2 className="size-3 animate-spin" /> Saving...
                </>
              )}
              {saveState === "saved" && (
                <>
                  <Check className="size-3 text-primary" /> Saved automatically
                </>
              )}
            </span>
            <Button
              type="button"
              size="sm"
              onClick={broadcastThisMap}
              disabled={broadcasting || nothingEntered}
            >
              {broadcasting ? (
                <Loader2 className="size-4 animate-spin mr-1" />
              ) : (
                <Send className="size-4 mr-1" />
              )}
              Send to players
            </Button>
            {/* Release to the waitlist (owner 2026-07-04): on a no-show, send this map's room ID+PASS
                to the waitlist per the event's waitlist mode (manual mode prompts to pick a team). */}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={releaseToWaitlist}
              disabled={releasing || nothingEntered}
            >
              {releasing ? (
                <Loader2 className="size-4 animate-spin mr-1" />
              ) : (
                <Send className="size-4 mr-1" />
              )}
              Send to waitlist
            </Button>
          </div>

          {/* Who actually received the room ID. "Send to players" goes out over in-app, email AND
              WhatsApp, but only WhatsApp reports back per person, so this is the one channel that
              can answer "did player X get it". Keyed on deliveryKey so a send refreshes it. */}
          <div className="pt-2">
            <RoomDeliveryPanel key={deliveryKey} matchId={matchId} />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
