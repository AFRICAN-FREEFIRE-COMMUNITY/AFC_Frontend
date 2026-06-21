"use client";

// ── Discord SSO callback (owner 2026-06-21) ──────────────────────────────────
// The backend (afc_auth.views.discord_sso_callback) bounces the browser here after
// Discord auth, with either:
//   ?code=<one-time handoff>&next=<path>   -> swap the handoff for the real session
//                                             token (POST /auth/discord/sso/exchange/),
//                                             log the user in, go to <next>.
//   ?status=failed|no_email|inactive       -> show why + send back to /login.
// The session token never travels in the URL - only the single-use handoff code does.
import { Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { FullLoader } from "@/components/Loader";

function DiscordCallbackInner() {
  const t = useTranslations("auth");
  const router = useRouter();
  const params = useSearchParams();
  const { login } = useAuth();
  const ran = useRef(false); // guard React StrictMode double-invoke

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const status = params.get("status");
    const code = params.get("code");
    const next = params.get("next") || "/home";

    if (status || !code) {
      const msg =
        status === "no_email"
          ? t("discord.noEmail")
          : status === "inactive"
            ? t("discord.inactive")
            : t("discord.failed");
      toast.error(msg);
      router.replace("/login");
      return;
    }

    (async () => {
      try {
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/discord/sso/exchange/`,
          { code },
        );
        await login(res.data.session_token);
        toast.success(t("discord.success"));
        router.replace(next.startsWith("/") ? next : "/home");
      } catch (err: any) {
        toast.error(err?.response?.data?.message || t("discord.failed"));
        router.replace("/login");
      }
    })();
  }, [params, login, router, t]);

  return (
    <div className="py-16 text-center">
      <FullLoader />
      <p className="mt-4 text-sm text-muted-foreground">{t("discord.signingIn")}</p>
    </div>
  );
}

export default function DiscordCallbackPage() {
  return (
    <Suspense fallback={<FullLoader />}>
      <DiscordCallbackInner />
    </Suspense>
  );
}
