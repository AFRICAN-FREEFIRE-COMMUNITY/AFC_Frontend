// ─────────────────────────────────────────────────────────────────────────────
// lib/recovery.ts
//
// Typed client for ACCOUNT RECOVERY BY WHATSAPP (backend prefix
// /auth/recovery/whatsapp/, see backend/afc_auth/views_recovery.py).
//
// WHAT IT IS FOR: the people the emailed reset cannot help at all. Somebody who
// has lost the inbox, or mistyped their address at signup, or simply never
// receives our mail. If they saved a WhatsApp number on the account, they prove
// that number, and then ONE PROOF OPENS TWO ENDINGS:
//   A. reset the password (the priority, and the ordinary case)
//   B. move the account onto an email address they can actually read
//
// EVERY CALL HERE IS PRE-SESSION, by definition: the caller cannot sign in, which
// is why they are on this page. There is no Bearer header anywhere in this file.
// Each step is authorised by what the step before it handed out:
//   start    -> recovery_token   names the account, and a code goes to WhatsApp
//   verify   -> grant_token      the code proves the number
//   then ONE of:
//   reset                        the grant authorises ONE password change
//   request + confirm email      a second code proves the NEW address, then it moves
// A grant is not a session: it expires in 15 minutes, works once, and is accepted
// by nothing else on the site. Whichever ending completes SPENDS it, so a single
// WhatsApp code cannot both move the address and set the password.
//
// THREE THINGS TO KNOW BEFORE CHANGING ANY OF THIS
//
// 1. START ALWAYS SUCCEEDS, and the token it returns may be a decoy. The backend
//    answers an unknown identifier, an account with no number saved and an
//    account that switched WhatsApp off with exactly the same body as a real
//    account, so this page cannot be used to find out whether an account exists.
//    That means the UI must NEVER say "we found your account" or "no account with
//    that name". Show the message the backend sent, and move to the code screen.
//
// 2. THE RESET DOES NOT SIGN ANYBODY IN. No session token comes back, on purpose.
//    The user is sent to /login to sign in with the password they just chose, and
//    an account with two-step sign-in is challenged there exactly as before. That
//    is what keeps this from being a way past the second factor; the full argument
//    is in views_recovery.py's header.
//
// 3. THE PASSWORD RULE IS CHECKED ON BOTH SIDES. The form uses
//    ResetPasswordFormSchema (lib/zodSchemas.tsx) and the backend re-checks the
//    identical rule in _password_problem, so posting past the form gains nothing.
//    If one moves, move the other.
//
// WHY A DEDICATED CLIENT (not inline fetches): mirrors lib/twoFactor.ts, its
// closest sibling. The base URL and the response shapes live in one place.
//
// CALLERS
//   app/(auth)/_components/RecoverAccountForm.tsx  the whole three-step screen
//   offered as a choice on app/(auth)/forgot-password/page.tsx and linked from
//   app/(auth)/login/page.tsx
// ─────────────────────────────────────────────────────────────────────────────

import axios from "axios";
import { env } from "@/lib/env";

const BASE = env.NEXT_PUBLIC_BACKEND_API_URL;

const url = (path: string) => `${BASE}/auth/recovery/whatsapp/${path}`;

export type RecoveryStartResult = {
  message: string;
  /** Opaque. MAY BE A DECOY (see the header): never treat its presence as proof an account exists. */
  recovery_token: string;
};

export type RecoveryVerifyResult = {
  message: string;
  /** Authorises exactly one call to resetPasswordWithWhatsApp. Not a session. */
  grant_token: string;
  /** Seconds the grant stays spendable, for the countdown on screen. */
  expires_in: number;
  /** The account about to be reset. Shown so a mistyped in-game name is caught before the reset. */
  username: string;
  /** MASKED, e.g. "pl*****@gmail.com". For recognition only, never the full address. */
  current_email: string;
};

export type RecoveryResetResult = {
  message: string;
  /** How many signed-in devices were signed out by the reset. */
  sessions_ended: number;
  /**
   * How many "remember this device" browsers were forgotten. Not decoration: this
   * is the number that makes the reset safe on a two-step account, because a
   * remembered browser is the one thing that would otherwise skip the factor.
   */
  devices_forgotten: number;
};

/**
 * The error body every step can return. `message` is always present and is
 * always safe to show. `attempts_left` appears only on a failed code check.
 */
export type RecoveryError = {
  message: string;
  /** Guesses left on the current code. */
  attempts_left?: number;
};

/** Pull the backend's sentence off any axios failure, falling back to `fallback`. */
export function recoveryErrorBody(error: unknown, fallback: string): RecoveryError {
  const data = (error as { response?: { data?: RecoveryError } })?.response?.data;
  if (data && typeof data.message === "string") return data;
  return { message: fallback };
}

/**
 * STEP 1. Name the account. POST /auth/recovery/whatsapp/start/
 *
 * @param identifier email, in-game name or Free Fire UID, resolved by the same
 *                   function sign-in uses (backend afc_auth/identifiers.py).
 *
 * Resolves for EVERY input, including one no account holds. See the header: the
 * returned token may be a decoy, and the UI must not claim an account was found.
 * Rejects only on a 400 (nothing typed) or a 429 (too many attempts from this
 * device this hour).
 */
