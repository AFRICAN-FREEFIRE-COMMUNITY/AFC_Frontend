"use client";

/**
 * components/support/AskOrganizerDialog.tsx - "Ask the organizer" (inbox #167 / #175).
 *
 * Owner 2026-10-08: "We want to give organizers their own support feature, how can that work?
 * people will be able to ask them questions and they should be able to answer and view things sent
 * to them, including attachments." Who may ask: "Signed-in players only".
 *
 * A button that opens a short form: the question, optional files, Send. The question goes to the
 * organization (and names the event when asked from an event page); the organization answers on
 * its portal's Support page (app/(organizer)/organizer/support), and the player reads the answer
 * on the ticket page (app/(user)/support/t/[token]), in My tickets on /support, and by email.
 *
 * R26: the whole control sits inside <NeedsAccount>, so a signed-out visitor sees one sentence and
 * a sign-in link instead of a form the server would refuse.
 *
 * Talks to lib/api/support.ts askOrganizer -> POST support/organizations/<slug>/ask/
 * (AFC-B afc_support/views_org.py). Refusals arrive with a code, translated below (R44).
 * Placed on: the event page's "Organized by" line (EventDetailsWrapper) and the organization's
 * public page (app/(user)/organizations/[slug]).
 */
import { useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { IconMessageQuestion, IconPaperclip, IconSend, IconX } from "@tabler/icons-react";

import { NeedsAccount } from "@/components/NeedsAccount";
import { NewBadge } from "@/components/NewBadge";
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
import { useAuth } from "@/contexts/AuthContext";
import { askOrganizer, ORGANIZER_QUESTION_MAX_LENGTH } from "@/lib/api/support";

const MAX_FILES = 6;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
// The day the feature goes live: its NEW tag expires by itself 5 days later.
const ASK_LIVE_SINCE = "2026-10-08";
// The refusal codes the endpoint answers with, each with its own sentence in messages/*/support.json.
const KNOWN_CODES = new Set([
  "question_empty",
  "question_too_long",
  "too_many_questions",
  "organization_not_found",
  "event_not_found",
]);

export function AskOrganizerButton({
  organization,
  event,
  className,
}: {
  organization: { slug: string; name: string };
  /** Set when asked from an event page: the question is about this event. */
  event?: { slug: string; name: string } | null;
  className?: string;
}) {
  const t = useTranslations("support");
  const [open, setOpen] = useState(false);
  return (
    <NeedsAccount action={t("ask.needsAccount")} className="text-muted-foreground text-xs">
      <Button type="button" variant="secondary" size="sm" className={className} onClick={() => setOpen(true)}>
        <IconMessageQuestion className="mr-1 size-4" />
        {t("ask.button")}
        <NewBadge since={ASK_LIVE_SINCE} className="ml-1.5" />
      </Button>
      <AskOrganizerDialog organization={organization} event={event} open={open} onOpenChange={setOpen} />
    </NeedsAccount>
  );
}

function AskOrganizerDialog({
  organization,
  event,
  open,
  onOpenChange,
}: {
  organization: { slug: string; name: string };
  event?: { slug: string; name: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("support");
  const { token } = useAuth();
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState<{ number: string; token: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const reset = () => {
    setMessage("");
    setFiles([]);
    setError("");
    setSent(null);
  };

  const addFiles = (list: FileList | null) => {
    const next = [...files];
    for (const f of Array.from(list ?? [])) {
      if (next.length >= MAX_FILES) {
        toast.error(t("errors.rejected.count", { name: f.name }));
        break;
      }
      if (f.size > MAX_FILE_BYTES) {
        toast.error(t("errors.rejected.size", { name: f.name }));
        continue;
      }
      next.push(f);
    }
    setFiles(next);
  };

  const send = async () => {
    if (!token || !message.trim()) return;
    setSending(true);
    setError("");
    try {
      const res = await askOrganizer(token, organization.slug, {
        message: message.trim(),
        eventSlug: event?.slug || undefined,
        files,
      });
      res.rejected_files?.forEach((f) => toast.error(t(`errors.rejected.${f.reason}`, { name: f.name })));
      setSent({ number: res.ticket_number, token: res.token });
      setMessage("");
      setFiles([]);
    } catch (err: any) {
      const code = err?.response?.data?.code;
      setError(KNOWN_CODES.has(code) ? t(`ask.errors.${code}`, { limit: ORGANIZER_QUESTION_MAX_LENGTH }) : t("ask.errors.generic"));
    } finally {
      setSending(false);
    }
  };

  const tooLong = message.length > ORGANIZER_QUESTION_MAX_LENGTH;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("ask.title", { name: organization.name })}</DialogTitle>
          <DialogDescription>{t("ask.explain", { name: organization.name })}</DialogDescription>
        </DialogHeader>

        {sent ? (
          <div className="bg-muted/40 space-y-3 rounded-md p-4">
            <p className="text-sm font-semibold">{t("ask.sentTitle")}</p>
            <p className="text-muted-foreground text-sm">
              {t("ask.sentBody", { name: organization.name, ticket: sent.number })}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm">
                <Link href={`/support/t/${encodeURIComponent(sent.token)}`}>{t("ask.openQuestion")}</Link>
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link href="/support">{t("ask.allMessages")}</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {event ? (
              <p className="text-muted-foreground text-xs">{t("ask.about", { event: event.name })}</p>
            ) : null}
            <Label htmlFor="ask-organizer-message">{t("ask.label")}</Label>
            <Textarea
              id="ask-organizer-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("ask.placeholder")}
              className="min-h-[120px]"
              maxLength={ORGANIZER_QUESTION_MAX_LENGTH + 200}
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground text-xs">{t("composer.limits")}</span>
              <span className={tooLong ? "text-destructive text-xs" : "text-muted-foreground text-xs"}>
                {message.length}/{ORGANIZER_QUESTION_MAX_LENGTH}
              </span>
            </div>
            {files.length ? (
              <div className="flex flex-wrap gap-1.5">
                {files.map((f, i) => (
                  <span key={`${f.name}-${i}`} className="bg-muted inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs">
                    {f.name}
                    <button
                      type="button"
                      aria-label={t("composer.removeFile", { name: f.name })}
                      onClick={() => setFiles(files.filter((_, j) => j !== i))}
                    >
                      <IconX className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            <input
              ref={fileInput}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            {error ? <p className="text-destructive text-sm">{error}</p> : null}
          </div>
        )}

        {sent ? null : (
          <DialogFooter className="gap-2 sm:justify-between">
            <Button type="button" variant="ghost" onClick={() => fileInput.current?.click()}>
              <IconPaperclip className="mr-1 size-4" /> {t("composer.attach")}
            </Button>
            <Button type="button" onClick={send} disabled={sending || !message.trim() || tooLong}>
              <IconSend className="mr-1 size-4" /> {sending ? t("composer.sending") : t("composer.send")}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
