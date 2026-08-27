// ── Google Identity Services plumbing, in ONE place ──────────────────────────────────────────
//
// WHY THIS FILE EXISTS (owner bug 2026-08-27: "We could not start connecting Google", from an
// account that had already signed in with Google).
//
// Two surfaces need a Google auth code:
//
//   SIGN IN   components/auth/GoogleSignInButton.tsx
//   CONNECT   app/(user)/profile/_components/ConnectedAccounts.tsx
//
// Connect never worked. It called the REDIRECT endpoint, which the backend correctly refuses for
// Google because Google is not a redirect provider here. The reason it was written that way is
// that the GIS plumbing lived privately inside the sign-in button, so the connect page had nothing
// to reuse and took the only path it could see.
//
// So the loader and the code request live here, and both surfaces call them. Copying this into a
// second component is what produced the bug; a shared module is what stops the next one.
//
// WHAT "CODE" MEANS HERE. This is the GIS POPUP CODE client: the user consents in a popup and we
// receive a one-time authorization code, NOT an id token. The backend exchanges it
// (afc_auth/connections/providers/google.py resolve_id_token, shared by sign-in and connect).
// The older id-token iframe button is gone because Google locks it to 400px, which could never
// match the full-width AFC buttons.

const GIS_SRC = "https://accounts.google.com/gsi/client";

let gisLoadPromise: Promise<void> | null = null;

/** Load the GIS script once per page, and hand every later caller the same promise. */
export function loadGis(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if ((window as any).google?.accounts?.oauth2) return Promise.resolve();
  if (gisLoadPromise) return gisLoadPromise;
  gisLoadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GIS_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("GIS load failed")));
      return;
    }
    const s = document.createElement("script");
    s.src = GIS_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("GIS load failed"));
    document.head.appendChild(s);
  });
  return gisLoadPromise;
}

/**
 * Open the Google consent popup and resolve with a one-time auth CODE.
 *
 * Rejects when the script is blocked, when GIS is unavailable, or when the user closes the popup
 * without consenting. A rejection is therefore an ordinary outcome, not necessarily a fault, so
 * callers should stay quiet on it rather than shouting an error at somebody who simply changed
 * their mind.
 */
export function requestGoogleCode(clientId: string): Promise<string> {
  return loadGis().then(
    () =>
      new Promise<string>((resolve, reject) => {
        const g = (window as any).google;
        if (!g?.accounts?.oauth2) {
          reject(new Error("GIS unavailable"));
          return;
        }
        const client = g.accounts.oauth2.initCodeClient({
          client_id: clientId,
          scope: "openid email profile",
          ux_mode: "popup",
          callback: (resp: { code?: string }) => {
            if (resp?.code) resolve(resp.code);
            else reject(new Error("no code"));
          },
          // Fired when the popup is dismissed or Google refuses to show it. Without this the
          // promise would hang forever and the button would sit spinning.
          error_callback: () => reject(new Error("popup closed")),
        });
        client.requestCode();
      }),
  );
}
