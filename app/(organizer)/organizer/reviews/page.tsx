// ─────────────────────────────────────────────────────────────────────────────
// Organizer › Reviews.
//
// The org's per-event feedback surface. For every event the organization has run we
// show its average rating (+ the number of ratings behind it) and an EXPANDABLE list
// of the comments left on it. Comments are ANONYMOUS — the backend exposes only the
// text + the date, never who wrote them — and the UI says so plainly (a notice at the
// top of the page and a reminder on each comment list) so an organizer never expects
// to see (or chase) the author.
//
// DATA FLOW:
//   1. Fetch the org's events:
//        GET `${NEXT_PUBLIC_BACKEND_API_URL}/events/get-all-events/?organization_id=<id>`
//      (the same call the Events page uses; response is { events: [...] }).
//   2. For each event, lazily fetch on first expand:
//        • organizersApi.getEventRating(event_id)  -> { average, count, my_score }
//        • organizersApi.getEventComments(event_id) -> { results: [{ text, created_at }] }
//      Each event's rating is loaded up front (cheap aggregate); the comment list is
//      only fetched the first time its row is expanded, then cached.
//
// GATING: mirrors the rest of the portal. The gate here is
// membership.permissions.can_view_reviews OR isOwner. A member without that
// permission gets a read-only lock notice (mirrors the Design / Metrics pages) — no
// events, ratings, or comments are ever fetched.
//
// The selected org is read from the OrganizerContext the portal layout provides —
// switching orgs re-mounts this subtree (keyed on slug), which re-runs the fetch
// below for the newly-selected org.
//
// Design mirrors the sibling organizer pages (events / design / members): PageHeader,
// a single Card per event wrapping an expandable comments region, outline badges
// (rounded-full, text-xs) per AFC constants, sonner toasts on error.
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import axios from "axios";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  IconChevronDown,
  IconLock,
  IconMessage,
  IconMessageOff,
  IconStarFilled,
} from "@tabler/icons-react";
import { env } from "@/lib/env";
import { formatDate } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { organizersApi } from "@/lib/organizers";
import { useOrganizer } from "../_components/OrganizerContext";

// ── Event row shape ───────────────────────────────────────────────────────────
// The org-scoped get-all-events response (same call the Events page uses). We only
// need the id + name here to fan out the per-event rating + comments fetches.
interface OrgEvent {
  event_id: string;
  event_name: string;
}

// ── Rating shape ──────────────────────────────────────────────────────────────
// getEventRating(eventId) -> { average, count, my_score }. average/count are the
// aggregate we surface; my_score is the caller's own score (unused here — the
// organizer view shows only the anonymous aggregate).
interface EventRating {
  average: number | null;
  count: number;
}

// ── Comment shape ─────────────────────────────────────────────────────────────
// getEventComments(eventId) -> { results: [{ text, created_at }] }. ANONYMOUS by
// design — the payload carries no author, only the text + when it was posted.
interface EventComment {
  text: string;
  created_at: string;
}

// ── Per-event local state ─────────────────────────────────────────────────────
// Tracks the lazily-loaded rating + comments for one event row, plus the loading
// flags and whether its comment region is expanded.
interface EventState {
  rating: EventRating | null;
  ratingLoading: boolean;
  comments: EventComment[] | null; // null = not fetched yet; [] = fetched, empty.
  commentsLoading: boolean;
  expanded: boolean;
}

const EMPTY_EVENT_STATE: EventState = {
  rating: null,
  ratingLoading: true,
  comments: null,
  commentsLoading: false,
  expanded: false,
};

// ── Anonymity notice ──────────────────────────────────────────────────────────
// Reused at the top of the page and inside each comment list so the organizer is
// always reminded that feedback is anonymous (text + date only, never the author).
function AnonymityNotice({ inline = false }: { inline?: boolean }) {
  return (
    <p
      className={
        inline
          ? "text-[11px] text-muted-foreground/80"
          : "text-xs text-muted-foreground"
      }
    >
      Ratings and comments are anonymous — only the feedback text and date are
      shown, never who left it.
    </p>
  );
}

