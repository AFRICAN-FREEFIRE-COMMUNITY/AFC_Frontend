"use client";

// ── The vendor writing to the buyer about one order ──────────────────────────
//
// Owner 2026-09-02: "also be able to send them notifications concerning what was ordered".
//
// The buyer already gets AUTOMATIC milestone mail (received / shipped / completed). What did not
// exist was the seller saying something of their OWN: "the large is gone, is medium alright", "the
// courier tried you twice today".
//
// WHAT THIS DELIBERATELY IS NOT: a chat. There is no thread and no reply path, and the copy says
// so plainly rather than letting a vendor sit waiting for an answer that cannot arrive. Building an
// inbox is a much larger thing than was asked for, and a half-built one that cannot be replied to
// is worse than an email that can.
//
// The CAP is surfaced, not hidden. The backend allows a bounded number of messages per order and
// answers 429 naming the number; a vendor who can see "3 left" never meets that wall by surprise.
//
// CONNECTS TO
//   vendorApi.messageBuyer -> POST /shop/fulfilment/orders/<id>/message/
//   (afc_shop.fulfilment.vendor_message_buyer), which authorises against the same gate as the
//   fulfilment transitions, records the send on VendorOrderMessage, and delivers it as a branded
//   email in the buyer's own language plus an in-app notification.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { toast } from "sonner";
import { IconLoader2, IconMessage } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { vendorApi } from "@/lib/vendor";

// Matches the backend cap on one message, which matches the event-invitation note raised on
// 2026-09-01: the same kind of thing written by the same kind of person, so the same room to say it.
const MAX_LENGTH = 2000;
// Only count down over the last stretch. A counter running from the first keystroke turns a note
// into a form field with a quota.
const COUNTER_FROM = MAX_LENGTH - 200;

export function MessageBuyerCard({
  orderId,
  buyerName,
}: {
  orderId: number;
  buyerName: string;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  // Null until the first send tells us. Showing a guessed number would be worse than showing none.
  const [remaining, setRemaining] = useState<number | null>(null);

  const send = async () => {
    const text = message.trim();
    if (!text) return;
    setBusy(true);
    try {
      const res = await vendorApi.messageBuyer(orderId, text);
      setMessage("");
      setRemaining(res.remaining);
      // Say WHERE it went. "Sent" alone leaves the vendor wondering whether the buyer will
      // actually see it, and the two channels genuinely can differ.
      toast.success(
        res.emailed && res.notified
          ? "Sent by email and in the buyer's notifications."
          : res.emailed
            ? "Sent by email."
            : res.notified
              ? "Sent to the buyer's notifications."
              : "Recorded, but nothing could be delivered. Contact AFC support.",
      );
    } catch (err: any) {
      // The backend names the cap in its 429, so pass its message through rather than replacing it
      // with something vaguer.
      toast.error(err?.response?.data?.message || "Could not send that message.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 text-base">
          <IconMessage className="size-4 text-primary" />
          Message {buyerName || "the buyer"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-4">
        <Label htmlFor="vendor-buyer-message">About this order</Label>
        <Textarea
          id="vendor-buyer-message"
          value={message}
          maxLength={MAX_LENGTH}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="For example: the large is out of stock, would medium be alright?"
          // max-h, because the shared Textarea grows with its content and an unbounded one pushes
          // the Send button off a phone screen.
          className="min-h-28 max-h-56"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {/* Said plainly. A vendor who expects a reply here will be waiting a long time. */}
            They get this by email and in their AFC notifications. They cannot reply here.
            {remaining !== null ? ` ${remaining} message(s) left for this order.` : ""}
          </p>
          <Button onClick={send} disabled={busy || !message.trim()}>
            {busy && <IconLoader2 className="mr-2 size-4 animate-spin" />}
            {busy ? "Sending..." : "Send message"}
          </Button>
        </div>
        {message.length >= COUNTER_FROM && (
          <p className="text-xs text-muted-foreground">
            {message.length >= MAX_LENGTH
              ? `Maximum length reached (${MAX_LENGTH} characters).`
              : `${MAX_LENGTH - message.length} characters left`}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
