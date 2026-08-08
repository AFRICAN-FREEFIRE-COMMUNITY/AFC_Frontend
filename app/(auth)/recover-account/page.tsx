import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { NewBadge } from "@/components/NewBadge";
import { RecoverAccountForm } from "../_components/RecoverAccountForm";

// ─────────────────────────────────────────────────────────────────────────────
// /recover-account - GETTING BACK IN with a code sent to WhatsApp instead of email
// (owner 2026-08-08).
//
// The emailed reset at /forgot-password only helps a person who still owns their
// inbox. This is the page for the ones who do not: if they saved a WhatsApp number
// on the account, they confirm a code sent to it, and that ONE proof opens TWO
// endings - set a new password, or move the account onto an email address they can
// actually read. Both live in RecoverAccountForm (a Client Component); this Server
// Component is only the heading, the explanation and the way back.
//
// Offered as a choice on /forgot-password and linked from /login. /contact stays
// underneath on both, and today it is still the answer for most people: only about
// 116 of 6,809 accounts have a number saved, so the capture half of this feature
// (signup + profile settings) is what decides whether this page ever helps anyone.
// The identify screen says so out loud rather than letting somebody wait for a code
// that is never coming.
//
// It does NOT sign the user in, whichever ending they take. On success they are sent
// to /login, where an account with two-step sign-in meets its second factor exactly
// as before. That is what keeps the password reset from being a way past it; the
// EMAIL move is handled differently and is refused outright on any account with
// two-step sign-in. See backend/afc_auth/views_recovery.py §4 for both arguments.
//
// NEW badge: this is a brand new user-facing surface, so it wears the dated tag
// and expires by itself five days later (components/NewBadge.tsx).
// ─────────────────────────────────────────────────────────────────────────────
const page = async () => {
  const t = await getTranslations("recovery");
  return (
    <div>
      <h1 className="mb-6 flex flex-wrap items-center justify-center gap-2 text-center text-3xl font-bold text-primary">
        {t("heading")}
        <NewBadge since="2026-08-08" />
      </h1>
      <p className="mb-6 text-center text-muted-foreground">{t("description")}</p>
      <RecoverAccountForm />
      <div className="mt-6">
        <Button className="w-full" variant={"secondary"} asChild>
          <Link href="/login">{t("backToLogin")}</Link>
        </Button>
      </div>
    </div>
  );
};

export default page;
