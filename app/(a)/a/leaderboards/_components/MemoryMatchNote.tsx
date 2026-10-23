"use client";

// ── MemoryMatchNote ───────────────────────────────────────────────────────────
// The one-line "remembered from your earlier reviews" note on a review row the OCR matcher bound
// from the organization's NAME MEMORY rather than by spelling alone (owner 2026-10-22, inbox #334,
// #335: each organizer has its own memory of player names, and it learns from every confirmed and
// every failed read).
//
// Where it comes from: AFC-B afc_ocr/services/matching.match_name sets match_source "memory" on a
// row when a spelling this organization's reviewers confirmed before decided the match
// (afc_ocr/services/name_memory.py). It sits beside <UnmatchedReasonNote> in both review tables:
//   - app/(a)/a/leaderboards/_components/OCRReviewTable.tsx                    (EVENT sessions)
//   - app/(a)/a/leaderboards/standalone/create/_components/OcrReviewTable.tsx  (STANDALONE maps)
// Anything other than "memory" (or nothing, on rows saved before the field existed) renders nothing.
//
// No NEW badge on purpose: this note repeats on every remembered row, and a tag on each would bury
// the table; the note's own words are what tells the reviewer the site learned.
import { IconHistory } from "@tabler/icons-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

export function MemoryMatchNote({ source, className }: { source?: string | null; className?: string }) {
  const t = useTranslations("ocr");
  if (source !== "memory") return null;
  return (
    <span
      className={cn(
        "flex items-start gap-1 text-[10px] leading-snug text-emerald-600 dark:text-emerald-400",
        className,
      )}
    >
      <IconHistory size={11} className="mt-px shrink-0" />
      <span>{t("memory.remembered")}</span>
    </span>
  );
}
