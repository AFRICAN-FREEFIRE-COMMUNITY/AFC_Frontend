import { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LoginForm } from "../_components/LoginForm";
import { Separator } from "@/components/ui/separator";
import { NewBadge } from "@/components/NewBadge";
import { generatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = generatePageMetadata({
  title: "Login",
  description:
    "Login to your African Free Fire Community account. Access your player profile, team management, and compete in tournaments.",
  keywords: ["login", "sign in", "AFC account", "Free Fire login"],
  url: "/login",
});

// Server Component: pulls auth.login.* copy via getTranslations (the async,
// server-side counterpart to the useTranslations hook). The interactive form
// lives in the LoginForm Client Component, which translates on its own.
export default async function LoginPage() {
  const t = await getTranslations("auth");
  return (
    <div>
      <h1 className="text-2xl md:text-3xl font-semibold text-primary mb-6 text-center">
        {t("login.heading")}
      </h1>
      <LoginForm />
      <div className="mt-4 text-center">
        <Link
          href="/forgot-password"
          className="text-muted-foreground hover:text-primary"
        >
          {t("login.forgotPassword")}
        </Link>
      </div>
      {/* Locked-out recovery (owner 2026-07-10, bug #1 "what of those who can't
          login"): the "Forgot password?" link above emails a code, which is no use
          to somebody who signed up with an address they cannot read. SECOND
          CHANNEL (owner 2026-08-08): if they saved a WhatsApp number,
          /recover-account sends the code there instead (auth/recovery/whatsapp/*).
          Proving that number opens TWO endings, so it covers both halves of being
          locked out: set a new password, or move the account onto an address they
          can actually read. The email move is refused on an account with two-step
          sign-in, where support is still the answer.

          /contact stays underneath as the fallback, and today it is still the
          answer for most people: only about 116 of 6,809 accounts have a number
          saved. Both pages are public, so both are reachable while logged out. */}
      <div className="mt-2 text-center text-sm">
        <span className="text-muted-foreground">
          {t("support.cantAccessEmail")}{" "}
        </span>
        <Link
          href="/recover-account"
          className="inline-flex items-center gap-1.5 text-primary hover:underline"
        >
          {t("support.resetWithWhatsApp")}
          <NewBadge since="2026-08-08" />
        </Link>
      </div>
      <div className="mt-1 text-center text-xs">
        <span className="text-muted-foreground">
          {t("support.noWhatsAppNumber")}{" "}
        </span>
        <Link href="/contact" className="text-primary hover:underline">
          {t("support.contactSupport")}
        </Link>
      </div>
      <Separator className="mt-4" />
      <div className="mt-4 text-center text-sm md:text-base">
        <p className="text-muted-foreground">{t("login.noAccount")}</p>
        <Link href="/create-account" className="text-primary hover:underline">
          {t("login.createAccount")}
        </Link>
      </div>
    </div>
  );
}
