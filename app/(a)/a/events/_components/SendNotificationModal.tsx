"use client";

// ── Per-group broadcast composer ("Message group") ────────────────────────────
// Rendered once per group in the event-edit "Stages & Groups" tab (StagesGroupsTab),
// which is reused by BOTH the AFC admin edit page (/a/events/<slug>/edit) and the
// organizer edit page (/organizer/events/<slug>/edit). Previously this was an
// UNLABELLED bell icon that only fired a fixed room-details push and 403'd for
// organizers. Now it is a clearly LABELLED "Message group" button opening a small
// composer with two modes:
//   • Room details (auto) - sends each map's Room ID / Name / Password to everyone
//     in the group (no typing).
//   • Custom message       - a free Title + Message to everyone in the group.
//
// Both modes POST to /events/broadcast-to-group/ (backend broadcast_to_group), which
// is gated for AFC event admins OR an organizer who can edit this event, and sends
// ONE in-app notification per recipient (deduped). This replaces the old admin-only
// send-match-room-details endpoint call.
//
// Style mirrors the admin SendMessageModal (app/(a)/a/_components/SendMessageModal.tsx):
// labelled outline trigger + segmented mode choice + Title/Message inputs.

import { useState, useTransition } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BroadcastTokenInserts } from "@/app/(a)/a/_components/BroadcastTokenInserts";
import { Loader } from "@/components/Loader";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { formatLocalTime } from "@/lib/i18n/time";
// Shared organizer broadcast rate-limit UI (5/hour + 5-min cooldown). The notice renders nothing for
// admins (exempt); the hook keeps the counter live across this composer's sends. See lib/broadcasts.tsx.
import { useBroadcastRate, BroadcastRateNotice } from "@/lib/broadcasts";
import { Megaphone, DoorOpen, Pencil, Send, Bell, Mail, BellRing, Hash } from "lucide-react";

// The broadcast modes. "room_details" sends the saved room info for every map; "custom" sends a
// free-text title + message (default for the per-group composer). "letter_assignments" is offered
// ONLY when the caller passes the per-team letter data (see LetterAssignment / the letterAssignments
// prop): it auto-tells each team the letter avatar assigned to them for the event (feature #7 / plan
// B7) by POSTing to /auth/broadcast-letter-assignments/ (afc_auth.broadcast_letter_assignments).
type Mode = "custom" | "room_details" | "letter_assignments";

// One per-team letter assignment supplied by the caller (the admin/org RegisteredTeamsTab, which
// already holds each TournamentTeam.assigned_letter). team_name is for display only; the backend
// resolves recipients + the live team name from team_id.
export type LetterAssignment = {
  team_id: number;
  letter: string;
  team_name?: string;
};

// Delivery channel (owner 2026-06-13): in-app push, email, or both. Email goes out in
// the fixed branded AFC design. Default "both".
type Delivery = "both" | "push" | "email";
const DELIVERY_OPTIONS: { value: Delivery; label: string; icon: typeof Bell }[] = [
  { value: "both", label: "App + Email", icon: BellRing },
  { value: "push", label: "App only", icon: Bell },
  { value: "email", label: "Email only", icon: Mail },
];

