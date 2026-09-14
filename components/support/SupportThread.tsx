"use client";

/**
 * components/support/SupportThread.tsx - one support conversation, rendered the same way on both
 * sides of the desk.
 *
 * WHY IT IS SHARED
 *   The staff dashboard (app/(a)/a/support) and the requester's own page
 *   (app/(user)/support/t/[token]) show the SAME history: who wrote, when, what they said, and
 *   what they attached. Two copies of that would drift the first time a field is added, so the
 *   thread, the attachment row and the composer live here and each page supplies the data and the
 *   send function.
 *
 * DATA
 *   SupportMessage[] from lib/api/support.ts. `ticketToken` is passed on the PUBLIC page so the
 *   attachment links carry ?t=<token>, which is how the guarded file view lets the requester read
 *   their own files without an account.
 *
 * TIME
 *   Every timestamp goes through LocalTime, so it reads in the viewer's own zone and language
 *   (project rule: never a raw toLocale* in user-facing UI).
 */
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { IconPaperclip, IconSend, IconX } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader } from "@/components/Loader";
import { LocalTime } from "@/components/LocalTime";
import {
  attachmentUrl,
  type SupportAttachment,
  type SupportMessage,
} from "@/lib/api/support";

/** Human file size. Kept here because only support surfaces show raw file sizes today. */
export const formatBytes = (bytes: number) => {
  if (!bytes) return "0 KB";
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.max(1, Math.round(kb))} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
};

const AttachmentRow = ({
  attachments,
  ticketToken,
}: {
  attachments: SupportAttachment[];
  ticketToken?: string;
}) => {
  if (!attachments.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {attachments.map((att) => (
        <a
          key={att.id}
          href={attachmentUrl(att, ticketToken)}
          target="_blank"
          rel="noreferrer"
          className="bg-muted hover:bg-muted/70 flex items-center gap-1.5 rounded-md px-2 py-1 text-xs"
        >
          <IconPaperclip className="size-3.5 shrink-0" />
          <span className="max-w-[220px] truncate">{att.name}</span>
          <span className="text-muted-foreground">{formatBytes(att.size_bytes)}</span>
        </a>
      ))}
    </div>
  );
};

export const SupportThread = ({
  messages,
  ticketToken,
  showInternalNotes = false,
}: {
  messages: SupportMessage[];
  ticketToken?: string;
  /** Staff see the automatic "acknowledgement sent" rows; the requester does not need them. */
  showInternalNotes?: boolean;
}) => {
  const t = useTranslations("support");
  const visible = showInternalNotes
    ? messages
    : messages.filter((m) => m.channel !== "auto");

  if (!visible.length) {
    return <p className="text-muted-foreground text-sm">{t("thread.empty")}</p>;
  }

  return (
    <div className="space-y-3">
      {visible.map((m) => {
        const fromAfc = m.direction === "out";
        return (
          <div
            key={m.id}
            className={
              fromAfc
                ? "bg-primary/10 rounded-md p-3"
                : "bg-muted/60 rounded-md p-3"
            }
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-xs font-semibold">
                {fromAfc ? t("thread.fromAfc") : m.author_name || t("thread.fromSender")}
                {showInternalNotes && m.author_username ? (
                  <span className="text-muted-foreground font-normal">
                    {" "}
                    ({m.author_username})
                  </span>
                ) : null}
                {m.channel === "auto" ? (
                  <span className="text-muted-foreground font-normal">
                    {" "}
                    {t("thread.automatic")}
                  </span>
                ) : null}
              </span>
              <span className="text-muted-foreground text-xs">
                <LocalTime value={m.created_at} />
              </span>
            </div>
            <p className="mt-1.5 text-sm whitespace-pre-wrap break-words">{m.body}</p>
            <AttachmentRow attachments={m.attachments} ticketToken={ticketToken} />
          </div>
        );
      })}
    </div>
  );
};

/**
 * The write box. Shared so the two sides cannot drift on what a reply may carry: the same file
 * limits (6 files, 20 MB each) the backend enforces in afc_support/views.py.
 */
export const SupportComposer = ({
  onSend,
  sending,
  placeholder,
}: {
  onSend: (message: string, files: File[]) => Promise<boolean>;
  sending: boolean;
  placeholder?: string;
}) => {
  const t = useTranslations("support");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  const addFiles = (picked: FileList | null) => {
    if (!picked) return;
    setFiles((prev) => [...prev, ...Array.from(picked)].slice(0, 6));
    if (fileInput.current) fileInput.current.value = "";
  };

  const send = async () => {
    const ok = await onSend(body.trim(), files);
    if (ok) {
      setBody("");
      setFiles([]);
    }
  };

  return (
    <div className="space-y-2">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder ?? t("composer.placeholder")}
        className="min-h-[110px] resize-none"
      />
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((f, i) => (
            <span
              key={`${f.name}-${i}`}
              className="bg-muted flex items-center gap-1.5 rounded-md px-2 py-1 text-xs"
            >
              <IconPaperclip className="size-3.5" />
              <span className="max-w-[200px] truncate">{f.name}</span>
              <span className="text-muted-foreground">{formatBytes(f.size)}</span>
              <button
                type="button"
                aria-label={t("composer.removeFile", { name: f.name })}
                onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                className="hover:text-destructive"
              >
                <IconX className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInput}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInput.current?.click()}
        >
          <IconPaperclip className="mr-1 size-4" /> {t("composer.attach")}
        </Button>
        <span className="text-muted-foreground text-xs">{t("composer.limits")}</span>
        <Button
          type="button"
          size="sm"
          className="ml-auto"
          disabled={sending || (!body.trim() && files.length === 0)}
          onClick={send}
        >
          {sending ? (
            <Loader text={t("composer.sending")} />
          ) : (
            <>
              <IconSend className="mr-1 size-4" /> {t("composer.send")}
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
