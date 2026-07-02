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
// i18n: copy lives in messages/en/tournaments.json under "sponsorRequirements.*"
// (useTranslations resolves the NEXT_LOCALE cookie locale, en fallback).
import { useTranslations } from "next-intl";

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
// Live refresh (owner 2026-07-02): re-pull the read-only submission statuses on the site-wide
// tick so pending -> approved/rejected pills flip without a manual reload.
import { useLiveTick } from "@/hooks/useLiveTick";

// Fallback row title when the engagement has no label (label is optional on
// follow_social / join_group configs). Maps each engagement type to its i18n
// key under sponsorRequirements.typeLabels.* (resolved at render via t()).
const TYPE_LABEL_KEYS: Record<string, string> = {
  collect_id: "sponsorRequirements.typeLabels.collectId",
  follow_social: "sponsorRequirements.typeLabels.followSocial",
  create_account: "sponsorRequirements.typeLabels.createAccount",
  join_group: "sponsorRequirements.typeLabels.joinGroup",
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
// `actionsConfirmedLabel` is the localized "Actions confirmed" string, passed in
// from the component (this stays a pure helper, no hook here).
const submittedValueSummary = (
  row: MySubmissionRow,
  actionsConfirmedLabel: string,
): string => {
  const p = row.payload || {};
  if (row.engagement_type === "join_group" && p.phone) {
    return `${p.country_code ? `${p.country_code} ` : ""}${p.phone}`;
  }
  const value =
    p.value ?? p.username ?? p.profile_link ?? p.discord_username ?? "";
  if (String(value).trim() !== "") return String(value);
  return row.engagement_type === "follow_social" ? actionsConfirmedLabel : "";
};

// Status pill in the AFC tier-badge idiom (outline, rounded-full, text-xs).
const StatusPill: React.FC<{ status: MySubmissionRow["approval_status"] }> = ({
  status,
}) => {
  // i18n: localized status labels under sponsorRequirements.status.*.
  const t = useTranslations("tournaments");
  const styles: Record<string, { className: string; label: string }> = {
    pending: {
      className: "border-yellow-500/50 text-yellow-400",
      label: t("sponsorRequirements.status.pending"),
    },
    approved: {
      className: "border-green-500/50 text-green-500",
      label: t("sponsorRequirements.status.approved"),
    },
    rejected: {
      className: "border-destructive/50 text-destructive",
      label: t("sponsorRequirements.status.rejected"),
    },
    not_required: {
      className: "border-input text-muted-foreground",
      label: t("sponsorRequirements.status.submitted"),
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
  const t = useTranslations("tournaments");
  // null = still loading (render nothing yet); [] = loaded, nothing to show.
  const [rows, setRows] = useState<MySubmissionRow[] | null>(null);
  // Per-row resubmit drafts keyed by submission id.
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  // The submission id currently being resubmitted (disables its button).
  const [resubmittingId, setResubmittingId] = useState<number | null>(null);

  // Live refresh (owner 2026-07-02): background=true = a silent tick re-pull; on failure it
  // keeps the last good rows instead of blanking (hiding) the card mid-session.
  const fetchRows = useCallback(async (background = false) => {
    try {
      const res = await sponsorsApi.mySubmissions(eventId);
      setRows(res.results || []);
    } catch {
      // Non-fatal supplementary UI (same stance as fetchPageRoster): a failed
      // fetch just hides the card.
      if (!background) setRows([]);
    }
  }, [eventId]);

  // Live refresh (owner 2026-07-02): tick 0 = the normal first load; later ticks are background.
  // The resubmit drafts live in separate state (keyed by submission id), so typing is safe.
  const tick = useLiveTick();
  useEffect(() => {
    fetchRows(tick > 0);
  }, [tick, fetchRows]);

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
      toast.success(t("sponsorRequirements.resubmitSuccess"));
      setDrafts((prev) => ({ ...prev, [row.id]: "" }));
      await fetchRows();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          t("sponsorRequirements.resubmitFailed"),
      );
    } finally {
      setResubmittingId(null);
    }
  };

  // Nothing to show while loading or when the user has no submissions here.
  if (!rows || rows.length === 0) return null;

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-xl">
          {t("sponsorRequirements.title")}
        </CardTitle>
        <CardDescription>
          {t("sponsorRequirements.description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((row) => {
          const summary = submittedValueSummary(
            row,
            t("sponsorRequirements.actionsConfirmed"),
          );
          const isResubmitting = resubmittingId === row.id;
          return (
            <div key={row.id} className="p-3 rounded-md border space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {row.engagement_label ||
                      (TYPE_LABEL_KEYS[row.engagement_type]
                        ? t(TYPE_LABEL_KEYS[row.engagement_type] as any)
                        : t("sponsorRequirements.fallbackTitle"))}
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
                      {t("sponsorRequirements.reason", { reason: row.reason })}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Input
                      className="h-8 text-xs flex-1"
                      placeholder={t("sponsorRequirements.correctedPlaceholder")}
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
                        <Loader text={t("sponsorRequirements.sending")} />
                      ) : (
                        t("sponsorRequirements.resubmit")
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
