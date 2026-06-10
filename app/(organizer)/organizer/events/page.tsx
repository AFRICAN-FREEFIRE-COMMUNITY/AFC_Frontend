// ─────────────────────────────────────────────────────────────────────────────
// Organizer › Events (the org's events list).
//
// Lists the events homed to the currently-selected organization. The org is read
// from the OrganizerContext the portal layout provides (the layout owns "which org
// is selected" via its switcher); we take the numeric organization_id off that
// membership and scope the fetch with it:
//   GET /events/get-all-events/?organization_id=<id>
//
// Each row shows the event name + the three badges the brief asks for:
//   • status      - upcoming / ongoing / completed (event.event_status)
//   • draft       - only rendered when the event is still a draft (event.is_draft)
//   • rankings    - Verified / Unverified (event.rankings_verified) - this is the
//                   AFC-side review state an organizer event must clear before its
//                   results feed the public rankings.
//
// "Create event" is gated exactly like the admin surface gates it, but on the
// organizer permission set: membership.permissions.can_create_events OR the caller
// owns the org (isOwner). When un-gated it deep-links to /organizer/events/create.
//
// Design mirrors the admin events list (app/(a)/a/events/page.tsx) and the sibling
// organizer pages (overview / profile): PageHeader, a single Card wrapping a Table,
// outline status/rankings badges (rounded-full, text-xs) per AFC constants.
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import axios from "axios";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  IconCalendarEvent,
  IconPlus,
  IconPencil,
  IconTrophy,
  IconUsersGroup,
} from "@tabler/icons-react";
import { env } from "@/lib/env";
import { formatDate } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganizer } from "../_components/OrganizerContext";
// Duplicate action: clones an event into a fresh draft (config + stage/group structure
// only) via POST /events/<id>/duplicate-event/. Shared with the admin events list; gated
// here on the same can_create_events permission as the "Create event" button, since the
// backend authorises duplication exactly like creation (AFC admin OR org can_create_events).
import { DuplicateEventButton } from "@/app/(a)/a/events/_components/DuplicateEventButton";

// ── Row shape ───────────────────────────────────────────────────────────────
// The org-scoped get-all-events response. Most fields mirror the admin list; the
// extra two (is_draft / rankings_verified) drive the organizer-specific badges.
// Both are optional so the page renders even if a given backend build omits them.
interface OrgEvent {
  event_id: string;
  event_name: string;
  event_date: string;
  event_status: string;
  competition_type: string;
  slug: string;
  is_public?: boolean;
  is_draft?: boolean;
  rankings_verified?: boolean;
}

// ── Status badge ──────────────────────────────────────────────────────────────
// Outline badge (rounded-full, text-xs) per AFC constants; colour by event status -
// same colour mapping the organizer Overview uses for org status, kept consistent.
function StatusBadge({ status }: { status: string }) {
  const normalized = (status || "").toLowerCase();
  const colour =
    normalized === "ongoing"
      ? "border-green-500 text-green-600"
      : normalized === "completed"
        ? "border-blue-500 text-blue-600"
        : normalized === "draft"
          ? "border-muted-foreground text-muted-foreground"
          : // upcoming (and anything unrecognised) → gold/amber
            "border-yellow-500 text-yellow-600";
  return (
    <Badge variant="outline" className={`capitalize ${colour}`}>
      {status || "unknown"}
    </Badge>
  );
}

