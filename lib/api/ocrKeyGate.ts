// lib/api/ocrKeyGate.ts - the one place an OCR upload failure becomes words on screen.
//
// WHY (owner 2026-09-12): a screenshot read can now be refused because the organization has no
// AI key and no free read left. The backend answers 402 {code: "ocr_key_required",
// organization_slug}; every OCR upload path (the event OCR steps, the leaderboard batch dialog,
// the stored-image read) funnels its catch through here so the organizer sees the same sentence
// with a "Connect a key" button that opens the connect page, instead of three different toasts.
// Any other failure keeps the backend's message (a provider refusal carries the provider's own
// words) or the caller's fallback.
import { toast } from "sonner";

export const AI_KEY_PAGE = "/organizer/ai-key";

interface ErrShape {
  response?: { status?: number; data?: { message?: string; code?: string; organization_slug?: string | null } };
}

export function isOcrKeyRequired(err: unknown): boolean {
  const e = err as ErrShape;
  return e?.response?.status === 402 && e.response?.data?.code === "ocr_key_required";
}

/**
 * Show the right toast for a failed OCR call. `labels.connect` is the button text ("Connect a key")
 * and `labels.fallback` the generic line; both come from the caller's namespace so the toast reads
 * in the viewer's language. Returns true when it was the key gate (callers may skip further
 * error UI in that case).
 */
export function toastOcrError(err: unknown, labels: { connect: string; fallback: string }): boolean {
  const e = err as ErrShape;
  const message = e?.response?.data?.message || labels.fallback;
  if (isOcrKeyRequired(err)) {
    toast.error(message, {
      duration: 12000,
      action: {
        label: labels.connect,
        onClick: () => {
          window.location.href = AI_KEY_PAGE;
        },
      },
    });
    return true;
  }
  toast.error(message);
  return false;
}
