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
import { useTranslations } from "next-intl";
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
  IconEyeOff,
  IconExternalLink,
  IconPlus,
  IconPencil,
  IconTrophy,
  IconUsersGroup,
} from "@tabler/icons-react";
import { env } from "@/lib/env";
import { formatDate } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganizer } from "../_components/OrganizerContext";
import { useLiveTick } from "@/hooks/useLiveTick";
// Duplicate action: clones an event into a fresh draft (config + stage/group structure
// only) via POST /events/<id>/duplicate-event/. Shared with the admin events list; gated
// here on the same can_create_events permission as the "Create event" button, since the
// backend authorises duplication exactly like creation (AFC admin OR org can_create_events).
import { DuplicateEventButton } from "@/app/(a)/a/events/_components/DuplicateEventButton";
// One-click ZIP of an event's registered team logos + player esport images.
import { DownloadEventMediaButton } from "@/components/esport-media";

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
  const t = useTranslations("organizer");
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
      {status || t("eventsList.status.unknown")}
    </Badge>
  );
}

// ── Rankings badge ──────────────────────────────────────────────────────────────
// Verified (green) vs Unverified (orange) - the AFC review gate an organizer event
// clears before its results count toward the public rankings.
function RankingsBadge({ verified }: { verified: boolean }) {
  const t = useTranslations("organizer");
  return (
    <Badge
      variant="outline"
      className={
        verified
          ? "border-green-500 text-green-600"
          : "border-orange-500 text-orange-600"
      }
    >
      {t("eventsList.rankings.label")}:{" "}
      {verified
        ? t("eventsList.rankings.verified")
        : t("eventsList.rankings.unverified")}
    </Badge>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OrganizerEventsPage() {
  const { membership, isOwner } = useOrganizer();
  const { token } = useAuth();
  const t = useTranslations("organizer");

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
  // Which event row is mid-unpublish (drives its button's pending state + disables it).
  const [unpublishingId, setUnpublishingId] = useState<string | null>(null);

  // Load the selected org's events. Extracted from the effect so the Unpublish action
  // can re-fetch afterwards (a freshly-drafted event then drops off this published-only
  // list). get-all-events filters is_draft=False, so every row here is a published event.
  // `background` (live refresh) skips the loading row + the error toast, so a silent
  // background poll never flashes the table away or spams failure toasts.
  const loadEvents = async (background = false) => {
    if (!background) setLoading(true);
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
      if (!background)
        toast.error(
          err?.response?.data?.message || t("eventsList.toast.loadFailed"),
        );
    } finally {
      setLoading(false);
    }
  };

  // Live refresh (owner 2026-07-02): re-run the read-only events fetch on the site-wide tick
  // (tick 0 = the normal first load; background ticks skip the loading row).
  const tick = useLiveTick();

  // ── Load the selected org's events. Re-runs when the org switches (the layout
  // re-mounts this subtree keyed on slug, so organizationId is always current). ──
  useEffect(() => {
    loadEvents(tick > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, token, tick]);

  // ── Unpublish an event (published -> draft) ─────────────────────────────────
  // One-click parity with the admin events list. Calls POST /events/edit-event/ with
  // { event_id, is_draft: true } - the SAME endpoint + payload the admin Unpublish button
  // and the [slug]/edit form use. The backend authorises org members with can_edit_events
  // (or the owner) on the event's owning org, so this works for org-owned events with no
  // backend change. Gated on canEditEvents, exactly like the Edit button. On success we
  // re-fetch: the now-drafted event leaves this published-only list and shows up under
  // /organizer/events/drafts, where "Continue editing" re-publishes it.
  const handleUnpublish = async (event: OrgEvent) => {
    setUnpublishingId(event.event_id);
    try {
      await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/edit-event/`,
        { event_id: event.event_id, is_draft: true },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(t("eventsList.toast.unpublished"));
      await loadEvents();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || t("eventsList.toast.unpublishFailed"),
      );
    } finally {
      setUnpublishingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div data-tour="org-events-title">
        <PageHeader
          title={t("eventsList.title")}
          description={t("eventsList.description")}
          // "Create event" lives in the header action slot, gated on the permission.
          action={
            canCreateEvents ? (
              <Button data-tour="org-events-create" asChild className="w-full md:w-auto">
                <Link href="/organizer/events/create">
                  <IconPlus className="size-4" />
                  {t("eventsList.createEvent")}
                </Link>
              </Button>
            ) : undefined
          }
        />
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>{t("eventsList.cardTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            // Inline loading row - matches the organizer Overview's loading copy.
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              {t("eventsList.loading")}
            </div>
          ) : events.length === 0 ? (
            // ── Empty state ── nothing homed to this org yet.
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="flex size-12 items-center justify-center rounded-md bg-primary/10 text-primary">
                <IconCalendarEvent className="size-6" />
              </div>
              <p className="text-sm text-muted-foreground">
                {t("eventsList.empty")}
              </p>
              {canCreateEvents && (
                <Button asChild variant="outline" size="sm">
                  <Link href="/organizer/events/create">
                    {t("eventsList.createFirst")}
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <Table data-tour="org-events-table">
              <TableHeader>
                <TableRow>
                  <TableHead>{t("eventsList.table.name")}</TableHead>
                  <TableHead>{t("eventsList.table.type")}</TableHead>
                  <TableHead>{t("eventsList.table.date")}</TableHead>
                  <TableHead>{t("eventsList.table.status")}</TableHead>
                  <TableHead>{t("eventsList.table.rankings")}</TableHead>
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
                            {t("eventsList.draftBadge")}
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
                          • View      → the ORGANIZER EVENT DETAIL dashboard (admin-style, with the
                            Leaderboard / Edit / Groups / OCR buttons), always shown. This used to
                            point at the PUBLIC /tournaments page, which is why organizers landed on
                            the user-facing view with no management buttons (owner 2026-07-04 parity).
                          • Public page → the read-only public /tournaments page (opens in a new tab).
                          • Edit      → the organizer event-EDIT page, gated on
                            can_edit_events / owner (matches the backend edit_event gate).
                          • Results & Leaderboard → the org results route,
                            gated on can_upload_results / owner. */}
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/organizer/events/${event.slug}`}>
                            {t("eventsList.actions.view")}
                          </Link>
                        </Button>
                        {canEditEvents && (
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/organizer/events/${event.slug}/edit`}>
                              <IconPencil className="size-4" />
                              {t("eventsList.actions.edit")}
                            </Link>
                          </Button>
                        )}
                        {/* Unpublish -> set the event back to a draft (hides it from every
                            public list). Same gate as Edit; mirrors the admin events list. */}
                        {canEditEvents && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUnpublish(event)}
                            disabled={unpublishingId === event.event_id}
                          >
                            <IconEyeOff className="size-4" />
                            {unpublishingId === event.event_id
                              ? t("eventsList.actions.unpublishing")
                              : t("eventsList.actions.unpublish")}
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
                              {t("eventsList.actions.resultsLeaderboard")}
                            </Link>
                          </Button>
                        )}
                        {/* Public page: the read-only user-facing event page, opened in a new tab so
                            the organizer can preview what players see without leaving their dashboard.
                            (Replaces the old "Links" button, whose event-linking hub now lives on the
                            View detail page above.) Always shown. */}
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/tournaments/${event.slug}`} target="_blank">
                            <IconExternalLink className="size-4" />
                            {t("eventsList.actions.publicPage")}
                          </Link>
                        </Button>
                        {/* Groups & Rosters: live-event seeding check (stage → group →
                            teams → players). Links to the new groups page; gated on the
                            registrations permission to match that page + the backend. */}
                        {canManageRegistrations && (
                          <Button asChild variant="outline" size="sm">
                            <Link
                              href={`/organizer/events/${event.slug}/groups`}
                            >
                              <IconUsersGroup className="size-4" />
                              {t("eventsList.actions.groupsRosters")}
                            </Link>
                          </Button>
                        )}
                        {/* ZIP of registered team logos + player esport images for THIS
                            event (owner 2026-06-12; organizers use them in graphics). */}
                        <DownloadEventMediaButton eventId={Number(event.event_id)} />
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
