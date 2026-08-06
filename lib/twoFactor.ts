// ─────────────────────────────────────────────────────────────────────────────
// lib/twoFactor.ts
//
// Typed client for TWO-STEP SIGN-IN (backend prefix /auth/two-factor/, see
// backend/afc_auth/views_two_factor.py). Two-factor authentication is OPT IN: a
// user turns it on from /profile/security, and from then on signing in takes a
// second step where they type a 6 digit code emailed to them.
//
// WHY EMAIL AND NOT WHATSAPP: every AFC account has a verified email address,
// while WhatsApp reaches roughly 90 of ~6,790 users. A second factor most people
// cannot switch on is not a second factor. The backend is built behind a method
// interface (afc_auth/two_factor.py) so WhatsApp and an authenticator app can be
// added later without any of this changing.
//
// WHY a dedicated client (not inline fetches): mirrors lib/connectedApps.ts, the
// closest sibling. The base URL and the Bearer header live in one place, and the
// caller passes the session token explicitly (useAuth().token).
//
// TWO GROUPS OF CALLS, and the difference matters:
//   • PRE-SESSION (verifyTwoFactor, resendTwoFactorCode). These run BETWEEN the
//     two login steps, when there is no session token yet. They are authorised by
//     the CHALLENGE TOKEN that POST /auth/login/ hands back. A challenge token is
//     not a session: it expires in 10 minutes, works once, and grants nothing.
//   • AUTHENTICATED (everything else). Ordinary Bearer calls from the security
//     page, for a user who is already signed in.
//
// CALLERS
//   app/(auth)/_components/TwoFactorStep.tsx  the code screen (used by both the
//                                             /login page and the AuthModal)
//   app/(user)/profile/_components/TwoFactorSecurity.tsx   the settings surface
//   components/TwoFactorPrompt.tsx            the admin/organizer nudge
// ─────────────────────────────────────────────────────────────────────────────

import axios from "axios";
import { env } from "@/lib/env";

const BASE = env.NEXT_PUBLIC_BACKEND_API_URL;

const url = (path: string) => `${BASE}/auth/two-factor/${path}`;

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

// ── The shape POST /auth/login/ returns when the account has 2FA on ───────────
// Everyone else gets the response login has always returned (session_token +
// user + geo), which is why both callers branch on `two_factor_required`.
export type TwoFactorChallenge = {
  two_factor_required: true;
  challenge_token: string;
  /** "email" today. The screen renders from this rather than assuming email. */
  method: string;
  /** MASKED, e.g. "pl*****@gmail.com". Safe to show before the user is signed in. */
  destination: string;
  /** False when the backend reused a code it had already sent (inside the cooldown). */
  code_sent: boolean;
  /**
   * True only when the email genuinely failed to go out (SMTP down). The challenge is still
   * returned so the recovery-code path stays open; refusing the login outright would lock every
   * 2FA user out for the length of an outage. The screen says so rather than telling the user to
   * check an inbox nothing was sent to.
   */
  delivery_failed?: boolean;
  /** Seconds the code stays valid. */
  expires_in: number;
  /** Seconds until another send is allowed. 0 when a code just went out. */
  retry_after: number;
  message: string;
};

/** The normal login success body. Identical whether or not 2FA was involved. */
export type LoginSuccess = {
  message: string;
  session_token: string;
  user: { id: number; username: string; language: string };
  geo: Record<string, unknown>;
};

export type TwoFactorStatus = {
  enabled: boolean;
  method: string;
  /** ISO string, or null while 2FA is off. */
  enabled_at: string | null;
  available_methods: string[];
  /** Masked destination a code would go to. */
  destination: string;
  backup_codes_remaining: number;
};

/** Status plus the one-time plaintext recovery codes, returned by enable + regenerate. */
export type TwoFactorStatusWithCodes = TwoFactorStatus & {
  message: string;
  backup_codes: string[];
};

export type ProofCodeSent = {
  message: string;
  challenge_token: string;
  code_sent: boolean;
  /** See TwoFactorChallenge.delivery_failed. */
  delivery_failed?: boolean;
  retry_after: number;
  destination: string;
  expires_in: number;
};

/**
 * Narrow a /auth/login/ response to the 2FA branch. Used by LoginForm and
 * AuthModal so the "did we get a session or a challenge" decision is made in one
 * place and cannot be spelt differently in the two forms.
 */
export function isTwoFactorChallenge(
  data: unknown,
): data is TwoFactorChallenge {
  return Boolean(
    data &&
      typeof data === "object" &&
      (data as { two_factor_required?: unknown }).two_factor_required === true &&
      typeof (data as { challenge_token?: unknown }).challenge_token === "string",
  );
}

