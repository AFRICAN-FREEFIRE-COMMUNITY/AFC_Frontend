"use client";

/**
 * BulkReplyDialog - one answer to several people at once (inbox #169 / #174).
 *
 * The same message goes to every picked person, recorded on all their open requests; each person
 * is emailed (and DMed) on their own, so nobody sees who else got it. People with nothing open are
 * skipped, and the result says how many.
 *
 * Talks to bulkReplyToPeople -> POST support/people/bulk-reply/ (AFC-B afc_support/views_people.py).
 * Opened from the people list's "Reply to all of them" in components/support/desk/SupportDesk.tsx.
 * On an organizer's desk (inbox #175) `organization` scopes the send to that organization's people.
 */
import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { IconSend } from "@tabler/icons-react";

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
import { Textarea } from "@/components/ui/textarea";
import { bulkReplyToPeople } from "@/lib/api/support";

export function BulkReplyDialog({
  token,
  keys,
  open,
  onOpenChange,
  onSent,
  organization,
}: {
  token: string;
  organization?: string;
  keys: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent: () => void;
}) {
  const t = useTranslations("support");
  const [message, setMessage] = useState("");
  const [resolve, setResolve] = useState(false);
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      const res = await bulkReplyToPeople(token, { keys, message: message.trim(), resolve, organization });
      toast.success(t("desk.bulk.done", { people: res.people_sent, requests: res.requests_answered }));
      if (res.skipped) toast.message(t("desk.bulk.skipped", { count: res.skipped }));
      setMessage("");
      setResolve(false);
      onSent();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("errors.reply"));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("desk.bulk.title", { count: keys.length })}</DialogTitle>
          <DialogDescription>{t("desk.bulk.explain")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="bulk-message">{t("desk.bulk.label")}</Label>
          <Textarea
            id="bulk-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t("desk.bulk.placeholder")}
            className="min-h-[110px]"
          />
          <label className="text-muted-foreground flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" className="accent-primary size-4" checked={resolve} onChange={(e) => setResolve(e.target.checked)} />
            {t("desk.resolveAfter")}
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("desk.bulk.cancel")}
          </Button>
          <Button onClick={send} disabled={sending || !message.trim()}>
            <IconSend className="mr-1 size-4" />
            {sending ? t("composer.sending") : t("desk.bulk.send", { count: keys.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
