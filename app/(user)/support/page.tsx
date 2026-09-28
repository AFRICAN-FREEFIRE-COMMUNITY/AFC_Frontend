import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import {
  IconBrandFacebook,
  IconBrandInstagram,
  IconBrandTiktok,
  IconBrandTwitter,
  IconBrandYoutube,
} from "@tabler/icons-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NewBadge } from "@/components/NewBadge";
import { PageHeader } from "@/components/PageHeader";
import { SupportWorkspace } from "@/components/support/SupportWorkspace";
import { SUPPORT_CARD, SUPPORT_LIVE_SINCE } from "@/components/support/styles";
import { generatePageMetadata } from "@/lib/seo";

/**
 * app/(user)/support/page.tsx - the Support page (inbox #71, owner 2026-09-28).
 *
 * THE support page: the contact form for anybody (no account needed, someone locked out or deleted
 * must still reach AFC), and, signed in, "My tickets": every ticket linked to the account or sent from
 * its email, each opening its own page at /support/t/<token>. /contact redirects here
 * (app/(user)/contact/page.tsx), so the ~10 older links and every email keep working.
 *
 * Server Component: the title, the SEO metadata (indexable, in app/sitemap.ts) and the contact
 * information card. Everything that depends on the session lives in SupportWorkspace (client).
 * Data: GET support/mine/ and POST support/contact/ (afc_support), through lib/api/support.ts.
 * Strings: supportPage (new) and contactPage (the information card), hand-written en/fr/pt.
 * Design: mockups/support-page (approved 2026-09-28): filled surfaces, no outlines.
 */

export const metadata: Metadata = generatePageMetadata({
  title: "Support",
  description:
    "Contact the African Free Fire Community (AFC) and follow your support tickets: every message you send and every reply, in one place.",
  keywords: ["AFC support", "contact AFC", "Free Fire African support", "AFC help"],
  url: "/support",
});

const DISCORD_INVITE = "https://discord.gg/african-freefire-community-afc-920726990607237160";

export default async function SupportPage() {
  const t = await getTranslations("supportPage");
  const c = await getTranslations("contactPage");

  const socials = [
    { href: "https://twitter.com/afcdatabase", label: "Twitter", Icon: IconBrandTwitter },
    { href: "https://www.tiktok.com/@africanfreefirecommunity?_t=ZS-8zkdR9UFB9m&_r=1", label: "Tiktok", Icon: IconBrandTiktok },
    { href: "https://www.facebook.com/share/1G4D9jDyyt/", label: "Facebook", Icon: IconBrandFacebook },
    { href: "https://www.instagram.com/africanfreefirecommunity?igsh=MXV0dHU2NXlmNXRhMg==", label: "Instagram", Icon: IconBrandInstagram },
    { href: "https://www.youtube.com/@AFRICANFREEFIRECOMMUNITY1", label: "Youtube", Icon: IconBrandYoutube },
  ];

  // Moved from the old Contact page; brand names are not translated.
  const aside = (
    <Card className={SUPPORT_CARD}>
      <CardHeader>
        <CardTitle>{c("contactInformation")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <h3 className="text-sm text-muted-foreground">{c("email")}</h3>
            <a className="text-base hover:text-primary hover:underline" href="mailto:info@africanfreefirecommunity.com">
              info@africanfreefirecommunity.com
            </a>
          </div>
          <div>
            <h3 className="text-sm text-muted-foreground">Discord</h3>
            <p>
              {c("discordJoin")}{" "}
              <a href={DISCORD_INVITE} className="text-primary hover:underline">AFC</a>
            </p>
          </div>
          <div>
            <h3 className="text-sm text-muted-foreground">{c("socialMedia")}</h3>
            <ul className="mt-1 space-y-1 text-base">
              {socials.map(({ href, label, Icon }) => (
                <li key={label}>
                  <a href={href} className="text-primary hover:underline">
                    <Icon className="mr-1 inline-block size-4" aria-hidden />
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div>
      <PageHeader
        title={<span className="inline-flex items-center gap-2">{t("title")}<NewBadge since={SUPPORT_LIVE_SINCE} /></span>}
        description={t("lead")}
      />
      <SupportWorkspace aside={aside} />
    </div>
  );
}
