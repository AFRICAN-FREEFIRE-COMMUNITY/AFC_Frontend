"use client";

// ─────────────────────────────────────────────────────────────────────────────
// EventDraftResumeDialog — the "you have an unsaved event, resume or start fresh?"
// prompt shown on the event CREATE pages when useEventCreateDraft finds a saved draft
// in localStorage (owner 2026-07-01, so organizers stop losing in-progress work).
//
// NON-BLOCKING BANNER (owner 2026-07-01 fix): this is an inline banner at the top of
// the form, NOT a modal. An earlier version used a Radix <AlertDialog> whose full-screen
// overlay (pointer-events:auto) sat over the whole page — so while a draft existed the
// "Create event" / "Save to draft" buttons were unclickable (the modal was also not
// closing reliably because it was a controlled AlertDialog with no onOpenChange). A
// resume prompt must NEVER block event creation, so it now renders as a dismissible
// banner: the form stays fully interactive; the user can Resume, Start fresh, or just
// ignore it and keep typing. Plain <Button onClick> handlers fire reliably (no Radix
// controlled-state pitfall).
//
// Pure presentation: all copy comes in as props so the ADMIN page can pass plain English
// (admin (a)/ is i18n-exempt) and the ORGANIZER page can pass next-intl translations.
// The page owns Resume (apply the saved state to the form) and Discard (wipe the draft).
// ─────────────────────────────────────────────────────────────────────────────
import { Button } from "@/components/ui/button";
import { IconHistory } from "@tabler/icons-react";

export interface EventDraftResumeDialogProps {
  open: boolean;
  savedAt?: number; // epoch ms of the saved draft (optional "saved <time>" line)
  title: string;
  description: string;
  resumeLabel: string;
  discardLabel: string;
  onResume: () => void;
  onDiscard: () => void;
}

export function EventDraftResumeDialog({
  open,
  savedAt,
  title,
  description,
  resumeLabel,
  discardLabel,
  onResume,
  onDiscard,
}: EventDraftResumeDialogProps) {
  // Not rendered at all when there is no draft to resolve -> zero footprint on the form.
  if (!open) return null;

  // A light "saved <local time>" line so the user knows how recent the draft is.
  const when =
    savedAt && Number.isFinite(savedAt)
      ? new Date(savedAt).toLocaleString()
      : null;

  return (
    <div className="border-primary/40 bg-primary/5 mb-6 flex flex-col gap-3 rounded-md border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2">
        <IconHistory className="text-primary mt-0.5 size-5 shrink-0" />
        <div className="text-sm">
          <p className="text-foreground font-medium">{title}</p>
          <p className="text-muted-foreground">{description}</p>
          {when ? (
            <p className="text-muted-foreground mt-0.5 text-xs opacity-70">{when}</p>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 gap-2 sm:pl-2">
        {/* Discard = start a clean form; Resume = restore the saved state. Both are plain buttons. */}
        <Button type="button" variant="outline" size="sm" onClick={onDiscard}>
          {discardLabel}
        </Button>
        <Button type="button" size="sm" onClick={onResume}>
          {resumeLabel}
        </Button>
      </div>
    </div>
  );
}
