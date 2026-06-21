"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";

import { cn } from "@/lib/utils";

// ── Radix pointer-events lock self-heal ───────────────────────────────────────
// WHY THIS EXISTS: Radix Dialog (a "modal" layer) sets `document.body
// { pointer-events: none }` while it is open so the page behind the modal is
// inert, and is supposed to restore it on close. With @radix-ui/react-dialog
// 1.1.x under React 19, when another Radix dismissable layer (a Select / Popover)
// lives INSIDE the dialog, the layered cleanup can race and leave that lock stuck
// on <body> after the dialog closes — making the ENTIRE page unclickable by mouse.
//
// This is the exact cause of the "Create Event button is not working" report:
// the create-event wizard's stage-config dialog (StageModal, which contains a
// Radix Select for the stage format) left the lock on, so on the final wizard
// step the publish/draft checkboxes and the "Create Event" submit could never be
// clicked. The same applies to the edit flow's StageConfigModal (same pattern).
//
// FIX: whenever a dialog closes, if the body lock is still stuck AND no other
// dialog is currently open, clear it. Guarding on "no other open dialog" keeps
// stacked/nested dialogs working (we never strip the lock a still-open dialog
// needs). This is a no-op when Radix cleans up correctly on its own.
//
// CONNECTS TO: every consumer of this shadcn <Dialog>/<DialogContent> wrapper —
// notably app/(a)/a/events/create/_components/StageModal.tsx and
// app/(a)/a/events/[slug]/edit/_components/StageConfigModal.tsx.
function restoreBodyPointerEventsIfStuck() {
  if (typeof document === "undefined") return;
  // Defer so Radix's own close/cleanup runs first; only override if it failed.
  setTimeout(() => {
    const anotherDialogOpen = document.querySelector(
      '[data-slot="dialog-content"][data-state="open"], [role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]'
    );
    if (!anotherDialogOpen && document.body.style.pointerEvents === "none") {
      document.body.style.pointerEvents = "";
    }
  }, 100);
}

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  // For controlled dialogs (open prop driven by parent state, e.g. StageModal),
  // self-heal the body pointer-events lock whenever `open` flips to false. This
  // covers programmatic closes (Save/Cancel handlers that set open=false), which
  // are the closes most prone to the stuck-lock race above.
  React.useEffect(() => {
    if (props.open === false) restoreBodyPointerEventsIfStuck();
  }, [props.open]);

  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      // NOTE: the CLOSE/exit animation utilities are intentionally omitted. With
      // tw-animate-css under Tailwind v4 + React 19, a heavily re-rendering dialog
      // (e.g. the create-event StageModal, full of form.watch subscriptions)
      // restarts the 0.2s `exit` keyframe on every render, so `animationend` never
      // fires and Radix's <Presence> never unmounts the closed overlay/content.
      // The leftover overlay (fixed inset-0, z-50, pointer-events auto) then sits
      // over the whole page and eats every click — which is what disabled the
      // "Create Event" submit. Without an exit animation, Presence unmounts the
      // overlay synchronously on close, so it can never linger. Keep the OPEN
      // (enter) animation for a smooth appearance.
      className={cn(
        "data-[state=open]:animate-in data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        className
      )}
      {...props}
    />
  );
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean;
}) {
  // Covers uncontrolled dialogs (opened via <DialogTrigger>, no `open` prop on
  // the Root): when the content unmounts on close, self-heal the body lock too.
  React.useEffect(() => {
    return () => restoreBodyPointerEventsIfStuck();
  }, []);

  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        // CLOSE/exit animation utilities intentionally omitted — see the note on
        // DialogOverlay above. A stuck `exit` keyframe kept the closed content
        // mounted (visible ghost panel + pointer-events auto) and froze the page.
        // Dropping the exit animation lets <Presence> unmount it immediately on
        // close. Keep the OPEN (enter) animation.
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border px-3 md:px-6 py-6 shadow-lg duration-200 sm:max-w-lg",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-left", className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  );
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
