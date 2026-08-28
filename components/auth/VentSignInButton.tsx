"use client";

// ── VentSignInButton (owner 2026-08-28) ──────────────────────────────────────
// "Continue with v-ent.co" on the login + register pages.
//
// "a sign in and sign up should also be the same as linking." v-ent.co already worked as a
// CONNECT provider on /profile/connected-apps, which requires an account you already have. This is
// the way IN, and the backend links the account on the way through, so a player who signs up here
// finds v-ent.co already connected on their profile without doing anything.
//
// Same shape as DiscordSignInButton next door: an authorization-code redirect, so this is a plain
// full-page navigation to the backend start endpoint and the whole exchange happens server-side
// before bouncing to app/(auth)/vent/callback. Nothing secret is ever in the browser.
//
// Gated on NEXT_PUBLIC_VENT_SSO_ENABLED so it only shows where the backend has VENT_CLIENT_ID and
// VENT_CLIENT_SECRET set. Without them the backend answers ?status=unconfigured, so the flag is
// about not showing a button that cannot work, not about security.
//
// BRAND: the mark is v-ent.co's own, served from /brands/v-ent.svg and used on their published
// terms (own proportions, never recoloured, at least 24px tall). See lib/providerBrands.ts. The
// button surface is deliberately NOT their red: a full red button would read as v-ent.co
// endorsing AFC, which their terms specifically ask us not to imply.
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { env } from "@/lib/env";
import { providerBrand } from "@/lib/providerBrands";

export function VentSignInButton() {
  const enabled = env.NEXT_PUBLIC_VENT_SSO_ENABLED === "true";
  const t = useTranslations("auth");
  const searchParams = useSearchParams();
  const brand = providerBrand("vent");

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
      `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/vent/sso/start/?next=${encodeURIComponent(next)}`;
  };

  return (
    <button
      type="button"
      onClick={start}
      className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-[#1a1a1e] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#26262c]"
    >
      {brand ? (
        <Image
          src={brand.src}
          alt=""
          width={20}
          height={20}
          className="h-5 w-auto object-contain"
          unoptimized
        />
      ) : null}
      {t("vent.continue")}
    </button>
  );
}