// ── Rankings badge ──────────────────────────────────────────────────────────────
// Verified (green) vs Unverified (orange) - the AFC review gate an organizer event
// clears before its results count toward the public rankings.
function RankingsBadge({ verified }: { verified: boolean }) {
  return (
    <Badge
      variant="outline"
      className={
        verified
          ? "border-green-500 text-green-600"
          : "border-orange-500 text-orange-600"
      }
    >
      Rankings: {verified ? "Verified" : "Unverified"}
    </Badge>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OrganizerEventsPage() {
  const { membership, isOwner } = useOrganizer();
  const { token } = useAuth();

  // The numeric id used to scope the events fetch (lives on the selected membership).
  const organizationId = membership.organization.organization_id;
  // Same gate the admin surface uses, but on the organizer permission set.
  const canCreateEvents = membership.permissions.can_create_events || isOwner;
  // Row-action gates (mirror the backend edit_event / upload-results permissions):
  //   • Edit                → isOwner || can_edit_events   (links to .../[slug]/edit)
  //   • Results & Leaderboard → isOwner || can_upload_results
  //     ("results + leaderboards" is exactly what can_upload_results covers). The
  //     leaderboard route itself is owned/built by a sibling agent; here we only link.
  const canEditEvents = membership.permissions.can_edit_events || isOwner;
  const canUploadResults =
    membership.permissions.can_upload_results || isOwner;
  //   • Groups & Rosters → isOwner || can_manage_registrations
  //     (links to .../[slug]/groups, the LIVE-event seeding check that shows which
  //     teams/players sit in which group). Same permission the groups page itself and
  //     the backend get-event-group-rosters endpoint enforce, so the button only
  //     appears for callers the backend will actually authorise.
  const canManageRegistrations =
    membership.permissions.can_manage_registrations || isOwner;

  const [events, setEvents] = useState<OrgEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Load the selected org's events. Re-runs when the org switches (the layout
  // re-mounts this subtree keyed on slug, so organizationId is always current). ──
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await axios.get(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-all-events/`,
          {
            params: { organization_id: organizationId },
            // get-all-events is read-only/public, but we still send the Bearer so an
            // org-scoped backend can authorise the caller against the organization.
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          },
        );
        setEvents(res.data?.events ?? []);
      } catch (err: any) {
        toast.error(
          err?.response?.data?.message || "Failed to load your events.",
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [organizationId, token]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Events"
        description="Events your organization is running."
        // "Create event" lives in the header action slot, gated on the permission.
        action={
          canCreateEvents ? (
            <Button asChild className="w-full md:w-auto">
              <Link href="/organizer/events/create">
                <IconPlus className="size-4" />
                Create event
              </Link>
            </Button>
          ) : undefined
        }
      />

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Your Events</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            // Inline loading row - matches the organizer Overview's loading copy.
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              Loading events...
            </div>
          ) : events.length === 0 ? (
            // ── Empty state ── nothing homed to this org yet.
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="flex size-12 items-center justify-center rounded-md bg-primary/10 text-primary">
                <IconCalendarEvent className="size-6" />
              </div>
              <p className="text-sm text-muted-foreground">
                Your organization hasn&apos;t created any events yet.
              </p>
              {canCreateEvents && (
                <Button asChild variant="outline" size="sm">
                  <Link href="/organizer/events/create">
                    Create your first event
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Rankings</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.event_id}>
                    {/* Name + draft badge inline so drafts read at a glance. */}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {event.event_name}
                        {event.is_draft && (
                          <Badge
                            variant="outline"
                            className="border-muted-foreground text-muted-foreground"
                          >
                            Draft
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="capitalize">
                      {event.competition_type}
                    </TableCell>
                    <TableCell>
                      {event.event_date ? formatDate(event.event_date) : "-"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={event.event_status} />
                    </TableCell>
                    <TableCell>
                      <RankingsBadge verified={!!event.rankings_verified} />
                    </TableCell>
                    <TableCell>
                      {/* Row actions, right-aligned:
                          • View      → the public event page (read-only), always shown.
                          • Edit      → the organizer event-EDIT page, gated on
                            can_edit_events / owner (matches the backend edit_event gate).
                          • Results & Leaderboard → the org results route (built by a
                            sibling agent), gated on can_upload_results / owner. */}
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/tournaments/${event.slug}`}>View</Link>
                        </Button>
                        {canEditEvents && (
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/organizer/events/${event.slug}/edit`}>
                              <IconPencil className="size-4" />
                              Edit
                            </Link>
                          </Button>
                        )}
                        {/* Duplicate → clone this event into a fresh draft, then deep-link
                            into editing the copy ("/organizer/events/<new-slug>/edit"). Gated
                            on can_create_events / owner to match the backend duplicate gate. */}
                        {canCreateEvents && (
                          <DuplicateEventButton
                            eventId={event.event_id}
                            eventName={event.event_name}
                            editHrefFor={(slug) =>
                              `/organizer/events/${slug}/edit`
                            }
                          />
                        )}
                        {canUploadResults && (
                          <Button asChild variant="outline" size="sm">
                            <Link
                              href={`/organizer/events/${event.slug}/leaderboard`}
                            >
                              <IconTrophy className="size-4" />
                              Results & Leaderboard
                            </Link>
                          </Button>
                        )}
                        {/* Groups & Rosters: live-event seeding check (stage → group →
                            teams → players). Links to the new groups page; gated on the
                            registrations permission to match that page + the backend. */}
                        {canManageRegistrations && (
                          <Button asChild variant="outline" size="sm">
                            <Link
                              href={`/organizer/events/${event.slug}/groups`}
                            >
                              <IconUsersGroup className="size-4" />
                              Groups & Rosters
                            </Link>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
