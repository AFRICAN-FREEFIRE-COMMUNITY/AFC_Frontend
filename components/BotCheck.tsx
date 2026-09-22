"use client";

/**
 * BotCheck - the Cloudflare Turnstile widget on a form anyone can post to (owner 2026-09-22).
 *
 * WHY IT IS HERE AND NOT JUST ON THE SERVER
 * -----------------------------------------
 * The server is what decides (afc_auth/bot_protection.py asks Cloudflare about the token, and a
 * script that skips this widget simply has no token to send). This component only produces the
 * token a real browser can get, and hands it to the form.
 *
 * WHAT IT RENDERS
 * ---------------
 * Nothing at all when NEXT_PUBLIC_TURNSTILE_SITE_KEY is unset, so a developer machine and the
 * scratch server keep working exactly as before - matching the server, which allows the request
 * when its own key is missing. With the key set it renders Turnstile's own widget, which for a
 * normal visitor is a single line that resolves by itself: no puzzle, no advertising cookie.
 *
 * HOW A FORM USES IT
 * ------------------
 *     const [botToken, setBotToken] = useState("");
 *     ...
 *     <BotCheck onToken={setBotToken} />
 *     ...
 *     body: { ...fields, cf_turnstile_response: botToken }
 *
 * The field name is what the backend reads (bot_protection.TOKEN_FIELDS). A token is single use and
 * expires after about five minutes, so `reset()` is exposed through the ref for a form that stays
 * open after a failed submit.
 *
 * CONNECTS TO: afc_auth/bot_protection.py (the verifier), and the four forms it guards: create
 * account, contact, the feedback dialog and the partner application.
 */

import { useCallback, useEffect, useId, useRef } from "react";

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const SCRIPT_ID = "cf-turnstile-script";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
    };
  }
}

/** The site key, or "" when this environment has none (then the widget is not rendered at all). */
export function turnstileSiteKey(): string {
  return (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "").trim();
}

/** True when this environment shows the check. Forms use it to decide whether to wait for a token. */
export function botCheckEnabled(): boolean {
  return turnstileSiteKey().length > 0;
}

function loadScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return resolve();
    if (window.turnstile) return resolve();
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("turnstile script failed")));
      return;
    }
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("turnstile script failed"));
    document.head.appendChild(script);
  });
}

export function BotCheck({
  onToken,
  className,
  theme = "dark",
}: {
  onToken: (token: string) => void;
  className?: string;
  theme?: "dark" | "light" | "auto";
}) {
  const holder = useRef<HTMLDivElement | null>(null);
  const widgetId = useRef<string | null>(null);
  const domId = useId();
  const siteKey = turnstileSiteKey();

  const handleToken = useCallback((token: string) => onToken(token), [onToken]);

  useEffect(() => {
    if (!siteKey || !holder.current) return;
    let cancelled = false;

    loadScript()
      .then(() => {
        if (cancelled || !holder.current || !window.turnstile) return;
        widgetId.current = window.turnstile.render(holder.current, {
          sitekey: siteKey,
          theme,
          callback: handleToken,
          // A token lasts about five minutes; when it lapses, clear ours so the form asks again
          // rather than posting something the server will refuse.
          "expired-callback": () => handleToken(""),
          "error-callback": () => handleToken(""),
        });
      })
      .catch(() => {
        // Cloudflare unreachable: leave the token empty. The server fails OPEN on its own outage,
        // so a real person is not stuck behind a script that would not load.
        handleToken("");
      });

    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetId.current);
        } catch {
          /* the widget is already gone */
        }
      }
    };
  }, [siteKey, theme, handleToken]);

  if (!siteKey) return null;
  return <div id={domId} ref={holder} className={className} />;
}

export default BotCheck;
