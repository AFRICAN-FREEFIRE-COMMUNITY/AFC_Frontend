"use client";

// ─────────────────────────────────────────────────────────────────────────────
// GoogleSignInButton (owner 2026-06-20)
//
// "Continue with Google" for BOTH the login and create-account pages. Uses Google
// Identity Services (GIS) ID-token flow:
//   1. Loads the GIS client script once.
//   2. Renders Google's official button. When the user authenticates, Google hands
//      us a signed JWT ID token in the callback.
//   3. We POST that token as { credential } to POST /auth/google/ (afc_auth.views.
//      google_auth), which verifies it, finds-or-creates the user, and returns OUR
//      SessionToken - identical to the password login response.
//   4. We hand that token to AuthContext.login(token) (same as LoginForm), toast,
//      and redirect (?redirect= -> stashed post-login page -> /home).
//
// It is INERT until NEXT_PUBLIC_GOOGLE_CLIENT_ID is set: with no client id the
// component renders nothing, so the rest of auth works unchanged. The backend
// verifies against settings.GOOGLE_OAUTH_CLIENT_ID (the SAME id).
//
// Consumed by: app/(auth)/_components/LoginForm.tsx and CreateAccountForm.tsx.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import axios from "axios";
import { useTranslations } from "next-intl";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";

// GIS client script URL (loaded once, lazily, on the client).
const GIS_SRC = "https://accounts.google.com/gsi/client";

// Module-level singleton so the script is injected at most once across mounts.
let gisLoadPromise: Promise<void> | null = null;
function loadGis(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if ((window as any).google?.accounts?.id) return Promise.resolve();
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

export function GoogleSignInButton() {
  const clientId = env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const t = useTranslations("auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const buttonRef = useRef<HTMLDivElement | null>(null);
  const [busy, setBusy] = useState(false);

  // Where to send the user after a successful Google sign-in. Mirrors LoginForm's
  // redirect priority: explicit ?redirect= -> page stashed on session expiry -> /home.
  const resolveTarget = useCallback((): string => {
    const explicit = searchParams.get("redirect");
    if (explicit) return explicit;
    try {
      const stashed = sessionStorage.getItem("afc_post_login_redirect");
      if (stashed) {
        sessionStorage.removeItem("afc_post_login_redirect");
        return stashed;
      }
    } catch {}
    return "/home";
  }, [searchParams]);

  // Exchange the Google ID token for our SessionToken, then sign the user in.
  const handleCredential = useCallback(
    async (credential: string) => {
      setBusy(true);
      try {
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/google/`,
          { credential },
        );
        await login(res.data.session_token);
        toast.success(res.data.message || t("google.success"));
        router.push(resolveTarget());
      } catch (error: any) {
        toast.error(error?.response?.data?.message || t("google.failed"));
      } finally {
        setBusy(false);
      }
    },
    [login, router, resolveTarget, t],
  );

  useEffect(() => {
    if (!clientId) return; // feature dormant until a client id is configured
    let cancelled = false;
    loadGis()
      .then(() => {
        if (cancelled) return;
        const g = (window as any).google;
        if (!g?.accounts?.id || !buttonRef.current) return;
        g.accounts.id.initialize({
          client_id: clientId,
          callback: (resp: { credential?: string }) => {
            if (resp?.credential) handleCredential(resp.credential);
          },
        });
        // Render Google's official, localized button into our container.
        g.accounts.id.renderButton(buttonRef.current, {
          theme: "outline",
          size: "large",
          width: 320,
          text: "continue_with",
          shape: "rectangular",
          logo_alignment: "center",
        });
      })
      .catch(() => {
        // Script blocked / offline: leave the area empty, password login still works.
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, handleCredential]);

  if (!clientId) return null;

  return (
    <div className="mt-6">
      {/* "or" divider between the password form and the Google button */}
      <div className="relative mb-4 flex items-center">
        <div className="h-px flex-1 bg-border" />
        <span className="px-3 text-xs uppercase text-muted-foreground">
          {t("google.or")}
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className="flex justify-center">
        {/* GIS renders its iframe button into this div. busy just dims it while we
            exchange the token so a double-click can't fire two logins. */}
        <div
          ref={buttonRef}
          className={busy ? "pointer-events-none opacity-60" : ""}
          aria-busy={busy}
        />
      </div>
    </div>
  );
}
