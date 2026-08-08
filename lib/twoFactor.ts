// ─────────────────────────────────────────────────────────────────────────────
// lib/twoFactor.ts
//
// Typed client for TWO-STEP SIGN-IN (backend prefix /auth/two-factor/, see
// backend/afc_auth/views_two_factor.py). Two-factor authentication is OPT IN: a
// user turns it on from /profile/security, and from then on signing in takes a
// second step where they type a 6 digit code emailed to them.
//
// TWO METHODS TODAY:
//   "email" a 6 digit code sent to the account's address. The default, and the
//           one every AFC account can use.
//   "totp"  a 6 digit code from an authenticator app (Google Authenticator,
//           Authy, 1Password, Aegis), added 2026-08-07. Nothing is sent: the app
//           and the server derive the same digits from the clock, so it survives
//           a compromised mailbox and an SMTP outage.
// WhatsApp is NOT one of them, and that is a settled decision rather than a gap:
// the owner turned down WhatsApp sign-in. It reaches roughly 116 of ~6,809
// accounts, and it is already the ACCOUNT RECOVERY channel (lib/recovery.ts), so
// using it for both would collapse two independent proofs into one. The backend
// keeps it registered for recovery and holds it out of ENABLED_METHODS, so it can
// never come back in `available_methods` and no screen here has to handle it.
//
// ── REMEMBER THIS DEVICE (owner 2026-08-08) ──────────────────────────────────
// The owner's actual complaint was not about the channel, it was about the
// FREQUENCY: "logging in each time with a code is stressful". So after the
// second step succeeds a user may tick a box, and THAT browser stops being
// challenged for 30 days. Everything about it lives at the bottom of this file.
//
// The one thing to hold onto while reading: a device token is NOT a session and
// NOT a password. The backend only looks at it AFTER a correct password, and all
// it does then is skip step two. On its own it opens nothing.
//
// THE ONE RULE THAT MATTERS WHEN READING THIS FILE: signing in is METHOD BLIND.
// verifyTwoFactor is the same call for both methods, and the login response is
// byte-identical either way. Only ENROLMENT differs, which is why only the
// authenticator has its own two calls (setupTotp, confirmTotp) - see
// backend/afc_auth/two_factor.py for the method registry this mirrors.
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
import Cookies from "js-cookie";
import { env } from "@/lib/env";

const BASE = env.NEXT_PUBLIC_BACKEND_API_URL;

const url = (path: string) => `${BASE}/auth/two-factor/${path}`;

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

/**
 * The methods the backend can hand back. Mirrors two_factor.ENABLED_METHODS in
 * backend/afc_auth/two_factor.py. Widened to `string` at the edges because an
 * older client must not crash if a third method ships before it is redeployed.
 */
export type TwoFactorMethod = "email" | "totp" | (string & {});

/** Does this method SEND a code the user then goes and finds somewhere? */
export const methodSendsCode = (method: TwoFactorMethod) => method !== "totp";

