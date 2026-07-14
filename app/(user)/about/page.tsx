import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { generatePageMetadata } from "@/lib/seo";
import { PageHeader } from "@/components/PageHeader";

export const metadata: Metadata = generatePageMetadata({
  title: "About Us",
  description:
    "Learn about the African Free Fire Community (AFC) - our mission to foster competitive esports, develop talent, and create opportunities for Free Fire players across Africa.",
  keywords: [
    "about AFC",
    "African esports organization",
    "Free Fire African mission",
    "esports community Africa",
  ],
  url: "/about",
});

// Async Server Component: page copy is localized via getTranslations("aboutPage")
// (keys in messages/en/aboutPage.json, machine-translated to fr/pt). The metadata
// export above is left as canonical English on purpose (SEO title/description),
// matching the privacy-policy page convention.
export default async function AboutPage() {
  const t = await getTranslations("aboutPage");
  return (
    <div>
      <PageHeader title={t("pageTitle")} />
      <div className="space-y-4">
        <Card className="gap-1.5">
          <CardHeader>
            <CardTitle>{t("missionTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm md:text-base text-muted-foreground">
            <p>{t("mission")}</p>
          </CardContent>
        </Card>

        <Card className="gap-1.5">
          <CardHeader>
            <CardTitle>{t("visionTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm md:text-base text-muted-foreground">
            <p>{t("vision")}</p>
          </CardContent>
        </Card>

        {/* What the platform does + how Google sign-in uses data (owner 2026-06-20).
            This page is the homepage URL set on the Google OAuth consent screen, so it
            must state the app's purpose AND what Google user data is used and why. */}
        <Card className="gap-1.5">
          <CardHeader>
            <CardTitle>{t("hubTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm md:text-base text-muted-foreground">
            <p>{t("hub")}</p>
          </CardContent>
        </Card>

        <Card className="gap-1.5">
          <CardHeader>
            <CardTitle>{t("googleTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm md:text-base text-muted-foreground">
            <p>
              {t.rich("googleSignin", {
                // Inline <privacy> tag in the translation wraps the Privacy Policy link.
                privacy: (chunks) => (
                  <a
                    href="/privacy-policy"
                    className="text-primary hover:underline"
                  >
                    {chunks}
                  </a>
                ),
              })}
            </p>
          </CardContent>
        </Card>

        <Card className="gap-1.5">
          <CardHeader>
            <CardTitle>{t("valuesTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm md:text-base text-muted-foreground">
            <ul className="list-disc pl-5 space-y-1">
              <li>{t("valueIntegrity")}</li>
              <li>{t("valueCommunity")}</li>
              <li>{t("valueExcellence")}</li>
              <li>{t("valueInnovation")}</li>
              <li>{t("valueEmpowerment")}</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
