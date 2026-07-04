"use client";

// Admin "Send Message" modal.
// Pushes an in-app notification and/or an email to a single PLAYER or to every
// member of a TEAM. Backs the afc_auth `admin-send-message` endpoint. The admin
// picks the delivery channel (push + email / push only / email only).
// Style mirrors BanModal (Dialog + trigger button) and the event-broadcast form.

import { useState, useTransition } from "react";
import axios from "axios";
import { toast } from "sonner";

import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";

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
import { cn } from "@/lib/utils";
import { Bell, Mail, MessageSquare, Send } from "lucide-react";
// Shared "what is this about?" deep-link picker. Here the message's recipient is
// already chosen by target_type/target_id (player vs team), so the LINK target
// rides on link_target_type + link_target_id per the admin_send_message contract.
import {
  NotificationTargetSelector,
  EMPTY_TARGET,
  type NotificationTarget,
} from "./NotificationTargetSelector";

type Delivery = "both" | "push" | "email";

// The three delivery channels the admin can pick between. `both` is the default.
const DELIVERY_OPTIONS: { value: Delivery; label: string; icon: typeof Bell }[] = [
  { value: "both", label: "Push + Email", icon: MessageSquare },
  { value: "push", label: "Push only", icon: Bell },
  { value: "email", label: "Email only", icon: Mail },
];

export const SendMessageModal = ({
  targetType,
  targetId,
  targetName,
}: {
  targetType: "player" | "team";
  targetId: string | number;
  targetName: string;
}) => {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [delivery, setDelivery] = useState<Delivery>("both");
  // Optional deep link for the "Take me there" button on the recipient's side.
  const [linkTarget, setLinkTarget] = useState<NotificationTarget>(EMPTY_TARGET);

  const reset = () => {
    setTitle("");
    setMessage("");
    setDelivery("both");
    setLinkTarget(EMPTY_TARGET);
  };

  const handleSend = () => {
    if (!message.trim()) {
      toast.error("Message is required");
      return;
    }
    startTransition(async () => {
      try {
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/admin-send-message/`,
          {
            target_type: targetType,
            target_id: targetId,
            title: title.trim(),
            message: message.trim(),
            delivery,
            // Deep-link target (only when the admin picked one). The recipient
            // is already keyed by target_type/target_id above, so the link rides
            // on the separate link_target_* pair.
            ...(linkTarget.target_type !== "none"
              ? {
                  link_target_type: linkTarget.target_type,
                  link_target_id: linkTarget.target_id.trim(),
                }
              : {}),
          },
          { headers: { Authorization: `Bearer ${token}` } },
        );
        toast.success(res.data.message || "Message sent");
        setOpen(false);
        reset();
      } catch (e: any) {
        toast.error(e.response?.data?.message || "Failed to send message");
      }
    });
  };

  // For a team the message fans out to all members; say so plainly.
  const recipientText =
    targetType === "team" ? `every member of ${targetName}` : targetName;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 font-medium">
          <Send className="h-4 w-4" />
          Send Message
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[480px]">
        <DialogTitle>Send Message</DialogTitle>
        <DialogDescription>
          Notify {recipientText} directly. Choose how it should be delivered.
        </DialogDescription>

        <div className="space-y-4 mt-2">
          {/* Delivery channel: push + email / push only / email only */}
          <div className="space-y-2">
            <Label>Delivery</Label>
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

          {/* Title (becomes the email subject + notification title) */}
          <div className="space-y-1">
            <Label htmlFor="sm-title">Title (optional)</Label>
            <Input
              id="sm-title"
              placeholder="e.g. Tournament reminder"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Message body (required) */}
          <div className="space-y-1">
            <Label htmlFor="sm-message">Message</Label>
            <Textarea
              id="sm-message"
              placeholder="Your message..."
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            {/* Time/money tokens (owner 2026-07-04): each recipient sees them in their own tz/currency. */}
            <div className="mt-1">
              <BroadcastTokenInserts onInsert={(tok) => setMessage((m) => (m ? m + " " : "") + tok)} />
            </div>
          </div>

          {/* Optional deep link: gives the recipient a "Take me there" button. */}
          <NotificationTargetSelector
            value={linkTarget}
            onChange={setLinkTarget}
          />

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
                  <Send className="h-4 w-4 mr-2" /> Send
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
