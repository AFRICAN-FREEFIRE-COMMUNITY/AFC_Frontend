// lib/api/ocrKeyGate.ts - the one place an OCR upload failure becomes words on screen.
//
// WHY (owner 2026-09-12): a screenshot read can now be refused because the organization has no
// AI key and no free read left. The backend answers 402 {code: "ocr_key_required",
// organization_slug}; every OCR upload path (the event OCR steps, the leaderboard batch dialog,
// the stored-image read) funnels its catch through here so the organizer sees the same sentence
// with a "Connect a key" button that opens the connect page, instead of three different toasts.
// Any other failure keeps the backend's message (a provider refusal carries the provider's own
// words) or the caller's fallback.
//
// Two shapes arrive here: an axios error ({response: {status, data}}) from the ocrApi callers, and
// a plain {status, data} built by the raw-fetch callers (ImageUploadStep's upload,
// GroupBulkUploadPanel) via ocrFetchError(). Both read the same way.
//
// When a read succeeded on AFC's free allowance (paid_by === "afc_free"), toastFreeReadSpent tells
// the organizer right then that it was the free one, with the same Connect button, so the next
// refusal is not the first they hear of it.
import { toast } from "sonner";

export const AI_KEY_PAGE = "/organizer/ai-key";

interface ErrData { message?: string; code?: string; organization_slug?: string | null }
interface ErrShape {
  response?: { status?: number; data?: ErrData };
  status?: number;
  data?: ErrData;
}

function parts(err: unknown): { status?: number; data?: ErrData } {
  const e = err as ErrShape;
  if (e?.response) return { status: e.response.status, data: e.response.data };
  return { status: e?.status, data: e?.data };
}

/** Wrap a failed fetch Response + its parsed JSON body in the shape toastOcrError reads. */
export function ocrFetchError(res: { status: number }, data: unknown): ErrShape {
  return { status: res.status, data: (data ?? {}) as ErrData };
}

export function isOcrKeyRequired(err: unknown): boolean {
  const { status, data } = parts(err);
  return status === 402 && data?.code === "ocr_key_required";
}

const connectAction = (label: string) => ({
  label,
  onClick: () => {
    window.location.href = AI_KEY_PAGE;
  },
});

/**
 * After a successful read: when it ran on AFC's free allowance, say so with the Connect button.
 * `paidBy` is the backend's paid_by ("org" / "afc_free" / "afc" / ""). No toast otherwise.
 */
export function toastFreeReadSpent(paidBy: string | undefined | null, labels: { message: string; connect: string }): void {
  if (paidBy !== "afc_free") return;
  toast.info(labels.message, { duration: 15000, action: connectAction(labels.connect) });
}

/**
 * Show the right toast for a failed OCR call. `labels.connect` is the button text ("Connect a key")
 * and `labels.fallback` the generic line; both come from the caller's namespace so the toast reads
 * in the viewer's language. Returns true when it was the key gate (callers may skip further
 * error UI in that case).
 */
export function toastOcrError(err: unknown, labels: { connect: string; fallback: string }): boolean {
  const { data } = parts(err);
  const message = data?.message || labels.fallback;
  if (isOcrKeyRequired(err)) {
    toast.error(message, { duration: 12000, action: connectAction(labels.connect) });
    return true;
  }
  toast.error(message);
  return false;
}
