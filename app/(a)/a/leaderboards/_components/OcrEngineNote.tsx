"use client";

// ── OcrEngineNote ─────────────────────────────────────────────────────────────
// Says, in words, which reader produced an OCR draft, and asks for a full check when the draft is
// the on-site reader's unsure read (owner 2026-10-22, inbox #328).
//
// Where the engine string comes from: the backend's OCR router (AFC-B afc_ocr/services/extract.py
// extract_rows) labels every read, and the upload endpoints hand that label to the page:
//   "local_student_*"      the on-site reader (PaddleOCR PP-OCRv6 on the server) was sure;
//   "local_best_effort_*"  the on-site reader was NOT sure and no AI key could read the screenshot
//                          (the organization has no key and no free read left), so the draft is the
//                          on-site reader's best attempt and every row needs checking;
//   anything else          the AI engine that read it (e.g. "gemini-2.5-flash").
// A map read from several screenshots carries ONE label, and an unsure draft on any of them wins
// (extract.summary_engine), so the note below never hides a screenshot that needs checking.
//
// Used by both review tables: OCRReviewTable (event OCR, admin + organizer, and the leaderboard
// editor) and standalone/create/_components/OcrReviewTable (the standalone leaderboard batch).
// Copy lives in messages/<locale>/ocr.json, group "engine".
import { IconAlertTriangle } from "@tabler/icons-react";
import { useTranslations } from "next-intl";

import { NewBadge } from "@/components/NewBadge";
import { Badge } from "@/components/ui/badge";

// The day the on-site reader started reading on the live site (owner rule: NEW for 5 days).
const ON_SITE_READER_LIVE = "2026-10-22";

export type OcrEngineKind = "local" | "localCheck" | "ai";

export function engineKind(engine?: string | null): OcrEngineKind | null {
  if (!engine) return null;
  if (engine.startsWith("local_best_effort")) return "localCheck";
  if (engine.startsWith("local_student")) return "local";
  return "ai";
}

/** The "which reader" badge for a review table header. Renders nothing when the backend sent no label. */
export function OcrEngineBadge({ engine }: { engine?: string | null }) {
  const t = useTranslations("ocr");
  const kind = engineKind(engine);
  if (!kind) return null;
  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge variant="outline" className="rounded-full text-xs">
        {kind === "ai" ? t("engine.ai", { engine: engine ?? "" }) : t(`engine.${kind}`)}
      </Badge>
      {kind !== "ai" && <NewBadge since={ON_SITE_READER_LIVE} />}
    </span>
  );
}

/** The amber "check every row" line, shown only for the on-site reader's unsure drafts. */
export function OcrCheckNotice({ engine }: { engine?: string | null }) {
  const t = useTranslations("ocr");
  if (engineKind(engine) !== "localCheck") return null;
  return (
    <div className="flex items-center gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
      <IconAlertTriangle className="size-4 shrink-0" />
      <span>{t("engine.checkNotice")}</span>
    </div>
  );
}
