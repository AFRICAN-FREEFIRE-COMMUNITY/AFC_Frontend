import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { Header } from "@/app/(user)/_components/Header";
import { Footer } from "@/app/_components/Footer";
import { BrandKit } from "@/components/brand/BrandKit";

/**
 * app/(root)/brand/page.tsx - AFC's public brand kit.
 *
 * WHY IT EXISTS (owner, 2026-08-30): a partner shipped a "Sign in with AFC" button that
 * read "Continue with African Free Fire Community" with no mark on it, because AFC had
 * never published a mark or a short name for anyone to use. Logos only travelled inwards:
 * partners upload theirs to us (afc_sso/provisioning.py) and we served our own nowhere.
 *
 * WHY (root) AND NOT (user): (root) is the set of pages a stranger can land on with no
 * session (privacy policy, terms, rules, invite, partner apply, the partner API guide).
 * This is one of those, and for the same reason as ./partners/api next door: the audience
 * is an engineer at a partner organisation who has no AFC account and never will. Gating a
 * brand kit behind a login would lock out exactly the people it is for, and worse, this is
 * the artwork for the button that STARTS a sign-in, so by definition nobody is signed in
 * when they need it.
 *
 * Content: components/brand/BrandKit.tsx, copy from the `brand` i18n namespace. Its machine
 * readable twin is backend afc_sso/brand.py (GET /sso/brand/), which publishes the same
 * names, colours, logo urls and rules. Change both together, and note the colour hexes
 * appear in both places on purpose so a partner reading either gets the same green.
 */

export async function generateMetadata(): Promise<Metadata> {
  // Same namespace as the page body, so the tab title and any link preview are localized
  // along with everything else. Mirrors partners/api/page.tsx.
  const t = await getTranslations("brand");
  return {
    title: t("metaTitle"),
    description: t("description"),
  };
}

export default function BrandPage() {
  return (
    <>
      <Header />
      <div className="container py-8">
        <BrandKit />
      </div>
      <Footer />
    </>
  );
}
