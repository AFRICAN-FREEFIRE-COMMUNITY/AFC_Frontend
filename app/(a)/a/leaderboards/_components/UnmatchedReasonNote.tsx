"use client";

// ── UnmatchedReasonNote ───────────────────────────────────────────────────────
// The one-line "why did this not match?" note shown next to a review row the OCR matcher REFUSED to
// bind. Shared by BOTH review tables so the two flows explain themselves identically:
//   - app/(a)/a/leaderboards/_components/OCRReviewTable.tsx                    (EVENT sessions)
//   - app/(a)/a/leaderboards/standalone/create/_components/OcrReviewTable.tsx  (STANDALONE maps)
//
// WHY IT EXISTS
// The matcher deliberately declines to guess in several situations (afc_ocr/services/matching.py):
// the best candidate is too weak, two records scored EXACTLY the same, or a 2-4 character team tag
// matched with nothing to back it up. Before this, all of those looked identical in the table: a
// red row with an empty picker. The admin could not tell "nothing resembles this" from "we found
// the team but would not bet a standing on a two-letter tag", so the natural reaction was to
// distrust the whole screen. The backend now sends WHY on every row (`unmatched_reason`), and this
// renders it, so the row says what it wants from the reviewer.
//
// The reason strings are the REASON_* constants in afc_ocr/services/matching.py and are used
// verbatim as i18n keys under the `ocr.whyNot.*` group (messages/{en,fr,pt}/ocr.json). An unknown
// or empty reason renders nothing, so a row from an older draft (saved before the backend emitted
// the field) simply looks the way it always did.

import { useTranslations } from "next-intl";
import { IconHelpCircle } from "@tabler/icons-react";

import { cn } from "@/lib/utils";

// Kept in sync with afc_ocr.services.matching REASON_* (and afc_leaderboard.ocr for team_conflict).
// Anything outside this list is ignored rather than rendered raw, so a backend that grows a new
// reason before the catalogue does can never print an untranslated key at the admin.
const KNOWN_REASONS = [
  "no_candidates",
  "below_floor",
  "ambiguous",
  "tag_needs_corroboration",
  "team_conflict",
] as const;

export function UnmatchedReasonNote({
  reason,
  className,
}: {
  /** The row's `unmatched_reason` from the backend. "" / undefined on a row that DID bind. */
  reason?: string | null;
  className?: string;
}) {
  const t = useTranslations("ocr");
  if (!reason || !KNOWN_REASONS.includes(reason as (typeof KNOWN_REASONS)[number])) {
    return null;
  }
  return (
    <span
      className={cn(
        "flex items-start gap-1 text-[10px] leading-snug text-amber-600 dark:text-amber-400",
        className,
      )}
    >
      <IconHelpCircle size={11} className="mt-px shrink-0" />
      <span>{t(`whyNot.${reason}`)}</span>
    </span>
  );
}
