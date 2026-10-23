"use client";

// app/(a)/a/email-news/new/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// "New email": makes an empty draft on the server (POST mail/campaigns/) and opens it in the composer,
// so everything written from the first word is saved to that draft. Head admins only (nav entry and
// the API both). A refusal stays on this page with the reason and a way back.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { errorCode, mailAdmin } from "@/lib/mailApi";

export default function NewEmailPage() {
  const t = useTranslations("emailNews");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    // Strict mode runs effects twice in development; one draft per visit.
    if (started.current) return;
    started.current = true;
    mailAdmin
      .create({})
      .then((c) => router.replace(`/a/email-news/${c.token}`))
      .catch((err) => setError(errorCode(err)));
  }, [router]);

  return (
    <div className="py-12 text-center">
      {error ? (
        <>
          <p className="text-sm text-muted-foreground">{t.has(`errors.${error}`) ? t(`errors.${error}`) : t("errors.error")}</p>
          <Button asChild className="mt-3" variant="secondary">
            <Link href="/a/email-news">{t("backToList")}</Link>
          </Button>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{t("opening")}</p>
      )}
    </div>
  );
}