// ── Pre-session: the login second step ───────────────────────────────────────

/**
 * Exchange the challenge token plus the code for a real session.
 *
 * Pass EITHER `code` (the emailed 6 digits) or `backupCode` (a recovery code).
 * On success the response is the ordinary login body, so the caller hands
 * `session_token` straight to AuthContext.login() exactly as it would after a
 * one-step login.
 *
 * Throws on 400 (wrong or dead code) and 429 (attempt cap spent). The error body
 * carries `attempts_left` so the screen can warn before the last try.
 */
export async function verifyTwoFactor(args: {
  challengeToken: string;
  code?: string;
  backupCode?: string;
}): Promise<LoginSuccess> {
  const res = await axios.post<LoginSuccess>(url("verify/"), {
    challenge_token: args.challengeToken,
    ...(args.code ? { code: args.code } : {}),
    ...(args.backupCode ? { backup_code: args.backupCode } : {}),
  });
  return res.data;
}

/**
 * Ask for the login code again.
 *
 * IMPORTANT: issuing a new code invalidates the old one, so the response carries
 * a NEW challenge_token that the caller MUST swap in. Keeping the old one would
 * leave the user typing a fresh code against a dead challenge.
 *
 * `code_sent: false` means nothing new was sent because we are inside the 60
 * second cooldown or past the hourly ceiling; `retry_after` says how long until
 * another send is possible.
 */
export async function resendTwoFactorCode(challengeToken: string): Promise<{
  message: string;
  challenge_token: string;
  code_sent: boolean;
  delivery_failed?: boolean;
  retry_after: number;
  destination: string;
}> {
  const res = await axios.post(url("resend/"), {
    challenge_token: challengeToken,
  });
  return res.data;
}

// ── Authenticated: managing your own two-step sign-in ────────────────────────

/** Whether 2FA is on, which method, and how many recovery codes are left. */
export async function getTwoFactorStatus(
  token: string,
): Promise<TwoFactorStatus> {
  const res = await axios.get<TwoFactorStatus>(url("status/"), {
    headers: bearer(token),
  });
  return res.data;
}

/**
 * Send the proof code that both turning 2FA on and turning it off require.
 *
 * Turning it ON checks the method actually reaches the user BEFORE the switch
 * flips, so nobody can lock themselves behind a mailbox they cannot open.
 * Turning it OFF proves it is really them, so an unlocked laptop cannot strip
 * the second factor off an account.
 */
export async function sendTwoFactorProofCode(
  token: string,
  purpose: "enable" | "disable",
): Promise<ProofCodeSent> {
  const res = await axios.post<ProofCodeSent>(
    url("send-code/"),
    { purpose },
    { headers: bearer(token) },
  );
  return res.data;
}

/**
 * Turn 2FA on. Returns the recovery codes in PLAINTEXT, exactly once: only
 * hashes are stored, so this response is the only chance to save them. The
 * security page makes the user confirm before it lets the dialog close.
 */
export async function enableTwoFactor(
  token: string,
  args: { challengeToken: string; code: string },
): Promise<TwoFactorStatusWithCodes> {
  const res = await axios.post<TwoFactorStatusWithCodes>(
    url("enable/"),
    { challenge_token: args.challengeToken, code: args.code },
    { headers: bearer(token) },
  );
  return res.data;
}

/** Turn 2FA off with either a fresh emailed code or an unused recovery code. */
export async function disableTwoFactor(
  token: string,
  args: { challengeToken?: string; code?: string; backupCode?: string },
): Promise<TwoFactorStatus & { message: string }> {
  const res = await axios.post(
    url("disable/"),
    {
      ...(args.challengeToken ? { challenge_token: args.challengeToken } : {}),
      ...(args.code ? { code: args.code } : {}),
      ...(args.backupCode ? { backup_code: args.backupCode } : {}),
    },
    { headers: bearer(token) },
  );
  return res.data;
}

/**
 * Replace the recovery codes with a fresh set, invalidating every old one.
 * Needs the same fresh proof as disabling (a code from sendTwoFactorProofCode
 * with purpose "disable"), because handing a new set to whoever holds the
 * browser would defeat the factor entirely.
 */
export async function regenerateBackupCodes(
  token: string,
  args: { challengeToken: string; code: string },
): Promise<TwoFactorStatusWithCodes> {
  const res = await axios.post<TwoFactorStatusWithCodes>(
    url("backup-codes/"),
    { challenge_token: args.challengeToken, code: args.code },
    { headers: bearer(token) },
  );
  return res.data;
}
