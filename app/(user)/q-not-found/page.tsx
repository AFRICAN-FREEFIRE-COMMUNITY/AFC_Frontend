// app/(user)/q-not-found/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Where a QR code lands when its page is gone (inbox #46): an unknown token, or an event, team,
// player or article that was deleted or unpublished after the poster was printed. Reached only by
// the redirect in app/q/[token]/route.ts. Never indexed.
// ─────────────────────────────────────────────────────────────────────────────
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { privatePageMetadata } from "@/lib/seo";

export async function generateMetadata() {
  const t = await getTranslations("qr");
  return privatePageMetadata(t("notFoundTitle"));
}

export default async function QrNotFoundPage() {
  const t = await getTranslations("qr");
  return (
    <div className="container py-10">
      <PageHeader title={t("notFoundTitle")} />
      <p className="mt-2 max-w-xl text-muted-foreground">{t("notFoundBody")}</p>
      <Button className="mt-6" asChild>
        <Link href="/">{t("backHome")}</Link>
      </Button>
    </div>
  );
}
