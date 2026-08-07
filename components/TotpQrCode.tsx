"use client";

/**
 * TotpQrCode - the QR an authenticator app scans (owner 2026-08-07).
 *
 * WHAT IT DRAWS: the `otpauth://` URI that POST /auth/two-factor/totp/setup/ returns. Scanning it
 * puts an "AFC (username)" entry into Google Authenticator, Authy, 1Password or Aegis, and from
 * then on that app produces the sign-in code.
 *
 * WHY THE QR IS DRAWN HERE AND NOT ON THE SERVER: the backend already needed one new dependency
 * (pyotp, for the RFC 6238 arithmetic). Rendering the QR would have meant a second one plus an
 * image encoder, and then a PNG endpoint carrying a secret that we would have to reason about
 * caching, logging and Referer leakage for. Drawing it client side from a string the client already
 * holds avoids all of that. See the §6 header in backend/afc_auth/two_factor.py.
 *
 * ── WHY IT IS ALWAYS WHITE-ON-BLACK, in a dark-themed app ───────────────────────────────────────
 * A QR is read by a camera, not by a person, and scanners expect dark modules on a light field.
 * Inverting it for dark mode is the single most common reason a QR "will not scan". So the code
 * sits in a fixed white plate with a quiet zone of padding around it, in both themes. This is the
 * one place in the app that deliberately ignores the viewer's theme, and that is a functional
 * decision rather than a styling oversight.
 *
 * ── ACCESSIBILITY AND THE FALLBACK ──────────────────────────────────────────────────────────────
 * The QR is aria-hidden: it is an image of a string, and a screen reader announcing a base32
 * secret character by character is not usable. The dialog that renders this ALWAYS shows the same
 * secret as selectable text beside it, which is the accessible path and also the path for anyone
 * setting 2FA up on the same phone they are browsing on (no second camera to point at the screen).
 *
 * How it connects to the rest of the system:
 *  - Data: TotpSetup.otpauth_uri from lib/twoFactor.ts setupTotp().
 *  - Caller: app/(user)/profile/_components/TotpEnrolDialog.tsx.
 *  - Encoder: react-qr-code (MIT, no runtime dependencies, renders inline SVG rather than a
 *    canvas, so it stays sharp at any size and needs no ref or effect).
 */

import QRCode from "react-qr-code";

type TotpQrCodeProps = {
  /** The otpauth:// URI to encode. */
  value: string;
  /** Optional classes for the white plate, mainly to change its width. */
  className?: string;
};

export function TotpQrCode({ value, className }: TotpQrCodeProps) {
  return (
    <div
      // The white plate and its padding ARE the quiet zone a scanner needs; without margin around
      // the modules many readers refuse the code outright. Fixed width (the SVG below fills it):
      // 12rem is comfortably scannable at arm's length and still leaves room on a 390px screen.
      className={`mx-auto w-48 rounded-md bg-white p-3 sm:w-56 ${className ?? ""}`}
    >
      <QRCode
        value={value}
        // "M" recovers ~15% of the symbol, which is what every authenticator setup page uses: enough
        // for a phone camera at an angle, without inflating the module count so the squares get too
        // small to read on a 390px screen.
        level="M"
        // Fixed dark-on-light, for the reason in the header.
        bgColor="#FFFFFF"
        fgColor="#000000"
        // Sized by CSS rather than the size prop so it scales down on a phone. The SVG has a
        // viewBox, so this stays crisp at any width.
        style={{ height: "auto", maxWidth: "100%", width: "100%" }}
        aria-hidden="true"
      />
    </div>
  );
}
