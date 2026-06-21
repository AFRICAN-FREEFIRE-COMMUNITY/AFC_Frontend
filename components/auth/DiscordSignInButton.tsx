"use client";

// ── DiscordSignInButton (owner 2026-06-21) ───────────────────────────────────
// "Continue with Discord" on the login + register pages. Discord SSO is a redirect
// (OAuth authorization-code) flow, so this is just a full-page navigation to the
// backend start endpoint - the whole exchange happens server-side and bounces back to
// app/(auth)/discord/callback. Unlike Google's locked iframe, this is a normal button,
// so it's a proper full-width, on-brand (blurple) AFC button.
//
// Gated on NEXT_PUBLIC_DISCORD_SSO_ENABLED so it only shows where the backend Discord
// app is configured. `next` carries the post-login path (the ?redirect= or /home).
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { IconBrandDiscordFilled } from "@tabler/icons-react";
import { env } from "@/lib/env";

export function DiscordSignInButton() {
  const enabled = env.NEXT_PUBLIC_DISCORD_SSO_ENABLED === "true";
  const t = useTranslations("auth");
  const searchParams = useSearchParams();

  if (!enabled) return null;

  const start = () => {
    // Where to land after login: explicit ?redirect=, else the stashed post-login page, else /home.
    let next = searchParams.get("redirect") || "";
    if (!next) {
      try {
        next = sessionStorage.getItem("afc_post_login_redirect") || "";
      } catch {}
    }
    if (!next) next = "/home";
    window.location.href =
      `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/discord/sso/start/?next=${encodeURIComponent(next)}`;
  };

  return (
    <button
      type="button"
      onClick={start}
      className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-[#5865F2] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#4752c4]"
    >
      <IconBrandDiscordFilled className="h-5 w-5" />
      {t("discord.continue")}
    </button>
  );
}
