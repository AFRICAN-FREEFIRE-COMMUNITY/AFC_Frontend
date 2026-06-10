"use client";

// ─────────────────────────────────────────────────────────────────────────────
// DuplicateEventButton
// ----------------------------------------------------------------------------
// A confirm-gated row action that clones an event into a fresh draft via
// POST /events/<event_id>/duplicate-event/ (eventsApi.duplicateEvent — see
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
// The duplicate endpoint copies CONFIG + stage/group structure only — never results,
// registrations, teams, matches, leaderboards, payments, sponsors, or analytics — so the
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
        setOpen(false);
        onSuccess?.();
        // Deep-link into editing the new draft when the caller knows the edit route.
        if (editHrefFor && data.slug) {
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
