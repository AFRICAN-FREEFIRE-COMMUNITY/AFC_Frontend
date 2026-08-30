"use client";
import { Logo } from "@/components/Logo";
import Link from "next/link";
import React from "react";
// Footer is a CLIENT component: it is rendered both by server layouts AND by client pages
// (home, rules, invite), so it must use the client useTranslations() hook, not the server
// getTranslations() (which throws "not supported in Client Components" when a client parent
// renders it). Strings live in messages/en/common.json under the "common" namespace.
import { useTranslations } from "next-intl";
import { FeedbackLauncher } from "@/components/feedback/FeedbackLauncher";
import { NewBadge } from "@/components/NewBadge";

export const Footer = () => {
  const t = useTranslations("common");

  return (
    <footer className="border-t border-border/40 bg-background/50 backdrop-blur-sm mt-8">
      <div className="container mx-auto px-4 py-8">
        {/* Brand column wider (2fr) so the three link columns (Platform / Community /
            Support) are equal width AND sit further right - the Support column then lines
            up under the right-aligned "Powered by" text in the bottom bar (owner 2026-06-20). */}
        <div className="grid gap-8 md:grid-cols-[2fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <Logo size="small" />
              <span className="text-lg font-bold text-primary">
                {t("brand.shortName")}
              </span>
            </div>
            <p className="text-muted-foreground text-sm">
              {t("footer.tagline")}
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-primary">
              {t("footer.platform")}
            </h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link
                  href="/tournaments"
                  className="hover:text-primary transition-colors"
                >
                  {t("footer.tournaments")}
                </Link>
              </li>
              {/* <li>
                  <Link
                    href="/rankings"
                    className="hover:text-primary transition-colors"
                  >
                    Rankings
                  </Link>
                </li> */}
              <li>
                <Link
                  href="/teams"
                  className="hover:text-primary transition-colors"
                >
                  {t("footer.teams")}
                </Link>
              </li>
              <li>
                <Link
                  href="/awards"
                  className="hover:text-primary transition-colors"
                >
                  {t("footer.awards")}
                </Link>
              </li>
              {/* <li>
                  <Link
                    href="/players"
                    className="hover:text-primary transition-colors"
                  >
                    Players
                  </Link>
                </li> */}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-primary">
              {t("footer.community")}
            </h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link
                  href="/about"
                  className="hover:text-primary transition-colors"
                >
                  {t("footer.aboutUs")}
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="hover:text-primary transition-colors"
                >
                  {t("footer.contact")}
                </Link>
              </li>
              <li>
                <Link
                  href="/news"
                  className="hover:text-primary transition-colors"
                >
                  {t("footer.news")}
                </Link>
              </li>
              <li>
                <Link
                  href="/teams"
                  className="hover:text-primary transition-colors"
                >
                  {t("footer.teams")}
                </Link>
              </li>
              {/* <li>
                  <Link
                    href="/shop"
                    className="hover:text-primary transition-colors"
                  >
                    Shop
                  </Link>
                </li> */}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-primary">
              {t("footer.support")}
            </h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link
                  href="/terms-of-service"
                  className="hover:text-primary transition-colors"
                >
                  {t("footer.termsOfService")}
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy-policy"
                  className="hover:text-primary transition-colors"
                >
                  {t("footer.privacyPolicy")}
                </Link>
              </li>
              <li>
                <Link
                  href="/rules"
                  className="hover:text-primary transition-colors"
                >
                  {t("footer.rules")}
                </Link>
              </li>
              {/* Partner links (owner 2026-08-27). Both pages were ALREADY public and in the
                  (root) group; the gap was that nothing on the site linked to them, so only
                  somebody who already knew the URL could reach them. The footer is the one
                  element rendered on every public page, signed in or not, which is exactly the
                  audience: an engineer at a partner organisation who has no AFC account and
                  never will. */}
              <li>
                <Link
                  href="/partners/api"
                  className="hover:text-primary transition-colors"
                >
                  {t("footer.partnerApi")}
                </Link>
              </li>
              <li>
                <Link
                  href="/partners/apply"
                  className="hover:text-primary transition-colors"
                >
                  {t("footer.becomeAPartner")}
                </Link>
              </li>
              {/* Brand kit (owner 2026-08-30). Added because a partner shipped a "Sign in
                  with AFC" button with no mark on it and the full legal name as its label,
                  for the simple reason that AFC published neither. Same audience and same
                  reasoning as the two links above: an engineer who needs our artwork and
                  has no AFC account. */}
              <li>
                <Link
                  href="/brand"
                  className="hover:text-primary transition-colors inline-flex items-center gap-1.5"
                >
                  {t("footer.brand")}
                  <NewBadge since="2026-08-30" />
                </Link>
              </li>
              {/* Always-on site feedback (owner backlog item 29). Lives here rather than in a
                  floating button because the Footer is the one element rendered on EVERY public
                  page (the user layout plus the landing, rules, privacy, terms, invite, auth and
                  onboarding pages render it directly), and because a fixed button would obscure
                  content on a 390px phone and sit under the bottom-center toaster. See
                  components/feedback/FeedbackLauncher.tsx for the full reasoning. */}
              <li>
                <FeedbackLauncher />
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t text-sm border-border/40 mt-8 pt-6 flex flex-col md:flex-row justify-between text-muted-foreground font-medium items-center">
          <p>{t("footer.copyright", { year: new Date().getFullYear() })}</p>
          <div className="flex items-center space-x-4 mt-4 md:mt-0">
            <span>{t("footer.poweredBy")}</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
