"use client";
// ─────────────────────────────────────────────────────────────────────────────
// EventReviewCard  ·  the "Rate this event" + feedback widget on a tournament page
//
// Drops into the public event detail (EventDetailsWrapper) as a small card. Two
// surfaces, wired to organizersApi (lib/organizers.ts):
//
//   1. RATING — 5 clickable stars bound to getEventRating(event_id).my_score.
//      It is always editable: clicking a star re-submits via rateEvent() (an
//      upsert — one rating per event+user), then we refresh the aggregate.
//      Anonymous visitors see the aggregate read-only ("X.X ★ (N ratings)").
//
//   2. COMMENT — a textarea + submit that posts via commentEvent(). The comment
//      is private to the event's organizer (+ AFC); on success we toast
//      "Sent to the organizer" and clear the box.
//
// Only logged-in users (useAuth) get the interactive controls. Everyone sees the
// aggregate. Mirrors the rest of the app: axios-style organizersApi calls, sonner
// toasts on success/error, shadcn Card/Button/Textarea, AFC green-primary accents.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useState } from "react";
import { Star } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader } from "@/components/Loader";
import { useAuth } from "@/contexts/AuthContext";
import { organizersApi } from "@/lib/organizers";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Aggregate shape returned by getEventRating(). my_score is null for anonymous
// callers (and for logged-in users who haven't rated yet).
interface EventRating {
  average: number;
  count: number;
  my_score: number | null;
}

const MAX_STARS = 5;

interface EventReviewCardProps {
  // The numeric event id already loaded by the page (eventDetails.event_id).
  eventId: number;
  // The event name — used only for friendlier copy in the comment box.
  eventName: string;
}

export const EventReviewCard: React.FC<EventReviewCardProps> = ({
  eventId,
  eventName,
}) => {
  const { token } = useAuth();
  const isLoggedIn = !!token;

  // ── Rating state ──
  const [rating, setRating] = useState<EventRating | null>(null);
  const [hoverScore, setHoverScore] = useState(0); // 0 = not hovering
  const [isRating, setIsRating] = useState(false); // submit in flight

  // ── Comment state ──
  const [comment, setComment] = useState("");
  const [isSendingComment, setIsSendingComment] = useState(false);

  // Pull the aggregate (+ my_score when authed). Auth is optional on this
  // endpoint, so anonymous visitors still get average + count.
  const fetchRating = useCallback(async () => {
    try {
      const data = await organizersApi.getEventRating(eventId);
      setRating(data);
    } catch {
      // Non-fatal — the widget just renders its empty/zero state.
    }
  }, [eventId]);

  useEffect(() => {
    if (eventId) fetchRating();
  }, [eventId, fetchRating]);

  // Clicking a star upserts the caller's score, then refreshes the aggregate so
  // the average + count reflect the new rating immediately.
  const handleRate = async (score: number) => {
    if (!isLoggedIn || isRating) return;
    setIsRating(true);
    try {
      await organizersApi.rateEvent(eventId, score);
      // Optimistically reflect my_score; fetchRating reconciles the aggregate.
      setRating((prev) =>
        prev ? { ...prev, my_score: score } : prev,
      );
      await fetchRating();
      toast.success("Thanks for rating this event!");
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Failed to submit your rating",
      );
    } finally {
      setIsRating(false);
    }
  };

  // Post a private comment to the organizer; clear the box on success.
  const handleComment = async () => {
    const text = comment.trim();
    if (!text || isSendingComment) return;
    setIsSendingComment(true);
    try {
      await organizersApi.commentEvent(eventId, text);
      setComment("");
      toast.success("Sent to the organizer");
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Failed to send your comment",
      );
    } finally {
      setIsSendingComment(false);
    }
  };

  // The score the stars should paint: hover preview > my own rating > none.
  const activeScore = hoverScore || rating?.my_score || 0;
  const average = rating?.average ?? 0;
  const count = rating?.count ?? 0;

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-xl">Rate this event</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* ── Stars + aggregate ── */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            {/* Star row. Buttons are disabled (non-interactive) for anonymous
                visitors so they read as a static, read-only display. */}
            <div
              className="flex items-center gap-1"
              onMouseLeave={() => setHoverScore(0)}
            >
              {Array.from({ length: MAX_STARS }, (_, i) => {
                const value = i + 1;
                const filled = value <= activeScore;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-label={`Rate ${value} star${value > 1 ? "s" : ""}`}
                    disabled={!isLoggedIn || isRating}
                    onMouseEnter={() =>
                      isLoggedIn && setHoverScore(value)
                    }
                    onClick={() => handleRate(value)}
                    className={cn(
                      "transition-transform",
                      isLoggedIn
                        ? "cursor-pointer hover:scale-110"
                        : "cursor-default",
                    )}
                  >
                    <Star
                      className={cn(
                        "size-6 transition-colors",
                        filled
                          ? "fill-primary text-primary"
                          : "text-muted-foreground/40",
                      )}
                    />
                  </button>
                );
              })}
            </div>

            {/* Aggregate, e.g. "4.3 ★ (12 ratings)" — read-only for everyone. */}
            <div className="text-sm text-muted-foreground">
              {count > 0 ? (
                <span>
                  <span className="font-semibold text-foreground">
                    {average.toFixed(1)}
                  </span>{" "}
                  ★ ({count} {count === 1 ? "rating" : "ratings"})
                </span>
              ) : (
                <span>No ratings yet</span>
              )}
            </div>
          </div>

          {/* Helper line: logged-in users learn the stars are editable; anonymous
              visitors are nudged to log in to participate. */}
          <p className="text-xs text-muted-foreground">
            {isLoggedIn
              ? rating?.my_score
                ? "You rated this event — click a star to change it."
                : "Click a star to rate this event."
              : "Log in to rate this event and leave feedback."}
          </p>
        </div>

        {/* ── Comment box — logged-in only. Private to the organizer. ── */}
        {isLoggedIn && (
          <div className="space-y-2">
            <label
              htmlFor="event-comment"
              className="text-sm font-medium text-foreground"
            >
              Leave feedback for the organizer
            </label>
            <Textarea
              id="event-comment"
              placeholder={`Share your thoughts on ${eventName}…`}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              disabled={isSendingComment}
            />
            <p className="text-xs text-muted-foreground">
              Only the organizer (and AFC) can read this.
            </p>
            <div className="flex justify-end">
              <Button
                onClick={handleComment}
                disabled={!comment.trim() || isSendingComment}
              >
                {isSendingComment ? <Loader text="Sending..." /> : "Send"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
