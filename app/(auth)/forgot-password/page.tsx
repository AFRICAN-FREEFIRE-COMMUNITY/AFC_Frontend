import { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { NewBadge } from "@/components/NewBadge";
import { ForgotPasswordForm } from "../_components/ForgotPasswordForm";
import { generatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = generatePageMetadata({
  title: "Forgot Password",
  description:
    "Reset your African Free Fire Community account password. Enter your email to receive password reset instructions.",
  keywords: ["forgot password", "reset password", "account recovery"],
  url: "/forgot-password",
  noIndex: true,
});

// Server Component: pulls auth.forgotPassword.* copy via getTranslations. The
// Email/UID tabbed form lives in the ForgotPasswordForm Client Component.
const page = async () => {
  const t = await getTranslations("auth");
  return (
    <div>
      <h1 className="text-3xl font-bold text-primary mb-6 text-center">
        {t("forgotPassword.heading")}
      </h1>
      <p className="text-muted-foreground mb-6 text-center">
        {t("forgotPassword.description")}
      </p>
      <ForgotPasswordForm />
      <div className="mt-4 text-center">
        <Button className="w-full" variant={"secondary"} asChild>
          <Link href="/login">{t("forgotPassword.backToLogin")}</Link>
        </Button>
      </div>
      {/* THE SECOND CHANNEL (owner 2026-08-08). Every tab in the form above sends
          the code to the account's EMAIL, so the whole page is useless to somebody
          who has lost that inbox, which is exactly the person most likely to be
          reading it. This is the choice for them: prove the WhatsApp number saved
          on the account instead, and set a new password (auth/recovery/whatsapp/*,
          backend afc_auth/views_recovery.py).

          Presented as a real alternative rather than a footnote link, because it
          IS one: a person who cannot receive our mail has to be able to see the
          other door without hunting for it. /contact stays underneath for the
          accounts this cannot serve either, which is most of them today: only
          about 116 of 6,809 accounts have a number saved, so until capture
          improves the honest answer for nearly everyone is still a human.

          NEW badge: brand new surface, dated, and it expires by itself. */}
      <div className="mt-6 rounded-md border bg-card p-4 text-center">
        <p className="flex flex-wrap items-center justify-center gap-2 text-sm font-medium">
          {t("whatsappReset.title")}
          <NewBadge since="2026-08-08" />
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("whatsappReset.body")}
        </p>
        <Button className="mt-3 w-full" variant={"outline"} asChild>
          <Link href="/recover-account">{t("whatsappReset.cta")}</Link>
        </Button>
      </div>
      <div className="mt-3 text-center text-xs">
        <span className="text-muted-foreground">
          {t("support.noWhatsAppNumber")}{" "}
        </span>
        <Link href="/contact" className="text-primary hover:underline">
          {t("support.contactSupport")}
        </Link>
      </div>
    </div>
  );
};

export default page;
