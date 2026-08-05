"use client";

// ─────────────────────────────────────────────────────────────────────────────
// DuplicateEventButton
// ----------------------------------------------------------------------------
// A confirm-gated row action that clones an event into a fresh draft via
// POST /events/<event_id>/duplicate-event/ (eventsApi.duplicateEvent - see
// lib/api/events.ts). It is shared by BOTH events lists so the two surfaces behave
// identically:
//   • admin     → app/(a)/a/_components/EventsAdminContent.tsx (next to View/Edit/Delete)
//   • organizer → app/(organizer)/organizer/events/page.tsx   (next to View/Edit)
//
// On confirm it calls the endpoint, toasts the new event's name, and then either
// routes to the new event's edit page (when `editHrefFor` is supplied) and/or calls
// `onSuccess` (e.g. the admin list's re-fetch). The button styling mirrors the other
// outline row actions (variant="outline", size="sm") per the AFC design constants.
//
// The duplicate endpoint copies CONFIG + stage/group structure only - never results,
// registrations, teams, matches, leaderboards, payments, sponsors, or analytics - so the
// confirm copy says exactly that to set expectations.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/Loader";
import { IconCopy } from "@tabler/icons-react";
import { eventsApi } from "@/lib/api/events";

// Wait until Radix has finished tearing the dialog down, so we never navigate on top of a
// half-removed overlay (see the long note in handleDuplicate).
//
// HOW WE KNOW IT IS DONE: Radix's scroll lock is what it removes LAST, and it is observable
// from here as `pointer-events` / `overflow` on <body>. We poll until the body looks
// untouched again, with a hard ceiling so a dialog whose exit animation never completes
// still navigates instead of stranding the user on the list.
//
// POLLED ON A TIMER, DELIBERATELY NOT requestAnimationFrame. The first version of this used
// rAF and HUNG: a browser does not run animation frames in a tab that is not visible, so the
// promise never settled, the clone was created but the app never navigated to it. That is
// the same hidden-tab behaviour that makes Radix skip `animationend` in the first place, so
// leaning on rAF here would have reintroduced the exact class of bug this is fixing.
// Timers still fire when a tab is hidden (throttled to about a second, which is bounded and
// fine), so this always resolves.
const TEARDOWN_TIMEOUT_MS = 400;
const TEARDOWN_POLL_MS = 16;

function waitForDialogTeardown(): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();

  const body = document.body;
  const isLocked = () =>
    body.style.pointerEvents === "none" ||
    body.hasAttribute("data-scroll-locked") ||
    body.style.overflow === "hidden";

  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const finish = () => {
      if (timer !== undefined) clearTimeout(timer);
      clearTimeout(deadline);
      // Belt and braces: if we finished on the deadline the lock may still be on, and
      // leaving it would hand the next page an unclickable <body>. Clearing exactly what
      // Radix would have cleared is safe here because this dialog is closing and no other
      // one is open.
      if (isLocked()) {
        body.style.pointerEvents = "";
        body.style.overflow = "";
        body.removeAttribute("data-scroll-locked");
      }
      resolve();
    };

    const deadline = setTimeout(finish, TEARDOWN_TIMEOUT_MS);

    const poll = () => {
      if (!isLocked()) return finish();
      timer = setTimeout(poll, TEARDOWN_POLL_MS);
    };
    poll();
  });
}

export function DuplicateEventButton({
  eventId,
  eventName,
  // When provided, builds the edit-page href from the NEW event's slug so we can deep-link
  // the user straight into editing their clone (admin: "/a/events/<slug>/edit",
  // organizer: "/organizer/events/<slug>/edit"). Omit to stay on the list.
  editHrefFor,
  // Called after a successful duplicate (e.g. the admin list re-fetches its rows).
  onSuccess,
  // Optional label next to the icon (the organizer list shows a label; the admin list,
  // which is tighter, can pass false to stay icon-only). Defaults to showing the label.
  showLabel = true,
  size = "sm",
}: {
  eventId: number | string;
  eventName: string;
  editHrefFor?: (slug: string) => string;
  onSuccess?: () => void;
  showLabel?: boolean;
  size?: "sm" | "default" | "lg";
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const handleDuplicate = () => {
    startTransition(async () => {
      try {
        // POST /events/<eventId>/duplicate-event/ -> {event_id, slug, event_name}.
        const data = await eventsApi.duplicateEvent(eventId);
        toast.success(`Created a copy: ${data.event_name}`);
        onSuccess?.();

        // ── Close the dialog BEFORE navigating, and wait for it to actually finish ──
        // (owner-reported 2026-08-05: "this glitch only happens when they duplicate an
        // event" - the clone's edit page came up visually corrupted on mobile, with
        // ghosted duplicate selects and static over the form.)
        //
        // WHY THE ORDER MATTERS. Radix's Dialog does not unmount on setOpen(false); it
        // keeps the node mounted to play an exit animation and only runs its teardown
        // when `animationend` fires. That teardown is what releases the scroll lock,
        // the `pointer-events: none` it puts on <body>, and the fixed-position overlay.
        // The old code called setOpen(false) and router.push() in the same tick, so the
        // route change ripped the dialog out mid-animation, `animationend` never fired,
        // and those body styles leaked onto the edit page that mounted next. (Same Radix
        // behaviour bit us on 2026-08-03: a dialog in a hidden tab never fires
        // animationend either, which is why those dialogs only LOOKED frozen.)
        //
        // Duplicate is the only flow in the app that closes a modal and mounts a large
        // form page in one tick, which is exactly why this was the only place it showed.
        setOpen(false);
        if (editHrefFor && data.slug) {
          await waitForDialogTeardown();
          router.push(editHrefFor(data.slug));
        }
      } catch (e: any) {
        toast.error(
          e?.response?.data?.message || "Failed to duplicate event.",
        );
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size={size}>
          <IconCopy className="size-4" />
          {showLabel && "Duplicate"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Duplicate event</DialogTitle>
          <DialogDescription>
            Create a new draft from <b>{eventName}</b>. This copies the event
            settings and the stage and group structure, but not registrations,
            teams, matches, leaderboards, or results.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button onClick={handleDuplicate} disabled={pending}>
            {pending ? (
              <Loader text="Duplicating..." />
            ) : (
              <>
                <IconCopy className="size-4" />
                Duplicate
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