// ── Rating badge ──────────────────────────────────────────────────────────────
// Outline badge (rounded-full, text-xs) per AFC constants. Shows the star + average
// to one decimal and the count behind it, or a muted "No ratings yet" when count==0.
function RatingBadge({ rating }: { rating: EventRating | null }) {
  const count = rating?.count ?? 0;
  if (count === 0 || rating?.average == null) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        No ratings yet
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-yellow-500 text-yellow-600 gap-1">
      <IconStarFilled className="size-3" />
      {rating.average.toFixed(1)}
      <span className="text-muted-foreground">
        ({count} rating{count !== 1 ? "s" : ""})
      </span>
    </Badge>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OrganizerReviewsPage() {
  const { membership, isOwner } = useOrganizer();
  const { token } = useAuth();

  // Same gate the rest of the portal uses, on the reviews permission.
  const canViewReviews = membership.permissions.can_view_reviews || isOwner;
  // The numeric id used to scope the events fetch (lives on the selected membership).
  const organizationId = membership.organization.organization_id;

  const [events, setEvents] = useState<OrgEvent[]>([]);
  const [loading, setLoading] = useState(true);
  // Per-event rating/comments/expand state, keyed by event_id.
  const [states, setStates] = useState<Record<string, EventState>>({});

  // Small helper: patch one event's state by id (merging into what's there).
  const patchState = useCallback(
    (eventId: string, patch: Partial<EventState>) => {
      setStates((prev) => ({
        ...prev,
        [eventId]: { ...(prev[eventId] ?? EMPTY_EVENT_STATE), ...patch },
      }));
    },
    [],
  );

  // ── 1. Load the org's events, then fetch each event's rating up front. ──
  // Gated members skip the fetch entirely (they only see the lock notice).
  useEffect(() => {
    if (!canViewReviews) {
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        // Same org-scoped events call the Events page uses; response is { events }.
        const res = await axios.get(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-all-events/`,
          {
            params: { organization_id: organizationId },
            // Read-only/public, but send the Bearer so an org-scoped backend can
            // authorise the caller against the organization.
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          },
        );
        const list: OrgEvent[] = res.data?.events ?? [];
        setEvents(list);

        // Seed each event's state, then fetch its (cheap) aggregate rating.
        const seeded: Record<string, EventState> = {};
        list.forEach((ev) => {
          seeded[ev.event_id] = { ...EMPTY_EVENT_STATE };
        });
        setStates(seeded);

        // Fan out the rating fetches — one aggregate per event. A failure on one
        // event's rating shouldn't blank the whole page, so each is caught locally.
        list.forEach(async (ev) => {
          try {
            const r = await organizersApi.getEventRating(ev.event_id);
            patchState(ev.event_id, {
              rating: { average: r?.average ?? null, count: r?.count ?? 0 },
              ratingLoading: false,
            });
          } catch {
            // Couldn't load this event's rating — show "No ratings yet" rather than
            // a spinner that never resolves.
            patchState(ev.event_id, { rating: null, ratingLoading: false });
          }
        });
      } catch (err: any) {
        toast.error(
          err?.response?.data?.message || "Failed to load your events.",
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [organizationId, token, canViewReviews, patchState]);

  // ── 2. Toggle a row's comment region; lazily fetch comments on first expand. ──
  const toggleExpand = async (eventId: string) => {
    const current = states[eventId] ?? EMPTY_EVENT_STATE;
    const nextExpanded = !current.expanded;
    patchState(eventId, { expanded: nextExpanded });

    // Only fetch the comments the first time the row opens (then cache them).
    if (nextExpanded && current.comments === null && !current.commentsLoading) {
      patchState(eventId, { commentsLoading: true });
      try {
        const res = await organizersApi.getEventComments(eventId);
        patchState(eventId, {
          comments: res?.results ?? [],
          commentsLoading: false,
        });
      } catch (err: any) {
        // Reset to "not fetched" so a later expand can retry.
        patchState(eventId, { comments: null, commentsLoading: false });
        toast.error(
          err?.response?.data?.message || "Failed to load comments.",
        );
      }
    }
  };

  // ── Non-permitted member: read-only lock notice (mirrors Design / Metrics). ──
  if (!canViewReviews) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Reviews"
          description="Ratings and feedback on your events."
        />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <IconLock className="size-8 text-muted-foreground" />
            <p className="max-w-sm text-sm text-muted-foreground">
              You don&apos;t have permission to view this organization&apos;s
              reviews.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 gap-2 text-muted-foreground text-sm">
        Loading reviews...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Reviews"
        description="Ratings and anonymous feedback on each of your events."
      />

      {/* Page-level anonymity notice — set the expectation before any feedback. */}
      <AnonymityNotice />

      {/* No events at all → nothing to review yet. */}
      {events.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-md bg-primary/10 text-primary">
              <IconMessage className="size-6" />
            </div>
            <p className="text-sm text-muted-foreground">
              Your organization hasn&apos;t run any events yet, so there&apos;s
              no feedback to show.
            </p>
          </CardContent>
        </Card>
      ) : (
        // One card per event: name + rating badge in the header row, an expand
        // toggle, and the (lazily-loaded) comment list when open.
        <div className="flex flex-col gap-3">
          {events.map((ev) => {
            const st = states[ev.event_id] ?? EMPTY_EVENT_STATE;
            return (
              <Card key={ev.event_id}>
                <CardContent className="flex flex-col gap-3">
                  {/* ── Header row: name + rating + expand toggle. ── */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{ev.event_name}</span>
                      {st.ratingLoading ? (
                        <span className="text-xs text-muted-foreground">
                          Loading rating...
                        </span>
                      ) : (
                        <RatingBadge rating={st.rating} />
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5"
                      onClick={() => toggleExpand(ev.event_id)}
                    >
                      <IconMessage className="size-4" />
                      Comments
                      {/* Chevron rotates to point up when the region is open. */}
                      <IconChevronDown
                        className={`size-4 transition-transform ${
                          st.expanded ? "rotate-180" : ""
                        }`}
                      />
                    </Button>
                  </div>

                  {/* ── Expandable comment region. ── */}
                  {st.expanded && (
                    <div className="flex flex-col gap-2 border-t pt-3">
                      {/* Reminder that these comments are anonymous. */}
                      <AnonymityNotice inline />

                      {st.commentsLoading ? (
                        <p className="py-4 text-center text-sm text-muted-foreground">
                          Loading comments...
                        </p>
                      ) : !st.comments || st.comments.length === 0 ? (
                        // Empty state — no comments on this event yet.
                        <div className="flex flex-col items-center gap-2 py-6 text-center">
                          <IconMessageOff className="size-6 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">
                            No comments on this event yet.
                          </p>
                        </div>
                      ) : (
                        // The anonymous comments: text + date only, newest as the
                        // backend orders them.
                        <ul className="flex flex-col gap-2">
                          {st.comments.map((c, i) => (
                            <li
                              key={i}
                              className="rounded-md border bg-muted/40 p-3"
                            >
                              <p className="text-sm text-foreground whitespace-pre-wrap">
                                {c.text}
                              </p>
                              <p className="mt-1 text-[11px] text-muted-foreground">
                                {c.created_at ? formatDate(c.created_at) : "—"}
                              </p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