// ── The shape POST /auth/login/ returns when the account has 2FA on ───────────
// Everyone else gets the response login has always returned (session_token +
// user + geo), which is why both callers branch on `two_factor_required`.
export type TwoFactorChallenge = {
  two_factor_required: true;
  challenge_token: string;
  /**
   * "email" or "totp". EVERY branch on the code screen keys off this rather than
   * assuming email: an authenticator challenge sends nothing, so it must not
   * offer a resend button or a cooldown, both of which would be meaningless.
   */
  method: TwoFactorMethod;
  /** MASKED, e.g. "pl*****@gmail.com". Safe to show before the user is signed in. Empty for "totp", which has no address. */
  destination: string;
  /** False when the backend reused a code it had already sent (inside the cooldown), and always false for "totp", where nothing needed sending. */
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

/**
 * The normal login success body. Identical whether or not 2FA was involved.
 *
 * The two device_token fields are ADDITIVE and only present when the user ticked
 * "Remember this device" on the code screen. Nothing else about this shape moved,
 * which is why a one-step login and a 2FA login are still the same object to
 * AuthContext.
 */
export type LoginSuccess = {
  message: string;
  session_token: string;
  user: { id: number; username: string; language: string };
  geo: Record<string, unknown>;
  /** Present ONLY when remember_device was asked for. Store it, send it back on future logins. */
  device_token?: string;
  /** Seconds the device token is good for (30 days). Used as the cookie lifetime. */
  device_token_expires_in?: number;
};

export type TwoFactorStatus = {
  enabled: boolean;
  /** Which method is guarding the account right now. */
  method: TwoFactorMethod;
  /** ISO string, or null while 2FA is off. */
  enabled_at: string | null;
  /** What the user may choose. The security page renders one card per entry, in this order. */
  available_methods: TwoFactorMethod[];
  /** Masked destination a code would go to. Empty for "totp". */
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
  /** Which method raised this challenge. "totp" means nothing was sent and the user reads the code off their phone. */
  method: TwoFactorMethod;
  code_sent: boolean;
  /** See TwoFactorChallenge.delivery_failed. */
  delivery_failed?: boolean;
  retry_after: number;
  destination: string;
  expires_in: number;
};

/** What POST /auth/two-factor/totp/setup/ hands back. The secret appears here ONCE and never again. */
export type TotpSetup = {
  /** The base32 secret, for anyone whose camera will not scan the QR. */
  secret: string;
  /** What the QR encodes. Drawn client side by components/TotpQrCode.tsx. */
  otpauth_uri: string;
  issuer: string;
  account: string;
  digits: number;
  period: number;
  algorithm: string;
  /** Seconds this enrolment stays confirmable. */
  expires_in: number;
  /**
   * Confirming ALWAYS costs proof of the account as it stands, and these three
   * fields say which proof, so the dialog can collect it in the same screen:
   *  - proof_purpose      pass this to sendTwoFactorProofCode()
   *  - proof_method       "email" (a code is sent) or "totp" (read the CURRENT app)
   *  - proof_destination  masked, empty when the proof method is "totp"
   * Without this, a stolen session alone could bolt an attacker's authenticator
   * onto the account and hold it through a password reset.
   */
  requires_proof: boolean;
  proof_purpose: "enable" | "disable";
  proof_method: TwoFactorMethod;
  proof_destination: string;
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
 * `rememberDevice` defaults to false and is the user's explicit tick, never
 * inferred. When true the response also carries `device_token`, which the caller
 * must hand to saveDeviceToken() so the next sign-in on this browser skips the
 * code screen. It is accepted on the recovery-code path too, on purpose: someone
 * signing in with a recovery code is exactly the person who least wants to be
 * back here next week.
 *
 * Throws on 400 (wrong or dead code) and 429 (attempt cap spent). The error body
 * carries `attempts_left` so the screen can warn before the last try.
 */
export async function verifyTwoFactor(args: {
  challengeToken: string;
  code?: string;
  backupCode?: string;
  rememberDevice?: boolean;
}): Promise<LoginSuccess> {
  const res = await axios.post<LoginSuccess>(url("verify/"), {
    challenge_token: args.challengeToken,
    ...(args.code ? { code: args.code } : {}),
    ...(args.backupCode ? { backup_code: args.backupCode } : {}),
    // Sent only when true, so a request that does not want it is byte-identical
    // to what this endpoint received before the feature existed.
    ...(args.rememberDevice ? { remember_device: true } : {}),
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

// ── Authenticator app enrolment ──────────────────────────────────────────────
// Two calls, and the split between them is the safety story: SETUP hands out a
// secret and changes nothing, CONFIRM proves the secret works and only then
// changes the account. Someone who opens the dialog, sees the QR and closes the
// tab is exactly where they started.

/**
 * Start (or restart) an authenticator enrolment. Returns the secret ONCE, plus
 * the otpauth:// URI to draw as a QR and a description of the proof `confirmTotp`
 * will demand.
 *
 * Calling this again simply replaces the pending enrolment. A user's CURRENT
 * authenticator, if they have one, keeps working until confirmTotp succeeds, so
 * a half-finished re-enrolment cannot break a working phone.
 */
export async function setupTotp(token: string): Promise<TotpSetup> {
  const res = await axios.post<TotpSetup>(
    url("totp/setup/"),
    {},
    { headers: bearer(token) },
  );
  return res.data;
}

/**
 * Finish enrolment: prove the account as it stands AND prove the new app.
 *
 * `code` is from the app that just scanned the QR. The proof is EITHER
 * `proofChallengeToken` + `proofCode` (from sendTwoFactorProofCode with the
 * `proof_purpose` the setup call named) OR an unused recovery code.
 *
 * `backup_codes` comes back populated on a FIRST enable and EMPTY when an
 * already-protected account merely switched method: the codes the user already
 * saved keep working, and minting a second parallel set would quietly invalidate
 * the piece of paper in their drawer.
 */
export async function confirmTotp(
  token: string,
  args: {
    code: string;
    proofChallengeToken?: string;
    proofCode?: string;
    backupCode?: string;
  },
): Promise<TwoFactorStatusWithCodes> {
  const res = await axios.post<TwoFactorStatusWithCodes>(
    url("totp/confirm/"),
    {
      code: args.code,
      ...(args.proofChallengeToken
        ? { proof_challenge_token: args.proofChallengeToken }
        : {}),
      ...(args.proofCode ? { proof_code: args.proofCode } : {}),
      ...(args.backupCode ? { backup_code: args.backupCode } : {}),
    },
    { headers: bearer(token) },
  );
  return res.data;
}

// ─────────────────────────────────────────────────────────────────────────────
// REMEMBER THIS DEVICE (owner 2026-08-08)
//
// THE PROBLEM, in the owner's words: "it'll be stressful to be inputting code
// each time every user wants to login". A user who ticks the box on their own
// phone meets the second step about once a month instead of every single time; a
// browser nobody ticked is challenged exactly as it is today.
//
// ── WHY THE TOKEN LIVES IN A JS-READABLE COOKIE ──────────────────────────────
// The obvious alternative is an HttpOnly cookie set by Django. It is rejected
// for a concrete reason, not a stylistic one: the API is on a DIFFERENT ORIGIN
// (api.africanfreefirecommunity.com, and :8010 in dev), so an HttpOnly cookie
// would have to be SameSite=None; Secure and every axios call would need
// withCredentials, which is a change to the whole request stack for one feature.
//
// The trade is honest and small. This token is NOT a session and NOT a password:
// the backend reads it only AFTER a correct password, and all it does then is
// skip step two. A page-script attacker who could read this cookie could already
// read `auth_token` sitting beside it, which IS the live session. So this adds no
// new class of exposure, and the worst case if it leaks is "an attacker who
// already knew the password is back where they were before 2FA existed".
//
// LIFETIME: the cookie is written with the exact window the backend reports
// (device_token_expires_in, 30 days), so the browser forgets it at the same
// moment the server does and a user never sends a token that cannot work.
//
// SameSite strict + secure-in-production, matching the auth_token cookie in
// contexts/AuthContext.tsx so both auth-adjacent cookies obey one rule.
// ─────────────────────────────────────────────────────────────────────────────

const DEVICE_COOKIE = "afc_trusted_device";

/** Fallback window if the backend ever omits device_token_expires_in. Days. */
const DEVICE_COOKIE_FALLBACK_DAYS = 30;

const deviceCookieOptions = (days: number) => ({
  expires: days,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
});

/**
 * Persist the device token returned by a successful verify, if there is one.
 *
 * Takes the whole login body rather than a string so callers can pass it
 * straight through without checking, and so "no token in the response" (the
 * normal case, because remembering is opt-in) is a silent no-op rather than
 * something every call site has to remember to guard.
 */
export function saveDeviceToken(login: LoginSuccess): void {
  if (!login?.device_token) return;
  const days = login.device_token_expires_in
    ? login.device_token_expires_in / 86400
    : DEVICE_COOKIE_FALLBACK_DAYS;
  Cookies.set(DEVICE_COOKIE, login.device_token, deviceCookieOptions(days));
}

/**
 * The device token to send with a sign-in, or undefined.
 *
 * Spread into the /auth/login/ body. Undefined rather than "" so the field is
 * simply absent for the overwhelming majority of sign-ins, and the request is
 * byte-identical to what it was before this feature.
 */
export function getDeviceToken(): string | undefined {
  return Cookies.get(DEVICE_COOKIE) || undefined;
}

/**
 * Forget this browser's device token locally.
 *
 * Called after revoking devices from the security page: the server row is gone,
 * so keeping the cookie would only mean sending a dead token forever. Removed at
 * both the explicit path and the js-cookie default, the same belt-and-braces
 * AuthContext uses for auth_token after a stale duplicate cookie at a deeper
 * path caused a day of "logged in but everything 401s".
 */
export function clearDeviceToken(): void {
  Cookies.remove(DEVICE_COOKIE, { path: "/" });
  Cookies.remove(DEVICE_COOKIE);
}

// ── Managing devices and sessions (backend afc_auth/views_devices.py) ────────
// TWO DIFFERENT THINGS, and the page says so out loud because confusing them is
// the only way a user can get this wrong:
//   A TRUSTED DEVICE skips the second step for 30 days. It is not a sign-in.
//   A SESSION is being signed in right now, and lapses after 3h of inactivity.
// Someone who lent a friend their phone wants the first gone. Someone who left
// themselves signed in at a cybercafe wants the second gone.

export type TrustedDevice = {
  id: number;
  /** "Chrome on Android". Derived from the user agent when the device was remembered. */
  label: string;
  /** May be empty when the address was never resolved. */
  last_ip: string;
  created_at: string;
  last_used_at: string;
  expires_at: string;
};

export type TrustedDeviceList = {
  devices: TrustedDevice[];
  count: number;
  /** How many days trust lasts, from the backend, so the copy never hardcodes 30. */
  trust_days: number;
};

export type SessionSummary = {
  created_at: string;
  expires_at: string;
  /** True for the browser making the request, so the UI never offers to sign it out. */
  current: boolean;
};

export type SessionList = {
  sessions: SessionSummary[];
  count: number;
  /** count minus the current one: exactly what "sign out everywhere else" will end. */
  others: number;
};

const deviceUrl = (path: string) => `${BASE}/auth/devices/${path}`;

/** Every browser allowed to skip this account's second step, most recently used first. */
export async function listTrustedDevices(
  token: string,
): Promise<TrustedDeviceList> {
  const res = await axios.get<TrustedDeviceList>(deviceUrl("trusted/"), {
    headers: bearer(token),
  });
  return res.data;
}

/**
 * Stop trusting one device. It is asked for a code on its very next sign-in:
 * the backend reads the row every time, so there is no cache to wait out.
 *
 * Idempotent, so a double tap on a phone returns 200 with revoked: 0 rather than
 * a scary failure toast.
 */
export async function revokeTrustedDevice(
  token: string,
  deviceId: number,
): Promise<{ message: string; revoked: number }> {
  const res = await axios.post(
    deviceUrl("trusted/revoke/"),
    { device_id: deviceId },
    { headers: bearer(token) },
  );
  return res.data;
}

/** Stop trusting every device, including the one you are on. The panic button. */
export async function revokeAllTrustedDevices(
  token: string,
): Promise<{ message: string; revoked: number }> {
  const res = await axios.post(
    deviceUrl("trusted/revoke/"),
    { all: true },
    { headers: bearer(token) },
  );
  return res.data;
}

/** How many browsers this account is signed in on right now. */
export async function listSessions(token: string): Promise<SessionList> {
  const res = await axios.get<SessionList>(deviceUrl("sessions/"), {
    headers: bearer(token),
  });
  return res.data;
}

/**
 * Sign out everywhere except here. The caller stays signed in, which is what
 * makes this safe as one tap: it cannot lock anybody out of their own account.
 *
 * Deliberately does NOT forget trusted devices. They answer a different question
 * and the page offers them separately.
 */
export async function signOutOtherSessions(
  token: string,
): Promise<{ message: string; signed_out: number }> {
  const res = await axios.post(
    deviceUrl("sessions/sign-out-others/"),
    {},
    { headers: bearer(token) },
  );
  return res.data;
}