export async function startWhatsAppRecovery(identifier: string) {
  const { data } = await axios.post<RecoveryStartResult>(url("start/"), { identifier });
  return data;
}

/**
 * STEP 2. Prove the number. POST /auth/recovery/whatsapp/verify/
 *
 * Spends the code (it is single use) and returns the grant plus the two things
 * the last screen shows: which account is about to be reset, and its masked
 * address.
 *
 * Rejects with 400 on a wrong, expired, already-used or decoy token/code, and
 * 429 once the attempt cap is spent (start again).
 */
export async function verifyWhatsAppRecovery(recoveryToken: string, code: string) {
  const { data } = await axios.post<RecoveryVerifyResult>(url("verify/"), {
    recovery_token: recoveryToken,
    code,
  });
  return data;
}

/**
 * STEP 3. Set the new password. POST /auth/recovery/whatsapp/reset-password/
 *
 * @param grantToken  from verifyWhatsAppRecovery.
 * @param newPassword must satisfy ResetPasswordFormSchema; the backend checks the
 *                    same rule again and answers 400 with the reason.
 *
 * On success every session on the account is ended and every remembered device is
 * forgotten, so the user signs in fresh. NO session comes back: sign-in, including
 * the second factor if the account has one, still happens on /login.
 *
 * A rejected password does NOT burn the grant, so a user who misses a requirement
 * can simply correct it and submit again.
 */
export async function resetPasswordWithWhatsApp(grantToken: string, newPassword: string) {
  const { data } = await axios.post<RecoveryResetResult>(url("reset-password/"), {
    grant_token: grantToken,
    new_password: newPassword,
  });
  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// THE OTHER ENDING: move the account onto an address the person can actually read
//
// A password reset gets somebody back IN. It does not fix the dead inbox that
// locked them out, so they would be back here the next time they forget. These
// two calls are the repair, and until 2026-08-08 the only way to get it was a
// support ticket and a head admin doing it by hand.
//
// TWO THINGS THAT ARE NOT TRUE OF THE PASSWORD ENDING:
//
// 1. IT IS REFUSED OUTRIGHT (409) ON AN ACCOUNT WITH TWO-STEP SIGN-IN. There is
//    no flag that switches the factor off, deliberately, and this is stricter
//    than what an admin is allowed to do. The default factor is a code to the
//    account email, so moving the address would hand the factor to whoever asked
//    for the move. Show the backend's sentence: it names the two things the user
//    can still do (reset the password here, or ask support).
// 2. THE NEW ADDRESS IS PROVEN with a second code before anything is written, so
//    a typo cannot move the account onto an inbox that does not exist. That is
//    why this is two calls and the password ending is one.
//
// The grant is spent by the CONFIRM call, not the request call, and one grant
// buys one ending: after a successful move the same grant cannot also set a
// password. Somebody who wants both proves the number twice.
// ─────────────────────────────────────────────────────────────────────────────

export type RecoveryRequestEmailResult = {
  message: string;
  /** Echoed back so the code screen can name the address the code went to. */
  new_email: string;
};

export type RecoveryConfirmEmailResult = {
  message: string;
  /** The address now on the account. */
  email: string;
  previous_email: string;
  sessions_ended: number;
  devices_forgotten: number;
  /** True when this also activated a signup that never entered its emailed code. */
  reactivated: boolean;
};

/**
 * STEP 3B (part one). Name the new address.
 * POST /auth/recovery/whatsapp/request-email-change/
 *
 * Sends a six-digit code to `newEmail`. Writes NOTHING: the account still has its
 * old address until confirmEmailChangeWithWhatsApp succeeds.
 *
 * Rejects with 400 on a dead grant, a malformed or unchanged address, an address
 * already registered to another account, or one that is another player's in-game
 * name (players sign in with name, email or UID, so those cannot overlap). 409
 * when the account has two-step sign-in on, carrying `two_factor_enabled: true`.
 * 429 if another code was asked for less than a minute ago.
 */
export async function requestEmailChangeWithWhatsApp(grantToken: string, newEmail: string) {
  const { data } = await axios.post<RecoveryRequestEmailResult>(url("request-email-change/"), {
    grant_token: grantToken,
    new_email: newEmail,
  });
  return data;
}

/**
 * STEP 3B (part two). Prove the new address and move the account onto it.
 * POST /auth/recovery/whatsapp/confirm-email-change/
 *
 * @param code the six digits sent to the new address by the call above.
 *
 * On success every session is ended and every remembered device is forgotten, and
 * the grant is spent. NO session comes back: the user signs in on /login with the
 * password they already had, at their new address.
 *
 * Rejects with 400 on a dead grant or a wrong, expired or missing code (one
 * generic message for all of them, with `attempts_left`), and 429 once the
 * attempt cap is spent, which burns the grant so the whole proof starts again.
 */
export async function confirmEmailChangeWithWhatsApp(grantToken: string, code: string) {
  const { data } = await axios.post<RecoveryConfirmEmailResult>(url("confirm-email-change/"), {
    grant_token: grantToken,
    code,
  });
  return data;
}
