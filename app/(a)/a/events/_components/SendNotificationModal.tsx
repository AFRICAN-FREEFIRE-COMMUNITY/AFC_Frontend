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
import { Loader } from "@/components/Loader";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Megaphone, DoorOpen, Pencil, Send } from "lucide-react";

// The two broadcast modes. "room_details" sends the saved room info for every map;
// "custom" sends a free-text title + message. Default = custom (the new capability
// the user asked for); room-details stays one click away.
type Mode = "custom" | "room_details";

export const SendNotificationModal = ({
  eventId,
  groupId,
  groupName,
  stageName,
  onSuccess,
}: {
  eventId: number | undefined;
  groupId: number | undefined;
  // Group + stage names label the dialog ("Broadcast to <stage> > <group>") so the
  // admin/organizer knows exactly which group they're messaging. Optional so callers
  // that don't have them still work.
  groupName?: string;
  stageName?: string;
  onSuccess?: () => void;
}) => {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [mode, setMode] = useState<Mode>("custom");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");

  const reset = () => {
    setMode("custom");
    setTitle("");
    setMessage("");
  };

  const handleSend = () => {
    if (mode === "custom" && !message.trim()) {
      toast.error("A message is required.");
      return;
    }
    startTransition(async () => {
      try {
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/broadcast-to-group/`,
          mode === "room_details"
            ? { event_id: eventId, group_id: groupId, mode }
            : {
                event_id: eventId,
                group_id: groupId,
                mode,
                title: title.trim(),
                message: message.trim(),
              },
          { headers: { Authorization: `Bearer ${token}` } },
        );
        toast.success(res.data.message || "Message sent to the group.");
        setOpen(false);
        reset();
        onSuccess?.();
      } catch (e: any) {
        toast.error(
          e.response?.data?.message || "Failed to message the group.",
        );
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
        {/* Labelled button (was an unlabelled bell icon). */}
        <Button variant="outline" size="sm" className="gap-2 font-medium">
          <Megaphone className="h-4 w-4" />
          Message group
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[480px]">
        <DialogTitle>Broadcast to {targetLabel}</DialogTitle>
        <DialogDescription>
          Sends an in-app notification to everyone in this group (all players, or
          every member of each team).
        </DialogDescription>

        <div className="space-y-4 mt-2">
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
              </div>
            </>
          ) : (
            // Room-details mode: no typing; explain what goes out.
            <p className="text-sm text-muted-foreground border rounded-md p-3 bg-muted/40">
              Sends every map&apos;s saved Room ID, Room Name and Password for this
              group to all of its players. Maps without room details set are skipped.
            </p>
          )}

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
                  <Send className="h-4 w-4 mr-2" /> Send to group
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
