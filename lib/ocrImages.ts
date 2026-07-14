// lib/ocrImages.ts
// ─────────────────────────────────────────────────────────────────────────────
// Shared client-side OCR image gate. Mirrors the backend validator contract in
// afc_ocr/services/image_validate.py (ALLOWED_OCR_MIME = png/jpeg/webp, 10 MB per file):
// what the client accepts here and what the server accepts there are kept identical on
// purpose. Rejecting HEIC on BOTH sides (not only the server) means an iPhone screenshot is
// caught at drop time with a clear "share as JPG" toast, instead of sailing through the file
// picker only to fail later at the Gemini read. There is deliberately NO "image/heic" in the
// allow-list (A8 decision: Gemini inline_data does not accept HEIC reliably).
//
// Consumers (all client components):
//   • MapSelectionStep.tsx  (app/(a)/a/leaderboards/_components) - event OCR upload dropzone/browse.
//   • ImageUploadStep.tsx   (app/(a)/a/leaderboards/_components) - stored match screenshot dropzone/browse.
//   • OcrBatchDialog.tsx    (standalone/create/_components)      - per-map screenshot picker (imports these).
// Each caller passes an onReject callback that turns the reason into a translated sonner toast
// (t("uploadSteps.rejectType") / t("uploadSteps.rejectSize")); this module stays i18n-agnostic so
// the same validation contract can be reused from any surface without pulling in next-intl.

/** Value for an <input type="file" accept="..."> attribute. Matches OCR_ALLOWED exactly. */
export const OCR_ACCEPT = "image/png,image/jpeg,image/webp";

/** The MIME types the OCR pipeline (client AND server) accepts. NO heic (see header). */
export const OCR_ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]);

/** Per-file size cap in bytes (10 MB). Matches MAX_OCR_IMAGE_BYTES server-side. */
export const OCR_MAX_BYTES = 10 * 1024 * 1024;

/** Why a file was rejected: wrong MIME type, or over the size cap. */
export type OcrImageRejectReason = "type" | "size";

/**
 * Keep only the files the OCR pipeline will accept (allowed MIME AND <= 10 MB), preserving order.
 * The FIRST rejected file (if any) invokes onReject once with its reason so the caller can toast
 * it (type is checked before size). Only the first rejection is surfaced to avoid a toast storm on
 * a bulk drop; the rest are silently dropped. Empty/null input returns [].
 */
export function filterOcrImages(
  files: FileList | File[] | null | undefined,
  opts?: { onReject?: (reason: OcrImageRejectReason, file: File) => void },
): File[] {
  if (!files) return [];
  const kept: File[] = [];
  let rejected = false; // surface only the FIRST rejection (task B8)
  for (const file of Array.from(files)) {
    const mime = (file.type || "").toLowerCase();
    if (!OCR_ALLOWED.has(mime)) {
      if (!rejected) {
        rejected = true;
        opts?.onReject?.("type", file);
      }
      continue;
    }
    if (file.size > OCR_MAX_BYTES) {
      if (!rejected) {
        rejected = true;
        opts?.onReject?.("size", file);
      }
      continue;
    }
    kept.push(file);
  }
  return kept;
}
