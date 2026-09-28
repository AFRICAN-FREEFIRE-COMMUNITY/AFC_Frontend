"use client";

/**
 * components/support/SupportWorkspace.tsx - the moving parts of the /support page (inbox #71).
 *
 * app/(user)/support/page.tsx (a Server Component: title, SEO, the contact information card) hands
 * this the contact information card as `aside`. This decides what depends on the session:
 *   - signed in: "My tickets" (MyTickets) first, then the form with the account's name and email
 *     filled in (ContactForm's accountPrefill), with a hint that says so
 *   - signed out: a line inviting them to log in to see their tickets, then the form
 *   - while the session loads: nothing account-shaped at all (R26, decided after it resolves)
 * The form itself posts to support/contact/ exactly as before (app/(user)/_components/ContactForm).
 */
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { useViewer } from "@/lib/gating";
import { Button } from "@/components/ui/button";
import { ContactForm } from "@/app/(user)/_components/ContactForm";
import { MyTickets } from "@/components/support/MyTickets";
import { SUPPORT_CARD, SUPPORT_FIELD } from "@/components/support/styles";

export function SupportWorkspace({ aside }: { aside: ReactNode }) {
  const t = useTranslations("supportPage");
  const viewer = useViewer();
  const user = viewer.user;

  return (
    <div className="flex flex-col gap-2">
      {viewer.signedIn && user && <MyTickets email={user.email || ""} />}
      {!viewer.loading && !viewer.signedIn && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/40 px-6 py-4 text-sm text-muted-foreground">
          <span>{t("signedOut.text")}</span>
          <Button asChild size="sm">
            <Link href="/login?redirect=/support">{t("signedOut.login")}</Link>
          </Button>
        </div>
      )}
      <div className="grid grid-cols-1 items-start gap-2 lg:grid-cols-7">
        <div className="lg:col-span-4">
          <ContactForm
            className={SUPPORT_CARD}
            fieldClassName={SUPPORT_FIELD}
            subtitle={t("form.subtitle")}
            prefilledHint={t("form.prefilled")}
            accountPrefill={viewer.signedIn && user ? { name: user.full_name || user.in_game_name || "", email: user.email || "" } : null}
          />
        </div>
        <div className="lg:col-span-3">{aside}</div>
      </div>
    </div>
  );
}
