"use client";
// ─────────────────────────────────────────────────────────────────────────────
// SponsorRequirementsCard  ·  the player's sponsor-submission status board (P4)
//
// Drops into the public event detail (EventDetailsWrapper) right under the
// "You've registered already" block, for registered users on events that carry
// entity sponsorships (sponsorsApi.forEvent non-empty). Shows the CALLER'S own
// submissions via sponsorsApi.mySubmissions(event_id) (lib/sponsors.ts):
//
//   - one compact row per submission: engagement label + sponsor name + the
//     submitted value, with a status pill (pending yellow / approved green /
//     rejected red / not_required muted "Submitted").
//   - REJECTED rows additionally show the sponsor's reason and an inline
//     input + "Resubmit" button -> sponsorsApi.resubmitSubmission(id, payload)
//     (the row returns to pending server-side), then we toast + refetch.
//
// HOW IT CONNECTS: the rows are created by register-for-event/ (the SPONSOR
// step's `sponsorships` payload, see SponsorEngagementForm.tsx); the sponsor
// decides on them in the sponsor portal (app/(sponsor)/, decideSubmission);
// this card is the player's side of that rejection loop. Renders nothing when
// the user has no submissions for the event.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader } from "@/components/Loader";
import { sponsorsApi, MySubmissionRow } from "@/lib/sponsors";

// Fallback row title when the engagement has no label (label is optional on
// follow_social / join_group configs).
const TYPE_LABELS: Record<string, string> = {
  collect_id: "Sponsor ID",
  follow_social: "Social follow",
  create_account: "Account signup",
  join_group: "Group join",
};

// The payload key a resubmit edits, per engagement type. join_group payloads
// are either {discord_username} or {phone, country_code}; we patch whichever
// the original submission carried so country_code survives a phone fix.
const primaryPayloadKey = (row: MySubmissionRow): string => {
  switch (row.engagement_type) {
    case "collect_id":
      return "value";
    case "create_account":
      return "username";
    case "follow_social":
      return "profile_link";
    case "join_group":
      return row.payload && "discord_username" in row.payload
        ? "discord_username"
        : "phone";
    default:
      return "value";
  }
};

// Human one-liner of what was submitted, shown next to the sponsor name.
// follow_social with an empty payload means "actions confirmed, no link asked".
const submittedValueSummary = (row: MySubmissionRow): string => {
  const p = row.payload || {};
  if (row.engagement_type === "join_group" && p.phone) {
    return `${p.country_code ? `${p.country_code} ` : ""}${p.phone}`;
  }
  const value =
    p.value ?? p.username ?? p.profile_link ?? p.discord_username ?? "";
  if (String(value).trim() !== "") return String(value);
  return row.engagement_type === "follow_social" ? "Actions confirmed" : "";
};

// Status pill in the AFC tier-badge idiom (outline, rounded-full, text-xs).
const StatusPill: React.FC<{ status: MySubmissionRow["approval_status"] }> = ({
  status,
}) => {
  const styles: Record<string, { className: string; label: string }> = {
    pending: {
      className: "border-yellow-500/50 text-yellow-400",
      label: "Pending",
    },
    approved: {
      className: "border-green-500/50 text-green-500",
      label: "Approved",
    },
    rejected: {
      className: "border-destructive/50 text-destructive",
      label: "Rejected",
    },
    not_required: {
      className: "border-input text-muted-foreground",
      label: "Submitted",
    },
  };
  const s = styles[status] ?? styles.not_required;
  return (
    <Badge
      variant="outline"
      className={`rounded-full px-2 py-0.5 text-xs flex-shrink-0 ${s.className}`}
    >
      {s.label}
    </Badge>
  );
};

interface SponsorRequirementsCardProps {
  // The numeric event id already loaded by the page (eventDetails.event_id).
  eventId: number;
}

export const SponsorRequirementsCard: React.FC<
  SponsorRequirementsCardProps
> = ({ eventId }) => {
  // null = still loading (render nothing yet); [] = loaded, nothing to show.
  const [rows, setRows] = useState<MySubmissionRow[] | null>(null);
  // Per-row resubmit drafts keyed by submission id.
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  // The submission id currently being resubmitted (disables its button).
  const [resubmittingId, setResubmittingId] = useState<number | null>(null);

  const fetchRows = useCallback(async () => {
    try {
      const res = await sponsorsApi.mySubmissions(eventId);
      setRows(res.results || []);
    } catch {
      // Non-fatal supplementary UI (same stance as fetchPageRoster): a failed
      // fetch just hides the card.
      setRows([]);
    }
  }, [eventId]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  // Player fixes a rejected value; the row returns to pending server-side.
  const handleResubmit = async (row: MySubmissionRow) => {
    const value = (drafts[row.id] ?? "").trim();
    if (!value) return;
    setResubmittingId(row.id);
    try {
      // Merge onto the original payload so sibling keys (country_code on
      // WhatsApp joins) survive a single-field correction.
      await sponsorsApi.resubmitSubmission(row.id, {
        ...(row.payload || {}),
        [primaryPayloadKey(row)]: value,
      });
      toast.success("Submitted. The sponsor will review it again.");
      setDrafts((prev) => ({ ...prev, [row.id]: "" }));
      await fetchRows();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to resubmit");
    } finally {
      setResubmittingId(null);
    }
  };

  // Nothing to show while loading or when the user has no submissions here.
  if (!rows || rows.length === 0) return null;

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-xl">Sponsor Requirements</CardTitle>
        <CardDescription>
          Your sponsor submissions for this event. Rejected items can be
          corrected and resubmitted below.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((row) => {
          const summary = submittedValueSummary(row);
          const isResubmitting = resubmittingId === row.id;
          return (
            <div key={row.id} className="p-3 rounded-md border space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {row.engagement_label ||
                      TYPE_LABELS[row.engagement_type] ||
                      "Sponsor requirement"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {row.sponsor_name}
                    {summary ? ` : ${summary}` : ""}
                  </p>
                </div>
                <StatusPill status={row.approval_status} />
              </div>

              {/* ── Rejection loop: reason + inline fix + Resubmit ── */}
              {row.approval_status === "rejected" && (
                <div className="space-y-2">
                  {row.reason && (
                    <p className="text-xs text-destructive">
                      Reason: {row.reason}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Input
                      className="h-8 text-xs flex-1"
                      placeholder="Enter the corrected value"
                      value={drafts[row.id] ?? ""}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [row.id]: e.target.value,
                        }))
                      }
                      disabled={isResubmitting}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleResubmit(row)}
                      disabled={!(drafts[row.id] ?? "").trim() || isResubmitting}
                    >
                      {isResubmitting ? (
                        <Loader text="Sending..." />
                      ) : (
                        "Resubmit"
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
