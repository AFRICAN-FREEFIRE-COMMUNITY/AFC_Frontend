"use client";
// ─────────────────────────────────────────────────────────────────────────────
// EventReviewsCard  ·  ratings + anonymous feedback for ONE event, admin view.
//
// Lives on the ADMIN event page (app/(a)/a/events/[slug]/page.tsx, Engagement
// tab) so AFC admins can finally SEE the ratings users leave on AFC's own
// events. Players rate any event from the public tournament page
// (app/(user)/tournaments/[slug]/_components/EventReviewCard.tsx); organizers
// read their orgs' feedback at /organizer/reviews. This card closes the gap
// for native AFC events (organization=None), which had no read surface at all.
//
// DATA FLOW (same endpoints the organizer reviews page uses, via
// lib/organizers.ts):
//   • organizersApi.getEventRating(eventId)   -> { average, count, my_score }
//     public aggregate, loaded up front (cheap).
//   • organizersApi.getEventComments(eventId) -> { results: [{ text, created_at }] }
//     gated by org_can_event(can_view_reviews) in
//     afc_organizers/views_reviews.py - for AFC events that resolves to
//     is_platform_org_admin (role=admin + a platform-admin granular role), so
//     this fetch is lazy (on first expand) and a 403 degrades to a toast.
//
// ANONYMITY: identical contract to the organizer surface - the backend only
// ever returns comment text + date, never the author. The notice below states
// it so an admin never goes chasing who said what.
//
// Design mirrors app/(organizer)/organizer/reviews/page.tsx verbatim (rating
// outline badge, expandable bordered comment list, muted empty states) so both
// read as the same designer's work.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  IconChevronDown,
  IconMessage,
  IconMessageOff,
  IconStarFilled,
} from "@tabler/icons-react";
import { formatDate } from "@/lib/utils";
import { organizersApi } from "@/lib/organizers";

// ── Shapes (mirror the organizer reviews page) ───────────────────────────────
interface EventRating {
  average: number | null;
  count: number;
}

interface EventComment {
  text: string;
  created_at: string;
}

interface EventReviewsCardProps {
  // The numeric event id the admin page already loaded (eventDetails.event_id).
  eventId: number;
}

// ── Rating badge ──────────────────────────────────────────────────────────────
// Outline badge (rounded-full, text-xs) per AFC constants - same component shape
// as the organizer reviews page's RatingBadge.
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

export function EventReviewsCard({ eventId }: EventReviewsCardProps) {
  const [rating, setRating] = useState<EventRating | null>(null);
  const [ratingLoading, setRatingLoading] = useState(true);
  // null = not fetched yet; [] = fetched, none. Comments load on first expand.
  const [comments, setComments] = useState<EventComment[] | null>(null);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // ── 1. Aggregate rating, up front (public + cheap). ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await organizersApi.getEventRating(eventId);
        if (!cancelled) {
          setRating({ average: r?.average ?? null, count: r?.count ?? 0 });
        }
      } catch {
        // Show "No ratings yet" rather than a spinner that never resolves.
        if (!cancelled) setRating(null);
      } finally {
        if (!cancelled) setRatingLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  // ── 2. Toggle the comment region; lazily fetch comments on first expand. ──
  const toggleExpand = async () => {
    const next = !expanded;
    setExpanded(next);
    if (next && comments === null && !commentsLoading) {
      setCommentsLoading(true);
      try {
        const res = await organizersApi.getEventComments(eventId);
        setComments(res?.results ?? []);
      } catch (err: any) {
        // Reset to "not fetched" so a later expand can retry.
        setComments(null);
        toast.error(err?.response?.data?.message || "Failed to load comments.");
      } finally {
        setCommentsLoading(false);
      }
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">Ratings &amp; Feedback</CardTitle>
          {ratingLoading ? (
            <span className="text-xs text-muted-foreground">
              Loading rating...
            </span>
          ) : (
            <RatingBadge rating={rating} />
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
          onClick={toggleExpand}
        >
          <IconMessage className="size-4" />
          Comments
          {/* Chevron rotates to point up when the region is open. */}
          <IconChevronDown
            className={`size-4 transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
          />
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {/* Anonymity contract - same wording as the organizer reviews page. */}
        <p className="text-xs text-muted-foreground">
          Ratings and comments are anonymous - only the feedback text and date
          are shown, never who left it. Users rate this event from its public
          tournament page.
        </p>

        {/* ── Expandable comment region. ── */}
        {expanded && (
          <div className="flex flex-col gap-2 border-t pt-3">
            {commentsLoading ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Loading comments...
              </p>
            ) : !comments || comments.length === 0 ? (
              // Empty state - no comments on this event yet.
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <IconMessageOff className="size-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No comments on this event yet.
                </p>
              </div>
            ) : (
              // The anonymous comments: text + date only, newest first as the
              // backend orders them.
              <ul className="flex flex-col gap-2">
                {comments.map((c, i) => (
                  <li key={i} className="rounded-md border bg-muted/40 p-3">
                    <p className="text-sm text-foreground whitespace-pre-wrap">
                      {c.text}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {c.created_at ? formatDate(c.created_at) : "-"}
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
}
