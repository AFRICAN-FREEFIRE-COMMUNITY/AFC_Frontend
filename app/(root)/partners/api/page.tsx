import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { Header } from "@/app/(user)/_components/Header";
import { Footer } from "@/app/_components/Footer";
import { PartnerApiGuide } from "@/components/partner-api-guide/PartnerApiGuide";

/**
 * app/(root)/partners/api/page.tsx - the public AFC Partner Data API integration guide.
 *
 * WHY IT IS HERE AND NOT BEHIND A LOGIN: the people reading it are engineers at a partner
 * organisation who have an API key but no AFC account, and never will - a partner key is a
 * server credential, not a user session. Requiring a login to read the docs for a credential
 * that has nothing to do with logins would lock out exactly the audience this is for. Same
 * reasoning, and the same (root) group, as ./apply next door.
 *
 * WHY (root) AND NOT (user): (root) is AFC's set of pages a stranger can land on with no
 * session (privacy policy, terms, rules, invite, partner apply). This is one of those, and it
 * renders the same Header + Footer chrome so it does not read as a bolted-on doc site.
 *
 * NOTHING HERE CALLS THE PARTNER API. The page shows curl and sample responses; a partner
 * runs them from their own infrastructure. Typing a partner key into a web page would put a
 * server secret in a browser, which is the one thing the guide itself tells them not to do.
 *
 * Content: components/partner-api-guide/PartnerApiGuide.tsx (structure from
 * lib/partner-api-guide-data.ts, copy from the partnerApiGuide i18n namespace). The API it
 * documents is backend/afc_partner_api. Its markdown twin, the version AFC emails, is
 * backend/PARTNER_API.md: change both together.
 */

export async function generateMetadata(): Promise<Metadata> {
  // Title and description come from the same namespace as the page body, so the tab title
  // and any link preview are localized along with everything else.
  const t = await getTranslations("partnerApiGuide");
  return {
    title: t("metaTitle"),
    description: t("description"),
  };
}

export default function PartnerApiGuidePage() {
  return (
    <>
      <Header />
      <div className="container py-8">
        <PartnerApiGuide />
      </div>
      <Footer />
    </>
  );
}
