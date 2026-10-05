// lib/uidTaken.ts
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// The refusal when a UID someone types is already on another account (inbox #152, owner 2026-10-05:
// "for users who want to input a uid into their accunt, let it also show the user using their UID").
//
// The backend (AFC-B afc_auth/views.py _uid_taken_body) answers 400 with a code, uid_taken from
// signup or uid_already_use_user from edit-profile, plus taken_by (the holder's in-game name) and
// taken_by_page (their public player page, which already shows the UID). This file turns that into
// the sentence in the reader's language and a "View their profile" button, the same way for every
// form a person types a UID into:
//   - app/(user)/profile/edit/page.tsx             the profile edit form
//   - app/(onboarding)/onboarding/page.tsx          the onboarding UID step (posts to edit-profile)
// Sign up no longer asks for a UID (its field is commented out in CreateAccountForm.tsx); the
// backend's signup refusal carries the same fields for any client that still sends one.
// Strings: common.uidTaken.* in messages/{en,fr,pt}/common.json.
// ─────────────────────────────────────────────────────────────────────────────────────────────────
import { toast } from "sonner";

const UID_TAKEN_CODES = new Set(["uid_taken", "uid_already_use_user"]);

// next-intl's t() for the "common" namespace; typed loosely so any caller's t can be passed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- next-intl's key-typed t() is not assignable to a plain (string) => string
type CommonT = (key: any, values?: any) => string;

type Refusal = { code?: string; taken_by?: string; taken_by_page?: string } | undefined | null;

/** The sentence for a UID-taken refusal, or null when the answer was about something else. */
export function uidTakenMessage(data: Refusal, tc: CommonT): string | null {
  if (!data || !data.code || !UID_TAKEN_CODES.has(data.code)) return null;
  return data.taken_by ? tc("uidTaken.byName", { name: String(data.taken_by) }) : tc("uidTaken.byAnother");
}

/** A player page we are willing to send someone to: only ever /players/... on this site. */
function holderPage(data: Refusal): string | null {
  const page = data?.taken_by_page;
  return typeof page === "string" && page.startsWith("/players/") ? page : null;
}

/**
 * Shows a UID-taken refusal as an error toast with a "View their profile" button. Returns false,
 * showing nothing, when the refusal was about something else, so the caller falls through to its
 * own handling.
 */
export function toastUidTaken(data: Refusal, tc: CommonT, open: (path: string) => void): boolean {
  const message = uidTakenMessage(data, tc);
  if (!message) return false;
  const page = holderPage(data);
  toast.error(message, page ? { action: { label: tc("uidTaken.viewProfile"), onClick: () => open(page) } } : undefined);
  return true;
}
