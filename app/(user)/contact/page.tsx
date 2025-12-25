import { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ContactForm } from "../_components/ContactForm";
import {
  IconBrandFacebook,
  IconBrandTiktok,
  IconBrandTwitter,
  IconBrandYoutube,
} from "@tabler/icons-react";
import { generatePageMetadata } from "@/lib/seo";
import { PageHeader } from "@/components/PageHeader";

export const metadata: Metadata = generatePageMetadata({
  title: "Contact Us",
  description:
    "Get in touch with the African Freefire Community (AFC). Contact us via email, Discord, or social media for inquiries, partnerships, or support.",
  keywords: [
    "contact AFC",
    "Free Fire African contact",
    "AFC support",
    "esports inquiry Africa",
  ],
  url: "/contact",
});

export default function ContactPage() {
  return (
    <div>
      <PageHeader title="Contact Us" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-2">
        <div className="col-span-4">
          <ContactForm />
        </div>
        <div className="col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="text-muted-foreground text-sm">Email</h3>
                  <a
                    className="hover:underline hover:text-primary text-base"
                    href={`mailto:info@africanfreefirecommunity.com`}
                  >
                    info@africanfreefirecommunity.com
                  </a>
                </div>
                <div>
                  <h3 className="text-muted-foreground text-sm">Discord</h3>
                  <p>
                    Join our Discord server:{" "}
                    <a
                      href="https://discord.gg/african-freefire-community-afc-920726990607237160
"
                      className="text-primary hover:underline"
                    >
                      AFC
                    </a>
                  </p>
                </div>
                <div>
                  <h3 className="text-muted-foreground text-sm">
                    Social Media
                  </h3>
                  <ul className="text-base mt-1 space-y-1">
                    <li>
                      <a
                        href="https://twitter.com/afcdatabase"
                        className="text-primary hover:underline"
                      >
                        <IconBrandTwitter className="size-4 inline-block mr-1" />
                        Twitter
                      </a>
                    </li>
                    <li>
                      <a
                        href="https://www.tiktok.com/@africanfreefirecommunity?_t=ZS-8zkdR9UFB9m&_r=1"
                        className="text-primary hover:underline"
                      >
                        <IconBrandTiktok className="size-4 inline-block mr-1" />
                        Tiktok
                      </a>
                    </li>
                    <li>
                      <a
                        href="https://www.facebook.com/share/1G4D9jDyyt/"
                        className="text-primary hover:underline"
                      >
                        <IconBrandFacebook className="size-4 inline-block mr-1" />
                        Facebook
                      </a>
                    </li>
                    <li>
                      <a
                        href="https://www.instagram.com/africanfreefirecommunity?igsh=MXV0dHU2NXlmNXRhMg=="
                        className="text-primary hover:underline"
                      >
                        <IconBrandFacebook className="size-4 inline-block mr-1" />
                        Instagram
                      </a>
                    </li>
                    <li>
                      <a
                        href="https://www.youtube.com/@AFRICANFREEFIRECOMMUNITY1"
                        className="text-primary hover:underline"
                      >
                        <IconBrandYoutube className="size-4 inline-block mr-1" />
                        Youtube
                      </a>
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
