"use client";

// ── v-ent.co SSO callback (owner 2026-08-28) ─────────────────────
// The backend (afc_auth.vent_sso.vent_sso_callback) bounces the browser here after v-ent.co auth,
// with either:
//   ?code=<one-time handoff>&next=<path>   -> swap the handoff for the real result
//                                             (POST /auth/vent/sso/exchange/).
//   ?status=failed|no_email|inactive       -> show why + send back to /login.
//
// The exchange returns ONE OF TWO THINGS, the same two the password login returns:
//   • the normal login body            -> log in, go to <next>.
//   • a two_factor_required challenge  -> render TwoFactorStep right here, and log in once the
//                                         code checks out.
//
// WHY THE CHALLENGE IS NOT IN THE URL: this page is reached by a redirect, so anything in the
// query string lands in browser history and can leak through Referer. The URL therefore carries
// only the opaque, single-use, 90-second handoff code; the challenge token itself arrives in the
// BODY of the exchange POST, exactly as the session token always has. Nothing about the URL
// contract changed when 2FA was added.
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { FullLoader } from "@/components/Loader";
import { TwoFactorStep } from "../../_components/TwoFactorStep";
import { isTwoFactorChallenge, type TwoFactorChallenge } from "@/lib/twoFactor";

function VentCallbackInner() {
  const t = useTranslations("auth");
  const router = useRouter();
  const params = useSearchParams();
  const { login } = useAuth();
  const ran = useRef(false); // guard React StrictMode double-invoke

  // Non-null only for a v-ent.co account whose owner has two-step sign-in on.
  const [challenge, setChallenge] = useState<TwoFactorChallenge | null>(null);
  // Where to land once the user is actually signed in. Held in state because the code screen
  // sits between the redirect and the navigation, so we cannot read it at push time.
  const [next, setNext] = useState("/home");

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const status = params.get("status");
    const code = params.get("code");
    const target = params.get("next") || "/home";
    setNext(target.startsWith("/") ? target : "/home");

    if (status || !code) {
      const msg =
        status === "no_email"
          ? t("vent.noEmail")
          : status === "inactive"
            ? t("vent.inactive")
            : t("vent.failed");
      toast.error(msg);
      router.replace("/login");
      return;
    }

    (async () => {
      try {
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/vent/sso/exchange/`,
          { code },
        );

        // Two-step sign-in: hold here and ask for the code instead of signing in.
        if (isTwoFactorChallenge(res.data)) {
          setChallenge(res.data);
          return;
        }

        await login(res.data.session_token);
        toast.success(t("vent.success"));
        router.replace(target.startsWith("/") ? target : "/home");
      } catch (err: any) {
        toast.error(err?.response?.data?.message || t("vent.failed"));
        router.replace("/login");
      }
    })();
  }, [params, login, router, t]);

  // The second step, on the same screen the redirect landed on. Cancelling goes back to /login
  // rather than retrying v-ent.co, because the handoff code is single-use and already spent.
  if (challenge) {
    return (
      <div className="py-8">
        <TwoFactorStep
          challenge={challenge}
          onVerified={async (data) => {
            await login(data.session_token);
            toast.success(t("vent.success"));
            router.replace(next);
          }}
          onCancel={() => router.replace("/login")}
        />
      </div>
    );
  }

  return (
    <div className="py-16 text-center">
      <FullLoader />
      <p className="mt-4 text-sm text-muted-foreground">{t("vent.signingIn")}</p>
    </div>
  );
}

export default function VentCallbackPage() {
  return (
    <Suspense fallback={<FullLoader />}>
      <VentCallbackInner />
    </Suspense>
  );
}
