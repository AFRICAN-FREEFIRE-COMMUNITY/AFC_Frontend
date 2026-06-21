"use client";

// ── GoogleSignInButton (owner 2026-06-20; custom button 2026-06-21) ──────────
// "Continue with Google" on the login + register pages. Uses Google Identity
// Services CODE client (popup): the user authenticates, we get a one-time auth code,
// POST it to the backend (afc_auth.views.google_auth), which exchanges it for an id
// token, verifies it, finds-or-creates the user, and returns our SessionToken.
//
// WHY the code flow (not the id-token iframe button): GIS's renderButton is a locked
// iframe capped at 400px, so it could never match the full-width AFC buttons. The code
// client lets us render OUR OWN full-width button, consistent with the Discord button.
//
// INERT until NEXT_PUBLIC_GOOGLE_CLIENT_ID is set. The backend also needs
// GOOGLE_OAUTH_CLIENT_SECRET for the code exchange.
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import axios from "axios";
import { useTranslations } from "next-intl";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";

const GIS_SRC = "https://accounts.google.com/gsi/client";

let gisLoadPromise: Promise<void> | null = null;
function loadGis(): Promise<void> {
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

// Official multi-colour Google "G".
function GoogleG({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export function GoogleSignInButton() {
  const clientId = env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const t = useTranslations("auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const codeClientRef = useRef<any>(null);
  const [busy, setBusy] = useState(false);

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

  const handleCode = useCallback(
    async (code: string) => {
      setBusy(true);
      try {
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/google/`,
          { code },
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
    if (!clientId) return;
    let cancelled = false;
    loadGis()
      .then(() => {
        if (cancelled) return;
        const g = (window as any).google;
        if (!g?.accounts?.oauth2) return;
        codeClientRef.current = g.accounts.oauth2.initCodeClient({
          client_id: clientId,
          scope: "openid email profile",
          ux_mode: "popup",
          callback: (resp: { code?: string }) => {
            if (resp?.code) handleCode(resp.code);
          },
        });
      })
      .catch(() => {
        // Script blocked / offline: leave it; password login still works.
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, handleCode]);

  if (!clientId) return null;

  const onClick = () => {
    if (busy) return;
    if (!codeClientRef.current) {
      toast.error(t("google.failed"));
      return;
    }
    codeClientRef.current.requestCode();
  };

  return (
    <div className="mt-6">
      {/* subtle "OR" divider above the SSO buttons */}
      <div className="relative mb-4 flex items-center">
        <div className="h-px flex-1 bg-border/70" />
        <span className="px-3 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
          {t("google.or")}
        </span>
        <div className="h-px flex-1 bg-border/70" />
      </div>
      {/* Custom full-width button, matched in shape/size to the Discord button. */}
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        aria-busy={busy}
        className="flex w-full items-center justify-center gap-2 rounded-full border border-border bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-100 disabled:opacity-60"
      >
        <GoogleG className="h-5 w-5" />
        {t("google.continue")}
      </button>
    </div>
  );
}
