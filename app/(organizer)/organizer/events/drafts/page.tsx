// ─────────────────────────────────────────────────────────────────────────────
// Organizer › Events › Drafts (the org's unpublished/draft events).
//
// A dedicated list of the selected organization's DRAFT events - events saved with
// is_draft=True from the create/edit wizard but not yet published. The organizer
// resumes one by clicking through to the organizer event-EDIT page, where finishing
// + publishing flips is_draft off and the event leaves this list.
//
// DATA (one read-only fetch):
//   GET /events/get-drafted-events/?organization_id=<id>
//     → { drafted_events: [{ event_id, event_slug, event_name,
//                            participant_type, created_at }] }
// The endpoint (afc_tournament_and_scrims/views.py::get_drafted_events) scopes the
// drafts to the given org and 403s a caller who is neither an AFC admin nor an org
// member with can_create_events / can_edit_events - the SAME permission set this
// page gates on client-side. The Bearer token (AuthContext) is required.
//
// GATING: the surface is gated on isOwner OR can_create_events OR can_edit_events -
// matching the backend gate exactly. A member without any of those gets the
// read-only lock notice (mirrors the organizer Leaderboards / Design pages).
//
// REUSE: a LIST page, so no admin step components are reused here - each row simply
// deep-links into the organizer edit page (events/[slug]/edit) that owns the heavy
// wizard reuse. Design mirrors the sibling organizer pages (events / leaderboards):
// PageHeader, a single Card wrapping a Table, outline badges (rounded-full, text-xs)
// per AFC constants, sonner toasts on error.
//
// NAV: reached from the "Drafts" item in the organizer portal sidebar
// (app/(organizer)/organizer/layout.tsx NAV_ITEMS) and from the Events list.
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
  IconFileText,
  IconLock,
  IconPencil,
  IconPlus,
} from "@tabler/icons-react";
import { env } from "@/lib/env";
import { formatDate } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganizer } from "../../_components/OrganizerContext";
// Reused from the admin Events area: a destructive confirm dialog that POSTs
// /events/delete-event/. The backend now lets the event's CREATOR delete it while it
// is still a draft (in addition to AFC admins / org can_edit_events), so organizers
// can remove their own drafts here. See afc_tournament_and_scrims/views.py::delete_event.
import { DeleteEventModal } from "@/app/(a)/a/events/_components/DeleteEventModal";

// ── Row shape ───────────────────────────────────────────────────────────────
// One draft as returned inside get-drafted-events().drafted_events[]. participant_type
// is "solo" / "team" - shown as the only descriptor a draft carries before its full
// details are filled in on the edit page.
interface DraftEvent {
  event_id: number | string;
  event_slug: string;
  event_name: string;
  participant_type: string;
  created_at: string;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OrganizerDraftsPage() {
  const { membership, isOwner } = useOrganizer();
  const { token } = useAuth();
  const t = useTranslations("organizer");

  // The numeric id used to scope the drafts fetch (lives on the selected membership).
  const organizationId = membership.organization.organization_id;
  // The SAME gate the backend enforces: owner OR can_create_events OR can_edit_events.
  // A draft is an in-progress event, so anyone who can create or edit events may see
  // and resume it.
  const canManageDrafts =
    membership.permissions.can_create_events ||
    membership.permissions.can_edit_events ||
    isOwner;

  const [drafts, setDrafts] = useState<DraftEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Load this org's draft events. Re-runs when the org switches: the portal
  // layout re-mounts this subtree keyed on slug, so organizationId is current. ──
  useEffect(() => {
    // Skip the fetch entirely when the caller can't manage drafts - the page only
    // renders the lock notice in that case, so there's nothing to load.
    if (!canManageDrafts) {
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        const res = await axios.get(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-drafted-events/`,
          {
            params: { organization_id: organizationId },
            // The endpoint REQUIRES the Bearer token (it 400s without one) and uses
            // it to authorise the caller against this organization.
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          },
        );
        setDrafts(res.data?.drafted_events ?? []);
      } catch (err: any) {
        toast.error(
          err?.response?.data?.message || t("drafts.toast.loadFailed"),
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [organizationId, token, canManageDrafts]);

  // ── Permission gate: read-only lock notice (mirrors Leaderboards / Design). ──
  if (!canManageDrafts) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader
          title={t("drafts.title")}
          description={t("drafts.description")}
        />
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <IconLock className="size-6" />
            </div>
            <p className="max-w-sm text-sm text-muted-foreground">
              {t("drafts.noPermission")}
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/organizer/overview">
                {t("drafts.backToOverview")}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div data-tour="org-drafts-title">
        <PageHeader
          title={t("drafts.title")}
          description={t("drafts.description")}
          // "Create event" mirrors the Events list header action, gated the same way
          // (can_create_events / owner) - a draft starts life in the create wizard.
          action={
            membership.permissions.can_create_events || isOwner ? (
              <Button data-tour="org-drafts-create" asChild className="w-full md:w-auto">
                <Link href="/organizer/events/create">
                  <IconPlus className="size-4" />
                  {t("drafts.createEvent")}
                </Link>
              </Button>
            ) : undefined
          }
        />
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>{t("drafts.cardTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            // Inline loading row - matches the organizer Events / Leaderboards copy.
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              {t("drafts.loading")}
            </div>
          ) : drafts.length === 0 ? (
            // ── Empty state ── no drafts saved for this org yet.
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="flex size-12 items-center justify-center rounded-md bg-primary/10 text-primary">
                <IconFileText className="size-6" />
              </div>
              <p className="text-sm text-muted-foreground">
                {t("drafts.empty")}
              </p>
              {(membership.permissions.can_create_events || isOwner) && (
                <Button asChild variant="outline" size="sm">
                  <Link href="/organizer/events/create">
                    {t("drafts.createEventAlt")}
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <Table data-tour="org-drafts-table">
              <TableHeader>
                <TableRow>
                  <TableHead>{t("drafts.table.name")}</TableHead>
                  <TableHead>{t("drafts.table.format")}</TableHead>
                  <TableHead>{t("drafts.table.created")}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drafts.map((draft) => (
                  <TableRow key={draft.event_id}>
                    {/* Name + a Draft badge so the row reads at a glance, matching
                        the inline draft badge on the Events list. */}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {draft.event_name || t("drafts.untitled")}
                        <Badge
                          variant="outline"
                          className="border-muted-foreground text-muted-foreground"
                        >
                          {t("drafts.draftBadge")}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="capitalize">
                      {draft.participant_type || "-"}
                    </TableCell>
                    <TableCell>
                      {draft.created_at ? formatDate(draft.created_at) : "-"}
                    </TableCell>
                    <TableCell>
                      {/* "Continue editing" deep-links into the organizer edit page,
                          where finishing + publishing flips is_draft off and the
                          event drops out of this list. The Delete button (owner
                          2026-06-21) lets the organizer remove their own draft; on
                          success we drop the row from local state so the list updates
                          without a refetch. */}
                      <div className="flex items-center justify-end gap-2">
                        <Button asChild variant="outline" size="sm">
                          <Link
                            href={`/organizer/events/${draft.event_slug}/edit`}
                          >
                            <IconPencil className="size-4" />
                            {t("drafts.continueEditing")}
                          </Link>
                        </Button>
                        <DeleteEventModal
                          eventId={draft.event_id}
                          eventName={draft.event_name || t("drafts.untitled")}
                          size="sm"
                          showLabel
                          onSuccess={() =>
                            setDrafts((prev) =>
                              prev.filter((d) => d.event_id !== draft.event_id),
                            )
                          }
                        />
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
