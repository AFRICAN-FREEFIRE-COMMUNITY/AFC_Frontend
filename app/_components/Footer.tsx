"use client";
import { Logo } from "@/components/Logo";
import Link from "next/link";
import React from "react";
// Footer is a CLIENT component: it is rendered both by server layouts AND by client pages
// (home, rules, invite), so it must use the client useTranslations() hook, not the server
// getTranslations() (which throws "not supported in Client Components" when a client parent
// renders it). Strings live in messages/en/common.json under the "common" namespace.
import { useTranslations } from "next-intl";

export const Footer = () => {
  const t = useTranslations("common");

  return (
    <footer className="border-t border-border/40 bg-background/50 backdrop-blur-sm mt-8">
      <div className="container mx-auto px-4 py-8">
        <div className="grid md:grid-cols-4 gap-8">
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