export const SendNotificationModal = ({
  eventId,
  groupId,
  groupName,
  stageName,
  onSuccess,
  letterAssignments,
  eventName,
}: {
  eventId: number | undefined;
  groupId: number | undefined;
  // Group + stage names label the dialog ("Broadcast to <stage> > <group>") so the
  // admin/organizer knows exactly which group they're messaging. Optional so callers
  // that don't have them still work.
  groupName?: string;
  stageName?: string;
  onSuccess?: () => void;
  // LETTER ASSIGNMENTS (owner 2026-06-29, feature #7): when supplied, the composer switches to a
  // dedicated "Letter assignments" mode that broadcasts each team its assigned letter for the event
  // (no group needed). Omitted by the existing per-group callers, so their behaviour is unchanged.
  letterAssignments?: LetterAssignment[];
  // Event name for the letter-assignment preview copy (purely cosmetic; backend uses the real name).
  eventName?: string;
}) => {
  const { token } = useAuth();
  // Rate-limit copy lives in the `broadcast` i18n namespace (organizer-facing surface).
  const t = useTranslations("broadcast");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  // Organizer broadcast budget for THIS composer: fetched each time it opens; kept live on send.
  // Admins are exempt → the notice renders nothing and behaviour is unchanged.
  const { rate, applySuccess, apply429 } = useBroadcastRate(open);

  // Letter-assignment mode is available ONLY when the caller passes the per-team letter data. With no
  // such prop the composer is exactly the old per-group composer (custom / room-details). When present,
  // it becomes a focused "Broadcast assignments" composer (the per-group modes are hidden, since letter
  // assignments are event-wide and need no group).
  const hasLetterMode = !!letterAssignments && letterAssignments.length > 0;
  const defaultMode: Mode = hasLetterMode ? "letter_assignments" : "custom";

  const [mode, setMode] = useState<Mode>(defaultMode);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [delivery, setDelivery] = useState<Delivery>("both");

  const reset = () => {
    setMode(defaultMode);
    setTitle("");
    setMessage("");
    setDelivery("both");
  };

  // Shared error toast for both send paths. A 429 = the organizer hit the hourly cap or the 5-min
  // cooldown: reflect the block in the live counter and name when sending re-opens (viewer timezone).
  const notifyError = (e: any, fallback: string) => {
    if (e.response?.status === 429) {
      const body = e.response.data || {};
      apply429(body);
      const when = formatLocalTime(body.resets_at, "time");
      toast.error(
        `${body.message || t("rate.limitReached")}${
          when ? ` ${t("rate.sendAgainAt")} ${when}` : ""
        }`,
      );
    } else {
      toast.error(e.response?.data?.message || fallback);
    }
  };

  const handleSend = () => {
    // ── Letter-assignment broadcast (event-wide; POSTs to afc_auth.broadcast_letter_assignments) ──
    if (mode === "letter_assignments") {
      if (!letterAssignments || letterAssignments.length === 0) {
        toast.error("There are no letter assignments to broadcast yet.");
        return;
      }
      startTransition(async () => {
        try {
          const res = await axios.post(
            `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/broadcast-letter-assignments/`,
            {
              event_id: eventId,
              // Send only what the backend needs (team_id + letter); team_name is display-only.
              assignments: letterAssignments.map((a) => ({
                team_id: a.team_id,
                letter: a.letter,
              })),
              delivery,
            },
            { headers: { Authorization: `Bearer ${token}` } },
          );
          toast.success(res.data.message || "Letter assignments sent.");
          // Keep the "N of 5 left this hour" counter live (rate_remaining/rate_limit on the response).
          applySuccess(res.data);
          setOpen(false);
          reset();
          onSuccess?.();
        } catch (e: any) {
          notifyError(e, "Failed to broadcast letter assignments.");
        }
      });
      return;
    }

    // ── Per-group broadcast (custom message / room details) ──
    if (mode === "custom" && !message.trim()) {
      toast.error("A message is required.");
      return;
    }
    startTransition(async () => {
      try {
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/broadcast-to-group/`,
          mode === "room_details"
            ? { event_id: eventId, group_id: groupId, mode, delivery }
            : {
                event_id: eventId,
                group_id: groupId,
                mode,
                title: title.trim(),
                message: message.trim(),
                delivery,
              },
          { headers: { Authorization: `Bearer ${token}` } },
        );
        toast.success(res.data.message || "Message sent to the group.");
        // Keep the "N of 5 left this hour" counter live from the send response (rate_remaining/_limit).
        applySuccess(res.data);
        setOpen(false);
        reset();
        onSuccess?.();
      } catch (e: any) {
        notifyError(e, "Failed to message the group.");
      }
    });
  };

  // Dialog heading: name the exact group when we have it.
  const targetLabel =
    stageName && groupName
      ? `${stageName} › ${groupName}`
      : groupName || "this group";

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        {/* Labelled button (was an unlabelled bell icon). Label adapts to the composer's purpose. */}
        <Button variant="outline" size="sm" className="gap-2 font-medium">
          <Megaphone className="h-4 w-4" />
          {hasLetterMode ? "Broadcast assignments" : "Message group"}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[480px]">
        <DialogTitle>
          {hasLetterMode
            ? "Broadcast letter assignments"
            : `Broadcast to ${targetLabel}`}
        </DialogTitle>
        <DialogDescription>
          {hasLetterMode
            ? "Notifies every member of each team of the letter assigned to them for this event."
            : "Sends an in-app notification to everyone in this group (all players, or every member of each team)."}
        </DialogDescription>

        <div className="space-y-4 mt-2">
          {/* Organizer rate-limit budget ("N of 5 left this hour" + cooldown countdown). Hidden for
              admins (exempt) so their composer is unchanged. */}
          <BroadcastRateNotice rate={rate} />

          {hasLetterMode ? (
            // ── Letter-assignment mode: no typing; auto-composed per-team message ──
            <div className="space-y-2">
              <Label>What to send</Label>
              <p className="text-sm text-muted-foreground border rounded-md p-3 bg-muted/40">
                <span className="inline-flex items-center gap-1 font-medium text-foreground">
                  <Hash className="h-4 w-4" /> Letter assignments
                </span>
                <br />
                Notifies every member of the{" "}
                {letterAssignments?.length ?? 0} selected team
                {(letterAssignments?.length ?? 0) === 1 ? "" : "s"} of the letter
                assigned to them for {eventName || "this event"}. Each player gets:
                &quot;Your assigned letter for {eventName || "this event"} is X.&quot;
                Teams with no assigned letter are not included.
              </p>
            </div>
          ) : (
            <>
              {/* Mode: room details (auto) vs custom message */}
              <div className="space-y-2">
                <Label>What to send</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      {
                        value: "custom" as Mode,
                        label: "Custom message",
                        icon: Pencil,
                      },
                      {
                        value: "room_details" as Mode,
                        label: "Room details (auto)",
                        icon: DoorOpen,
                      },
                    ]
                  ).map((opt) => {
                    const Icon = opt.icon;
                    const selected = mode === opt.value;
                    return (
                      <button
                        type="button"
                        key={opt.value}
                        onClick={() => setMode(opt.value)}
                        className={cn(
                          "flex flex-col items-center justify-center gap-1 border rounded-md p-3 text-xs text-center transition-colors",
                          selected
                            ? "border-primary bg-primary/10 text-primary"
                            : "hover:bg-muted",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {mode === "custom" ? (
                <>
                  {/* Title (optional) + Message (required) */}
                  <div className="space-y-1">
                    <Label htmlFor="gb-title">Title (optional)</Label>
                    <Input
                      id="gb-title"
                      placeholder="e.g. Group A - match starts soon"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="gb-message">Message</Label>
                    <Textarea
                      id="gb-message"
                      placeholder="Your message to this group..."
                      rows={4}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                    />
                    {/* Time/money tokens (owner 2026-07-04): rendered in each recipient's tz/currency. */}
                    <div className="mt-1">
                      <BroadcastTokenInserts onInsert={(tok) => setMessage((m) => (m ? m + " " : "") + tok)} />
                    </div>
                  </div>
                </>
              ) : (
                // Room-details mode: no typing; explain what goes out.
                <p className="text-sm text-muted-foreground border rounded-md p-3 bg-muted/40">
                  Sends every map&apos;s saved Room ID, Room Name and Password for
                  this group to all of its players. Maps without room details set
                  are skipped.
                </p>
              )}
            </>
          )}

          {/* Delivery channel: app push / email (branded) / both. */}
          <div className="space-y-2">
            <Label>Send to</Label>
            <div className="grid grid-cols-3 gap-2">
              {DELIVERY_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const selected = delivery === opt.value;
                return (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => setDelivery(opt.value)}
                    className={cn(
                      "flex flex-col items-center justify-center gap-1 border rounded-md p-2.5 text-xs text-center transition-colors",
                      selected
                        ? "border-primary bg-primary/10 text-primary"
                        : "hover:bg-muted",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Emails are sent in the standard AFC branded design.
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleSend} disabled={pending}>
              {pending ? (
                <Loader text="Sending..." />
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />{" "}
                  {hasLetterMode ? "Send assignments" : "Send to group"}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
