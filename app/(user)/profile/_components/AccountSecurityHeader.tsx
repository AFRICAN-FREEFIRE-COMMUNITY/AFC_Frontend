"use client";

/**
 * AccountSecurityHeader - the top of /profile/security, renamed "Account and security" (inbox #60,
 * owner 2026-09-27: "for the user side, its hard to find the delete my account where it is";
 * approved mockup mockups/account-and-2fa, screen 2).
 *
 * The page used to be "Sign-in security", reached from a card that only talked about two-step
 * sign-in, with "Delete my account" at the very bottom. It now opens with jump links to its three
 * parts; the red one goes straight to deleting. The anchors are the section ids set in
 * TwoFactorSecurity.tsx (#two-step, #devices) and DeleteAccountCard.tsx (#delete), which also
 * handles arriving at /profile/security#delete from the profile page.
 * Caller: app/(user)/profile/security/page.tsx. i18n: twoFactor.account.* (fr/pt by hand).
 * DESIGN: filled pills, no outlines; the delete pill is tinted red, the only red before the card.
 */
import { useTranslations } from "next-intl";

import { PageHeader } from "@/components/PageHeader";
import { NewBadge } from "@/components/NewBadge";

export function AccountSecurityHeader() {
  const t = useTranslations("twoFactor");
  const links = [
    { href: "#two-step", label: t("account.jumpTwoStep"), danger: false },
    { href: "#devices", label: t("account.jumpDevices"), danger: false },
    { href: "#delete", label: t("account.jumpDelete"), danger: true },
  ];
  return (
    <div className="container mx-auto pt-6">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {t("account.title")}
            <NewBadge since="2026-09-27" />
          </span>
        }
        description={t("account.subtitle")}
      />
      <nav aria-label={t("account.jumpLabel")} className="mt-4 flex flex-wrap gap-2">
        {links.map((l) => (
          <a
            key={l.href}
            href={l.href}
            className={
              l.danger
                ? "rounded-full bg-destructive/15 px-3 py-1.5 text-sm font-semibold text-destructive hover:bg-destructive/25"
                : "rounded-full bg-muted px-3 py-1.5 text-sm font-semibold hover:bg-muted/70"
            }
          >
            {l.label}
          </a>
        ))}
      </nav>
    </div>
  );
}
