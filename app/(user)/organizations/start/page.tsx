import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { generatePageMetadata } from "@/lib/seo";

import { StartOrganization } from "./_components/StartOrganization";

/**
 * app/(user)/organizations/start/page.tsx - anyone starts an organization (open organizations, owner 16 Nov 2026,
 * AFC inbox #582 #583; approved mockup mockups/organizer-dashboard/, "anyone starts an organization").
 *
 * Server Component: the localized title and description (indexable, listed in app/sitemap.ts). The page itself is
 * StartOrganization (client): a landing a stranger can read (R25: public by default), the button inside NeedsAccount
 * (R26), then two steps and a done screen. It posts to AFC-B organizers/start/ through lib/organizers.ts and lands the
 * new owner on the organizer dashboard. Strings: orgStart (en/fr/pt, hand-written).
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("orgStart");
  return generatePageMetadata({
    title: t("metaTitle"),
    description: t("metaDescription"),
    keywords: ["host a Free Fire tournament", "create a Free Fire organization", "AFC organizer", "Free Fire scrims"],
    url: "/organizations/start",
  });
}

export default function StartOrganizationPage() {
  return <StartOrganization />;
}
